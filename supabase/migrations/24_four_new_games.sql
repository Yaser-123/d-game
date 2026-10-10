-- Migration: 24_four_new_games.sql

-- 1. NIM_GAME
CREATE OR REPLACE FUNCTION public.submit_nim_action(p_challenge_id uuid, p_amount integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid; v_challenge public.challenges%ROWTYPE; v_is_p1 boolean; v_pub jsonb;
  v_p1_hp integer; v_p2_hp integer; v_turn text; v_pearls integer; v_log jsonb; v_log_msg text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF v_challenge.status != 'ACTIVE' THEN RAISE EXCEPTION 'Challenge is not active'; END IF;
  v_is_p1 := (v_challenge.challenger_id = v_uid);
  IF NOT v_is_p1 AND v_challenge.challenged_id != v_uid THEN RAISE EXCEPTION 'Not part of this challenge'; END IF;
  v_pub := v_challenge.public_state;
  v_turn := v_pub->>'current_turn';
  IF (v_turn = 'p1' AND NOT v_is_p1) OR (v_turn = 'p2' AND v_is_p1) THEN RAISE EXCEPTION 'Not your turn'; END IF;

  v_p1_hp := (v_pub->>'p1_hp')::integer; v_p2_hp := (v_pub->>'p2_hp')::integer;
  v_pearls := (v_pub->>'pearls_left')::integer; v_log := COALESCE(v_pub->'log', '[]'::jsonb);

  IF p_amount < 1 OR p_amount > 3 THEN RAISE EXCEPTION 'Can only take 1-3 souls'; END IF;

  v_pearls := v_pearls - p_amount;
  v_log_msg := CASE WHEN v_is_p1 THEN 'Player' ELSE 'Opponent' END || ' took ' || p_amount || ' souls. ' || v_pearls || ' remain.';
  
  IF v_pearls <= 0 THEN
    v_log_msg := v_log_msg || ' ' || CASE WHEN v_is_p1 THEN 'Player' ELSE 'Opponent' END || ' was forced to take the final cursed soul! Takes 1 DMG.';
    IF v_is_p1 THEN v_p1_hp := v_p1_hp - 1; ELSE v_p2_hp := v_p2_hp - 1; END IF;
    v_pearls := 21;
  END IF;

  v_log := v_log || jsonb_build_array(v_log_msg); IF jsonb_array_length(v_log) > 10 THEN v_log := v_log - 0; END IF;
  v_turn := CASE WHEN v_turn = 'p1' THEN 'p2' ELSE 'p1' END;
  v_pub := v_pub || jsonb_build_object('p1_hp', v_p1_hp, 'p2_hp', v_p2_hp, 'current_turn', v_turn, 'pearls_left', v_pearls, 'log', v_log);
  UPDATE public.challenges SET public_state = v_pub, updated_at = now() WHERE id = p_challenge_id;
  IF v_p1_hp <= 0 THEN PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenged_id, v_challenge.challenger_id, false);
  ELSIF v_p2_hp <= 0 THEN PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenger_id, v_challenge.challenged_id, false); END IF;
END; $function$;

-- 2. DEATHJACK
CREATE OR REPLACE FUNCTION public.submit_deathjack_action(p_challenge_id uuid, p_action text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid; v_challenge public.challenges%ROWTYPE; v_is_p1 boolean; v_pub jsonb; v_priv jsonb;
  v_p1_hp integer; v_p2_hp integer; v_turn text; v_phase text; v_log jsonb; v_log_msg text;
  v_p1_vis jsonb; v_p2_vis jsonb; v_p1_hid integer; v_p2_hid integer; v_new_card integer;
  v_p1_total integer; v_p2_total integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF v_challenge.status != 'ACTIVE' THEN RAISE EXCEPTION 'Challenge is not active'; END IF;
  v_is_p1 := (v_challenge.challenger_id = v_uid);
  IF NOT v_is_p1 AND v_challenge.challenged_id != v_uid THEN RAISE EXCEPTION 'Not part of this challenge'; END IF;
  
  v_pub := v_challenge.public_state; v_priv := v_challenge.private_state;
  v_turn := v_pub->>'current_turn'; v_phase := v_pub->>'phase';
  IF (v_turn = 'p1' AND NOT v_is_p1) OR (v_turn = 'p2' AND v_is_p1) THEN RAISE EXCEPTION 'Not your turn'; END IF;

  v_p1_hp := (v_pub->>'p1_hp')::integer; v_p2_hp := (v_pub->>'p2_hp')::integer;
  v_p1_vis := v_pub->'p1_visible'; v_p2_vis := v_pub->'p2_visible';
  v_p1_hid := (v_priv->>'p1_hidden')::integer; v_p2_hid := (v_priv->>'p2_hidden')::integer;
  v_log := COALESCE(v_pub->'log', '[]'::jsonb);

  IF p_action = 'HIT' THEN
    v_new_card := floor(random() * 10)::integer + 1;
    v_log_msg := CASE WHEN v_is_p1 THEN 'Player' ELSE 'Opponent' END || ' hits and draws a ' || v_new_card || '.';
    IF v_is_p1 THEN 
      v_p1_vis := v_p1_vis || jsonb_build_array(v_new_card);
      SELECT COALESCE(sum(v::text::int), 0) INTO v_p1_total FROM jsonb_array_elements(v_p1_vis) v;
      v_p1_total := v_p1_total + v_p1_hid;
      IF v_p1_total > 21 THEN
        v_log_msg := v_log_msg || ' BUST! Player takes 1 DMG. Total was ' || v_p1_total || '.';
        v_p1_hp := v_p1_hp - 1; v_phase := 'RESET';
      END IF;
    ELSE 
      v_p2_vis := v_p2_vis || jsonb_build_array(v_new_card);
      SELECT COALESCE(sum(v::text::int), 0) INTO v_p2_total FROM jsonb_array_elements(v_p2_vis) v;
      v_p2_total := v_p2_total + v_p2_hid;
      IF v_p2_total > 21 THEN
        v_log_msg := v_log_msg || ' BUST! Opponent takes 1 DMG. Total was ' || v_p2_total || '.';
        v_p2_hp := v_p2_hp - 1; v_phase := 'RESET';
      END IF;
    END IF;
  ELSIF p_action = 'STAND' THEN
    v_log_msg := CASE WHEN v_is_p1 THEN 'Player' ELSE 'Opponent' END || ' stands.';
    IF v_turn = 'p1' THEN
      v_turn := 'p2'; v_phase := 'P2_TURN';
    ELSE
      v_phase := 'REVEAL';
    END IF;
  END IF;

  IF v_phase = 'REVEAL' THEN
    SELECT COALESCE(sum(v::text::int), 0) INTO v_p1_total FROM jsonb_array_elements(v_p1_vis) v; v_p1_total := v_p1_total + v_p1_hid;
    SELECT COALESCE(sum(v::text::int), 0) INTO v_p2_total FROM jsonb_array_elements(v_p2_vis) v; v_p2_total := v_p2_total + v_p2_hid;
    v_log_msg := v_log_msg || ' REVEAL! Player: ' || v_p1_total || ', Opponent: ' || v_p2_total || '. ';
    IF v_p1_total > v_p2_total THEN
      v_log_msg := v_log_msg || 'Player wins! Opponent takes 1 DMG.'; v_p2_hp := v_p2_hp - 1;
    ELSIF v_p2_total > v_p1_total THEN
      v_log_msg := v_log_msg || 'Opponent wins! Player takes 1 DMG.'; v_p1_hp := v_p1_hp - 1;
    ELSE
      v_log_msg := v_log_msg || 'Draw! No damage taken.';
    END IF;
    v_phase := 'RESET';
  END IF;

  IF v_phase = 'RESET' THEN
    v_p1_vis := jsonb_build_array(floor(random() * 10)::integer + 1);
    v_p2_vis := jsonb_build_array(floor(random() * 10)::integer + 1);
    v_priv := jsonb_build_object('p1_hidden', floor(random() * 10)::integer + 1, 'p2_hidden', floor(random() * 10)::integer + 1);
    v_turn := 'p1'; v_phase := 'P1_TURN';
  END IF;

  v_log := v_log || jsonb_build_array(v_log_msg); IF jsonb_array_length(v_log) > 10 THEN v_log := v_log - 0; END IF;
  v_pub := v_pub || jsonb_build_object('p1_hp', v_p1_hp, 'p2_hp', v_p2_hp, 'current_turn', v_turn, 'phase', v_phase, 'p1_visible', v_p1_vis, 'p2_visible', v_p2_vis, 'log', v_log);
  UPDATE public.challenges SET public_state = v_pub, private_state = v_priv, updated_at = now() WHERE id = p_challenge_id;
  IF v_p1_hp <= 0 THEN PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenged_id, v_challenge.challenger_id, false);
  ELSIF v_p2_hp <= 0 THEN PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenger_id, v_challenge.challenged_id, false); END IF;
END; $function$;

-- 3. DOOMSDAY
CREATE OR REPLACE FUNCTION public.submit_doomsday_action(p_challenge_id uuid, p_action text, p_ticks integer DEFAULT 0)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid; v_challenge public.challenges%ROWTYPE; v_is_p1 boolean; v_pub jsonb; v_priv jsonb;
  v_p1_hp integer; v_p2_hp integer; v_turn text; v_clock integer; v_threshold integer; v_log jsonb; v_log_msg text;
BEGIN
  v_uid := auth.uid(); IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF v_challenge.status != 'ACTIVE' THEN RAISE EXCEPTION 'Challenge is not active'; END IF;
  v_is_p1 := (v_challenge.challenger_id = v_uid);
  IF NOT v_is_p1 AND v_challenge.challenged_id != v_uid THEN RAISE EXCEPTION 'Not part of this challenge'; END IF;
  v_pub := v_challenge.public_state; v_priv := v_challenge.private_state;
  v_turn := v_pub->>'current_turn';
  IF (v_turn = 'p1' AND NOT v_is_p1) OR (v_turn = 'p2' AND v_is_p1) THEN RAISE EXCEPTION 'Not your turn'; END IF;

  v_p1_hp := (v_pub->>'p1_hp')::integer; v_p2_hp := (v_pub->>'p2_hp')::integer;
  v_clock := (v_pub->>'clock')::integer; v_threshold := (v_priv->>'threshold')::integer;
  v_log := COALESCE(v_pub->'log', '[]'::jsonb);

  IF p_action = 'TICK' THEN
    IF p_ticks < 1 OR p_ticks > 3 THEN RAISE EXCEPTION 'Can only tick 1-3'; END IF;
    v_clock := v_clock + p_ticks;
    v_log_msg := CASE WHEN v_is_p1 THEN 'Player' ELSE 'Opponent' END || ' ticked the clock by ' || p_ticks || '. It is now at ' || v_clock || '.';
    IF v_clock >= 15 THEN
      v_log_msg := v_log_msg || ' THE CLOCK EXPLODED! Max reached. ' || CASE WHEN v_is_p1 THEN 'Player' ELSE 'Opponent' END || ' takes 1 DMG.';
      IF v_is_p1 THEN v_p1_hp := v_p1_hp - 1; ELSE v_p2_hp := v_p2_hp - 1; END IF;
      v_clock := 0; v_priv := jsonb_build_object('threshold', floor(random() * 6)::integer + 8);
    END IF;
  ELSIF p_action = 'DETONATE' THEN
    v_log_msg := CASE WHEN v_is_p1 THEN 'Player' ELSE 'Opponent' END || ' hit DETONATE at ' || v_clock || '! (Threshold was ' || v_threshold || ') ';
    IF v_clock >= v_threshold THEN
      v_log_msg := v_log_msg || 'SUCCESS! The blast hits the enemy! Opponent takes 1 DMG.';
      IF v_is_p1 THEN v_p2_hp := v_p2_hp - 1; ELSE v_p1_hp := v_p1_hp - 1; END IF;
    ELSE
      v_log_msg := v_log_msg || 'FAILURE! Too early, it misfires! You take 1 DMG.';
      IF v_is_p1 THEN v_p1_hp := v_p1_hp - 1; ELSE v_p2_hp := v_p2_hp - 1; END IF;
    END IF;
    v_clock := 0; v_priv := jsonb_build_object('threshold', floor(random() * 6)::integer + 8);
  END IF;

  v_log := v_log || jsonb_build_array(v_log_msg); IF jsonb_array_length(v_log) > 10 THEN v_log := v_log - 0; END IF;
  v_turn := CASE WHEN v_turn = 'p1' THEN 'p2' ELSE 'p1' END;
  v_pub := v_pub || jsonb_build_object('p1_hp', v_p1_hp, 'p2_hp', v_p2_hp, 'current_turn', v_turn, 'clock', v_clock, 'log', v_log);
  UPDATE public.challenges SET public_state = v_pub, private_state = v_priv, updated_at = now() WHERE id = p_challenge_id;
  IF v_p1_hp <= 0 THEN PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenged_id, v_challenge.challenger_id, false);
  ELSIF v_p2_hp <= 0 THEN PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenger_id, v_challenge.challenged_id, false); END IF;
END; $function$;

-- 4. MINEFIELD
CREATE OR REPLACE FUNCTION public.submit_minefield_action(p_challenge_id uuid, p_index integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid; v_challenge public.challenges%ROWTYPE; v_is_p1 boolean; v_pub jsonb; v_priv jsonb;
  v_p1_hp integer; v_p2_hp integer; v_turn text; v_revealed jsonb; v_mines jsonb; v_log jsonb; v_log_msg text;
  v_is_mine boolean := false; v_i integer; v_val text;
BEGIN
  v_uid := auth.uid(); IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF v_challenge.status != 'ACTIVE' THEN RAISE EXCEPTION 'Challenge is not active'; END IF;
  v_is_p1 := (v_challenge.challenger_id = v_uid);
  IF NOT v_is_p1 AND v_challenge.challenged_id != v_uid THEN RAISE EXCEPTION 'Not part of this challenge'; END IF;
  v_pub := v_challenge.public_state; v_priv := v_challenge.private_state;
  v_turn := v_pub->>'current_turn';
  IF (v_turn = 'p1' AND NOT v_is_p1) OR (v_turn = 'p2' AND v_is_p1) THEN RAISE EXCEPTION 'Not your turn'; END IF;

  v_p1_hp := (v_pub->>'p1_hp')::integer; v_p2_hp := (v_pub->>'p2_hp')::integer;
  v_revealed := COALESCE(v_pub->'revealed', '{}'::jsonb); v_mines := v_priv->'mines';
  v_log := COALESCE(v_pub->'log', '[]'::jsonb);

  FOR v_i IN 0..(jsonb_array_length(v_mines)-1) LOOP
    IF (v_mines->>v_i)::integer = p_index THEN v_is_mine := true; END IF;
  END LOOP;

  IF v_is_mine THEN
    v_log_msg := CASE WHEN v_is_p1 THEN 'Player' ELSE 'Opponent' END || ' stepped on tile ' || p_index || ' and hit a TRAP! Takes 1 DMG. Grid reset.';
    IF v_is_p1 THEN v_p1_hp := v_p1_hp - 1; ELSE v_p2_hp := v_p2_hp - 1; END IF;
    -- Reset grid
    v_revealed := '{}'::jsonb;
    -- Reroll mines (just a simple array of 4 random distinct 0-15 isn't trivial in one line, but we can do a quick shuffle array)
    SELECT jsonb_agg(idx) INTO v_mines FROM (SELECT generate_series(0, 15) as idx ORDER BY random() LIMIT 4) t;
    v_priv := jsonb_build_object('mines', v_mines);
  ELSE
    v_log_msg := CASE WHEN v_is_p1 THEN 'Player' ELSE 'Opponent' END || ' stepped on tile ' || p_index || ' safely.';
    v_revealed := v_revealed || jsonb_build_object(p_index::text, 'SAFE');
  END IF;

  v_log := v_log || jsonb_build_array(v_log_msg); IF jsonb_array_length(v_log) > 10 THEN v_log := v_log - 0; END IF;
  v_turn := CASE WHEN v_turn = 'p1' THEN 'p2' ELSE 'p1' END;
  v_pub := v_pub || jsonb_build_object('p1_hp', v_p1_hp, 'p2_hp', v_p2_hp, 'current_turn', v_turn, 'revealed', v_revealed, 'log', v_log);
  UPDATE public.challenges SET public_state = v_pub, private_state = v_priv, updated_at = now() WHERE id = p_challenge_id;
  IF v_p1_hp <= 0 THEN PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenged_id, v_challenge.challenger_id, false);
  ELSIF v_p2_hp <= 0 THEN PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenger_id, v_challenge.challenged_id, false); END IF;
END; $function$;
