-- Migration: 10_black_market.sql

CREATE OR REPLACE FUNCTION public.purchase_item(p_item_id text, p_quantity integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_player public.players%ROWTYPE;
  v_item public.items%ROWTYPE;
  v_total_cost integer;
  v_inventory public.inventory%ROWTYPE;
  v_reference_key text;
BEGIN
  -- 1. Validate inputs
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Lock and fetch player
  SELECT * INTO v_player FROM public.players WHERE id = v_uid FOR UPDATE;
  IF v_player.id IS NULL THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  -- 3. Check status
  IF v_player.status = 'ELIMINATED' THEN
    RAISE EXCEPTION 'Eliminated players cannot access the Black Market';
  END IF;
  IF v_player.status = 'FINAL_SALVATION' THEN
    RAISE EXCEPTION 'Players in Final Salvation cannot access the Black Market';
  END IF;

  -- 4. Lock and fetch item
  SELECT * INTO v_item FROM public.items WHERE id = p_item_id FOR SHARE;
  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'Item not found in the catalogue';
  END IF;
  
  -- Prevent negative prices just in case
  IF v_item.price < 0 THEN
    RAISE EXCEPTION 'Invalid item price';
  END IF;

  v_total_cost := v_item.price * p_quantity;

  -- 5. Check affordability and balance rules
  IF v_player.points < v_total_cost THEN
    RAISE EXCEPTION 'Insufficient points';
  END IF;

  IF (v_player.points - v_total_cost) < 100 THEN
    RAISE EXCEPTION 'Purchase would drop points below 100, which is required to remain ACTIVE in standard engagements';
  END IF;

  -- 6. Lock and fetch existing inventory row if it exists
  SELECT * INTO v_inventory FROM public.inventory 
  WHERE player_id = v_uid AND item_id = p_item_id 
  FOR UPDATE;

  -- 7. Handle stackability and inventory update
  IF v_inventory.id IS NOT NULL THEN
    IF NOT v_item.is_stackable THEN
      RAISE EXCEPTION 'You already own this non-stackable item';
    END IF;

    UPDATE public.inventory 
    SET quantity = quantity + p_quantity 
    WHERE id = v_inventory.id;
  ELSE
    IF NOT v_item.is_stackable AND p_quantity > 1 THEN
      RAISE EXCEPTION 'Cannot purchase multiple non-stackable items';
    END IF;

    INSERT INTO public.inventory (player_id, item_id, quantity, equipped)
    VALUES (v_uid, p_item_id, p_quantity, false);
  END IF;

  -- 8. Deduct points
  UPDATE public.players
  SET points = points - v_total_cost
  WHERE id = v_uid;

  -- 9. Insert points ledger entry
  -- Generate unique idempotency key based on time or random uuid
  v_reference_key := 'SHOP_PURCHASE_' || v_uid || '_' || p_item_id || '_' || gen_random_uuid();
  
  INSERT INTO public.points_ledger (player_id, amount, transaction_type, reference_key)
  VALUES (v_uid, -v_total_cost, 'SHOP_PURCHASE', v_reference_key);

END;
$function$;
