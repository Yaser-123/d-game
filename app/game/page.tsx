import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AcceptButton, DeclineButton, CancelButton } from '@/components/InvitationButtons'


type ActiveBattle = {
  id: string
  status: string
  turn_counter: number
  player1_id: string
  player2_id: string
  p1: { handle: string } | null
  p2: { handle: string } | null
}

type Invitation = {
  id: string
  challenger_id: string
  target_id: string
  status: string
  created_at: string
  challenger: { handle: string } | null
  target: { handle: string } | null
}

export default async function GamePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch player and full sigil info
  const { data: player } = await supabase
    .from('players')
    .select('*, sigils(*)')
    .eq('id', user.id)
    .single()

  const sigilData = Array.isArray(player.sigils) ? player.sigils[0] : player.sigils;
  if (!player || !sigilData) {
    console.log('Game page redirecting to /initialize. Player:', player)
    redirect('/initialize')
  }

  const sigil = sigilData

  if (player.status === 'ELIMINATED') {
    return (
      <div className="container mx-auto p-4 sm:p-6 mt-8 max-w-2xl text-center space-y-6">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tighter text-danger">ELIMINATED</h1>
        <div className="panel p-8 space-y-4">
          <p className="text-muted-foreground text-lg">Your account has been permanently disconnected from the nexus.</p>
          <p className="text-sm font-mono text-muted-foreground/70 tracking-widest">NO FURTHER ACTIONS PERMITTED</p>
        </div>
      </div>
    )
  }

  // Fetch active battles
  const { data: activeBattlesData } = await supabase
    .from('battles')
    .select(`
      id,
      status,
      turn_counter,
      player1_id,
      player2_id,
      p1:players!battles_player1_id_fkey(handle),
      p2:players!battles_player2_id_fkey(handle)
    `)
    .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
    .eq('status', 'ACTIVE')
    .order('updated_at', { ascending: false })

  const activeBattles = (activeBattlesData as unknown as ActiveBattle[]) || []

  // Fetch pending invitations
  const { data: invitationsData } = await supabase
    .from('battle_invitations')
    .select(`
      id,
      challenger_id,
      target_id,
      status,
      created_at,
      challenger:players!battle_invitations_challenger_id_fkey(handle),
      target:players!battle_invitations_target_id_fkey(handle)
    `)
    .or(`challenger_id.eq.${user.id},target_id.eq.${user.id}`)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })

  const pendingInvitations = (invitationsData as unknown as Invitation[]) || []

  const isFinalSalvation = player.status === 'FINAL_SALVATION'
  const canFindPlayers = player.points >= 100 || isFinalSalvation

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl mt-4 sm:mt-8">
      {isFinalSalvation && (
        <div className="mb-6 p-4 border border-warning/50 bg-warning/10 text-warning text-center rounded relative overflow-hidden">
          <div className="absolute inset-0 bg-warning/5 animate-pulse" />
          <h2 className="text-xl font-bold tracking-tighter relative z-10">FINAL SALVATION</h2>
          <p className="text-sm mt-1 font-mono relative z-10">You have fallen below 100 points. You are granted exactly one final engagement to survive.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* Left Column: Player HUD */}
        <div className="lg:col-span-4 space-y-6">
          <div className="panel border-danger/30 relative overflow-hidden group p-6">
            <div className="absolute inset-0 bg-gradient-to-br from-danger/10 to-transparent opacity-0 group-hover:opacity-100 transition-duration-1000" />
            <div className="flex justify-between items-start mb-6 border-b border-border/50 pb-4">
              <div>
                <h2 className="text-xs font-mono text-muted-foreground tracking-widest mb-1">OPERATIVE</h2>
                <h1 className="text-2xl font-bold tracking-tighter text-foreground">{player.handle}</h1>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <Link href="/profile" className="btn btn-outline border-border/50 text-xs px-3 h-8 tracking-widest hover:text-danger hover:border-danger/50">
                  PROFILE
                </Link>
                <Link href="/history" className="btn btn-outline border-border/50 text-xs px-3 h-8 tracking-widest hover:text-white">
                  HISTORY
                </Link>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <h2 className="text-[10px] font-mono text-muted-foreground tracking-widest mb-1">PRIMARY SIGIL</h2>
                <p className="text-xl font-bold text-danger drop-shadow-[0_0_8px_rgba(220,38,38,0.3)]">
                  {sigil.name}
                </p>
                <p className="text-sm text-foreground/80 mt-2 leading-relaxed">
                  {sigil.basic_ability}
                </p>
              </div>

              <div className="pt-4 border-t border-border/30">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-[10px] font-mono text-muted-foreground tracking-widest pt-1">TACTICAL ASSETS</h3>
                  <div className="flex flex-col items-end gap-2">
                    <Link href="/inventory" className="text-[10px] font-mono text-danger hover:text-white transition-colors">
                      MANAGE INVENTORY &rarr;
                    </Link>
                    <Link href="/shop" className="text-[10px] font-mono text-emerald-500 hover:text-white transition-colors">
                      BLACK MARKET &rarr;
                    </Link>
                    <Link href="/intel" className="text-[10px] font-mono text-emerald-500 hover:text-white transition-colors mt-1">
                      INTEL EXCHANGE &rarr;
                    </Link>
                    <Link href="/bosses" className="text-[10px] font-mono text-emerald-500 hover:text-white transition-colors mt-1">
                      SOLO BOSS HUNT &rarr;
                    </Link>
                    <Link href="/events" className="text-[10px] font-mono text-emerald-500 hover:text-white transition-colors mt-1">
                      GLOBAL EVENTS &rarr;
                    </Link>
                    <Link href="/clans" className="text-[10px] font-mono text-emerald-500 hover:text-white transition-colors mt-1">
                      CLANS & SYNDICATES &rarr;
                    </Link>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/30">
                <div className="flex justify-between items-end mb-2">
                  <h3 className="text-[10px] font-mono text-muted-foreground tracking-widest">MASTERY PROGRESS</h3>
                  <span className="text-xs font-mono text-danger">{sigil.mastery}/100</span>
                </div>
                <div className="h-1.5 w-full bg-black rounded-full overflow-hidden border border-border/50">
                  <div 
                    className="h-full bg-danger rounded-full" 
                    style={{ width: `${Math.max(5, sigil.mastery)}%` }} 
                  />
                </div>
              </div>

              <div className="flex justify-between text-[10px] font-mono text-muted-foreground tracking-widest pt-4 border-t border-border/30">
                <span>STATUS: {player.status}</span>
                <span className={player.points < 100 ? 'text-warning' : ''}>POINTS: {player.points.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Encounters / The Arena */}
        <div className="lg:col-span-8 flex flex-col space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-4 gap-4">
            <h2 className="text-3xl font-bold tracking-tighter">THE ARENA</h2>
            <div className="flex items-center gap-3">
              <Link href="/leaderboard" className="btn btn-outline border-emerald-500/30 text-emerald-500 text-[10px] px-3 h-8 tracking-widest hover:border-emerald-500 hover:bg-emerald-500/10 hidden sm:flex items-center mr-2">
                LEADERBOARD &rarr;
              </Link>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 motion-reduce:hidden"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-mono text-emerald-500 tracking-widest">NETWORK ACTIVE</span>
            </div>
          </div>

          {activeBattles.length > 0 || pendingInvitations.length > 0 ? (
            <div className="flex-1 panel p-6">
              <h3 className="text-sm font-bold tracking-widest text-muted-foreground mb-6">ACTIVE ENGAGEMENTS</h3>
              <div className="space-y-4">
                {pendingInvitations.map(inv => {
                  const isIncoming = inv.target_id === user.id
                  const otherHandle = isIncoming ? inv.challenger?.handle : inv.target?.handle
                  
                  return (
                    <div key={inv.id} className="p-4 border border-warning/30 rounded bg-warning/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${isIncoming ? 'bg-danger/20 text-danger' : 'bg-white/10 text-white'}`}>
                            {isIncoming ? 'INCOMING CHALLENGE' : 'OUTGOING CHALLENGE'}
                          </span>
                        </div>
                        <h4 className="text-lg font-bold text-white tracking-tight">{isIncoming ? `from ${otherHandle}` : `to ${otherHandle}`}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        {isIncoming ? (
                          <>
                            <DeclineButton inviteId={inv.id} />
                            <AcceptButton inviteId={inv.id} />
                          </>
                        ) : (
                          <CancelButton inviteId={inv.id} />
                        )}
                      </div>
                    </div>
                  )
                })}

                {activeBattles.map(battle => {
                  const isP1 = battle.player1_id === user.id
                  const opponentHandle = isP1 ? battle.p2?.handle : battle.p1?.handle
                  return (
                    <div key={battle.id} className="p-4 border border-border/50 rounded bg-black/40 hover:border-danger/50 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h4 className="text-lg font-bold text-white tracking-tight">vs {opponentHandle}</h4>
                        <p className="text-[10px] font-mono text-muted-foreground mt-1">TURN {battle.turn_counter} &bull; {battle.status}</p>
                      </div>
                      <Link href={`/battle/${battle.id}`} className="btn btn-outline border-border/50 text-xs px-4 h-8 tracking-widest hover:border-white">
                        ENTER ARENA &rarr;
                      </Link>
                    </div>
                  )
                })}
              </div>
              <div className="mt-8 pt-6 border-t border-border/30">
                {canFindPlayers ? (
                  <Link 
                    href="/players" 
                    className="btn btn-danger w-full sm:w-auto px-8 h-10 text-xs tracking-widest relative overflow-hidden inline-flex items-center justify-center"
                  >
                    <span className="relative z-10 font-bold">FIND MORE PLAYERS</span>
                  </Link>
                ) : (
                  <button disabled className="btn btn-outline border-border/20 text-muted-foreground/30 cursor-not-allowed w-full sm:w-auto px-8 h-10 text-xs tracking-widest">
                    INSUFFICIENT POINTS FOR NEW BATTLES
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 panel flex flex-col items-center justify-center text-center p-8 min-h-[300px] border-dashed">
              <div className="space-y-4 max-w-md">
                <h3 className="text-lg font-bold tracking-widest text-muted-foreground">SCANNING FOR SIGNATURES</h3>
                <p className="text-sm text-muted-foreground/70 leading-relaxed mb-6">
                  {canFindPlayers 
                    ? 'Your Sigil dictates your capacity to engage other operatives. The matchmaking nexus is standing by.'
                    : 'You require a minimum of 100 points to initiate standard engagements.'}
                </p>
                
                {canFindPlayers ? (
                  <Link 
                    href="/players" 
                    className="btn btn-danger w-full sm:w-auto px-12 h-12 text-sm tracking-widest group relative overflow-hidden inline-flex items-center justify-center"
                  >
                    <span className="relative z-10 font-bold">FIND PLAYERS</span>
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  </Link>
                ) : (
                  <button disabled className="btn btn-outline border-border/20 text-muted-foreground/30 cursor-not-allowed w-full sm:w-auto px-12 h-12 text-sm tracking-widest">
                    INSUFFICIENT POINTS
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
