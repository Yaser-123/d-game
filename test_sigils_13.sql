BEGIN;

DO $$ 
DECLARE
  v_p1 uuid := gen_random_uuid();
  v_p2 uuid := gen_random_uuid();
  v_battle_id uuid;
  v_p2_health integer;
  v_p1_health integer;
  v_p1_effects jsonb;
  v_p2_effects jsonb;
  v_log_record record;
BEGIN
  -- SETUP FIXTURE USERS
  INSERT INTO auth.users (id, email) VALUES (v_p1, 'test_p1_13@local.dev'), (v_p2, 'test_p2_13@local.dev');
  INSERT INTO public.players (id, handle, points, status) VALUES 
    (v_p1, 'P1_13', 500, 'ACTIVE'), 
    (v_p2, 'P2_13', 500, 'ACTIVE');

  -- P1 has COUNTER sigil
  INSERT INTO public.sigils (player_id, fingerprint, name, basic_ability, limitation, hidden_mechanic, ability_meta)
  VALUES (v_p1, 'f1', 'Counter', 'burn', 'none', 'none', '{"type": "COUNTER", "magnitude": 20, "duration": 1, "cooldown": 2}');
  
  -- P2 has DAMAGE sigil
  INSERT INTO public.sigils (player_id, fingerprint, name, basic_ability, limitation, hidden_mechanic, ability_meta)
  VALUES (v_p2, 'f2', 'Nuke', 'burn', 'none', 'none', '{"type": "DAMAGE", "magnitude": 30, "cooldown": 2}');
  
  INSERT INTO public.battles (player1_id, player2_id, current_turn_player_id, status, turn_counter, p1_health, p2_health)
  VALUES (v_p1, v_p2, v_p1, 'ACTIVE', 1, 100, 100) RETURNING id INTO v_battle_id;
  
  ---------------------------------------------------------
  -- TEST 2: COUNTER ACTIVATION AND CONSUMPTION
  ---------------------------------------------------------
  -- Turn 1: P1 uses COUNTER
  PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', v_p1), true);
  PERFORM public.submit_battle_action(v_battle_id, 1, 'SIGIL_ABILITY');
  
  SELECT p1_effects INTO v_p1_effects FROM public.battles WHERE id = v_battle_id;
  ASSERT (v_p1_effects->>'counter_until')::integer = 2, 'Counter until should be Turn 2 (dur 1 * 2 - 1 = 1, + 1 = 2)';
  ASSERT (v_p1_effects->>'counter_mag')::integer = 20, 'Counter magnitude should be 20';
  
  -- Turn 2: P2 attacks
  PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', v_p2), true);
  PERFORM public.submit_battle_action(v_battle_id, 2, 'ATTACK');
  
  SELECT p2_health, p1_effects INTO v_p2_health, v_p1_effects FROM public.battles WHERE id = v_battle_id;
  ASSERT v_p2_health = 80, 'P2 should have taken 20 counter damage. Found: ' || v_p2_health;
  ASSERT NOT (v_p1_effects ? 'counter_until'), 'Counter should be consumed!';
  
  -- Turn 3: P1 defends
  PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', v_p1), true);
  PERFORM public.submit_battle_action(v_battle_id, 3, 'DEFEND');
  
  -- Turn 4: P2 attacks again (P1 counter is consumed)
  PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', v_p2), true);
  PERFORM public.submit_battle_action(v_battle_id, 4, 'ATTACK');
  
  SELECT p2_health INTO v_p2_health FROM public.battles WHERE id = v_battle_id;
  ASSERT v_p2_health = 80, 'P2 should NOT take counter damage twice. Found: ' || v_p2_health;

  ---------------------------------------------------------
  -- TEST 1: STATUS EXPIRATION
  ---------------------------------------------------------
  -- Let's test SHIELD expiration
  UPDATE public.sigils SET ability_meta = '{"type": "SHIELD", "magnitude": 10, "duration": 2}' WHERE player_id = v_p1;
  UPDATE public.battles SET current_turn_player_id = v_p1, turn_counter = 5 WHERE id = v_battle_id;
  
  -- Turn 5: P1 SHIELD
  PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', v_p1), true);
  PERFORM public.submit_battle_action(v_battle_id, 5, 'SIGIL_ABILITY');
  
  SELECT p1_effects INTO v_p1_effects FROM public.battles WHERE id = v_battle_id;
  ASSERT (v_p1_effects->>'shield_until')::integer = 8, 'Shield until should be 5 + 4 - 1 = 8. Found: ' || (v_p1_effects->>'shield_until');

  ---------------------------------------------------------
  -- TEST 3: ARMOUR & SHIELD MITIGATION LOGS
  ---------------------------------------------------------
  -- Turn 6: P2 attacks
  PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', v_p2), true);
  PERFORM public.submit_battle_action(v_battle_id, 6, 'ATTACK');
  
  SELECT * INTO v_log_record FROM public.battle_logs WHERE battle_id = v_battle_id AND turn_number = 6;
  ASSERT (v_log_record.action_details->>'shield_mitigation')::integer = 10, 'Log should reflect shield mitigation of 10. Found: ' || v_log_record.action_details;

  ---------------------------------------------------------
  -- TEST 6: BATTLE COMPLETION PRESERVATION
  ---------------------------------------------------------
  UPDATE public.battles SET p2_health = 5, current_turn_player_id = v_p1, turn_counter = 7 WHERE id = v_battle_id;
  
  -- Turn 7: P1 attacks, kills P2
  PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', v_p1), true);
  PERFORM public.submit_battle_action(v_battle_id, 7, 'ATTACK');
  
  -- Verify economy
  DECLARE
    v_winner_points integer;
    v_loser_points integer;
  BEGIN
    SELECT points INTO v_winner_points FROM public.players WHERE id = v_p1;
    SELECT points INTO v_loser_points FROM public.players WHERE id = v_p2;
    ASSERT v_winner_points > 500, 'Winner should gain points';
    ASSERT v_loser_points < 500, 'Loser should lose points';
  END;

  RAISE NOTICE 'ALL TASK 13 TESTS PASSED';
END $$;

ROLLBACK;
