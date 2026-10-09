-- Migration: 08_sigil_fixes.sql

CREATE OR REPLACE FUNCTION public.submit_battle_action(p_battle_id uuid, p_expected_turn integer, p_action_type text, p_item_id text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_battle public.battles%ROWTYPE;
  v_is_p1 boolean;
  v_opponent_id uuid;
  v_damage integer := 0;
  v_healing integer := 0;
  v_log_details jsonb := '{}'::jsonb;
  v_weapon_id text;
  v_armour_id text;
  v_weapon_effects jsonb;
  v_armour_effects jsonb;
  v_item_effects jsonb;
  v_base_damage integer := 10;
  v_opponent_defending boolean;
  v_item_qty integer;
  v_actor_status text;
  
  -- Ability variables
  v_sigil_meta jsonb;
  v_ability_type text;
  v_ability_mag integer;
  v_ability_dur integer;
  v_ability_cd integer;
  v_until_turn integer;
  
  v_my_effects jsonb;
  v_opp_effects jsonb;
  v_new_my_effects jsonb;
  v_new_opp_effects jsonb;
  
  -- Counter / Disrupt
  v_counter_dmg integer := 0;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT status INTO v_actor_status FROM public.players WHERE id = v_uid;
  IF v_actor_status = 'ELIMINATED' THEN RAISE EXCEPTION 'You are permanently eliminated'; END IF;

  SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id FOR UPDATE;
  IF v_battle.id IS NULL THEN RAISE EXCEPTION 'Battle not found'; END IF;
  IF v_uid != v_battle.player1_id AND v_uid != v_battle.player2_id THEN RAISE EXCEPTION 'Not a participant'; END IF;
  IF v_battle.status != 'ACTIVE' THEN RAISE EXCEPTION 'Battle is not active'; END IF;
  IF v_battle.current_turn_player_id != v_uid THEN RAISE EXCEPTION 'Not your turn'; END IF;
  IF v_battle.turn_counter != p_expected_turn THEN RAISE EXCEPTION 'Turn synchronization error (expected turn %, got %)', v_battle.turn_counter, p_expected_turn; END IF;

  v_is_p1 := (v_uid = v_battle.player1_id);
  v_opponent_id := CASE WHEN v_is_p1 THEN v_battle.player2_id ELSE v_battle.player1_id END;
  v_opponent_defending := CASE WHEN v_is_p1 THEN v_battle.p2_defending ELSE v_battle.p1_defending END;
  
  v_my_effects := CASE WHEN v_is_p1 THEN v_battle.p1_effects ELSE v_battle.p2_effects END;
  v_opp_effects := CASE WHEN v_is_p1 THEN v_battle.p2_effects ELSE v_battle.p1_effects END;
  
  v_new_my_effects := v_my_effects;
  v_new_opp_effects := v_opp_effects;

  -- Check if actor is disrupted
  IF (v_my_effects->>'disrupted_until') IS NOT NULL AND (v_my_effects->>'disrupted_until')::integer >= v_battle.turn_counter THEN
    IF p_action_type = 'SIGIL_ABILITY' THEN
      RAISE EXCEPTION 'You are disrupted and cannot use your Sigil';
    END IF;
  END IF;

  IF v_is_p1 THEN
    v_battle.p1_defending := false;
  ELSE
    v_battle.p2_defending := false;
  END IF;

  IF p_action_type = 'ATTACK' THEN
    SELECT i.id, i.effects INTO v_weapon_id, v_weapon_effects
    FROM public.inventory inv
    JOIN public.items i ON i.id = inv.item_id
    WHERE inv.player_id = v_uid AND inv.equipped = true AND i.equipment_slot = 'weapon'
    LIMIT 1;

    IF FOUND AND v_weapon_effects ? 'damage' THEN
      v_damage := (v_weapon_effects->>'damage')::integer;
      v_log_details := jsonb_build_object('weapon', v_weapon_id, 'base_damage', v_damage);
    ELSE
      v_damage := v_base_damage;
      v_log_details := jsonb_build_object('weapon', 'unarmed', 'base_damage', v_damage);
    END IF;
    
    -- Disruption effect on damage
    IF (v_my_effects->>'disrupted_until') IS NOT NULL AND (v_my_effects->>'disrupted_until')::integer >= v_battle.turn_counter THEN
      v_damage := v_damage / 2;
      v_log_details := v_log_details || jsonb_build_object('disrupt_mitigation', true);
    END IF;

    SELECT i.id, i.effects INTO v_armour_id, v_armour_effects
    FROM public.inventory inv
    JOIN public.items i ON i.id = inv.item_id
    WHERE inv.player_id = v_opponent_id AND inv.equipped = true AND i.equipment_slot = 'body_armour'
    LIMIT 1;

    IF FOUND AND v_armour_effects ? 'protection' THEN
      v_damage := GREATEST(0, v_damage - (v_armour_effects->>'protection')::integer);
      v_log_details := v_log_details || jsonb_build_object('armour_mitigation', (v_armour_effects->>'protection')::integer);
    END IF;

    IF v_opponent_defending THEN
      v_damage := v_damage / 2;
      v_log_details := v_log_details || jsonb_build_object('defend_mitigation', true);
    END IF;
    
    -- Opponent SHIELD effect
    IF (v_opp_effects->>'shield_until') IS NOT NULL AND (v_opp_effects->>'shield_until')::integer >= v_battle.turn_counter THEN
      v_damage := GREATEST(0, v_damage - (v_opp_effects->>'shield_mag')::integer);
      v_log_details := v_log_details || jsonb_build_object('shield_mitigation', (v_opp_effects->>'shield_mag')::integer);
    END IF;
    
    -- Opponent COUNTER effect
    IF (v_opp_effects->>'counter_until') IS NOT NULL AND (v_opp_effects->>'counter_until')::integer >= v_battle.turn_counter THEN
      v_counter_dmg := (v_opp_effects->>'counter_mag')::integer;
      v_log_details := v_log_details || jsonb_build_object('countered_damage_taken', v_counter_dmg);
      -- Apply counter damage to the attacker
      IF v_is_p1 THEN
        v_battle.p1_health := GREATEST(0, v_battle.p1_health - v_counter_dmg);
      ELSE
        v_battle.p2_health := GREATEST(0, v_battle.p2_health - v_counter_dmg);
      END IF;
      -- Consume counter
      v_new_opp_effects := (v_new_opp_effects - 'counter_until') - 'counter_mag';
    END IF;

    v_log_details := v_log_details || jsonb_build_object('final_damage', v_damage);

    IF v_is_p1 THEN
      v_battle.p2_health := GREATEST(0, v_battle.p2_health - v_damage);
    ELSE
      v_battle.p1_health := GREATEST(0, v_battle.p1_health - v_damage);
    END IF;

  ELSIF p_action_type = 'DEFEND' THEN
    IF v_is_p1 THEN
      v_battle.p1_defending := true;
    ELSE
      v_battle.p2_defending := true;
    END IF;
    v_log_details := jsonb_build_object('message', 'Takes a defensive stance');

  ELSIF p_action_type = 'USE_ITEM' THEN
    IF p_item_id IS NULL THEN RAISE EXCEPTION 'Item ID required for USE_ITEM'; END IF;

    SELECT quantity INTO v_item_qty FROM public.inventory
    WHERE player_id = v_uid AND item_id = p_item_id AND quantity > 0 FOR UPDATE;

    IF v_item_qty IS NULL THEN RAISE EXCEPTION 'Item not owned or out of stock'; END IF;

    SELECT effects INTO v_item_effects FROM public.items WHERE id = p_item_id AND category = 'utility';
    IF v_item_effects IS NULL THEN RAISE EXCEPTION 'Invalid utility item'; END IF;

    UPDATE public.inventory SET quantity = quantity - 1 WHERE player_id = v_uid AND item_id = p_item_id;

    IF v_item_effects ? 'healing' THEN
      v_healing := (v_item_effects->>'healing')::integer;
      -- Record actual healing done (cap at 100)
      IF v_is_p1 THEN
        v_healing := LEAST(v_healing, 100 - v_battle.p1_health);
        v_battle.p1_health := v_battle.p1_health + v_healing;
      ELSE
        v_healing := LEAST(v_healing, 100 - v_battle.p2_health);
        v_battle.p2_health := v_battle.p2_health + v_healing;
      END IF;
      v_log_details := jsonb_build_object('item', p_item_id, 'healed', v_healing);
    ELSE
      v_log_details := jsonb_build_object('item', p_item_id, 'message', 'Used item with no direct effect');
    END IF;

  ELSIF p_action_type = 'SIGIL_ABILITY' THEN
    SELECT ability_meta INTO v_sigil_meta FROM public.sigils WHERE player_id = v_uid;
    IF v_sigil_meta IS NULL THEN RAISE EXCEPTION 'Sigil does not have a structured ability'; END IF;
    
    v_ability_type := v_sigil_meta->>'type';
    v_ability_mag := COALESCE((v_sigil_meta->>'magnitude')::integer, 0);
    v_ability_dur := COALESCE((v_sigil_meta->>'duration')::integer, 0);
    v_ability_cd := COALESCE((v_sigil_meta->>'cooldown')::integer, 0);

    IF v_ability_dur > 0 THEN
      v_until_turn := v_battle.turn_counter + (v_ability_dur * 2) - 1;
    ELSE
      v_until_turn := v_battle.turn_counter;
    END IF;

    -- Check Cooldown
    IF (v_my_effects->>'sigil_cd_until') IS NOT NULL AND (v_my_effects->>'sigil_cd_until')::integer >= v_battle.turn_counter THEN
      RAISE EXCEPTION 'Sigil ability is on cooldown';
    END IF;
    
    -- Set Cooldown
    v_new_my_effects := v_new_my_effects || jsonb_build_object('sigil_cd_until', v_battle.turn_counter + (v_ability_cd * 2) - 1);
    
    IF v_ability_type = 'DAMAGE' THEN
      v_damage := v_ability_mag;
      
      SELECT i.id, i.effects INTO v_armour_id, v_armour_effects
      FROM public.inventory inv
      JOIN public.items i ON i.id = inv.item_id
      WHERE inv.player_id = v_opponent_id AND inv.equipped = true AND i.equipment_slot = 'body_armour'
      LIMIT 1;

      IF FOUND AND v_armour_effects ? 'protection' THEN
        v_damage := GREATEST(0, v_damage - (v_armour_effects->>'protection')::integer);
        v_log_details := v_log_details || jsonb_build_object('armour_mitigation', (v_armour_effects->>'protection')::integer);
      END IF;

      IF v_opponent_defending THEN
        v_damage := v_damage / 2;
        v_log_details := v_log_details || jsonb_build_object('defend_mitigation', true);
      END IF;
      
      IF (v_opp_effects->>'shield_until') IS NOT NULL AND (v_opp_effects->>'shield_until')::integer >= v_battle.turn_counter THEN
        v_damage := GREATEST(0, v_damage - (v_opp_effects->>'shield_mag')::integer);
        v_log_details := v_log_details || jsonb_build_object('shield_mitigation', (v_opp_effects->>'shield_mag')::integer);
      END IF;
      
      IF v_is_p1 THEN
        v_battle.p2_health := GREATEST(0, v_battle.p2_health - v_damage);
      ELSE
        v_battle.p1_health := GREATEST(0, v_battle.p1_health - v_damage);
      END IF;
      
      v_log_details := v_log_details || jsonb_build_object('ability', 'DAMAGE', 'final_damage', v_damage);
      
    ELSIF v_ability_type = 'HEAL' THEN
      IF v_is_p1 THEN
        v_healing := LEAST(v_ability_mag, 100 - v_battle.p1_health);
        v_battle.p1_health := v_battle.p1_health + v_healing;
      ELSE
        v_healing := LEAST(v_ability_mag, 100 - v_battle.p2_health);
        v_battle.p2_health := v_battle.p2_health + v_healing;
      END IF;
      v_log_details := jsonb_build_object('ability', 'HEAL', 'healed', v_healing);
      
    ELSIF v_ability_type = 'SHIELD' THEN
      v_new_my_effects := v_new_my_effects || jsonb_build_object('shield_until', v_until_turn, 'shield_mag', v_ability_mag);
      v_log_details := jsonb_build_object('ability', 'SHIELD', 'magnitude', v_ability_mag, 'duration', v_ability_dur);
      
    ELSIF v_ability_type = 'COUNTER' THEN
      v_new_my_effects := v_new_my_effects || jsonb_build_object('counter_until', v_until_turn, 'counter_mag', v_ability_mag);
      v_log_details := jsonb_build_object('ability', 'COUNTER', 'magnitude', v_ability_mag, 'duration', v_ability_dur);
      
    ELSIF v_ability_type = 'DISRUPT' THEN
      v_new_opp_effects := v_new_opp_effects || jsonb_build_object('disrupted_until', v_until_turn);
      v_log_details := jsonb_build_object('ability', 'DISRUPT', 'duration', v_ability_dur);
      
    ELSE
      RAISE EXCEPTION 'Unknown ability type';
    END IF;

  ELSE
    RAISE EXCEPTION 'Invalid action type';
  END IF;

  INSERT INTO public.battle_logs (battle_id, turn_number, actor_id, action_type, action_details)
  VALUES (p_battle_id, v_battle.turn_counter, v_uid, p_action_type, v_log_details);

  IF v_battle.p1_health = 0 THEN
    v_battle.status := 'COMPLETED';
    v_battle.winner_id := v_battle.player2_id;
    v_battle.completion_reason := 'PLAYER_1_DEFEATED';
  ELSIF v_battle.p2_health = 0 THEN
    v_battle.status := 'COMPLETED';
    v_battle.winner_id := v_battle.player1_id;
    v_battle.completion_reason := 'PLAYER_2_DEFEATED';
  ELSIF v_battle.turn_counter >= v_battle.max_turns THEN
    v_battle.status := 'COMPLETED';
    v_battle.completion_reason := 'TURN_LIMIT_REACHED';
    IF v_battle.p1_health > v_battle.p2_health THEN
      v_battle.winner_id := v_battle.player1_id;
    ELSIF v_battle.p2_health > v_battle.p1_health THEN
      v_battle.winner_id := v_battle.player2_id;
    END IF;
  END IF;

  -- Economy Settlement Phase
  IF v_battle.status = 'COMPLETED' AND v_battle.winner_id IS NOT NULL THEN
    DECLARE
      v_loser_id uuid;
      v_winner_points integer;
      v_loser_points integer;
      v_loser_status text;
      v_theft_pct numeric;
      v_theft_amount integer;
    BEGIN
      v_loser_id := CASE WHEN v_battle.winner_id = v_battle.player1_id THEN v_battle.player2_id ELSE v_battle.player1_id END;
      
      SELECT points INTO v_winner_points FROM public.players WHERE id = v_battle.winner_id FOR UPDATE;
      SELECT points, status INTO v_loser_points, v_loser_status FROM public.players WHERE id = v_loser_id FOR UPDATE;

      v_theft_pct := random();
      v_theft_amount := floor(v_loser_points * v_theft_pct);

      UPDATE public.players SET points = points + 100 + v_theft_amount, status = 'ACTIVE' WHERE id = v_battle.winner_id;
      
      INSERT INTO public.points_ledger (player_id, amount, transaction_type, reference_key)
      VALUES (v_battle.winner_id, 100, 'BATTLE_REWARD', p_battle_id || '-reward');
      
      IF v_theft_amount > 0 THEN
        INSERT INTO public.points_ledger (player_id, amount, transaction_type, reference_key)
        VALUES (v_battle.winner_id, v_theft_amount, 'BATTLE_THEFT_CREDIT', p_battle_id || '-theft-credit');
      END IF;

      UPDATE public.players SET points = points - v_theft_amount WHERE id = v_loser_id;
      
      IF v_theft_amount > 0 THEN
        INSERT INTO public.points_ledger (player_id, amount, transaction_type, reference_key)
        VALUES (v_loser_id, -v_theft_amount, 'BATTLE_THEFT_DEBIT', p_battle_id || '-theft-debit');
      END IF;

      IF (v_loser_points - v_theft_amount) <= 0 THEN
        UPDATE public.players SET status = 'ELIMINATED' WHERE id = v_loser_id;
      ELSIF v_loser_status = 'FINAL_SALVATION' THEN
        UPDATE public.players SET status = 'ELIMINATED' WHERE id = v_loser_id;
      ELSIF (v_loser_points - v_theft_amount) < 100 THEN
        UPDATE public.players SET status = 'FINAL_SALVATION' WHERE id = v_loser_id;
      END IF;
    END;
  END IF;

  IF v_battle.status = 'ACTIVE' THEN
    v_battle.turn_counter := v_battle.turn_counter + 1;
    v_battle.current_turn_player_id := v_opponent_id;
  END IF;

  v_battle.updated_at := now();
  
  IF v_is_p1 THEN
    v_battle.p1_effects := v_new_my_effects;
    v_battle.p2_effects := v_new_opp_effects;
  ELSE
    v_battle.p2_effects := v_new_my_effects;
    v_battle.p1_effects := v_new_opp_effects;
  END IF;

  UPDATE public.battles SET
    status = v_battle.status,
    winner_id = v_battle.winner_id,
    completion_reason = v_battle.completion_reason,
    p1_health = v_battle.p1_health,
    p2_health = v_battle.p2_health,
    p1_defending = v_battle.p1_defending,
    p2_defending = v_battle.p2_defending,
    p1_effects = v_battle.p1_effects,
    p2_effects = v_battle.p2_effects,
    current_turn_player_id = v_battle.current_turn_player_id,
    turn_counter = v_battle.turn_counter,
    updated_at = v_battle.updated_at
  WHERE id = p_battle_id;

END;
$function$;
