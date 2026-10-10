-- Add GPS coordinates to players table
ALTER TABLE public.players 
ADD COLUMN latitude float8,
ADD COLUMN longitude float8;

-- Create an RPC to update player location
CREATE OR REPLACE FUNCTION update_player_location(p_lat float8, p_lng float8)
RETURNS void AS $$
BEGIN
  UPDATE public.players 
  SET latitude = p_lat, longitude = p_lng 
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_public_players to also return coordinates
DROP FUNCTION IF EXISTS get_public_players();
CREATE OR REPLACE FUNCTION get_public_players()
RETURNS TABLE (
  player_id uuid,
  handle text,
  sigil_name text,
  basic_ability text,
  mastery int,
  created_at timestamptz,
  latitude float8,
  longitude float8
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as player_id,
    p.handle,
    s.name as sigil_name,
    s.basic_ability,
    s.mastery,
    p.created_at,
    p.latitude,
    p.longitude
  FROM public.players p
  JOIN public.sigils s ON p.id = s.player_id
  WHERE p.id != auth.uid()
  AND p.status != 'ELIMINATED'
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
