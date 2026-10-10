-- Migration: 27_fix_boss_points.sql

CREATE OR REPLACE FUNCTION public.resolve_challenge(p_challenge_id uuid, p_winner_id uuid, p_loser_id uuid, p_is_draw boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_challenge public.challenges%ROWTYPE;
  v_loser_points integer;
  v_loser_status text;
  v_theft_pct double precision;
  v_theft_amount integer;
BEGIN
  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF v_challenge.status = 'COMPLETED' THEN RAISE EXCEPTION 'Challenge already completed'; END IF;

  UPDATE public.challenges SET status = 'COMPLETED', winner_id = p_winner_id, loser_id = p_loser_id, is_draw = p_is_draw, updated_at = now() WHERE id = p_challenge_id;

  IF NOT p_is_draw AND p_winner_id IS NOT NULL AND p_loser_id IS NOT NULL THEN
    SELECT points, status INTO v_loser_points, v_loser_status FROM public.players WHERE id = p_loser_id FOR UPDATE;
    
    IF p_loser_id IN ('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, '33333333-3333-4333-8333-333333333333'::uuid) THEN
      -- Fixed rewards for defeating bosses
      IF p_loser_id = '11111111-1111-4111-8111-111111111111'::uuid THEN v_theft_amount := 400;
      ELSIF p_loser_id = '22222222-2222-4222-8222-222222222222'::uuid THEN v_theft_amount := 900;
      ELSIF p_loser_id = '33333333-3333-4333-8333-333333333333'::uuid THEN v_theft_amount := 2400;
      ELSE v_theft_amount := 0; END IF;
    ELSE
      v_theft_pct := random();
      v_theft_amount := floor(v_loser_points * v_theft_pct);
    END IF;

    UPDATE public.players SET points = points + 100 + v_theft_amount, status = 'ACTIVE' WHERE id = p_winner_id;
    
    INSERT INTO public.points_ledger (player_id, amount, transaction_type, reference_key)
    VALUES (p_winner_id, 100, 'CHALLENGE_REWARD', p_challenge_id || '-reward');
    
    IF v_theft_amount > 0 THEN
      INSERT INTO public.points_ledger (player_id, amount, transaction_type, reference_key)
      VALUES (p_winner_id, v_theft_amount, 'CHALLENGE_THEFT_CREDIT', p_challenge_id || '-theft-credit');
    END IF;

    UPDATE public.players SET points = points - v_theft_amount WHERE id = p_loser_id;
    
    IF v_theft_amount > 0 THEN
      INSERT INTO public.points_ledger (player_id, amount, transaction_type, reference_key)
      VALUES (p_loser_id, -v_theft_amount, 'CHALLENGE_THEFT_DEBIT', p_challenge_id || '-theft-debit');
    END IF;

    -- Only eliminate if it's a real player, not a boss bot
    IF p_loser_id NOT IN ('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, '33333333-3333-4333-8333-333333333333'::uuid) THEN
      IF (v_loser_points - v_theft_amount) <= 0 THEN
        UPDATE public.players SET status = 'ELIMINATED' WHERE id = p_loser_id;
      ELSIF v_loser_status = 'FINAL_SALVATION' THEN
        UPDATE public.players SET status = 'ELIMINATED' WHERE id = p_loser_id;
      ELSIF (v_loser_points - v_theft_amount) < 100 THEN
        UPDATE public.players SET status = 'FINAL_SALVATION' WHERE id = p_loser_id;
      END IF;
    END IF;
  END IF;
END;
$function$;
