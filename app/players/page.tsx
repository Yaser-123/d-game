import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChallengeButton } from '@/components/ChallengeButton'
import { GpsScanner } from '@/components/GpsScanner'
import { MapPin } from 'lucide-react'

// Haversine distance formula
function getDistanceKM(lat1: number | null, lon1: number | null, lat2: number | null, lon2: number | null) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null
  const R = 6371 // km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return (R * c).toFixed(1)
}


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
    .select('status, points, latitude, longitude')
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

  // Fetch pending challenges
  const { data: challengesData } = await supabase
    .from('challenges')
    .select('id, challenger_id, challenged_id, status')
    .eq('status', 'PENDING')
    .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`)

  const pendingChallenges = challengesData || []

  // Fetch active challenges
  const { data: activeChallengesData } = await supabase
    .from('challenges')
    .select('id, challenger_id, challenged_id')
    .eq('status', 'ACTIVE')
    .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`)

  const activeChallenges = activeChallengesData || []
  const isInChallenge = activeChallenges.length > 0

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
                const activeChallengeWithThem = activeChallenges.find(c => c.challenger_id === p.player_id || c.challenged_id === p.player_id)
                const pendingChallenge = pendingChallenges.find(c => c.challenger_id === p.player_id || c.challenged_id === p.player_id)
                const distance = getDistanceKM(currentPlayer?.latitude, currentPlayer?.longitude, p.latitude, p.longitude)

                return (
                  <div key={p.player_id} className="panel p-5 hover:border-danger/40 transition-colors flex flex-col sm:flex-row justify-between gap-4 relative overflow-hidden">
                    {/* Background Distance Indicator */}
                    {distance !== null && (
                      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-emerald-500/5 to-transparent pointer-events-none" />
                    )}
                    
                    <div className="space-y-1 flex-1 relative z-10">
                      <div className="flex items-center gap-3">
                        <h4 className="text-lg font-bold tracking-tight text-white">{p.handle}</h4>
                        {distance !== null && (
                          <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <MapPin className="w-3 h-3" />
                            {distance} KM
                          </span>
                        )}
                      </div>
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
                      ) : activeChallengeWithThem ? (
                        <Link href={`/challenge/${activeChallengeWithThem.id}`} className="btn btn-outline border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10 text-[10px] mt-4 sm:mt-0 px-3 h-6 tracking-widest flex items-center justify-center">
                          IN CHALLENGE
                        </Link>
                      ) : pendingChallenge ? (
                        <Link href="/game" className="btn btn-outline border-warning/50 text-warning hover:bg-warning/10 text-[10px] mt-4 sm:mt-0 px-3 h-6 tracking-widest flex items-center justify-center">
                          PENDING CHALLENGE
                        </Link>
                      ) : isInChallenge ? (
                        <button disabled className="btn btn-outline border-border/20 text-muted-foreground/30 cursor-not-allowed text-[10px] mt-4 sm:mt-0 px-3 h-6 tracking-widest">
                          YOU ARE IN CHALLENGE
                        </button>
                      ) : canEngage ? (
                        <div className="mt-4 sm:mt-0">
                          <ChallengeButton opponentId={p.player_id} />
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
          <GpsScanner />
        </div>

      </div>
    </div>
  )
}
