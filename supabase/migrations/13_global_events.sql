-- Migration 13_global_events.sql

CREATE TYPE public.event_type AS ENUM (
  'SURVIVAL_CHALLENGE',
  'SIGIL_TRIAL',
  'BLOOD_PRICE'
);

CREATE TYPE public.event_status AS ENUM (
  'UPCOMING',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED'
);

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL UNIQUE,
  description text NOT NULL,
  type public.event_type NOT NULL,
  status public.event_status NOT NULL DEFAULT 'UPCOMING',
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  reward_points integer NOT NULL CHECK (reward_points >= 0),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CHECK (end_time > start_time)
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view events" ON public.events FOR SELECT TO public USING (true);

CREATE TABLE public.event_participants (
  event_id uuid NOT NULL REFERENCES public.events(id),
  player_id uuid NOT NULL REFERENCES public.players(id),
  score integer NOT NULL DEFAULT 0,
  reward_claimed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (event_id, player_id)
);

ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view participants" ON public.event_participants FOR SELECT TO public USING (true);

CREATE TABLE public.event_battles (
  event_id uuid NOT NULL REFERENCES public.events(id),
  battle_id uuid NOT NULL REFERENCES public.battles(id),
  player_id uuid NOT NULL REFERENCES public.players(id),
  score_awarded integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (event_id, battle_id, player_id)
);

ALTER TABLE public.event_battles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view event battles" ON public.event_battles FOR SELECT TO public USING (true);


-- RPC to register for an event
CREATE OR REPLACE FUNCTION public.register_for_event(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player public.players%ROWTYPE;
  v_event public.events%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  
  SELECT * INTO v_player FROM public.players WHERE id = v_uid FOR UPDATE;
  IF v_player.id IS NULL THEN RAISE EXCEPTION 'Player not found'; END IF;
  IF v_player.status IN ('ELIMINATED', 'FINAL_SALVATION') THEN
    RAISE EXCEPTION 'Eliminated and Final Salvation players cannot register for events';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF v_event.id IS NULL THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_event.status NOT IN ('UPCOMING', 'ACTIVE') THEN
    RAISE EXCEPTION 'Event is not open for registration';
  END IF;
  IF now() > v_event.end_time THEN
    RAISE EXCEPTION 'Event has already ended';
  END IF;

  INSERT INTO public.event_participants (event_id, player_id)
  VALUES (p_event_id, v_uid);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Already registered for this event';
END;
$$;


-- RPC to submit a battle to an event
CREATE OR REPLACE FUNCTION public.submit_battle_to_event(p_event_id uuid, p_battle_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player public.players%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_battle public.battles%ROWTYPE;
  v_score_to_add integer := 0;
  v_used_sigil boolean := false;
  v_stolen_points integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_player FROM public.players WHERE id = v_uid;
  IF v_player.status IN ('ELIMINATED', 'FINAL_SALVATION') THEN
    RAISE EXCEPTION 'You are no longer eligible to participate in events';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF v_event.id IS NULL THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_event.status != 'ACTIVE' THEN RAISE EXCEPTION 'Event is not active'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.event_participants WHERE event_id = p_event_id AND player_id = v_uid) THEN
    RAISE EXCEPTION 'You are not registered for this event';
  END IF;

  SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;
  IF v_battle.id IS NULL THEN RAISE EXCEPTION 'Battle not found'; END IF;
  IF v_battle.status != 'COMPLETED' THEN RAISE EXCEPTION 'Battle is not completed'; END IF;
  IF v_battle.updated_at < v_event.start_time OR v_battle.updated_at > v_event.end_time THEN
    RAISE EXCEPTION 'Battle did not occur during the event window';
  END IF;
  IF v_battle.player1_id != v_uid AND v_battle.player2_id != v_uid THEN
    RAISE EXCEPTION 'You did not participate in this battle';
  END IF;

  -- Lock participant row
  PERFORM 1 FROM public.event_participants WHERE event_id = p_event_id AND player_id = v_uid FOR UPDATE;

  -- Calculate score based on event type
  IF v_event.type = 'SURVIVAL_CHALLENGE' THEN
    IF v_battle.winner_id = v_uid THEN
      v_score_to_add := 1;
    ELSE
      RAISE EXCEPTION 'Only victories count for Survival Challenge';
    END IF;

  ELSIF v_event.type = 'SIGIL_TRIAL' THEN
    IF v_battle.winner_id != v_uid THEN
      RAISE EXCEPTION 'Only victories count for Sigil Trial';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.battle_logs 
      WHERE battle_id = p_battle_id AND actor_id = v_uid AND action_type = 'SIGIL_ABILITY'
    ) INTO v_used_sigil;
    
    IF v_used_sigil THEN
      v_score_to_add := 1;
    ELSE
      RAISE EXCEPTION 'You must use a Sigil ability to qualify for Sigil Trial';
    END IF;

  ELSIF v_event.type = 'BLOOD_PRICE' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_stolen_points 
    FROM public.points_ledger 
    WHERE player_id = v_uid AND reference_key = (p_battle_id || '-theft-credit');

    IF v_stolen_points > 0 THEN
      v_score_to_add := v_stolen_points;
    ELSE
      RAISE EXCEPTION 'No points were stolen in this battle, or you did not win';
    END IF;
  END IF;

  IF v_score_to_add <= 0 THEN
    RAISE EXCEPTION 'Battle did not generate any score for this event';
  END IF;

  -- Insert into event_battles (will fail if already submitted)
  BEGIN
    INSERT INTO public.event_battles (event_id, battle_id, player_id, score_awarded)
    VALUES (p_event_id, p_battle_id, v_uid, v_score_to_add);
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Battle already submitted to this event';
  END;

  UPDATE public.event_participants 
  SET score = score + v_score_to_add, updated_at = now()
  WHERE event_id = p_event_id AND player_id = v_uid;

  RETURN v_score_to_add;
END;
$$;


-- RPC to claim event reward
CREATE OR REPLACE FUNCTION public.claim_event_reward(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_event public.events%ROWTYPE;
  v_participant public.event_participants%ROWTYPE;
  v_player public.players%ROWTYPE;
  v_is_winner boolean := false;
  v_max_score integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF v_event.id IS NULL THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_event.status != 'COMPLETED' THEN RAISE EXCEPTION 'Event is not completed yet'; END IF;
  IF v_event.reward_points <= 0 THEN RAISE EXCEPTION 'Event has no point rewards'; END IF;

  SELECT * INTO v_participant FROM public.event_participants 
  WHERE event_id = p_event_id AND player_id = v_uid FOR UPDATE;
  
  IF v_participant.player_id IS NULL THEN RAISE EXCEPTION 'Not registered for this event'; END IF;
  IF v_participant.reward_claimed THEN RAISE EXCEPTION 'Reward already claimed'; END IF;

  SELECT * INTO v_player FROM public.players WHERE id = v_uid FOR UPDATE;
  IF v_player.status IN ('ELIMINATED', 'FINAL_SALVATION') THEN
    RAISE EXCEPTION 'Eliminated players cannot claim rewards';
  END IF;

  -- Determine if user is winner (has max score > 0)
  SELECT MAX(score) INTO v_max_score FROM public.event_participants WHERE event_id = p_event_id;
  
  IF v_max_score IS NOT NULL AND v_max_score > 0 AND v_participant.score = v_max_score THEN
    v_is_winner := true;
  END IF;

  IF NOT v_is_winner THEN
    RAISE EXCEPTION 'You did not win this event';
  END IF;

  -- Grant reward
  UPDATE public.players SET points = points + v_event.reward_points WHERE id = v_uid;
  
  INSERT INTO public.points_ledger (player_id, amount, transaction_type, reference_key)
  VALUES (v_uid, v_event.reward_points, 'EVENT_REWARD', 'EVENT_REWARD_' || p_event_id || '_' || v_uid);

  UPDATE public.event_participants SET reward_claimed = true, updated_at = now() 
  WHERE event_id = p_event_id AND player_id = v_uid;

END;
$$;
