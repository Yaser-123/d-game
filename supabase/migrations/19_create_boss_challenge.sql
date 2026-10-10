-- Migration: 19_create_boss_challenge.sql

CREATE OR REPLACE FUNCTION public.create_boss_challenge(
    p_boss_id uuid,
    p_game_type challenge_type,
    p_public_state jsonb,
    p_private_state jsonb,
    p_p2_private_state jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_uid uuid;
    v_challenge_id uuid;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    
    INSERT INTO public.challenges (
        challenger_id,
        challenged_id,
        type,
        status,
        public_state,
        private_state,
        p2_private_state,
        created_at,
        updated_at
    ) VALUES (
        v_uid,
        p_boss_id,
        p_game_type,
        'ACTIVE',
        p_public_state,
        p_private_state,
        p_p2_private_state,
        now(),
        now()
    ) RETURNING id INTO v_challenge_id;

    RETURN v_challenge_id;
END;
$$;
