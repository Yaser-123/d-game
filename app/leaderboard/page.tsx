import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const instant = false

type LeaderboardRow = {
  rank: number
  player_id: string
  handle: string
  points: number
  battles_completed: number
  wins: number
  losses: number
  win_rate: number
}

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch leaderboard
  const { data: leaderboardData } = await supabase.rpc('get_leaderboard', { p_limit: 100 })
  const leaderboard = (leaderboardData || []) as LeaderboardRow[]

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl mt-4 sm:mt-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-border pb-6 gap-4">
        <div>
          <h2 className="text-xs font-mono text-muted-foreground tracking-widest mb-2">GLOBAL RANKINGS</h2>
          <h1 className="text-4xl font-bold tracking-tighter">LEADERBOARD</h1>
        </div>
        <Link href="/game" className="btn btn-outline text-xs tracking-widest px-6 h-10 flex items-center">
          &larr; BACK TO ARENA
        </Link>
      </div>

      <div className="panel p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50 bg-black/40">
                <th className="p-4 text-xs font-mono tracking-widest text-muted-foreground font-normal">RANK</th>
                <th className="p-4 text-xs font-mono tracking-widest text-muted-foreground font-normal">OPERATIVE</th>
                <th className="p-4 text-xs font-mono tracking-widest text-muted-foreground font-normal text-right">PTS</th>
                <th className="p-4 text-xs font-mono tracking-widest text-muted-foreground font-normal text-right hidden sm:table-cell">BATTLES</th>
                <th className="p-4 text-xs font-mono tracking-widest text-muted-foreground font-normal text-right">W - L</th>
                <th className="p-4 text-xs font-mono tracking-widest text-muted-foreground font-normal text-right">WIN RATE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground font-mono text-sm tracking-widest">
                    NO ACTIVE OPERATIVES DETECTED
                  </td>
                </tr>
              ) : (
                leaderboard.map((row) => (
                  <tr key={row.player_id} className={`hover:bg-white/5 transition-colors ${row.player_id === user.id ? 'bg-danger/10 hover:bg-danger/20' : ''}`}>
                    <td className="p-4 font-mono text-sm">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded ${row.rank === 1 ? 'bg-emerald-500/20 text-emerald-500 font-bold' : row.rank <= 3 ? 'bg-white/10 text-white font-bold' : 'text-muted-foreground'}`}>
                        {row.rank}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-white tracking-tight">{row.handle}</span>
                      {row.player_id === user.id && <span className="ml-2 text-[10px] font-mono text-danger tracking-widest bg-danger/10 px-1.5 py-0.5 rounded">YOU</span>}
                    </td>
                    <td className="p-4 font-mono text-emerald-500 font-bold text-right">
                      {row.points.toLocaleString()}
                    </td>
                    <td className="p-4 font-mono text-muted-foreground text-right hidden sm:table-cell">
                      {row.battles_completed}
                    </td>
                    <td className="p-4 font-mono text-muted-foreground text-right">
                      <span className="text-emerald-500">{row.wins}</span> - <span className="text-danger">{row.losses}</span>
                    </td>
                    <td className="p-4 font-mono text-white text-right">
                      {row.win_rate}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
