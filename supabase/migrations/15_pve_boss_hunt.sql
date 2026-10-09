-- Migration: 15_pve_boss_hunt.sql

CREATE TABLE IF NOT EXISTS public.bosses (
    id text PRIMARY KEY,
    name text NOT NULL,
    description text,
    difficulty text NOT NULL,
    max_health integer NOT NULL,
    base_damage integer NOT NULL,
    armour integer DEFAULT 0,
    behavior_pattern text NOT NULL,
    points_reward integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Insert bosses
INSERT INTO public.bosses (id, name, description, difficulty, max_health, base_damage, armour, behavior_pattern, points_reward)
VALUES 
('boss_hollow_knight', 'The Hollow Knight', 'A rusted remnant of a forgotten war. Swings wildly but rarely guards.', 'Tier I', 150, 15, 0, 'AGGRESSIVE', 500),
('boss_phantom', 'The Phantom', 'An ethereal operative utilizing disruption tactics.', 'Tier II', 200, 12, 5, 'TACTICAL', 1000),
('boss_executioner', 'The Executioner', 'A juggernaut built for raw destruction and brutal counterattacks.', 'Tier III', 300, 25, 10, 'HEAVY', 2500)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  max_health = EXCLUDED.max_health,
  base_damage = EXCLUDED.base_damage,
  armour = EXCLUDED.armour,
  behavior_pattern = EXCLUDED.behavior_pattern,
  points_reward = EXCLUDED.points_reward;

CREATE TABLE IF NOT EXISTS public.pve_encounters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id uuid NOT NULL REFERENCES public.players(id),
    boss_id text NOT NULL REFERENCES public.bosses(id),
    status text NOT NULL DEFAULT 'ACTIVE',
    player_health integer NOT NULL DEFAULT 100,
    boss_health integer NOT NULL,
    player_effects jsonb NOT NULL DEFAULT '{}'::jsonb,
    boss_effects jsonb NOT NULL DEFAULT '{}'::jsonb,
    player_defending boolean DEFAULT false,
    boss_defending boolean DEFAULT false,
    turn_counter integer NOT NULL DEFAULT 1,
    combat_log jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pve_encounters_active_player_idx ON public.pve_encounters (player_id) WHERE status = 'ACTIVE';

ALTER TABLE public.pve_encounters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can view their own encounters" ON public.pve_encounters FOR SELECT USING (auth.uid() = player_id);
-- No insert/update policies as it's handled by SECURITY DEFINER functions.
CREATE POLICY "Players can view all bosses" ON public.bosses FOR SELECT USING (true);


CREATE OR REPLACE FUNCTION public.start_pve_encounter(p_boss_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_boss public.bosses%ROWTYPE;
  v_encounter_id uuid;
  v_status text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT status INTO v_status FROM public.players WHERE id = v_uid;
  IF v_status != 'ACTIVE' THEN RAISE EXCEPTION 'Only ACTIVE players can start encounters'; END IF;

  SELECT * INTO v_boss FROM public.bosses WHERE id = p_boss_id;
  IF v_boss.id IS NULL THEN RAISE EXCEPTION 'Boss not found'; END IF;

  -- End any existing active encounters for this player as DEFEAT
  UPDATE public.pve_encounters SET status = 'DEFEAT' WHERE player_id = v_uid AND status = 'ACTIVE';

  INSERT INTO public.pve_encounters (player_id, boss_id, boss_health)
  VALUES (v_uid, p_boss_id, v_boss.max_health)
  RETURNING id INTO v_encounter_id;

  RETURN v_encounter_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_pve_action(p_encounter_id uuid, p_action_type text, p_item_id text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_enc public.pve_encounters%ROWTYPE;
  v_boss public.bosses%ROWTYPE;
  
  v_player_damage integer := 0;
  v_player_healing integer := 0;
  v_boss_damage integer := 0;
  v_boss_healing integer := 0;
  
  v_player_log_details jsonb := '{}'::jsonb;
  v_boss_log_details jsonb := '{}'::jsonb;
  
  v_weapon_id text;
  v_weapon_effects jsonb;
  v_item_effects jsonb;
  v_item_qty integer;
  
  v_sigil_meta jsonb;
  v_ability_type text;
  v_ability_mag integer;
  v_ability_dur integer;
  v_ability_cd integer;
  v_until_turn integer;
  
  v_boss_action text;
  v_rand numeric;
  
  v_counter_dmg integer := 0;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_enc FROM public.pve_encounters WHERE id = p_encounter_id FOR UPDATE;
  IF v_enc.id IS NULL THEN RAISE EXCEPTION 'Encounter not found'; END IF;
  IF v_enc.player_id != v_uid THEN RAISE EXCEPTION 'Not your encounter'; END IF;
  IF v_enc.status != 'ACTIVE' THEN RAISE EXCEPTION 'Encounter is not active'; END IF;

  SELECT * INTO v_boss FROM public.bosses WHERE id = v_enc.boss_id;

  -- 1. Check if player disrupted
  IF (v_enc.player_effects->>'disrupted_until') IS NOT NULL AND (v_enc.player_effects->>'disrupted_until')::integer >= v_enc.turn_counter THEN
    IF p_action_type = 'SIGIL_ABILITY' THEN
      RAISE EXCEPTION 'You are disrupted and cannot use your Sigil';
    END IF;
  END IF;

  v_enc.player_defending := false;
  v_enc.boss_defending := false;
  
  -- Determine Boss Action BEFORE resolving player, so we know if boss is defending
  v_rand := random();
  IF v_boss.behavior_pattern = 'AGGRESSIVE' THEN
    IF v_rand < 0.15 THEN v_boss_action := 'DEFEND'; ELSE v_boss_action := 'ATTACK'; END IF;
  ELSIF v_boss.behavior_pattern = 'TACTICAL' THEN
    IF v_rand < 0.3 THEN v_boss_action := 'DEFEND'; 
    ELSIF v_rand < 0.5 THEN v_boss_action := 'DISRUPT';
    ELSE v_boss_action := 'ATTACK'; END IF;
  ELSIF v_boss.behavior_pattern = 'HEAVY' THEN
    IF v_rand < 0.2 THEN v_boss_action := 'COUNTER';
    ELSIF v_rand < 0.4 THEN v_boss_action := 'DEFEND';
    ELSE v_boss_action := 'ATTACK'; END IF;
  ELSE
    v_boss_action := 'ATTACK';
  END IF;

  IF v_boss_action = 'DEFEND' THEN
    v_enc.boss_defending := true;
  END IF;

  -- =======================================
  -- PLAYER TURN
  -- =======================================
  IF p_action_type = 'ATTACK' THEN
    SELECT i.id, i.effects INTO v_weapon_id, v_weapon_effects
    FROM public.inventory inv
    JOIN public.items i ON i.id = inv.item_id
    WHERE inv.player_id = v_uid AND inv.equipped = true AND i.equipment_slot = 'weapon'
    LIMIT 1;

    IF FOUND AND v_weapon_effects ? 'damage' THEN
      v_player_damage := (v_weapon_effects->>'damage')::integer;
      v_player_log_details := jsonb_build_object('weapon', v_weapon_id, 'base_damage', v_player_damage);
    ELSE
      v_player_damage := 10;
      v_player_log_details := jsonb_build_object('weapon', 'unarmed', 'base_damage', v_player_damage);
    END IF;
    
    -- Disruption effect on damage
    IF (v_enc.player_effects->>'disrupted_until') IS NOT NULL AND (v_enc.player_effects->>'disrupted_until')::integer >= v_enc.turn_counter THEN
      v_player_damage := v_player_damage / 2;
      v_player_log_details := v_player_log_details || jsonb_build_object('disrupt_mitigation', true);
    END IF;

    -- Boss armor
    IF v_boss.armour > 0 THEN
      v_player_damage := GREATEST(0, v_player_damage - v_boss.armour);
      v_player_log_details := v_player_log_details || jsonb_build_object('armour_mitigation', v_boss.armour);
    END IF;

    IF v_enc.boss_defending THEN
      v_player_damage := v_player_damage / 2;
      v_player_log_details := v_player_log_details || jsonb_build_object('defend_mitigation', true);
    END IF;
    
    -- Boss shield
    IF (v_enc.boss_effects->>'shield_until') IS NOT NULL AND (v_enc.boss_effects->>'shield_until')::integer >= v_enc.turn_counter THEN
      v_player_damage := GREATEST(0, v_player_damage - (v_enc.boss_effects->>'shield_mag')::integer);
      v_player_log_details := v_player_log_details || jsonb_build_object('shield_mitigation', (v_enc.boss_effects->>'shield_mag')::integer);
    END IF;
    
    -- Boss counter
    IF (v_enc.boss_effects->>'counter_until') IS NOT NULL AND (v_enc.boss_effects->>'counter_until')::integer >= v_enc.turn_counter THEN
      v_counter_dmg := (v_enc.boss_effects->>'counter_mag')::integer;
      v_player_log_details := v_player_log_details || jsonb_build_object('countered_damage_taken', v_counter_dmg);
      v_enc.player_health := GREATEST(0, v_enc.player_health - v_counter_dmg);
      v_enc.boss_effects := (v_enc.boss_effects - 'counter_until') - 'counter_mag';
    END IF;

    v_player_log_details := v_player_log_details || jsonb_build_object('final_damage', v_player_damage);
    v_enc.boss_health := GREATEST(0, v_enc.boss_health - v_player_damage);

  ELSIF p_action_type = 'DEFEND' THEN
    v_enc.player_defending := true;
    v_player_log_details := jsonb_build_object('message', 'Takes a defensive stance');

  ELSIF p_action_type = 'USE_ITEM' THEN
    IF p_item_id IS NULL THEN RAISE EXCEPTION 'Item ID required for USE_ITEM'; END IF;

    SELECT quantity INTO v_item_qty FROM public.inventory
    WHERE player_id = v_uid AND item_id = p_item_id AND quantity > 0 FOR UPDATE;

    IF v_item_qty IS NULL THEN RAISE EXCEPTION 'Item not owned or out of stock'; END IF;

    SELECT effects INTO v_item_effects FROM public.items WHERE id = p_item_id AND category = 'utility';
    IF v_item_effects IS NULL THEN RAISE EXCEPTION 'Invalid utility item'; END IF;

    UPDATE public.inventory SET quantity = quantity - 1 WHERE player_id = v_uid AND item_id = p_item_id;

    IF v_item_effects ? 'healing' THEN
      v_player_healing := (v_item_effects->>'healing')::integer;
      v_player_healing := LEAST(v_player_healing, 100 - v_enc.player_health);
      v_enc.player_health := v_enc.player_health + v_player_healing;
      v_player_log_details := jsonb_build_object('item', p_item_id, 'healed', v_player_healing);
    ELSE
      v_player_log_details := jsonb_build_object('item', p_item_id, 'message', 'Used item with no direct effect');
    END IF;

  ELSIF p_action_type = 'SIGIL_ABILITY' THEN
    SELECT ability_meta INTO v_sigil_meta FROM public.sigils WHERE player_id = v_uid;
    IF v_sigil_meta IS NULL THEN RAISE EXCEPTION 'Sigil does not have a structured ability'; END IF;
    
    v_ability_type := v_sigil_meta->>'type';
    v_ability_mag := COALESCE((v_sigil_meta->>'magnitude')::integer, 0);
    v_ability_dur := COALESCE((v_sigil_meta->>'duration')::integer, 0);
    v_ability_cd := COALESCE((v_sigil_meta->>'cooldown')::integer, 0);

    IF v_ability_dur > 0 THEN
      v_until_turn := v_enc.turn_counter + (v_ability_dur * 2) - 1;
    ELSE
      v_until_turn := v_enc.turn_counter;
    END IF;

    IF (v_enc.player_effects->>'sigil_cd_until') IS NOT NULL AND (v_enc.player_effects->>'sigil_cd_until')::integer >= v_enc.turn_counter THEN
      RAISE EXCEPTION 'Sigil ability is on cooldown';
    END IF;
    
    v_enc.player_effects := v_enc.player_effects || jsonb_build_object('sigil_cd_until', v_enc.turn_counter + (v_ability_cd * 2) - 1);
    
    IF v_ability_type = 'DAMAGE' THEN
      v_player_damage := v_ability_mag;
      IF v_boss.armour > 0 THEN
        v_player_damage := GREATEST(0, v_player_damage - v_boss.armour);
        v_player_log_details := v_player_log_details || jsonb_build_object('armour_mitigation', v_boss.armour);
      END IF;
      IF v_enc.boss_defending THEN
        v_player_damage := v_player_damage / 2;
        v_player_log_details := v_player_log_details || jsonb_build_object('defend_mitigation', true);
      END IF;
      IF (v_enc.boss_effects->>'shield_until') IS NOT NULL AND (v_enc.boss_effects->>'shield_until')::integer >= v_enc.turn_counter THEN
        v_player_damage := GREATEST(0, v_player_damage - (v_enc.boss_effects->>'shield_mag')::integer);
        v_player_log_details := v_player_log_details || jsonb_build_object('shield_mitigation', (v_enc.boss_effects->>'shield_mag')::integer);
      END IF;
      v_enc.boss_health := GREATEST(0, v_enc.boss_health - v_player_damage);
      v_player_log_details := v_player_log_details || jsonb_build_object('ability', 'DAMAGE', 'final_damage', v_player_damage);
      
    ELSIF v_ability_type = 'HEAL' THEN
      v_player_healing := LEAST(v_ability_mag, 100 - v_enc.player_health);
      v_enc.player_health := v_enc.player_health + v_player_healing;
      v_player_log_details := jsonb_build_object('ability', 'HEAL', 'healed', v_player_healing);
      
    ELSIF v_ability_type = 'SHIELD' THEN
      v_enc.player_effects := v_enc.player_effects || jsonb_build_object('shield_until', v_until_turn, 'shield_mag', v_ability_mag);
      v_player_log_details := jsonb_build_object('ability', 'SHIELD', 'magnitude', v_ability_mag, 'duration', v_ability_dur);
      
    ELSIF v_ability_type = 'COUNTER' THEN
      v_enc.player_effects := v_enc.player_effects || jsonb_build_object('counter_until', v_until_turn, 'counter_mag', v_ability_mag);
      v_player_log_details := jsonb_build_object('ability', 'COUNTER', 'magnitude', v_ability_mag, 'duration', v_ability_dur);
      
    ELSIF v_ability_type = 'DISRUPT' THEN
      v_enc.boss_effects := v_enc.boss_effects || jsonb_build_object('disrupted_until', v_until_turn);
      v_player_log_details := jsonb_build_object('ability', 'DISRUPT', 'duration', v_ability_dur);
      
    ELSE
      RAISE EXCEPTION 'Unknown ability type';
    END IF;

  ELSE
    RAISE EXCEPTION 'Invalid action type';
  END IF;


  -- =======================================
  -- BOSS TURN
  -- =======================================
  IF v_enc.boss_health > 0 THEN
    IF v_boss_action = 'ATTACK' THEN
      v_boss_damage := v_boss.base_damage;
      v_boss_log_details := jsonb_build_object('base_damage', v_boss_damage);
      
      -- Boss Disrupted?
      IF (v_enc.boss_effects->>'disrupted_until') IS NOT NULL AND (v_enc.boss_effects->>'disrupted_until')::integer >= v_enc.turn_counter THEN
        v_boss_damage := v_boss_damage / 2;
        v_boss_log_details := v_boss_log_details || jsonb_build_object('disrupt_mitigation', true);
      END IF;
      
      -- Player Armor
      SELECT i.id, i.effects INTO v_weapon_id, v_weapon_effects -- Reusing variables
      FROM public.inventory inv
      JOIN public.items i ON i.id = inv.item_id
      WHERE inv.player_id = v_uid AND inv.equipped = true AND i.equipment_slot = 'body_armour'
      LIMIT 1;

      IF FOUND AND v_weapon_effects ? 'protection' THEN
        v_boss_damage := GREATEST(0, v_boss_damage - (v_weapon_effects->>'protection')::integer);
        v_boss_log_details := v_boss_log_details || jsonb_build_object('armour_mitigation', (v_weapon_effects->>'protection')::integer);
      END IF;

      IF v_enc.player_defending THEN
        v_boss_damage := v_boss_damage / 2;
        v_boss_log_details := v_boss_log_details || jsonb_build_object('defend_mitigation', true);
      END IF;
      
      IF (v_enc.player_effects->>'shield_until') IS NOT NULL AND (v_enc.player_effects->>'shield_until')::integer >= v_enc.turn_counter THEN
        v_boss_damage := GREATEST(0, v_boss_damage - (v_enc.player_effects->>'shield_mag')::integer);
        v_boss_log_details := v_boss_log_details || jsonb_build_object('shield_mitigation', (v_enc.player_effects->>'shield_mag')::integer);
      END IF;

      IF (v_enc.player_effects->>'counter_until') IS NOT NULL AND (v_enc.player_effects->>'counter_until')::integer >= v_enc.turn_counter THEN
        v_counter_dmg := (v_enc.player_effects->>'counter_mag')::integer;
        v_boss_log_details := v_boss_log_details || jsonb_build_object('countered_damage_taken', v_counter_dmg);
        v_enc.boss_health := GREATEST(0, v_enc.boss_health - v_counter_dmg);
        v_enc.player_effects := (v_enc.player_effects - 'counter_until') - 'counter_mag';
      END IF;

      v_boss_log_details := v_boss_log_details || jsonb_build_object('final_damage', v_boss_damage);
      v_enc.player_health := GREATEST(0, v_enc.player_health - v_boss_damage);

    ELSIF v_boss_action = 'DEFEND' THEN
      v_boss_log_details := jsonb_build_object('message', 'Boss takes a defensive stance');

    ELSIF v_boss_action = 'DISRUPT' THEN
      -- Boss specific ability logic
      v_enc.player_effects := v_enc.player_effects || jsonb_build_object('disrupted_until', v_enc.turn_counter + 3);
      v_boss_log_details := jsonb_build_object('ability', 'DISRUPT', 'duration', 2);
      
    ELSIF v_boss_action = 'COUNTER' THEN
      v_enc.boss_effects := v_enc.boss_effects || jsonb_build_object('counter_until', v_enc.turn_counter + 1, 'counter_mag', v_boss.base_damage);
      v_boss_log_details := jsonb_build_object('ability', 'COUNTER', 'magnitude', v_boss.base_damage);
    END IF;
  END IF;

  -- Append to log
  v_enc.combat_log := v_enc.combat_log || jsonb_build_array(
    jsonb_build_object('turn', v_enc.turn_counter, 'actor', 'player', 'action', p_action_type, 'details', v_player_log_details),
    jsonb_build_object('turn', v_enc.turn_counter, 'actor', 'boss', 'action', v_boss_action, 'details', v_boss_log_details)
  );

  -- Evaluate End Conditions
  IF v_enc.player_health <= 0 THEN
    v_enc.status := 'DEFEAT';
  ELSIF v_enc.boss_health <= 0 THEN
    v_enc.status := 'VICTORY';
    
    -- Grant points with idempotent ledger entry
    -- Using the ledger's UNIQUE constraint on reference_key to prevent duplicate rewards.
    -- On conflict, it does nothing (DO NOTHING).
    INSERT INTO public.points_ledger (player_id, amount, transaction_type, reference_key)
    VALUES (v_uid, v_boss.points_reward, 'BOSS_VICTORY', v_uid || '-boss-victory-' || v_boss.id)
    ON CONFLICT (reference_key) DO NOTHING;
    
    -- We need to check if row was actually inserted to give them the points in players table
    IF FOUND THEN
      UPDATE public.players SET points = points + v_boss.points_reward WHERE id = v_uid;
    END IF;
  END IF;

  v_enc.turn_counter := v_enc.turn_counter + 1;
  v_enc.updated_at := now();

  UPDATE public.pve_encounters SET
    status = v_enc.status,
    player_health = v_enc.player_health,
    boss_health = v_enc.boss_health,
    player_effects = v_enc.player_effects,
    boss_effects = v_enc.boss_effects,
    player_defending = v_enc.player_defending,
    boss_defending = v_enc.boss_defending,
    turn_counter = v_enc.turn_counter,
    combat_log = v_enc.combat_log,
    updated_at = v_enc.updated_at
  WHERE id = p_encounter_id;

END;
$function$;
