import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BattleControls } from '@/components/BattleControls'


type LogEntry = {
  id: string
  turn_number: number
  actor_id: string
  action_type: string
  action_details: {
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
  }
  actor: { handle: string }
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

export default async function BattlePage({ params }: { params: Promise<{ battleId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const resolvedParams = await params
  
  if (!user) {
    redirect('/login')
  }

  // Fetch battle state
  const { data: battle, error } = await supabase
    .from('battles')
    .select(`
      *,
      p1:players!battles_player1_id_fkey(id, handle),
      p2:players!battles_player2_id_fkey(id, handle),
      winner:players!battles_winner_id_fkey(handle)
    `)
    .eq('id', resolvedParams.battleId)
    .single()

  if (error || !battle) {
    return (
      <div className="container mx-auto p-4 sm:p-6 mt-8 max-w-md text-center">
        <h1 className="text-xl font-bold text-danger mb-4">ERROR</h1>
        <p className="text-sm text-muted-foreground mb-6">Battle not found or access denied.</p>
        <Link href="/game" className="btn btn-outline">RETURN TO ARENA</Link>
      </div>
    )
  }

  // Ensure user is participant
  if (battle.player1_id !== user.id && battle.player2_id !== user.id) {
    return (
      <div className="container mx-auto p-4 sm:p-6 mt-8 max-w-md text-center">
        <h1 className="text-xl font-bold text-danger mb-4">CLASSIFIED</h1>
        <p className="text-sm text-muted-foreground mb-6">You are not authorized to observe this engagement.</p>
        <Link href="/game" className="btn btn-outline">RETURN TO ARENA</Link>
      </div>
    )
  }

  // Fetch logs
  const { data: logsData } = await supabase
    .from('battle_logs')
    .select('*, actor:players!battle_logs_actor_id_fkey(handle)')
    .eq('battle_id', battle.id)
    .order('turn_number', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20)

  const logs = (logsData as unknown as LogEntry[]) || []

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

  const isMyTurn = battle.current_turn_player_id === user.id && battle.status === 'ACTIVE'
  const isCompleted = battle.status === 'COMPLETED' || battle.status === 'CANCELLED'

  const myPlayer = battle.player1_id === user.id ? battle.p1 : battle.p2
  const opponentPlayer = battle.player1_id === user.id ? battle.p2 : battle.p1

  const myHealth = battle.player1_id === user.id ? battle.p1_health : battle.p2_health
  const opponentHealth = battle.player1_id === user.id ? battle.p2_health : battle.p1_health
  
  const myDefending = battle.player1_id === user.id ? battle.p1_defending : battle.p2_defending
  const opponentDefending = battle.player1_id === user.id ? battle.p2_defending : battle.p1_defending
  
  const myEffects = battle.player1_id === user.id ? battle.p1_effects : battle.p2_effects
  const opponentEffects = battle.player1_id === user.id ? battle.p2_effects : battle.p1_effects
  
  const sigilMeta = sigilData?.ability_meta || null
  const sigilCdUntil = myEffects?.sigil_cd_until ? parseInt(myEffects.sigil_cd_until, 10) : 0
  const sigilOnCooldown = sigilCdUntil >= battle.turn_counter
  const sigilCooldownRemaining = Math.max(0, sigilCdUntil - battle.turn_counter + 1)

  const isMyShielded = myEffects?.shield_until && parseInt(myEffects.shield_until, 10) >= battle.turn_counter
  const isMyDisrupted = myEffects?.disrupted_until && parseInt(myEffects.disrupted_until, 10) >= battle.turn_counter
  const isMyCountered = myEffects?.counter_until && parseInt(myEffects.counter_until, 10) >= battle.turn_counter

  const isOppShielded = opponentEffects?.shield_until && parseInt(opponentEffects.shield_until, 10) >= battle.turn_counter
  const isOppDisrupted = opponentEffects?.disrupted_until && parseInt(opponentEffects.disrupted_until, 10) >= battle.turn_counter
  const isOppCountered = opponentEffects?.counter_until && parseInt(opponentEffects.counter_until, 10) >= battle.turn_counter

  function renderHealthBar(health: number, reverse = false) {
    return (
      <div className="h-3 w-full bg-black rounded-full overflow-hidden border border-border/50">
        <div 
          className={`h-full transition-all duration-500 ease-out ${health > 50 ? 'bg-emerald-500' : health > 20 ? 'bg-warning' : 'bg-danger'} ${reverse ? 'ml-auto' : ''}`}
          style={{ width: `${Math.max(0, Math.min(100, health))}%` }} 
        />
      </div>
    )
  }

  // Fetch theft amount if completed
  let stolenPoints = 0
  if (isCompleted && battle.winner) {
    const { data: ledger } = await supabase
      .from('points_ledger')
      .select('amount')
      .eq('transaction_type', 'BATTLE_THEFT_CREDIT')
      .eq('reference_key', `${battle.id}-theft-credit`)
      .single()
    if (ledger) {
      stolenPoints = ledger.amount
    }
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl mt-2 sm:mt-8 space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center border-b border-border pb-4">
        <div>
          <h2 className="text-xs font-mono text-muted-foreground tracking-widest mb-1">ENGAGEMENT {battle.status}</h2>
          <div className="flex gap-2 items-center">
            <h1 className="text-xl font-bold tracking-tighter">TURN {battle.turn_counter}</h1>
            <span className="text-[10px] font-mono text-muted-foreground">/ {battle.max_turns}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href={`/battle/${battle.id}`} className="text-[10px] font-mono text-info hover:text-white transition-colors">
            REFRESH
          </Link>
          <Link href="/game" className="btn btn-outline text-[10px] h-8 px-4 tracking-widest">
            LEAVE
          </Link>
        </div>
      </div>

      {isCompleted && (
        <div className="panel p-6 border-info/30 bg-info/5 text-center">
          <h3 className="text-xs font-mono tracking-widest text-info mb-2">ENGAGEMENT CONCLUDED</h3>
          <h2 className="text-3xl font-bold text-white mb-2">
            {battle.winner ? `${battle.winner.handle} VICTORIOUS` : 'DRAW'}
          </h2>
          <p className="text-sm font-mono text-muted-foreground mb-4">{battle.completion_reason?.replace(/_/g, ' ')}</p>
          {battle.winner && (
            <div className="inline-block bg-black/40 border border-border/50 rounded px-6 py-4">
              <h4 className="text-[10px] font-mono tracking-widest text-muted-foreground mb-2">REWARDS</h4>
              <div className="flex gap-4 items-center justify-center text-sm font-mono">
                <span className="text-emerald-500">+100 FIXED REWARD</span>
                {stolenPoints > 0 && (
                  <>
                    <span className="text-muted-foreground">&bull;</span>
                    <span className="text-emerald-500">+{stolenPoints} STOLEN POINTS</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Combatants HUD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12">
        {/* My Player */}
        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <div>
              <h3 className="text-lg font-bold text-white leading-none">{myPlayer.handle}</h3>
              <p className="text-[10px] font-mono text-emerald-500 tracking-widest mt-1">YOU</p>
            </div>
            <div className="text-right">
              <span className="text-xl font-mono font-bold text-white">{myHealth}</span>
              <span className="text-[10px] font-mono text-muted-foreground ml-1">HP</span>
            </div>
          </div>
          {renderHealthBar(myHealth)}
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
            {battle.current_turn_player_id === user.id && !isCompleted && (
              <span className="text-[10px] font-mono text-warning motion-safe:animate-pulse">YOUR TURN &rarr;</span>
            )}
          </div>
        </div>

        {/* Opponent Player */}
        <div className="space-y-3">
          <div className="flex justify-between items-end flex-row-reverse sm:flex-row">
            <div className="sm:text-right">
              <h3 className="text-lg font-bold text-white leading-none">{opponentPlayer.handle}</h3>
              <p className="text-[10px] font-mono text-danger tracking-widest mt-1">OPPONENT</p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[10px] font-mono text-muted-foreground mr-1">HP</span>
              <span className="text-xl font-mono font-bold text-white">{opponentHealth}</span>
            </div>
          </div>
          {renderHealthBar(opponentHealth, true)}
          <div className="flex flex-wrap gap-2 mt-2 justify-end">
            {opponentDefending && (
              <span className="text-[10px] font-mono bg-info/20 text-info px-2 py-0.5 rounded transition-all">DEFENDING</span>
            )}
            {isOppShielded && (
              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded transition-all">SHIELDED</span>
            )}
            {isOppCountered && (
              <span className="text-[10px] font-mono bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded transition-all">COUNTER ARMED</span>
            )}
            {isOppDisrupted && (
              <span className="text-[10px] font-mono bg-danger/20 text-danger px-2 py-0.5 rounded transition-all">DISRUPTED</span>
            )}
          </div>
          <div className="flex justify-between flex-row-reverse min-h-[20px] mt-2">
            {battle.current_turn_player_id === opponentPlayer.id && !isCompleted && (
              <span className="text-[10px] font-mono text-warning motion-safe:animate-pulse">&larr; THEIR TURN</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6">
        
        {/* Controls */}
        <div className="lg:col-span-1">
          <BattleControls 
            battleId={battle.id}
            expectedTurn={battle.turn_counter}
            isMyTurn={isMyTurn}
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
            {logs.length === 0 && (
              <div className="text-center text-xs font-mono text-muted-foreground opacity-50 py-8">
                NO ACTIONS RECORDED
              </div>
            )}
            {logs.map((log) => {
              const details = log.action_details || {}
              return (
                <div key={log.id} className="text-sm border-l-2 border-border/50 pl-3 py-1">
                  <div className="flex gap-2 items-baseline mb-1">
                    <span className="text-[10px] font-mono text-muted-foreground">T{log.turn_number}</span>
                    <span className={`font-bold ${log.actor_id === user.id ? 'text-white' : 'text-danger'}`}>
                      {log.actor.handle}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {log.action_type === 'SIGIL_ABILITY' ? 'unleashed sigil' : `used ${log.action_type.replace('_', ' ')}`}
                    </span>
                  </div>
                  <div className="text-muted-foreground/80 text-sm">
                    {log.action_type === 'ATTACK' && (
                      <div className="flex flex-col gap-1">
                        <span>
                          Dealt <strong className="text-white">{details.final_damage || 0}</strong> damage 
                          {details.weapon && details.weapon !== 'unarmed' ? ` with ${details.weapon.replace('wpn_', '')}.` : ' unarmed.'}
                        </span>
                        {(details.armour_mitigation || details.defend_mitigation || details.shield_mitigation || details.disrupt_mitigation || details.countered_damage_taken) && (
                          <div className="text-[11px] font-mono opacity-80 border-l border-border/50 pl-2 ml-1 flex flex-col">
                            {details.disrupt_mitigation && <span className="text-danger">Damage halved by disruption.</span>}
                            {details.armour_mitigation ? <span>Opponent armour absorbed {details.armour_mitigation}.</span> : null}
                            {details.defend_mitigation ? <span className="text-info">Damage halved by defensive stance.</span> : null}
                            {details.shield_mitigation ? <span className="text-emerald-400">Shield absorbed {details.shield_mitigation}.</span> : null}
                            {details.countered_damage_taken ? <span className="text-purple-400">Took {details.countered_damage_taken} damage from opponent counter!</span> : null}
                          </div>
                        )}
                      </div>
                    )}
                    {log.action_type === 'DEFEND' && <span>{details.message || 'Prepared defenses.'}</span>}
                    {log.action_type === 'USE_ITEM' && (
                      <span>
                        {details.healed ? `Recovered ${details.healed} HP.` : details.message || 'Used utility item.'}
                      </span>
                    )}
                    {log.action_type === 'SIGIL_ABILITY' && details.ability && (
                      <div className="flex flex-col gap-1">
                        {details.ability === 'DAMAGE' && (
                          <span>
                            Dealt <strong className="text-white">{details.final_damage || 0}</strong> supernatural damage.
                            {(details.armour_mitigation || details.defend_mitigation || details.shield_mitigation) && (
                              <div className="text-[11px] font-mono opacity-80 border-l border-border/50 pl-2 ml-1 mt-1 flex flex-col">
                                {details.armour_mitigation ? <span>Opponent armour absorbed {details.armour_mitigation}.</span> : null}
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
