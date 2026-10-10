import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BossHuntButton } from '@/components/BossHuntButton'

export default async function BossesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch player status to ensure they are active
  const { data: player } = await supabase
    .from('players')
    .select('status, points')
    .eq('id', user.id)
    .single()

  if (!player || player.status === 'ELIMINATED') {
    redirect('/game')
  }

  // Map bot IDs to recognize if an active challenge is with a boss
  const botIds = [
    '11111111-1111-4111-8111-111111111111', // Hollow Knight
    '22222222-2222-4222-8222-222222222222', // Phantom
    '33333333-3333-4333-8333-333333333333'  // Executioner
  ]

  // Fetch active boss challenges
  const { data: activeChallengeData } = await supabase
    .from('challenges')
    .select('id, challenged_id')
    .eq('challenger_id', user.id)
    .in('challenged_id', botIds)
    .in('status', ['PENDING', 'ACTIVE'])
    .limit(1)

  const activeChallenge = activeChallengeData?.[0]

  // Fetch bosses
  const { data: bosses } = await supabase
    .from('bosses')
    .select('*')
    .order('points_reward', { ascending: true })

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl mt-4 sm:mt-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter text-foreground">SOLO BOSS HUNT</h1>
          <p className="text-muted-foreground font-mono mt-1 text-sm tracking-widest">TEST YOUR METTLE AGAINST THE NEXUS ELITE</p>
        </div>
        <Link href="/game" className="btn btn-outline h-10 px-4 text-xs tracking-widest border-border/50 hover:text-white">
          &larr; BACK TO HUB
        </Link>
      </div>

      {activeChallenge && (
        <div className="panel border-warning/50 bg-warning/5 p-6 space-y-4">
          <h2 className="text-xl font-bold tracking-tighter text-warning">ACTIVE ENCOUNTER DETECTED</h2>
          <p className="text-sm text-foreground/80">You are currently engaged in a duel with a boss.</p>
          <Link href={`/challenge/${activeChallenge.id}`} className="btn btn-primary inline-flex h-10 px-6 items-center tracking-widest">
            RETURN TO DUEL
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bosses?.map((boss) => (
          <div key={boss.id} className="panel border-border/50 flex flex-col hover:border-danger/50 transition-colors">
            <div className="p-6 flex-1 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] font-mono text-danger tracking-widest mb-1">{boss.difficulty}</div>
                  <h2 className="text-xl font-bold tracking-tighter">{boss.name}</h2>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono text-muted-foreground tracking-widest mb-1">REWARD</div>
                  <div className="font-mono text-emerald-400">+{boss.points_reward}</div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{boss.description}</p>
              
              <div className="grid grid-cols-2 gap-4 py-4 border-y border-border/30">
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground tracking-widest">HEALTH</div>
                  <div className="font-mono">{boss.max_health}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground tracking-widest">DAMAGE</div>
                  <div className="font-mono">{boss.base_damage}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground tracking-widest">ARMOUR</div>
                  <div className="font-mono">{boss.armour}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground tracking-widest">PATTERN</div>
                  <div className="font-mono">{boss.behavior_pattern}</div>
                </div>
              </div>
            </div>
            
            <div className="p-6 pt-0 mt-auto">
              {activeChallenge ? (
                 <button disabled className="btn btn-outline w-full opacity-50 cursor-not-allowed tracking-widest text-xs h-12">
                   BUSY
                 </button>
              ) : (
                <BossHuntButton bossId={boss.id} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
