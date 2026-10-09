-- Migration 12_intel_exchange.sql

CREATE TYPE public.intel_category AS ENUM (
  'SIGIL_CLASS',
  'ABILITY_HINT',
  'LIMITATION',
  'MECHANIC_CLUE'
);

CREATE TABLE public.intel_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.players(id),
  sigil_id uuid NOT NULL REFERENCES public.sigils(id),
  title text NOT NULL,
  category public.intel_category NOT NULL,
  price integer NOT NULL CHECK (price > 0 AND price <= 1000),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SOLD', 'CANCELLED')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.intel_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active or sold listings" 
ON public.intel_listings FOR SELECT 
TO public 
USING (status IN ('ACTIVE', 'SOLD') OR seller_id = auth.uid());

CREATE TABLE public.intel_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.players(id),
  listing_id uuid NOT NULL REFERENCES public.intel_listings(id),
  price_paid integer NOT NULL,
  purchased_at timestamp with time zone DEFAULT now(),
  UNIQUE (buyer_id, listing_id)
);

ALTER TABLE public.intel_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own purchases" 
ON public.intel_purchases FOR SELECT 
TO public 
USING (buyer_id = auth.uid());
CREATE POLICY "Sellers can view their sales"
ON public.intel_purchases FOR SELECT
TO public
USING (
  EXISTS (SELECT 1 FROM public.intel_listings l WHERE l.id = listing_id AND l.seller_id = auth.uid())
);

CREATE TABLE public.intel_disclosures (
  listing_id uuid PRIMARY KEY REFERENCES public.intel_listings(id),
  content text NOT NULL
);

ALTER TABLE public.intel_disclosures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyers and sellers can view disclosure" 
ON public.intel_disclosures FOR SELECT 
TO public 
USING (
  EXISTS (
    SELECT 1 FROM public.intel_listings l WHERE l.id = listing_id AND l.seller_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.intel_purchases p WHERE p.listing_id = intel_disclosures.listing_id AND p.buyer_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.create_intel_listing(p_title text, p_category text, p_price integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sigil public.sigils%ROWTYPE;
  v_content text;
  v_listing_id uuid;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  
  SELECT status INTO v_status FROM public.players WHERE id = v_uid;
  IF v_status != 'ACTIVE' THEN RAISE EXCEPTION 'Only ACTIVE players can sell intel'; END IF;

  IF p_price <= 0 OR p_price > 1000 THEN RAISE EXCEPTION 'Price must be between 1 and 1000'; END IF;

  SELECT * INTO v_sigil FROM public.sigils WHERE player_id = v_uid;
  IF v_sigil.id IS NULL THEN RAISE EXCEPTION 'No sigil found to disclose'; END IF;

  IF p_category = 'SIGIL_CLASS' THEN
    IF v_sigil.ability_meta IS NULL THEN RAISE EXCEPTION 'Sigil class not available'; END IF;
    v_content := 'Type: ' || (v_sigil.ability_meta->>'type');
  ELSIF p_category = 'ABILITY_HINT' THEN
    IF v_sigil.basic_ability IS NULL THEN RAISE EXCEPTION 'Ability hint not available'; END IF;
    v_content := v_sigil.basic_ability;
  ELSIF p_category = 'LIMITATION' THEN
    IF v_sigil.limitation IS NULL THEN RAISE EXCEPTION 'Limitation not available'; END IF;
    v_content := v_sigil.limitation;
  ELSIF p_category = 'MECHANIC_CLUE' THEN
    IF v_sigil.hidden_mechanic IS NULL THEN RAISE EXCEPTION 'Mechanic clue not available'; END IF;
    v_content := v_sigil.hidden_mechanic;
  ELSE
    RAISE EXCEPTION 'Invalid category';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.intel_listings 
    WHERE seller_id = v_uid AND category = p_category::public.intel_category AND status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'You already have an active listing for this category';
  END IF;

  INSERT INTO public.intel_listings (seller_id, sigil_id, title, category, price, status)
  VALUES (v_uid, v_sigil.id, p_title, p_category::public.intel_category, p_price, 'ACTIVE')
  RETURNING id INTO v_listing_id;

  INSERT INTO public.intel_disclosures (listing_id, content)
  VALUES (v_listing_id, v_content);

  RETURN v_listing_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_intel(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_listing public.intel_listings%ROWTYPE;
  v_buyer public.players%ROWTYPE;
  v_seller public.players%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_buyer FROM public.players WHERE id = v_uid FOR UPDATE;
  IF v_buyer.status IN ('ELIMINATED', 'FINAL_SALVATION') THEN
    RAISE EXCEPTION 'You are not eligible to purchase intel';
  END IF;

  SELECT * INTO v_listing FROM public.intel_listings WHERE id = p_listing_id FOR UPDATE;
  IF v_listing.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF v_listing.status != 'ACTIVE' THEN RAISE EXCEPTION 'Listing is no longer active'; END IF;
  IF v_listing.seller_id = v_uid THEN RAISE EXCEPTION 'You cannot buy your own intel'; END IF;

  IF v_buyer.points - v_listing.price < 100 THEN
    RAISE EXCEPTION 'Insufficient points. You must maintain at least 100 PTS.';
  END IF;

  SELECT * INTO v_seller FROM public.players WHERE id = v_listing.seller_id FOR UPDATE;

  UPDATE public.players SET points = points - v_listing.price WHERE id = v_buyer.id;
  UPDATE public.players SET points = points + v_listing.price WHERE id = v_seller.id;

  INSERT INTO public.points_ledger (player_id, amount, transaction_type, reference_key)
  VALUES (v_buyer.id, -v_listing.price, 'INTEL_PURCHASE_DEBIT', 'INTEL_BUY_' || p_listing_id || '_' || v_uid);

  INSERT INTO public.points_ledger (player_id, amount, transaction_type, reference_key)
  VALUES (v_seller.id, v_listing.price, 'INTEL_SALE_CREDIT', 'INTEL_SELL_' || p_listing_id || '_' || v_uid);

  INSERT INTO public.intel_purchases (buyer_id, listing_id, price_paid)
  VALUES (v_uid, p_listing_id, v_listing.price);

  UPDATE public.intel_listings SET status = 'SOLD', updated_at = now() WHERE id = p_listing_id;

END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_intel_listing(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_listing public.intel_listings%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  
  SELECT * INTO v_listing FROM public.intel_listings WHERE id = p_listing_id FOR UPDATE;
  IF v_listing.seller_id != v_uid THEN RAISE EXCEPTION 'Not your listing'; END IF;
  IF v_listing.status != 'ACTIVE' THEN RAISE EXCEPTION 'Only ACTIVE listings can be cancelled'; END IF;
  
  UPDATE public.intel_listings SET status = 'CANCELLED', updated_at = now() WHERE id = p_listing_id;
END;
$$;
