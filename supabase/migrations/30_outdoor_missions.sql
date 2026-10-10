-- Add a secure RPC to claim mission points
CREATE OR REPLACE FUNCTION claim_mission_reward()
RETURNS void AS $$
BEGIN
  UPDATE public.players 
  SET points = points + 50
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
