-- Migration: 25_four_new_games_bots.sql

-- 1. NIM BOT
CREATE OR REPLACE FUNCTION public.process_bot_nim_turn(p_challenge_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid; v_challenge public.challenges%ROWTYPE; v_pub jsonb;
  v_p1_hp integer; v_p2_hp integer; v_turn text; v_pearls integer; v_log jsonb; v_log_msg text;
  v_take integer;
BEGIN
  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF v_challenge.status != 'ACTIVE' THEN RETURN; END IF;
  v_pub := v_challenge.public_state; v_turn := v_pub->>'current_turn';
  IF v_turn != 'p2' THEN RETURN; END IF;
  v_p1_hp := (v_pub->>'p1_hp')::integer; v_p2_hp := (v_pub->>'p2_hp')::integer;
  v_pearls := (v_pub->>'pearls_left')::integer; v_log := COALESCE(v_pub->'log', '[]'::jsonb);

  -- Perfect play strategy: leave a multiple of 4 + 1 if possible. (1, 5, 9, 13, 17, 21)
  -- If we can't, pick random.
  IF (v_pearls % 4) = 0 THEN v_take := 3;
  ELSIF (v_pearls % 4) = 3 THEN v_take := 2;
  ELSIF (v_pearls % 4) = 2 THEN v_take := 1;
  ELSE v_take := floor(random() * 3 + 1)::integer; END IF;
  
  -- ensure we dont take more than what's left
  IF v_take > v_pearls THEN v_take := v_pearls; END IF;
  IF v_take < 1 THEN v_take := 1; END IF;

  v_pearls := v_pearls - v_take;
  v_log_msg := 'Opponent took ' || v_take || ' souls. ' || v_pearls || ' remain.';
  
  IF v_pearls <= 0 THEN
    v_log_msg := v_log_msg || ' Opponent was forced to take the final cursed soul! Takes 1 DMG.';
    v_p2_hp := v_p2_hp - 1; v_pearls := 21;
  END IF;

  v_log := v_log || jsonb_build_array(v_log_msg); IF jsonb_array_length(v_log) > 10 THEN v_log := v_log - 0; END IF;
  v_pub := v_pub || jsonb_build_object('p1_hp', v_p1_hp, 'p2_hp', v_p2_hp, 'current_turn', 'p1', 'pearls_left', v_pearls, 'log', v_log);
  UPDATE public.challenges SET public_state = v_pub, updated_at = now() WHERE id = p_challenge_id;
  IF v_p1_hp <= 0 THEN PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenged_id, v_challenge.challenger_id, false);
  ELSIF v_p2_hp <= 0 THEN PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenger_id, v_challenge.challenged_id, false); END IF;
END; $function$;

-- 2. DEATHJACK BOT
CREATE OR REPLACE FUNCTION public.process_bot_deathjack_turn(p_challenge_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_challenge public.challenges%ROWTYPE; v_pub jsonb; v_priv jsonb;
  v_p1_hp integer; v_p2_hp integer; v_turn text; v_phase text; v_log jsonb; v_log_msg text;
  v_p1_vis jsonb; v_p2_vis jsonb; v_p1_hid integer; v_p2_hid integer; v_new_card integer;
  v_p1_total integer; v_p2_total integer; v_action text;
BEGIN
  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF v_challenge.status != 'ACTIVE' THEN RETURN; END IF;
  v_pub := v_challenge.public_state; v_priv := v_challenge.private_state;
  v_turn := v_pub->>'current_turn'; v_phase := v_pub->>'phase';
  IF v_phase != 'P2_TURN' THEN RETURN; END IF;

  v_p1_hp := (v_pub->>'p1_hp')::integer; v_p2_hp := (v_pub->>'p2_hp')::integer;
  v_p1_vis := v_pub->'p1_visible'; v_p2_vis := v_pub->'p2_visible';
  v_p1_hid := (v_priv->>'p1_hidden')::integer; v_p2_hid := (v_priv->>'p2_hidden')::integer;
  v_log := COALESCE(v_pub->'log', '[]'::jsonb);

  SELECT COALESCE(sum(v::text::int), 0) INTO v_p2_total FROM jsonb_array_elements(v_p2_vis) v; v_p2_total := v_p2_total + v_p2_hid;
  
  -- simple logic: hit if under 16
  IF v_p2_total < 16 THEN v_action := 'HIT'; ELSE v_action := 'STAND'; END IF;

  IF v_action = 'HIT' THEN
    v_new_card := floor(random() * 10)::integer + 1;
    v_log_msg := 'Opponent hits and draws a ' || v_new_card || '.';
    v_p2_vis := v_p2_vis || jsonb_build_array(v_new_card);
    v_p2_total := v_p2_total + v_new_card;
    IF v_p2_total > 21 THEN
      v_log_msg := v_log_msg || ' BUST! Opponent takes 1 DMG. Total was ' || v_p2_total || '.';
      v_p2_hp := v_p2_hp - 1; v_phase := 'RESET';
    END IF;
  ELSE
    v_log_msg := 'Opponent stands.';
    v_phase := 'REVEAL';
  END IF;

  IF v_phase = 'REVEAL' THEN
    SELECT COALESCE(sum(v::text::int), 0) INTO v_p1_total FROM jsonb_array_elements(v_p1_vis) v; v_p1_total := v_p1_total + v_p1_hid;
    v_log_msg := v_log_msg || ' REVEAL! Player: ' || v_p1_total || ', Opponent: ' || v_p2_total || '. ';
    IF v_p1_total > v_p2_total THEN
      v_log_msg := v_log_msg || 'Player wins! Opponent takes 1 DMG.'; v_p2_hp := v_p2_hp - 1;
    ELSIF v_p2_total > v_p1_total THEN
      v_log_msg := v_log_msg || 'Opponent wins! Player takes 1 DMG.'; v_p1_hp := v_p1_hp - 1;
    ELSE v_log_msg := v_log_msg || 'Draw! No damage taken.'; END IF;
    v_phase := 'RESET';
  END IF;

  IF v_phase = 'RESET' THEN
    v_p1_vis := jsonb_build_array(floor(random() * 10)::integer + 1); v_p2_vis := jsonb_build_array(floor(random() * 10)::integer + 1);
    v_priv := jsonb_build_object('p1_hidden', floor(random() * 10)::integer + 1, 'p2_hidden', floor(random() * 10)::integer + 1);
    v_turn := 'p1'; v_phase := 'P1_TURN';
  END IF;

  v_log := v_log || jsonb_build_array(v_log_msg); IF jsonb_array_length(v_log) > 10 THEN v_log := v_log - 0; END IF;
  v_pub := v_pub || jsonb_build_object('p1_hp', v_p1_hp, 'p2_hp', v_p2_hp, 'current_turn', v_turn, 'phase', v_phase, 'p1_visible', v_p1_vis, 'p2_visible', v_p2_vis, 'log', v_log);
  UPDATE public.challenges SET public_state = v_pub, private_state = v_priv, updated_at = now() WHERE id = p_challenge_id;
  IF v_p1_hp <= 0 THEN PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenged_id, v_challenge.challenger_id, false);
  ELSIF v_p2_hp <= 0 THEN PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenger_id, v_challenge.challenged_id, false); END IF;
END; $function$;

-- 3. DOOMSDAY BOT
CREATE OR REPLACE FUNCTION public.process_bot_doomsday_turn(p_challenge_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_challenge public.challenges%ROWTYPE; v_pub jsonb; v_priv jsonb;
  v_p1_hp integer; v_p2_hp integer; v_turn text; v_clock integer; v_threshold integer; v_log jsonb; v_log_msg text;
  v_action text; v_ticks integer;
BEGIN
  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF v_challenge.status != 'ACTIVE' THEN RETURN; END IF;
  v_pub := v_challenge.public_state; v_priv := v_challenge.private_state;
  v_turn := v_pub->>'current_turn';
  IF v_turn != 'p2' THEN RETURN; END IF;

  v_p1_hp := (v_pub->>'p1_hp')::integer; v_p2_hp := (v_pub->>'p2_hp')::integer;
  v_clock := (v_pub->>'clock')::integer; v_threshold := (v_priv->>'threshold')::integer;
  v_log := COALESCE(v_pub->'log', '[]'::jsonb);

  -- Bot logic: if clock >= threshold, heavily lean to DETONATE.
  IF v_clock >= v_threshold THEN
    IF random() > 0.1 THEN v_action := 'DETONATE'; ELSE v_action := 'TICK'; v_ticks := 1; END IF;
  ELSE
    IF random() > 0.8 THEN v_action := 'DETONATE'; ELSE v_action := 'TICK'; v_ticks := floor(random() * 3 + 1)::integer; END IF;
  END IF;

  IF v_action = 'TICK' THEN
    v_clock := v_clock + v_ticks;
    v_log_msg := 'Opponent ticked the clock by ' || v_ticks || '. It is now at ' || v_clock || '.';
    IF v_clock >= 15 THEN
      v_log_msg := v_log_msg || ' THE CLOCK EXPLODED! Max reached. Opponent takes 1 DMG.';
      v_p2_hp := v_p2_hp - 1; v_clock := 0; v_priv := jsonb_build_object('threshold', floor(random() * 6)::integer + 8);
    END IF;
  ELSE
    v_log_msg := 'Opponent hit DETONATE at ' || v_clock || '! (Threshold was ' || v_threshold || ') ';
    IF v_clock >= v_threshold THEN
      v_log_msg := v_log_msg || 'SUCCESS! The blast hits the enemy! Player takes 1 DMG.';
      v_p1_hp := v_p1_hp - 1;
    ELSE
      v_log_msg := v_log_msg || 'FAILURE! Too early, it misfires! Opponent takes 1 DMG.';
      v_p2_hp := v_p2_hp - 1;
    END IF;
    v_clock := 0; v_priv := jsonb_build_object('threshold', floor(random() * 6)::integer + 8);
  END IF;

  v_log := v_log || jsonb_build_array(v_log_msg); IF jsonb_array_length(v_log) > 10 THEN v_log := v_log - 0; END IF;
  v_pub := v_pub || jsonb_build_object('p1_hp', v_p1_hp, 'p2_hp', v_p2_hp, 'current_turn', 'p1', 'clock', v_clock, 'log', v_log);
  UPDATE public.challenges SET public_state = v_pub, private_state = v_priv, updated_at = now() WHERE id = p_challenge_id;
  IF v_p1_hp <= 0 THEN PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenged_id, v_challenge.challenger_id, false);
  ELSIF v_p2_hp <= 0 THEN PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenger_id, v_challenge.challenged_id, false); END IF;
END; $function$;

-- 4. MINEFIELD BOT
CREATE OR REPLACE FUNCTION public.process_bot_minefield_turn(p_challenge_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_challenge public.challenges%ROWTYPE; v_pub jsonb; v_priv jsonb;
  v_p1_hp integer; v_p2_hp integer; v_revealed jsonb; v_mines jsonb; v_log jsonb; v_log_msg text;
  v_is_mine boolean := false; v_i integer; v_pick integer; v_safe boolean;
BEGIN
  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF v_challenge.status != 'ACTIVE' THEN RETURN; END IF;
  v_pub := v_challenge.public_state; v_priv := v_challenge.private_state;
  IF v_pub->>'current_turn' != 'p2' THEN RETURN; END IF;

  v_p1_hp := (v_pub->>'p1_hp')::integer; v_p2_hp := (v_pub->>'p2_hp')::integer;
  v_revealed := COALESCE(v_pub->'revealed', '{}'::jsonb); v_mines := v_priv->'mines';
  v_log := COALESCE(v_pub->'log', '[]'::jsonb);

  -- Pick a random unrevealed tile
  LOOP
    v_pick := floor(random() * 16)::integer;
    IF NOT v_revealed ? v_pick::text THEN EXIT; END IF;
  END LOOP;

  FOR v_i IN 0..(jsonb_array_length(v_mines)-1) LOOP
    IF (v_mines->>v_i)::integer = v_pick THEN v_is_mine := true; END IF;
  END LOOP;

  IF v_is_mine THEN
    v_log_msg := 'Opponent stepped on tile ' || v_pick || ' and hit a TRAP! Takes 1 DMG. Grid reset.';
    v_p2_hp := v_p2_hp - 1; v_revealed := '{}'::jsonb;
    SELECT jsonb_agg(idx) INTO v_mines FROM (SELECT generate_series(0, 15) as idx ORDER BY random() LIMIT 4) t;
    v_priv := jsonb_build_object('mines', v_mines);
  ELSE
    v_log_msg := 'Opponent stepped on tile ' || v_pick || ' safely.';
    v_revealed := v_revealed || jsonb_build_object(v_pick::text, 'SAFE');
  END IF;

  v_log := v_log || jsonb_build_array(v_log_msg); IF jsonb_array_length(v_log) > 10 THEN v_log := v_log - 0; END IF;
  v_pub := v_pub || jsonb_build_object('p1_hp', v_p1_hp, 'p2_hp', v_p2_hp, 'current_turn', 'p1', 'revealed', v_revealed, 'log', v_log);
  UPDATE public.challenges SET public_state = v_pub, private_state = v_priv, updated_at = now() WHERE id = p_challenge_id;
  IF v_p1_hp <= 0 THEN PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenged_id, v_challenge.challenger_id, false);
  ELSIF v_p2_hp <= 0 THEN PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenger_id, v_challenge.challenged_id, false); END IF;
END; $function$;
