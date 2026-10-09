BEGIN;

DO $$ 
DECLARE
  v_p1 uuid := gen_random_uuid();
  v_p2 uuid := gen_random_uuid();
  v_battle_id uuid;
  v_p2_health integer;
  v_p1_health integer;
  v_battle_status text;
  v_p1_effects jsonb;
BEGIN
  -- SETUP FIXTURE USERS
  INSERT INTO auth.users (id, email) VALUES (v_p1, 'test_p1_sigil@local.dev'), (v_p2, 'test_p2_sigil@local.dev');
  INSERT INTO public.players (id, handle, points, status) VALUES 
    (v_p1, 'SigilP1', 500, 'ACTIVE'), 
    (v_p2, 'SigilP2', 500, 'ACTIVE');

  ---------------------------------------------------------
  -- TEST 1: DAMAGE EFFECT & ARMOUR MITIGATION (Tests 1 & 5)
  ---------------------------------------------------------
  -- P1 has DAMAGE sigil
  INSERT INTO public.sigils (player_id, fingerprint, name, basic_ability, limitation, hidden_mechanic, ability_meta)
  VALUES (v_p1, 'f1', 'Fireball', 'burn', 'none', 'none', '{"type": "DAMAGE", "magnitude": 30, "cooldown": 2}');
  
  -- P2 has armour
  INSERT INTO public.inventory (player_id, item_id, quantity, equipped) VALUES (v_p2, 'arm_light', 1, true);
  
  INSERT INTO public.battles (player1_id, player2_id, current_turn_player_id, status, turn_counter, p1_health, p2_health)
  VALUES (v_p1, v_p2, v_p1, 'ACTIVE', 1, 100, 100) RETURNING id INTO v_battle_id;
  
  PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', v_p1), true);
  PERFORM public.submit_battle_action(v_battle_id, 1, 'SIGIL_ABILITY');
  
  SELECT p2_health, p1_effects INTO v_p2_health, v_p1_effects FROM public.battles WHERE id = v_battle_id;
  -- Base damage 30. Armour 'arm_light' protection is 10. So final damage = 20.
  ASSERT v_p2_health = 80, 'P2 health should be 80 after 30 DMG - 10 ARMOUR';
  
  ---------------------------------------------------------
  -- TEST 4: COOLDOWN ENFORCEMENT
  ---------------------------------------------------------
  -- P2 turn (P2 skips basically by just defending)
  PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', v_p2), true);
  PERFORM public.submit_battle_action(v_battle_id, 2, 'DEFEND');
  
  -- P1 tries to use Sigil again on Turn 3
  PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', v_p1), true);
  BEGIN
    PERFORM public.submit_battle_action(v_battle_id, 3, 'SIGIL_ABILITY');
    ASSERT FALSE, 'Expected cooldown exception';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM = 'Sigil ability is on cooldown', 'Unexpected exception: ' || SQLERRM;
  END;

  ---------------------------------------------------------
  -- TEST 1: HEAL EFFECT (Bounds)
  ---------------------------------------------------------
  UPDATE public.battles SET p1_health = 90 WHERE id = v_battle_id;
  UPDATE public.sigils SET ability_meta = '{"type": "HEAL", "magnitude": 50, "cooldown": 1}' WHERE player_id = v_p1;
  UPDATE public.battles SET p1_effects = '{}'::jsonb WHERE id = v_battle_id; -- reset cd
  
  PERFORM public.submit_battle_action(v_battle_id, 3, 'SIGIL_ABILITY');
  SELECT p1_health INTO v_p1_health FROM public.battles WHERE id = v_battle_id;
  ASSERT v_p1_health = 100, 'Health should cap at 100 after 50 HEAL on 90 HP';

  ---------------------------------------------------------
  -- TEST 2: REJECTION OF UNKNOWN TYPES
  ---------------------------------------------------------
  UPDATE public.sigils SET ability_meta = '{"type": "NUKE_WORLD", "magnitude": 1000}' WHERE player_id = v_p1;
  UPDATE public.battles SET p1_effects = '{}'::jsonb WHERE id = v_battle_id;
  
  PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', v_p2), true);
  PERFORM public.submit_battle_action(v_battle_id, 4, 'DEFEND');

  PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', v_p1), true);
  BEGIN
    PERFORM public.submit_battle_action(v_battle_id, 5, 'SIGIL_ABILITY');
    ASSERT FALSE, 'Expected unknown type exception';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM = 'Unknown ability type', 'Unexpected exception: ' || SQLERRM;
  END;

  ---------------------------------------------------------
  -- TEST 7: COMPATIBILITY WITH EXISTING SIGILS (NULL META)
  ---------------------------------------------------------
  UPDATE public.sigils SET ability_meta = NULL WHERE player_id = v_p1;
  BEGIN
    PERFORM public.submit_battle_action(v_battle_id, 5, 'SIGIL_ABILITY');
    ASSERT FALSE, 'Expected missing metadata exception';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM = 'Sigil does not have a structured ability', 'Unexpected exception: ' || SQLERRM;
  END;

  RAISE NOTICE 'ALL SIGIL TESTS PASSED';
END $$;

ROLLBACK;
