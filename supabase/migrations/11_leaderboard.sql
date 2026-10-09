-- Migration: 11_leaderboard.sql

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_limit integer DEFAULT 50)
RETURNS TABLE (
  rank bigint,
  player_id uuid,
  handle text,
  points integer,
  battles_completed bigint,
  wins bigint,
  losses bigint,
  win_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT 
      p.id AS player_id,
      p.handle,
      p.points,
      COUNT(b.id) AS battles_completed,
      COUNT(CASE WHEN b.winner_id = p.id THEN 1 END) AS wins,
      COUNT(CASE WHEN b.winner_id IS NOT NULL AND b.winner_id != p.id THEN 1 END) AS losses
    FROM public.players p
    LEFT JOIN public.battles b 
      ON (b.player1_id = p.id OR b.player2_id = p.id) 
      AND b.status = 'COMPLETED'
    WHERE p.status != 'ELIMINATED'
    GROUP BY p.id, p.handle, p.points
  )
  SELECT 
    ROW_NUMBER() OVER (ORDER BY s.points DESC, s.wins DESC, s.player_id ASC) AS rank,
    s.player_id,
    s.handle,
    s.points,
    s.battles_completed,
    s.wins,
    s.losses,
    CASE 
      WHEN s.battles_completed > 0 THEN ROUND((s.wins::numeric / s.battles_completed::numeric) * 100, 1)
      ELSE 0.0
    END AS win_rate
  FROM stats s
  ORDER BY s.points DESC, s.wins DESC, s.player_id ASC
  LIMIT p_limit;
END;
$function$;
