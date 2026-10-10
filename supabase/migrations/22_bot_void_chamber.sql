-- Migration: 22_bot_void_chamber.sql

CREATE OR REPLACE FUNCTION public.process_bot_void_chamber_turn(p_challenge_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_challenge public.challenges%ROWTYPE;
  v_is_p1 boolean;
  v_pub jsonb;
  v_priv jsonb;
  v_p1_hp integer;
  v_p2_hp integer;
  v_chamber jsonb;
  v_chamber_idx integer;
  v_current_shell text;
  v_log jsonb;
  v_log_msg text;
  
  v_live_count integer;
  v_blank_count integer;
  v_action text;
  v_next_turn text;
  v_new_chamber jsonb;
  v_i integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF v_challenge.status != 'ACTIVE' THEN RAISE EXCEPTION 'Challenge is not active'; END IF;

  v_is_p1 := (v_challenge.challenger_id = v_uid);
  IF NOT v_is_p1 THEN RAISE EXCEPTION 'Only challenger can trigger bot'; END IF;

  v_pub := v_challenge.public_state;
  v_priv := v_challenge.private_state;
  
  IF v_pub->>'current_turn' != 'p2' THEN
    RAISE EXCEPTION 'Not bots turn';
  END IF;

  v_p1_hp := (v_pub->>'p1_hp')::integer;
  v_p2_hp := (v_pub->>'p2_hp')::integer;
  v_chamber_idx := (v_priv->>'chamber_index')::integer;
  v_chamber := v_priv->'chamber';
  v_log := COALESCE(v_pub->'log', '[]'::jsonb);

  v_live_count := (v_pub->>'live_count')::integer;
  v_blank_count := (v_pub->>'blank_count')::integer;

  -- Bot AI logic
  v_action := 'SHOOT_OPPONENT';
  IF v_blank_count > v_live_count THEN
    IF random() > 0.5 THEN v_action := 'SHOOT_SELF'; END IF;
  ELSIF v_blank_count = v_live_count THEN
    IF random() > 0.8 THEN v_action := 'SHOOT_SELF'; END IF;
  END IF;

  v_current_shell := v_chamber->>v_chamber_idx;
  v_next_turn := 'p2';

  IF v_action = 'SHOOT_SELF' THEN
    IF v_current_shell = 'LIVE' THEN
      v_log_msg := 'Boss shot itself with a LIVE round! Takes 1 damage.';
      v_p2_hp := v_p2_hp - 1;
      v_next_turn := 'p1';
    ELSE
      v_log_msg := 'Boss shot itself with a BLANK. Safe! Gets another turn.';
      v_next_turn := 'p2';
    END IF;
  ELSE
    IF v_current_shell = 'LIVE' THEN
      v_log_msg := 'Boss shot you with a LIVE round! You take 1 damage.';
      v_p1_hp := v_p1_hp - 1;
    ELSE
      v_log_msg := 'Boss shot you with a BLANK. Nothing happens.';
    END IF;
    v_next_turn := 'p1';
  END IF;

  v_log := v_log || jsonb_build_array(v_log_msg);
  IF jsonb_array_length(v_log) > 10 THEN v_log := v_log - 0; END IF;

  v_chamber_idx := v_chamber_idx + 1;
  
  IF v_chamber_idx >= jsonb_array_length(v_chamber) THEN
    v_new_chamber := '[]'::jsonb;
    v_live_count := floor(random() * 2)::integer + 1;
    v_blank_count := floor(random() * 2)::integer + 1;
    
    FOR v_i IN 1..v_live_count LOOP v_new_chamber := v_new_chamber || '["LIVE"]'::jsonb; END LOOP;
    FOR v_i IN 1..v_blank_count LOOP v_new_chamber := v_new_chamber || '["BLANK"]'::jsonb; END LOOP;
    
    SELECT jsonb_agg(elem) INTO v_new_chamber FROM (SELECT jsonb_array_elements(v_new_chamber) AS elem ORDER BY random()) t;
    
    v_chamber := v_new_chamber;
    v_chamber_idx := 0;
    v_log := v_log || jsonb_build_array('Chamber empty. Reloading: ' || v_live_count::text || ' LIVE, ' || v_blank_count::text || ' BLANK.');
  ELSE
    v_live_count := 0;
    v_blank_count := 0;
    FOR v_i IN v_chamber_idx..(jsonb_array_length(v_chamber)-1) LOOP
      IF v_chamber->>v_i = 'LIVE' THEN v_live_count := v_live_count + 1; ELSE v_blank_count := v_blank_count + 1; END IF;
    END LOOP;
  END IF;

  v_pub := v_pub || jsonb_build_object(
    'p1_hp', v_p1_hp,
    'p2_hp', v_p2_hp,
    'current_turn', v_next_turn,
    'live_count', v_live_count,
    'blank_count', v_blank_count,
    'log', v_log
  );
  v_priv := v_priv || jsonb_build_object(
    'chamber', v_chamber,
    'chamber_index', v_chamber_idx
  );

  UPDATE public.challenges SET public_state = v_pub, private_state = v_priv, updated_at = now() WHERE id = p_challenge_id;

  IF v_p1_hp <= 0 THEN
    PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenged_id, v_challenge.challenger_id, false);
  ELSIF v_p2_hp <= 0 THEN
    PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenger_id, v_challenge.challenged_id, false);
  END IF;
END;
$function$;
