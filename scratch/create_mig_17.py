import os

migration_sql = """
-- Migration: 17_challenge_logic.sql

CREATE OR REPLACE FUNCTION public.submit_codebreaker_guess(p_challenge_id uuid, p_guess text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_challenge public.challenges%ROWTYPE;
  v_secret text;
  v_guesser_id uuid;
  v_setter_id uuid;
  v_exact integer := 0;
  v_partial integer := 0;
  v_i integer;
  v_j integer;
  v_s_char text;
  v_g_char text;
  v_secret_used boolean[] := array[false, false, false, false];
  v_guess_used boolean[] := array[false, false, false, false];
  v_attempts_left integer;
  v_guesses jsonb;
  v_guess_record jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF v_challenge.id IS NULL THEN RAISE EXCEPTION 'Challenge not found'; END IF;
  IF v_challenge.status != 'ACTIVE' THEN RAISE EXCEPTION 'Challenge is not active'; END IF;
  IF v_challenge.type != 'CODEBREAKER' THEN RAISE EXCEPTION 'Invalid challenge type'; END IF;

  v_guesser_id := (v_challenge.private_state->>'guesser_id')::uuid;
  v_secret := v_challenge.private_state->>'secret';
  
  IF v_guesser_id = v_challenge.challenger_id THEN
    v_setter_id := v_challenge.challenged_id;
  ELSE
    v_setter_id := v_challenge.challenger_id;
  END IF;

  IF v_uid != v_guesser_id THEN RAISE EXCEPTION 'You are not the guesser'; END IF;

  IF length(p_guess) != 4 THEN RAISE EXCEPTION 'Guess must be 4 characters'; END IF;

  -- Calculate exact matches
  FOR v_i IN 1..4 LOOP
    v_s_char := substring(v_secret from v_i for 1);
    v_g_char := substring(p_guess from v_i for 1);
    IF v_s_char = v_g_char THEN
      v_exact := v_exact + 1;
      v_secret_used[v_i] := true;
      v_guess_used[v_i] := true;
    END IF;
  END LOOP;

  -- Calculate partial matches
  FOR v_i IN 1..4 LOOP
    IF NOT v_guess_used[v_i] THEN
      v_g_char := substring(p_guess from v_i for 1);
      FOR v_j IN 1..4 LOOP
        IF NOT v_secret_used[v_j] THEN
          v_s_char := substring(v_secret from v_j for 1);
          IF v_s_char = v_g_char THEN
            v_partial := v_partial + 1;
            v_secret_used[v_j] := true;
            v_guess_used[v_i] := true;
            EXIT;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  v_attempts_left := (v_challenge.public_state->>'attempts_left')::integer - 1;
  
  v_guess_record := jsonb_build_object(
    'guess', p_guess,
    'exact', v_exact,
    'partial', v_partial
  );
  
  v_guesses := (v_challenge.public_state->>'guesses')::jsonb;
  v_guesses := v_guesses || v_guess_record;
  
  UPDATE public.challenges SET
    public_state = jsonb_build_object(
      'guesses', v_guesses,
      'attempts_left', v_attempts_left
    )
  WHERE id = p_challenge_id;

  IF v_exact = 4 THEN
    PERFORM public.resolve_challenge(p_challenge_id, v_guesser_id, v_setter_id, false);
  ELSIF v_attempts_left <= 0 THEN
    PERFORM public.resolve_challenge(p_challenge_id, v_setter_id, v_guesser_id, false);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_logic_answer(p_challenge_id uuid, p_answer text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_challenge public.challenges%ROWTYPE;
  v_secret_answer text;
  v_opp_id uuid;
  v_my_submitted boolean;
  v_opp_submitted boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF v_challenge.id IS NULL THEN RAISE EXCEPTION 'Challenge not found'; END IF;
  IF v_challenge.status != 'ACTIVE' THEN RAISE EXCEPTION 'Challenge is not active'; END IF;
  IF v_challenge.type != 'LOGIC_DUEL' THEN RAISE EXCEPTION 'Invalid challenge type'; END IF;

  IF v_uid = v_challenge.challenger_id THEN
    v_opp_id := v_challenge.challenged_id;
    v_my_submitted := (v_challenge.public_state->>'p1_submitted')::boolean;
    v_opp_submitted := (v_challenge.public_state->>'p2_submitted')::boolean;
  ELSIF v_uid = v_challenge.challenged_id THEN
    v_opp_id := v_challenge.challenger_id;
    v_my_submitted := (v_challenge.public_state->>'p2_submitted')::boolean;
    v_opp_submitted := (v_challenge.public_state->>'p1_submitted')::boolean;
  ELSE
    RAISE EXCEPTION 'Not a participant';
  END IF;

  IF v_my_submitted THEN RAISE EXCEPTION 'You already submitted an answer'; END IF;

  v_secret_answer := v_challenge.private_state->>'answer';

  -- Record submission
  IF v_uid = v_challenge.challenger_id THEN
    v_challenge.public_state := jsonb_set(v_challenge.public_state, '{p1_submitted}', 'true');
  ELSE
    v_challenge.public_state := jsonb_set(v_challenge.public_state, '{p2_submitted}', 'true');
  END IF;
  
  UPDATE public.challenges SET public_state = v_challenge.public_state WHERE id = p_challenge_id;

  IF p_answer = v_secret_answer THEN
    -- Correct! Winner is v_uid
    PERFORM public.resolve_challenge(p_challenge_id, v_uid, v_opp_id, false);
  ELSE
    -- Incorrect. If opponent also submitted, it's a draw (both failed).
    -- If opponent hasn't submitted yet, opponent just wins automatically because we only give 1 try!
    IF v_opp_submitted THEN
      PERFORM public.resolve_challenge(p_challenge_id, NULL, NULL, true);
    ELSE
      -- Opponent wins by default since we failed
      PERFORM public.resolve_challenge(p_challenge_id, v_opp_id, v_uid, false);
    END IF;
  END IF;
END;
$function$;


CREATE OR REPLACE FUNCTION public.submit_bluff_choice(p_challenge_id uuid, p_choice text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_challenge public.challenges%ROWTYPE;
  v_opp_id uuid;
  v_my_choice text;
  v_opp_choice text;
  v_winner_id uuid;
  v_loser_id uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_choice NOT IN ('TRUST', 'BLUFF', 'CHALLENGE') THEN
    RAISE EXCEPTION 'Invalid choice';
  END IF;

  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF v_challenge.id IS NULL THEN RAISE EXCEPTION 'Challenge not found'; END IF;
  IF v_challenge.status != 'ACTIVE' THEN RAISE EXCEPTION 'Challenge is not active'; END IF;
  IF v_challenge.type != 'BLUFF_DUEL' THEN RAISE EXCEPTION 'Invalid challenge type'; END IF;

  -- Check if already submitted
  IF v_uid = v_challenge.challenger_id THEN
    IF (v_challenge.public_state->>'p1_submitted')::boolean THEN
      RAISE EXCEPTION 'Already submitted';
    END IF;
    UPDATE public.challenges SET 
      p1_private_state = jsonb_build_object('choice', p_choice),
      public_state = jsonb_set(public_state, '{p1_submitted}', 'true')
    WHERE id = p_challenge_id
    RETURNING * INTO v_challenge;
  ELSIF v_uid = v_challenge.challenged_id THEN
    IF (v_challenge.public_state->>'p2_submitted')::boolean THEN
      RAISE EXCEPTION 'Already submitted';
    END IF;
    UPDATE public.challenges SET 
      p2_private_state = jsonb_build_object('choice', p_choice),
      public_state = jsonb_set(public_state, '{p2_submitted}', 'true')
    WHERE id = p_challenge_id
    RETURNING * INTO v_challenge;
  ELSE
    RAISE EXCEPTION 'Not a participant';
  END IF;

  -- If both submitted, resolve
  IF (v_challenge.public_state->>'p1_submitted')::boolean AND (v_challenge.public_state->>'p2_submitted')::boolean THEN
    v_my_choice := v_challenge.p1_private_state->>'choice';
    v_opp_choice := v_challenge.p2_private_state->>'choice';
    
    -- Payoff Matrix:
    -- TRUST vs TRUST: DRAW
    -- TRUST vs BLUFF: BLUFF wins
    -- TRUST vs CHALLENGE: TRUST wins
    -- BLUFF vs TRUST: BLUFF wins
    -- BLUFF vs BLUFF: DRAW
    -- BLUFF vs CHALLENGE: CHALLENGE wins
    -- CHALLENGE vs TRUST: TRUST wins
    -- CHALLENGE vs BLUFF: CHALLENGE wins
    -- CHALLENGE vs CHALLENGE: DRAW
    
    IF v_my_choice = v_opp_choice THEN
      PERFORM public.resolve_challenge(p_challenge_id, NULL, NULL, true);
    ELSE
      IF (v_my_choice = 'TRUST' AND v_opp_choice = 'CHALLENGE') OR
         (v_my_choice = 'BLUFF' AND v_opp_choice = 'TRUST') OR
         (v_my_choice = 'CHALLENGE' AND v_opp_choice = 'BLUFF') THEN
        -- P1 wins
        v_winner_id := v_challenge.challenger_id;
        v_loser_id := v_challenge.challenged_id;
      ELSE
        -- P2 wins
        v_winner_id := v_challenge.challenged_id;
        v_loser_id := v_challenge.challenger_id;
      END IF;
      
      -- Move choices to public state so they can see what happened
      UPDATE public.challenges SET 
        public_state = jsonb_set(jsonb_set(public_state, '{p1_choice}', to_jsonb(v_my_choice)), '{p2_choice}', to_jsonb(v_opp_choice))
      WHERE id = p_challenge_id;

      PERFORM public.resolve_challenge(p_challenge_id, v_winner_id, v_loser_id, false);
    END IF;
  END IF;
END;
$function$;
"""

with open("supabase/migrations/17_challenge_logic.sql", "w") as f:
    f.write(migration_sql)
