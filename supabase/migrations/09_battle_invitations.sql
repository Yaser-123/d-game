-- Migration: 09_battle_invitations.sql

CREATE TABLE public.battle_invitations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    challenger_id uuid NOT NULL REFERENCES public.players(id),
    target_id uuid NOT NULL REFERENCES public.players(id),
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX idx_unique_pending_invite ON public.battle_invitations (challenger_id, target_id) WHERE status = 'PENDING';
CREATE INDEX idx_battle_invitations_challenger ON public.battle_invitations(challenger_id);
CREATE INDEX idx_battle_invitations_target ON public.battle_invitations(target_id);

ALTER TABLE public.battle_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invitations involving them" 
ON public.battle_invitations FOR SELECT 
USING (auth.uid() = challenger_id OR auth.uid() = target_id);

CREATE OR REPLACE FUNCTION public.create_invitation(p_target_id uuid)
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
  v_invite_id uuid;
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
    RAISE EXCEPTION 'You need at least 100 points to initiate a normal battle';
  END IF;
  IF v_opp_status = 'ACTIVE' AND v_opp_points < 100 THEN
    RAISE EXCEPTION 'Opponent needs at least 100 points to participate in a normal battle';
  END IF;

  IF EXISTS (SELECT 1 FROM public.battle_invitations WHERE challenger_id = v_uid AND target_id = p_target_id AND status = 'PENDING') THEN
    RAISE EXCEPTION 'You already have a pending invitation to this player';
  END IF;
  
  IF EXISTS (SELECT 1 FROM public.battles WHERE status = 'ACTIVE' AND (player1_id = v_uid OR player2_id = v_uid)) THEN
    RAISE EXCEPTION 'You are already in an active battle';
  END IF;

  INSERT INTO public.battle_invitations (challenger_id, target_id)
  VALUES (v_uid, p_target_id)
  RETURNING id INTO v_invite_id;

  RETURN v_invite_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_invitation(p_invite_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_invite public.battle_invitations%ROWTYPE;
  v_battle_id uuid;
  v_opp_status text;
  v_opp_points integer;
  v_my_status text;
  v_my_points integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_invite FROM public.battle_invitations WHERE id = p_invite_id FOR UPDATE;
  IF v_invite.id IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF v_invite.target_id != v_uid THEN RAISE EXCEPTION 'Not authorized to accept this invitation'; END IF;
  IF v_invite.status != 'PENDING' THEN RAISE EXCEPTION 'Invitation is not pending'; END IF;

  -- Re-verify eligibility since time may have passed
  SELECT status, points INTO v_my_status, v_my_points FROM public.players WHERE id = v_uid;
  SELECT status, points INTO v_opp_status, v_opp_points FROM public.players WHERE id = v_invite.challenger_id;
  
  IF v_my_status = 'ELIMINATED' THEN RAISE EXCEPTION 'You are permanently eliminated'; END IF;
  IF v_opp_status = 'ELIMINATED' THEN RAISE EXCEPTION 'Challenger is permanently eliminated'; END IF;
  
  IF v_my_status = 'ACTIVE' AND v_my_points < 100 THEN
    RAISE EXCEPTION 'You need at least 100 points to participate in a normal battle';
  END IF;
  IF v_opp_status = 'ACTIVE' AND v_opp_points < 100 THEN
    RAISE EXCEPTION 'Challenger needs at least 100 points to participate in a normal battle';
  END IF;
  
  -- Create battle using the challenger as player1 so they get first turn
  -- Wait, start_battle uses auth.uid() as player1. 
  -- If we call it directly, v_uid (target) becomes player1. Let's just create it here directly to have challenger as player1.
  -- The prompt says "Reuse the existing start_battle RPC and battle tables wherever possible."
  
  -- If I call start_battle(v_invite.challenger_id), target is player 1, challenger is player 2. This is perfectly fine.
  v_battle_id := public.start_battle(v_invite.challenger_id);
  
  UPDATE public.battle_invitations SET status = 'ACCEPTED', updated_at = now() WHERE id = p_invite_id;
  
  -- Cancel other pending invitations involving these two players (optional, but good)
  -- Enforce one active battle at a time is handled by start_battle which will fail if either is in an active battle!
  
  RETURN v_battle_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decline_invitation(p_invite_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_invite public.battle_invitations%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_invite FROM public.battle_invitations WHERE id = p_invite_id FOR UPDATE;
  IF v_invite.id IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF v_invite.target_id != v_uid THEN RAISE EXCEPTION 'Not authorized to decline this invitation'; END IF;
  IF v_invite.status != 'PENDING' THEN RAISE EXCEPTION 'Invitation is not pending'; END IF;

  UPDATE public.battle_invitations SET status = 'DECLINED', updated_at = now() WHERE id = p_invite_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_invitation(p_invite_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_invite public.battle_invitations%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_invite FROM public.battle_invitations WHERE id = p_invite_id FOR UPDATE;
  IF v_invite.id IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF v_invite.challenger_id != v_uid THEN RAISE EXCEPTION 'Not authorized to cancel this invitation'; END IF;
  IF v_invite.status != 'PENDING' THEN RAISE EXCEPTION 'Invitation is not pending'; END IF;

  UPDATE public.battle_invitations SET status = 'CANCELLED', updated_at = now() WHERE id = p_invite_id;
END;
$function$;

-- Update start_battle to enforce opponent points requirement if they are ACTIVE
CREATE OR REPLACE FUNCTION public.start_battle(p_opponent_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_battle_id uuid;
  v_uid uuid;
  v_my_status text;
  v_my_points integer;
  v_opp_status text;
  v_opp_points integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_uid = p_opponent_id THEN RAISE EXCEPTION 'Cannot battle yourself'; END IF;

  SELECT status, points INTO v_my_status, v_my_points FROM public.players WHERE id = v_uid;
  SELECT status, points INTO v_opp_status, v_opp_points FROM public.players WHERE id = p_opponent_id;

  IF v_opp_status IS NULL THEN RAISE EXCEPTION 'Opponent does not exist'; END IF;

  IF v_my_status = 'ELIMINATED' THEN RAISE EXCEPTION 'You are permanently eliminated'; END IF;
  IF v_opp_status = 'ELIMINATED' THEN RAISE EXCEPTION 'Opponent is permanently eliminated'; END IF;

  IF v_my_status = 'ACTIVE' AND v_my_points < 100 THEN
    RAISE EXCEPTION 'You need at least 100 points to initiate a normal battle';
  END IF;
  
  IF v_opp_status = 'ACTIVE' AND v_opp_points < 100 THEN
    RAISE EXCEPTION 'Opponent needs at least 100 points to participate in a normal battle';
  END IF;

  -- Ensure neither player is already in an ACTIVE battle
  IF EXISTS (SELECT 1 FROM public.battles WHERE status = 'ACTIVE' AND (player1_id IN (v_uid, p_opponent_id) OR player2_id IN (v_uid, p_opponent_id))) THEN
    RAISE EXCEPTION 'One or both players are already in an active battle';
  END IF;

  INSERT INTO public.battles (player1_id, player2_id, current_turn_player_id)
  VALUES (v_uid, p_opponent_id, v_uid)
  RETURNING id INTO v_battle_id;

  RETURN v_battle_id;
END;
$function$;
