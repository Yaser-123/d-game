import os

migration_sql = """
-- Migration: 16_challenge_protocol.sql

CREATE TYPE challenge_type AS ENUM ('CODEBREAKER', 'LOGIC_DUEL', 'BLUFF_DUEL');
CREATE TYPE challenge_status AS ENUM ('PENDING', 'ACCEPTED', 'ACTIVE', 'COMPLETED', 'DECLINED', 'CANCELLED');

CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid REFERENCES public.players(id) NOT NULL,
  challenged_id uuid REFERENCES public.players(id) NOT NULL,
  type challenge_type,
  status challenge_status DEFAULT 'PENDING' NOT NULL,
  
  -- Public state visible to both
  public_state jsonb DEFAULT '{}'::jsonb,
  
  -- Private state visible only to server
  private_state jsonb DEFAULT '{}'::jsonb,
  
  -- Participant private states
  p1_private_state jsonb DEFAULT '{}'::jsonb, 
  p2_private_state jsonb DEFAULT '{}'::jsonb,

  winner_id uuid REFERENCES public.players(id),
  loser_id uuid REFERENCES public.players(id),
  is_draw boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_unique_pending_challenge ON public.challenges (challenger_id, challenged_id) WHERE status = 'PENDING';
CREATE INDEX idx_challenges_challenger ON public.challenges(challenger_id);
CREATE INDEX idx_challenges_challenged ON public.challenges(challenged_id);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view challenges involving them" 
ON public.challenges FOR SELECT 
USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

-- Utility to resolve challenge rewards
CREATE OR REPLACE FUNCTION public.resolve_challenge(p_challenge_id uuid, p_winner_id uuid, p_loser_id uuid, p_is_draw boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_challenge public.challenges%ROWTYPE;
  v_loser_points integer;
  v_loser_status text;
  v_theft_pct double precision;
  v_theft_amount integer;
BEGIN
  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF v_challenge.status = 'COMPLETED' THEN RAISE EXCEPTION 'Challenge already completed'; END IF;

  UPDATE public.challenges SET status = 'COMPLETED', winner_id = p_winner_id, loser_id = p_loser_id, is_draw = p_is_draw, updated_at = now() WHERE id = p_challenge_id;

  IF NOT p_is_draw AND p_winner_id IS NOT NULL AND p_loser_id IS NOT NULL THEN
    SELECT points, status INTO v_loser_points, v_loser_status FROM public.players WHERE id = p_loser_id FOR UPDATE;
    
    v_theft_pct := random();
    v_theft_amount := floor(v_loser_points * v_theft_pct);

    UPDATE public.players SET points = points + 100 + v_theft_amount, status = 'ACTIVE' WHERE id = p_winner_id;
    
    INSERT INTO public.points_ledger (player_id, amount, transaction_type, reference_key)
    VALUES (p_winner_id, 100, 'CHALLENGE_REWARD', p_challenge_id || '-reward');
    
    IF v_theft_amount > 0 THEN
      INSERT INTO public.points_ledger (player_id, amount, transaction_type, reference_key)
      VALUES (p_winner_id, v_theft_amount, 'CHALLENGE_THEFT_CREDIT', p_challenge_id || '-theft-credit');
    END IF;

    UPDATE public.players SET points = points - v_theft_amount WHERE id = p_loser_id;
    
    IF v_theft_amount > 0 THEN
      INSERT INTO public.points_ledger (player_id, amount, transaction_type, reference_key)
      VALUES (p_loser_id, -v_theft_amount, 'CHALLENGE_THEFT_DEBIT', p_challenge_id || '-theft-debit');
    END IF;

    IF (v_loser_points - v_theft_amount) <= 0 THEN
      UPDATE public.players SET status = 'ELIMINATED' WHERE id = p_loser_id;
    ELSIF v_loser_status = 'FINAL_SALVATION' THEN
      UPDATE public.players SET status = 'ELIMINATED' WHERE id = p_loser_id;
    ELSIF (v_loser_points - v_theft_amount) < 100 THEN
      UPDATE public.players SET status = 'FINAL_SALVATION' WHERE id = p_loser_id;
    END IF;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_challenge(p_target_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_my_status text;
  v_my_points integer;
  v_opp_status text;
  v_opp_points integer;
  v_challenge_id uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_uid = p_target_id THEN RAISE EXCEPTION 'Cannot challenge yourself'; END IF;

  SELECT status, points INTO v_my_status, v_my_points FROM public.players WHERE id = v_uid;
  SELECT status, points INTO v_opp_status, v_opp_points FROM public.players WHERE id = p_target_id;

  IF v_opp_status IS NULL THEN RAISE EXCEPTION 'Opponent does not exist'; END IF;
  IF v_my_status = 'ELIMINATED' THEN RAISE EXCEPTION 'You are permanently eliminated'; END IF;
  IF v_opp_status = 'ELIMINATED' THEN RAISE EXCEPTION 'Opponent is permanently eliminated'; END IF;

  IF v_my_status = 'ACTIVE' AND v_my_points < 100 THEN
    RAISE EXCEPTION 'You need at least 100 points to initiate a challenge';
  END IF;
  IF v_opp_status = 'ACTIVE' AND v_opp_points < 100 THEN
    RAISE EXCEPTION 'Opponent needs at least 100 points to participate in a challenge';
  END IF;

  IF EXISTS (SELECT 1 FROM public.challenges WHERE challenger_id = v_uid AND challenged_id = p_target_id AND status = 'PENDING') THEN
    RAISE EXCEPTION 'You already have a pending challenge to this player';
  END IF;
  
  IF EXISTS (SELECT 1 FROM public.challenges WHERE status = 'ACTIVE' AND (challenger_id = v_uid OR challenged_id = v_uid)) THEN
    RAISE EXCEPTION 'You are already in an active challenge';
  END IF;

  INSERT INTO public.challenges (challenger_id, challenged_id)
  VALUES (v_uid, p_target_id)
  RETURNING id INTO v_challenge_id;

  RETURN v_challenge_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_challenge(p_challenge_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_challenge public.challenges%ROWTYPE;
  v_opp_status text;
  v_opp_points integer;
  v_my_status text;
  v_my_points integer;
  v_rand float;
  v_type challenge_type;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF v_challenge.id IS NULL THEN RAISE EXCEPTION 'Challenge not found'; END IF;
  IF v_challenge.challenged_id != v_uid THEN RAISE EXCEPTION 'Not authorized to accept this challenge'; END IF;
  IF v_challenge.status != 'PENDING' THEN RAISE EXCEPTION 'Challenge is not pending'; END IF;

  SELECT status, points INTO v_my_status, v_my_points FROM public.players WHERE id = v_uid;
  SELECT status, points INTO v_opp_status, v_opp_points FROM public.players WHERE id = v_challenge.challenger_id;
  
  IF v_my_status = 'ELIMINATED' THEN RAISE EXCEPTION 'You are permanently eliminated'; END IF;
  IF v_opp_status = 'ELIMINATED' THEN RAISE EXCEPTION 'Challenger is permanently eliminated'; END IF;
  
  IF v_my_status = 'ACTIVE' AND v_my_points < 100 THEN
    RAISE EXCEPTION 'You need at least 100 points to participate in a challenge';
  END IF;
  IF v_opp_status = 'ACTIVE' AND v_opp_points < 100 THEN
    RAISE EXCEPTION 'Challenger needs at least 100 points to participate in a challenge';
  END IF;
  
  -- Ensure neither player is already in an ACTIVE challenge
  IF EXISTS (SELECT 1 FROM public.challenges WHERE status = 'ACTIVE' AND (challenger_id IN (v_uid, v_challenge.challenger_id) OR challenged_id IN (v_uid, v_challenge.challenger_id))) THEN
    RAISE EXCEPTION 'One or both players are already in an active challenge';
  END IF;

  -- Randomly assign mini-game
  v_rand := random();
  IF v_rand < 0.33 THEN
    v_type := 'CODEBREAKER';
  ELSIF v_rand < 0.66 THEN
    v_type := 'LOGIC_DUEL';
  ELSE
    v_type := 'BLUFF_DUEL';
  END IF;

  UPDATE public.challenges SET status = 'ACTIVE', type = v_type, updated_at = now() WHERE id = p_challenge_id;
  
  -- Initialize game state
  IF v_type = 'CODEBREAKER' THEN
    -- Generate secret code
    UPDATE public.challenges SET 
      private_state = jsonb_build_object(
        'secret', floor(random() * 9000 + 1000)::text,
        'guesser_id', CASE WHEN random() > 0.5 THEN challenger_id ELSE challenged_id END
      ),
      public_state = jsonb_build_object(
        'guesses', '[]'::jsonb,
        'attempts_left', 8
      )
    WHERE id = p_challenge_id;
  ELSIF v_type = 'LOGIC_DUEL' THEN
    UPDATE public.challenges SET 
      private_state = jsonb_build_object('answer', 'A'),
      public_state = jsonb_build_object(
        'puzzle', 'What has keys but cannot open locks?',
        'options', '["A. Piano", "B. Map", "C. Treasurer"]'::jsonb,
        'p1_submitted', false,
        'p2_submitted', false
      )
    WHERE id = p_challenge_id;
  ELSIF v_type = 'BLUFF_DUEL' THEN
    UPDATE public.challenges SET 
      public_state = jsonb_build_object(
        'p1_submitted', false,
        'p2_submitted', false
      )
    WHERE id = p_challenge_id;
  END IF;

  RETURN p_challenge_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decline_challenge(p_challenge_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_challenge public.challenges%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF v_challenge.id IS NULL THEN RAISE EXCEPTION 'Challenge not found'; END IF;
  IF v_challenge.challenged_id != v_uid THEN RAISE EXCEPTION 'Not authorized to decline this challenge'; END IF;
  IF v_challenge.status != 'PENDING' THEN RAISE EXCEPTION 'Challenge is not pending'; END IF;

  UPDATE public.challenges SET status = 'DECLINED', updated_at = now() WHERE id = p_challenge_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_challenge(p_challenge_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_challenge public.challenges%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF v_challenge.id IS NULL THEN RAISE EXCEPTION 'Challenge not found'; END IF;
  IF v_challenge.challenger_id != v_uid THEN RAISE EXCEPTION 'Not authorized to cancel this challenge'; END IF;
  IF v_challenge.status != 'PENDING' THEN RAISE EXCEPTION 'Challenge is not pending'; END IF;

  UPDATE public.challenges SET status = 'CANCELLED', updated_at = now() WHERE id = p_challenge_id;
END;
$function$;
"""

with open("supabase/migrations/16_challenge_protocol.sql", "w") as f:
    f.write(migration_sql)
