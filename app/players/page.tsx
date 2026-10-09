import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { EngageButton } from '@/components/EngageButton'

export const instant = false

type PublicPlayer = {
  player_id: string
  handle: string
  sigil_name: string
  basic_ability: string
  mastery: number
  created_at: string
}

export default async function PlayersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch real public players via our secure RPC
  const { data: players } = await supabase.rpc('get_public_players')

  const publicPlayers = (players || []) as PublicPlayer[]

  // Fetch current player status
  const { data: currentPlayer } = await supabase
    .from('players')
    .select('status, points')
    .eq('id', user.id)
    .single()

  if (currentPlayer?.status === 'ELIMINATED') {
    return (
      <div className="container mx-auto p-4 sm:p-6 mt-8 max-w-2xl text-center space-y-6">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tighter text-danger">ELIMINATED</h1>
        <div className="panel p-8 space-y-4">
          <p className="text-muted-foreground text-lg">Your account has been permanently disconnected from the nexus.</p>
          <Link href="/game" className="btn btn-outline text-xs tracking-widest px-6 mt-4 inline-block">
            RETURN
          </Link>
        </div>
      </div>
    )
  }

  const canEngage = currentPlayer ? (currentPlayer.points >= 100 || currentPlayer.status === 'FINAL_SALVATION') : false

  // Fetch pending invitations
  const { data: invitationsData } = await supabase
    .from('battle_invitations')
    .select('id, challenger_id, target_id, status')
    .eq('status', 'PENDING')
    .or(`challenger_id.eq.${user.id},target_id.eq.${user.id}`)

  const pendingInvitations = invitationsData || []

  // Fetch active battles
  const { data: activeBattlesData } = await supabase
    .from('battles')
    .select('id, player1_id, player2_id')
    .eq('status', 'ACTIVE')
    .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)

  const activeBattles = activeBattlesData || []
  const isInBattle = activeBattles.length > 0

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl mt-4 sm:mt-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-border pb-6 gap-4">
        <div>
          <h2 className="text-xs font-mono text-muted-foreground tracking-widest mb-2">NETWORK NEXUS</h2>
          <h1 className="text-4xl font-bold tracking-tighter">OPPONENT DISCOVERY</h1>
        </div>
        <Link href="/game" className="btn btn-outline text-xs tracking-widest px-6">
          &larr; BACK TO ARENA
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Roster List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-mono tracking-widest">ACTIVE OPERATIVES</h3>
            <span className="text-xs bg-danger/20 text-danger px-2 py-0.5 rounded font-mono">
              {publicPlayers.length} DETECTED
            </span>
          </div>

          {publicPlayers.length === 0 ? (
            <div className="panel p-12 text-center border-dashed opacity-70">
              <p className="text-sm font-mono text-muted-foreground tracking-widest mb-2">NO SIGNATURES FOUND</p>
              <p className="text-xs text-muted-foreground">The grid is currently empty. You are the only active operative in this sector.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {publicPlayers.map((p) => {
                const isMe = p.player_id === user.id
                const activeBattleWithThem = activeBattles.find(b => b.player1_id === p.player_id || b.player2_id === p.player_id)
                const pendingInvite = pendingInvitations.find(i => i.challenger_id === p.player_id || i.target_id === p.player_id)

                return (
                  <div key={p.player_id} className="panel p-5 hover:border-danger/40 transition-colors flex flex-col sm:flex-row justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <h4 className="text-lg font-bold tracking-tight text-white">{p.handle}</h4>
                      <p className="text-xs font-mono text-danger tracking-widest">SIGIL: {p.sigil_name}</p>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {p.basic_ability}
                      </p>
                    </div>
                    <div className="flex flex-col items-start sm:items-end justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground">MASTERY: {p.mastery}</span>
                      {isMe ? (
                        <span className="text-[10px] font-mono text-muted-foreground mt-4 sm:mt-0 px-4 h-8 flex items-center">
                          YOU
                        </span>
                      ) : activeBattleWithThem ? (
                        <Link href={`/battle/${activeBattleWithThem.id}`} className="btn btn-outline border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10 text-[10px] mt-4 sm:mt-0 px-3 h-6 tracking-widest flex items-center justify-center">
                          IN BATTLE
                        </Link>
                      ) : pendingInvite ? (
                        <Link href="/game" className="btn btn-outline border-warning/50 text-warning hover:bg-warning/10 text-[10px] mt-4 sm:mt-0 px-3 h-6 tracking-widest flex items-center justify-center">
                          PENDING INVITATION
                        </Link>
                      ) : isInBattle ? (
                        <button disabled className="btn btn-outline border-border/20 text-muted-foreground/30 cursor-not-allowed text-[10px] mt-4 sm:mt-0 px-3 h-6 tracking-widest">
                          YOU ARE IN BATTLE
                        </button>
                      ) : canEngage ? (
                        <div className="mt-4 sm:mt-0">
                          <EngageButton opponentId={p.player_id} />
                        </div>
                      ) : (
                        <button disabled className="btn btn-outline border-border/20 text-muted-foreground/30 cursor-not-allowed text-[10px] mt-4 sm:mt-0 px-3 h-6 tracking-widest">
                          INSUFFICIENT POINTS
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-[10px] font-mono text-muted-foreground/50 text-center mt-8">
            NOTICE: Classified Sigil mechanics and restrictions are securely masked from public scans.
          </p>
        </div>

        {/* Sidebar / Proximity Module */}
        <div className="space-y-6">
          <div className="panel p-6 border-warning/20 bg-warning/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              <span className="flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-warning/50"></span>
              </span>
            </div>
            <h3 className="text-sm font-bold tracking-widest text-warning mb-2">PROXIMITY SYSTEM</h3>
            <span className="inline-block text-[10px] font-mono bg-warning/10 text-warning px-2 py-1 rounded mb-4">
              IN DEVELOPMENT
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Real-world localized detection is currently offline. Geographic triangulation and nearby-operative tracking will be initialized in a future update.
            </p>
            <div className="mt-6 h-24 bg-black/40 rounded border border-warning/10 flex items-center justify-center">
              <div className="w-16 h-16 border border-warning/20 rounded-full flex items-center justify-center relative">
                <div className="absolute inset-0 border border-warning/20 rounded-full animate-ping motion-reduce:hidden duration-3000"></div>
                <div className="w-1 h-1 bg-warning rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
