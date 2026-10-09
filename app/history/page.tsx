import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'


type BattleHistoryRow = {
  id: string
  status: string
  winner_id: string | null
  completion_reason: string | null
  updated_at: string
  player1_id: string
  player2_id: string
  p1: { handle: string } | null
  p2: { handle: string } | null
}

type PointsLedgerEntry = {
  amount: number
  reference_key: string
}

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch completed battles
  const { data: battlesData } = await supabase
    .from('battles')
    .select(`
      id,
      status,
      winner_id,
      completion_reason,
      updated_at,
      player1_id,
      player2_id,
      p1:players!battles_player1_id_fkey(handle),
      p2:players!battles_player2_id_fkey(handle)
    `)
    .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
    .eq('status', 'COMPLETED')
    .order('updated_at', { ascending: false })
    .limit(50)

  const battles = (battlesData || []) as unknown as BattleHistoryRow[]

  // Fetch relevant points ledger entries for this user
  // This helps calculate points gained/lost per battle
  const { data: ledgerData } = await supabase
    .from('points_ledger')
    .select('amount, reference_key')
    .eq('player_id', user.id)
    .in('transaction_type', ['BATTLE_REWARD', 'BATTLE_THEFT_CREDIT', 'BATTLE_THEFT_DEBIT'])
    .order('created_at', { ascending: false })

  const ledger = (ledgerData || []) as PointsLedgerEntry[]

  // Map points change per battle
  const battlePoints: Record<string, number> = {}
  ledger.forEach(entry => {
    // extract uuid from reference key (assumes uuid is first 36 chars)
    const battleId = entry.reference_key.substring(0, 36)
    if (!battlePoints[battleId]) battlePoints[battleId] = 0
    battlePoints[battleId] += entry.amount
  })

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl mt-4 sm:mt-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-border pb-6 gap-4">
        <div>
          <h2 className="text-xs font-mono text-muted-foreground tracking-widest mb-2">PERSONAL ARCHIVES</h2>
          <h1 className="text-4xl font-bold tracking-tighter">BATTLE HISTORY</h1>
        </div>
        <div className="flex gap-4">
          <Link href="/leaderboard" className="btn btn-outline border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500 text-xs tracking-widest px-6 h-10 flex items-center">
            LEADERBOARD
          </Link>
          <Link href="/game" className="btn btn-outline text-xs tracking-widest px-6 h-10 flex items-center">
            &larr; BACK TO ARENA
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        {battles.length === 0 ? (
          <div className="panel p-12 text-center border-dashed opacity-70">
            <p className="text-sm font-mono text-muted-foreground tracking-widest mb-2">NO RECORDS FOUND</p>
            <p className="text-xs text-muted-foreground">You have not completed any battles yet.</p>
          </div>
        ) : (
          battles.map((battle) => {
            const isP1 = battle.player1_id === user.id
            const opponentHandle = isP1 ? battle.p2?.handle : battle.p1?.handle
            const isWinner = battle.winner_id === user.id
            const isDraw = battle.winner_id === null
            
            const pointChange = battlePoints[battle.id] || 0
            
            let resultText = 'DEFEAT'
            let resultColor = 'text-danger border-danger/30 bg-danger/5'
            
            if (isWinner) {
              resultText = 'VICTORY'
              resultColor = 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5'
            } else if (isDraw) {
              resultText = 'DRAW'
              resultColor = 'text-muted-foreground border-border/30 bg-white/5'
            }

            const date = new Date(battle.updated_at).toLocaleString(undefined, { 
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
            })

            return (
              <div key={battle.id} className={`panel p-5 border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${resultColor} hover:brightness-125 transition-all`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-xl tracking-tight text-white">vs {opponentHandle}</span>
                    <span className="text-[10px] font-mono tracking-widest px-2 py-0.5 rounded border border-current">
                      {resultText}
                    </span>
                  </div>
                  <p className="text-xs font-mono opacity-80 mt-2">
                    {date} &bull; {battle.completion_reason?.toUpperCase()}
                  </p>
                </div>
                
                <div className="flex flex-col sm:items-end w-full sm:w-auto">
                  <div className="text-[10px] font-mono text-muted-foreground tracking-widest mb-1">
                    NET EXCHANGE
                  </div>
                  <div className={`font-mono text-lg font-bold ${pointChange > 0 ? 'text-emerald-500' : pointChange < 0 ? 'text-danger' : 'text-muted-foreground'}`}>
                    {pointChange > 0 ? '+' : ''}{pointChange} PTS
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

    </div>
  )
}
