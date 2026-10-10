-- Migration: 23_poison_chalice.sql

CREATE OR REPLACE FUNCTION public.submit_chalice_action(
  p_challenge_id uuid,
  p_action_type text,
  p_content text DEFAULT NULL,
  p_taunt text DEFAULT NULL,
  p_decision text DEFAULT NULL
)
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
  v_turn text;
  v_phase text;
  v_log jsonb;
  v_log_msg text;
  v_cup_content text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF v_challenge.status != 'ACTIVE' THEN RAISE EXCEPTION 'Challenge is not active'; END IF;

  v_is_p1 := (v_challenge.challenger_id = v_uid);
  IF NOT v_is_p1 AND v_challenge.challenged_id != v_uid THEN RAISE EXCEPTION 'Not part of this challenge'; END IF;

  v_pub := v_challenge.public_state;
  v_priv := COALESCE(v_challenge.private_state, '{}'::jsonb);
  
  v_turn := v_pub->>'current_turn';
  v_phase := v_pub->>'phase';
  
  IF (v_turn = 'p1' AND NOT v_is_p1) OR (v_turn = 'p2' AND v_is_p1) THEN
    RAISE EXCEPTION 'Not your turn';
  END IF;

  v_p1_hp := (v_pub->>'p1_hp')::integer;
  v_p2_hp := (v_pub->>'p2_hp')::integer;
  v_log := COALESCE(v_pub->'log', '[]'::jsonb);

  IF p_action_type = 'POISON_CUP' THEN
    IF v_phase != 'POISON' THEN RAISE EXCEPTION 'Not in POISON phase'; END IF;
    
    v_priv := v_priv || jsonb_build_object('cup_content', p_content);
    v_pub := v_pub || jsonb_build_object('phase', 'TASTE', 'taunt', p_taunt);
    
    -- Turn swaps to the other player to TASTE
    v_turn := CASE WHEN v_turn = 'p1' THEN 'p2' ELSE 'p1' END;
    v_pub := v_pub || jsonb_build_object('current_turn', v_turn);
    
    v_log_msg := CASE WHEN v_is_p1 THEN 'Player' ELSE 'Opponent' END || ' offered a chalice. Taunt: "' || p_taunt || '"';
    
  ELSIF p_action_type = 'TASTE_CUP' THEN
    IF v_phase != 'TASTE' THEN RAISE EXCEPTION 'Not in TASTE phase'; END IF;
    
    v_cup_content := v_priv->>'cup_content';
    
    IF p_decision = 'DRINK' THEN
      IF v_cup_content = 'POISON' THEN
        v_log_msg := CASE WHEN v_is_p1 THEN 'Player' ELSE 'Opponent' END || ' drank POISON! Takes 1 DMG.';
        IF v_is_p1 THEN v_p1_hp := v_p1_hp - 1; ELSE v_p2_hp := v_p2_hp - 1; END IF;
      ELSE
        v_log_msg := CASE WHEN v_is_p1 THEN 'Player' ELSE 'Opponent' END || ' drank WINE! The poisoner takes 1 DMG out of frustration.';
        IF v_is_p1 THEN v_p2_hp := v_p2_hp - 1; ELSE v_p1_hp := v_p1_hp - 1; END IF;
      END IF;
    ELSE -- PASS
      IF v_cup_content = 'POISON' THEN
        v_log_msg := CASE WHEN v_is_p1 THEN 'Player' ELSE 'Opponent' END || ' refused! The poisoner is forced to drink their POISON and takes 1 DMG.';
        IF v_is_p1 THEN v_p2_hp := v_p2_hp - 1; ELSE v_p1_hp := v_p1_hp - 1; END IF;
      ELSE
        v_log_msg := CASE WHEN v_is_p1 THEN 'Player' ELSE 'Opponent' END || ' refused WINE! Punished for cowardice, takes 1 DMG.';
        IF v_is_p1 THEN v_p1_hp := v_p1_hp - 1; ELSE v_p2_hp := v_p2_hp - 1; END IF;
      END IF;
    END IF;

    -- Phase goes back to POISON, turn does NOT swap because the person who just TASTED now gets to be the POISONER
    v_pub := v_pub || jsonb_build_object('phase', 'POISON', 'taunt', '', 'p1_hp', v_p1_hp, 'p2_hp', v_p2_hp);
    
  ELSE
    RAISE EXCEPTION 'Invalid action_type';
  END IF;

  v_log := v_log || jsonb_build_array(v_log_msg);
  IF jsonb_array_length(v_log) > 10 THEN v_log := v_log - 0; END IF;
  v_pub := v_pub || jsonb_build_object('log', v_log);

  UPDATE public.challenges SET public_state = v_pub, private_state = v_priv, updated_at = now() WHERE id = p_challenge_id;

  IF v_p1_hp <= 0 THEN
    PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenged_id, v_challenge.challenger_id, false);
  ELSIF v_p2_hp <= 0 THEN
    PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenger_id, v_challenge.challenged_id, false);
  END IF;
END;
$function$;

-- Bot processor for Poison Chalice
CREATE OR REPLACE FUNCTION public.process_bot_chalice_turn(p_challenge_id uuid)
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
  v_turn text;
  v_phase text;
  v_log jsonb;
  v_log_msg text;
  v_cup_content text;
  
  v_bot_content text;
  v_bot_taunt text;
  v_bot_decision text;
  v_taunts text[] := ARRAY['I swear this is safe.', 'Don''t be a coward.', 'Drink your doom.', 'This is definitely poison.'];
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF v_challenge.status != 'ACTIVE' THEN RAISE EXCEPTION 'Challenge is not active'; END IF;

  v_is_p1 := (v_challenge.challenger_id = v_uid);
  IF NOT v_is_p1 THEN RAISE EXCEPTION 'Only challenger can trigger bot'; END IF;

  v_pub := v_challenge.public_state;
  v_priv := COALESCE(v_challenge.private_state, '{}'::jsonb);
  
  v_turn := v_pub->>'current_turn';
  v_phase := v_pub->>'phase';
  
  IF v_turn != 'p2' THEN RAISE EXCEPTION 'Not bots turn'; END IF;

  v_p1_hp := (v_pub->>'p1_hp')::integer;
  v_p2_hp := (v_pub->>'p2_hp')::integer;
  v_log := COALESCE(v_pub->'log', '[]'::jsonb);

  IF v_phase = 'POISON' THEN
    v_bot_content := CASE WHEN random() > 0.5 THEN 'POISON' ELSE 'WINE' END;
    v_bot_taunt := v_taunts[floor(random() * 4 + 1)::int];
    
    v_priv := v_priv || jsonb_build_object('cup_content', v_bot_content);
    v_pub := v_pub || jsonb_build_object('phase', 'TASTE', 'taunt', v_bot_taunt);
    v_pub := v_pub || jsonb_build_object('current_turn', 'p1');
    v_log_msg := 'Opponent offered a chalice. Taunt: "' || v_bot_taunt || '"';
    
  ELSIF v_phase = 'TASTE' THEN
    v_bot_decision := CASE WHEN random() > 0.5 THEN 'DRINK' ELSE 'PASS' END;
    v_cup_content := v_priv->>'cup_content';
    
    IF v_bot_decision = 'DRINK' THEN
      IF v_cup_content = 'POISON' THEN
        v_log_msg := 'Opponent drank POISON! Takes 1 DMG.';
        v_p2_hp := v_p2_hp - 1;
      ELSE
        v_log_msg := 'Opponent drank WINE! The poisoner (you) takes 1 DMG out of frustration.';
        v_p1_hp := v_p1_hp - 1;
      END IF;
    ELSE
      IF v_cup_content = 'POISON' THEN
        v_log_msg := 'Opponent refused! The poisoner (you) is forced to drink their POISON and takes 1 DMG.';
        v_p1_hp := v_p1_hp - 1;
      ELSE
        v_log_msg := 'Opponent refused WINE! Punished for cowardice, takes 1 DMG.';
        v_p2_hp := v_p2_hp - 1;
      END IF;
    END IF;

    v_pub := v_pub || jsonb_build_object('phase', 'POISON', 'taunt', '', 'p1_hp', v_p1_hp, 'p2_hp', v_p2_hp);
  END IF;

  v_log := v_log || jsonb_build_array(v_log_msg);
  IF jsonb_array_length(v_log) > 10 THEN v_log := v_log - 0; END IF;
  v_pub := v_pub || jsonb_build_object('log', v_log);

  UPDATE public.challenges SET public_state = v_pub, private_state = v_priv, updated_at = now() WHERE id = p_challenge_id;

  IF v_p1_hp <= 0 THEN
    PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenged_id, v_challenge.challenger_id, false);
  ELSIF v_p2_hp <= 0 THEN
    PERFORM public.resolve_challenge(p_challenge_id, v_challenge.challenger_id, v_challenge.challenged_id, false);
  END IF;
END;
$function$;
