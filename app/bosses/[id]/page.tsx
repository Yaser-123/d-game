import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PvEControls } from '@/components/PvEControls'
import { CinematicArena } from '@/components/CinematicArena'

type LogEntry = {
  turn: number
  actor: 'player' | 'boss'
  action: string
  details: {
    final_damage?: number
    weapon?: string
    armour_mitigation?: number
    defend_mitigation?: boolean
    shield_mitigation?: number
    disrupt_mitigation?: boolean
    countered_damage_taken?: number
    ability?: string
    message?: string
    healed?: number
    item?: string
    magnitude?: number
    duration?: number
    base_damage?: number
  }
}

type UsableItem = {
  id: string
  quantity: number
  items: {
    id: string
    name: string
    effects: Record<string, unknown>
  }
}

export default async function PvEBattlePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const resolvedParams = await params;
  
  if (!user) {
    redirect('/login')
  }

  // Fetch encounter state
  const { data: encounter, error } = await supabase
    .from('pve_encounters')
    .select(`
      *,
      boss:bosses(id, name, difficulty, points_reward),
      player:players(id, handle)
    `)
    .eq('id', resolvedParams.id)
    .single()

  if (error || !encounter) {
    return (
      <div className="container mx-auto p-4 sm:p-6 mt-8 max-w-md text-center">
        <h1 className="text-xl font-bold text-danger mb-4">ERROR</h1>
        <p className="text-sm text-muted-foreground mb-6">Encounter not found or access denied.</p>
        <Link href="/bosses" className="btn btn-outline">RETURN TO BOSS HUNT</Link>
      </div>
    )
  }

  if (encounter.player_id !== user.id) {
    return (
      <div className="container mx-auto p-4 sm:p-6 mt-8 max-w-md text-center">
        <h1 className="text-xl font-bold text-danger mb-4">CLASSIFIED</h1>
        <p className="text-sm text-muted-foreground mb-6">You are not authorized to observe this engagement.</p>
        <Link href="/bosses" className="btn btn-outline">RETURN TO BOSS HUNT</Link>
      </div>
    )
  }

  const logs = (encounter.combat_log as unknown as LogEntry[]) || []
  // Reverse the logs so the most recent is at the top
  const sortedLogs = [...logs].reverse()

  // Fetch usable items for current player
  const { data: invData } = await supabase
    .from('inventory')
    .select('id, quantity, items!inner(id, name, effects)')
    .eq('player_id', user.id)
    .eq('items.category', 'utility')
    .gt('quantity', 0)

  const usableItems = (invData as unknown as UsableItem[]) || []

  // Fetch sigil
  const { data: sigilData } = await supabase
    .from('sigils')
    .select('*')
    .eq('player_id', user.id)
    .single()

  const isCompleted = encounter.status === 'VICTORY' || encounter.status === 'DEFEAT'

  const myHealth = encounter.player_health
  const bossHealth = encounter.boss_health
  
  const myDefending = encounter.player_defending
  const bossDefending = encounter.boss_defending
  
  const myEffects = encounter.player_effects as Record<string, string>
  const bossEffects = encounter.boss_effects as Record<string, string>
  
  const sigilMeta = sigilData?.ability_meta || null
  const sigilCdUntil = myEffects?.sigil_cd_until ? parseInt(myEffects.sigil_cd_until, 10) : 0
  const sigilOnCooldown = sigilCdUntil >= encounter.turn_counter
  const sigilCooldownRemaining = Math.max(0, sigilCdUntil - encounter.turn_counter + 1)

  const isMyShielded = myEffects?.shield_until && parseInt(myEffects.shield_until, 10) >= encounter.turn_counter
  const isMyDisrupted = myEffects?.disrupted_until && parseInt(myEffects.disrupted_until, 10) >= encounter.turn_counter
  const isMyCountered = myEffects?.counter_until && parseInt(myEffects.counter_until, 10) >= encounter.turn_counter

  const isOppShielded = bossEffects?.shield_until && parseInt(bossEffects.shield_until, 10) >= encounter.turn_counter
  const isOppDisrupted = bossEffects?.disrupted_until && parseInt(bossEffects.disrupted_until, 10) >= encounter.turn_counter
  const isOppCountered = bossEffects?.counter_until && parseInt(bossEffects.counter_until, 10) >= encounter.turn_counter

  function renderHealthBar(health: number, maxHealth: number = 100, reverse = false) {
    const percentage = Math.max(0, Math.min(100, (health / maxHealth) * 100))
    return (
      <div className="h-3 w-full bg-black rounded-full overflow-hidden border border-border/50">
        <div 
          className={`h-full transition-all duration-500 ease-out ${percentage > 50 ? 'bg-emerald-500' : percentage > 20 ? 'bg-warning' : 'bg-danger'} ${reverse ? 'ml-auto' : ''}`}
          style={{ width: `${percentage}%` }} 
        />
      </div>
    )
  }

  // Find boss max health from the database just for the health bar
  const { data: bossData } = await supabase
    .from('bosses')
    .select('max_health')
    .eq('id', encounter.boss_id)
    .single()
    
  const maxBossHealth = bossData?.max_health || 100

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl mt-2 sm:mt-8 space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center border-b border-border pb-4">
        <div>
          <h2 className="text-xs font-mono text-muted-foreground tracking-widest mb-1">PVE {encounter.status}</h2>
          <div className="flex gap-2 items-center">
            <h1 className="text-xl font-bold tracking-tighter">TURN {encounter.turn_counter}</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href={`/bosses/${encounter.id}`} className="text-[10px] font-mono text-info hover:text-white transition-colors">
            REFRESH
          </Link>
          <a href="/bosses" className="btn btn-outline text-[10px] h-8 px-4 tracking-widest">
            LEAVE
          </a>
        </div>
      </div>

      {isCompleted && (
        <div className="panel p-6 border-info/30 bg-info/5 text-center">
          <h3 className="text-xs font-mono tracking-widest text-info mb-2">ENCOUNTER CONCLUDED</h3>
          <h2 className="text-3xl font-bold text-white mb-2">
            {encounter.status === 'VICTORY' ? 'VICTORIOUS' : 'DEFEATED'}
          </h2>
          {encounter.status === 'VICTORY' && (
            <div className="inline-block bg-black/40 border border-border/50 rounded px-6 py-4 mt-4">
              <h4 className="text-[10px] font-mono tracking-widest text-muted-foreground mb-2">REWARDS</h4>
              <div className="flex gap-4 items-center justify-center text-sm font-mono">
                <span className="text-emerald-500">+{encounter.boss.points_reward} POINTS EARNED</span>
              </div>
            </div>
          )}
          {encounter.status === 'DEFEAT' && (
            <div className="mt-4">
              <p className="text-sm font-mono text-danger">You have fallen in battle, but your points remain untouched.</p>
            </div>
          )}
          <div className="mt-8">
            <a href="/bosses" className="btn btn-outline border-info/50 text-info hover:bg-info/10 tracking-widest px-8 h-12">
              RETURN TO MENU
            </a>
          </div>
        </div>
      )}

      {/* Combatants HUD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12">
        {/* My Player */}
        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <div>
              <h3 className="text-lg font-bold text-white leading-none">{encounter.player?.handle || 'OPERATIVE'}</h3>
              <p className="text-[10px] font-mono text-emerald-500 tracking-widest mt-1">YOU</p>
            </div>
            <div className="text-right">
              <span className="text-xl font-mono font-bold text-white">{myHealth}</span>
              <span className="text-[10px] font-mono text-muted-foreground ml-1">HP</span>
            </div>
          </div>
          {renderHealthBar(myHealth, 100)}
          <div className="flex flex-wrap gap-2 mt-2">
            {myDefending && (
              <span className="text-[10px] font-mono bg-info/20 text-info px-2 py-0.5 rounded transition-all">DEFENDING</span>
            )}
            {isMyShielded && (
              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded transition-all">SHIELDED</span>
            )}
            {isMyCountered && (
              <span className="text-[10px] font-mono bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded transition-all">COUNTER ARMED</span>
            )}
            {isMyDisrupted && (
              <span className="text-[10px] font-mono bg-danger/20 text-danger px-2 py-0.5 rounded transition-all">DISRUPTED</span>
            )}
            {sigilOnCooldown && (
              <span className="text-[10px] font-mono border border-border/50 text-muted-foreground px-2 py-0.5 rounded transition-all">SIGIL CD ({sigilCooldownRemaining})</span>
            )}
          </div>
          <div className="flex justify-between min-h-[20px] mt-2">
            {!isCompleted && (
              <span className="text-[10px] font-mono text-warning motion-safe:animate-pulse">YOUR TURN &rarr;</span>
            )}
          </div>
        </div>

        {/* Boss */}
        <div className="space-y-3">
          <div className="flex justify-between items-end flex-row-reverse sm:flex-row">
            <div className="sm:text-right">
              <h3 className="text-lg font-bold text-danger leading-none">{encounter.boss?.name || 'UNKNOWN BOSS'}</h3>
              <p className="text-[10px] font-mono text-danger tracking-widest mt-1">BOSS - {encounter.boss?.difficulty}</p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[10px] font-mono text-muted-foreground mr-1">HP</span>
              <span className="text-xl font-mono font-bold text-white">{bossHealth}</span>
            </div>
          </div>
          {renderHealthBar(bossHealth, maxBossHealth, true)}
          <div className="flex flex-wrap gap-2 mt-2 justify-end">
            {bossDefending && (
              <span className="text-[10px] font-mono bg-info/20 text-info px-2 py-0.5 rounded transition-all">DEFENDING</span>
            )}
            {isOppShielded && (
              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded transition-all">SHIELDED</span>
            )}
            {isOppCountered && (
              <span className="text-[10px] font-mono bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded transition-all">COUNTER ARMED</span>
            )}
          </div>
        </div>
      </div>

      {/* Cinematic Arena */}
      <CinematicArena 
        playerId={user.id}
        bossId={encounter.boss_id}
        myHealth={myHealth}
        bossHealth={bossHealth}
        turnCounter={encounter.turn_counter}
        latestLog={sortedLogs.length > 0 ? sortedLogs[0] : null}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        
        {/* Controls */}
        <div className="lg:col-span-1">
          <PvEControls 
            encounterId={encounter.id}
            isCompleted={isCompleted}
            usableItems={usableItems}
            sigil={{
              hasAbility: !!sigilMeta,
              name: sigilData?.name || 'Unknown Sigil',
              type: sigilMeta?.type || 'UNKNOWN',
              onCooldown: sigilOnCooldown,
              cooldownRemaining: sigilCooldownRemaining
            }}
          />
        </div>

        {/* Log */}
        <div className="lg:col-span-2 panel p-0 overflow-hidden flex flex-col h-[400px]">
          <div className="p-3 border-b border-border/50 bg-black/40">
            <h3 className="text-[10px] font-mono text-muted-foreground tracking-widest">COMBAT LOG</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col-reverse">
            {sortedLogs.length === 0 && (
              <div className="text-center text-xs font-mono text-muted-foreground opacity-50 py-8">
                NO ACTIONS RECORDED
              </div>
            )}
            {sortedLogs.map((log, index) => {
              const details = log.details || {}
              const actorName = log.actor === 'player' ? (encounter.player?.handle || 'You') : (encounter.boss?.name || 'Boss')
              return (
                <div key={index} className="text-sm border-l-2 border-border/50 pl-3 py-1">
                  <div className="flex gap-2 items-baseline mb-1">
                    <span className="text-[10px] font-mono text-muted-foreground">T{log.turn}</span>
                    <span className={`font-bold ${log.actor === 'player' ? 'text-white' : 'text-danger'}`}>
                      {actorName}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {log.action === 'SIGIL_ABILITY' ? 'unleashed sigil' : `used ${log.action.replace('_', ' ')}`}
                    </span>
                  </div>
                  <div className="text-muted-foreground/80 text-sm">
                    {log.action === 'ATTACK' && (
                      <div className="flex flex-col gap-1">
                        <span>
                          Dealt <strong className="text-white">{details.final_damage || 0}</strong> damage 
                          {details.weapon && details.weapon !== 'unarmed' ? ` with ${details.weapon.replace('wpn_', '')}.` : ' unarmed.'}
                        </span>
                        {(details.armour_mitigation || details.defend_mitigation || details.shield_mitigation || details.disrupt_mitigation || details.countered_damage_taken) && (
                          <div className="text-[11px] font-mono opacity-80 border-l border-border/50 pl-2 ml-1 flex flex-col">
                            {details.disrupt_mitigation && <span className="text-danger">Damage halved by disruption.</span>}
                            {details.armour_mitigation ? <span>Armour absorbed {details.armour_mitigation}.</span> : null}
                            {details.defend_mitigation ? <span className="text-info">Damage halved by defensive stance.</span> : null}
                            {details.shield_mitigation ? <span className="text-emerald-400">Shield absorbed {details.shield_mitigation}.</span> : null}
                            {details.countered_damage_taken ? <span className="text-purple-400">Took {details.countered_damage_taken} damage from counter!</span> : null}
                          </div>
                        )}
                      </div>
                    )}
                    {log.action === 'DEFEND' && <span>{details.message || 'Prepared defenses.'}</span>}
                    {log.action === 'USE_ITEM' && (
                      <span>
                        {details.healed ? `Recovered ${details.healed} HP.` : details.message || 'Used utility item.'}
                      </span>
                    )}
                    {log.action === 'COUNTER' && <span className="text-purple-400">Armed a reactive counter-strike.</span>}
                    {log.action === 'DISRUPT' && <span className="text-danger">Disrupted opponent senses.</span>}
                    {log.action === 'SIGIL_ABILITY' && details.ability && (
                      <div className="flex flex-col gap-1">
                        {details.ability === 'DAMAGE' && (
                          <span>
                            Dealt <strong className="text-white">{details.final_damage || 0}</strong> supernatural damage.
                            {(details.armour_mitigation || details.defend_mitigation || details.shield_mitigation) && (
                              <div className="text-[11px] font-mono opacity-80 border-l border-border/50 pl-2 ml-1 mt-1 flex flex-col">
                                {details.armour_mitigation ? <span>Armour absorbed {details.armour_mitigation}.</span> : null}
                                {details.defend_mitigation ? <span className="text-info">Damage halved by defensive stance.</span> : null}
                                {details.shield_mitigation ? <span className="text-emerald-400">Shield absorbed {details.shield_mitigation}.</span> : null}
                              </div>
                            )}
                          </span>
                        )}
                        {details.ability === 'HEAL' && <span className="text-emerald-400">Restored {details.healed || 0} HP.</span>}
                        {details.ability === 'SHIELD' && <span className="text-emerald-400">Manifested a protective barrier.</span>}
                        {details.ability === 'COUNTER' && <span className="text-purple-400">Armed a reactive counter-strike.</span>}
                        {details.ability === 'DISRUPT' && <span className="text-danger">Disrupted opponent senses.</span>}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
