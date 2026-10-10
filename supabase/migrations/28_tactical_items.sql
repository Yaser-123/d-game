
-- Migration: 28_tactical_items.sql

-- Clear old items from inventories
DELETE FROM public.inventory;

-- Clear old items
DELETE FROM public.items;

-- Insert new Tactical Items
INSERT INTO public.items (id, name, category, description, equipment_slot, is_stackable, price, effects) VALUES
(gen_random_uuid(), 'Adrenaline Stim', 'utility', 'Experimental regenerative compound. Instantly restores 1 HP mid-battle.', null, true, 1000, '{"heal": 1}'),
(gen_random_uuid(), 'Chrono-Shift Device', 'utility', 'Manipulate local spacetime. Instantly skip your turn, forcing the opponent to act.', null, true, 2500, '{"skip_turn": true}'),
(gen_random_uuid(), 'Lazarus Protocol', 'defence', 'Neural backup matrix. Automatically revives you from 0 HP back to 1 HP once per match.', 'defence', false, 10000, '{"revive": true}');
