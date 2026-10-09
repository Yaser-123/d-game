import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { RegisterButton, SubmitBattleForm, ClaimRewardButton } from '@/components/EventActionButtons'

export const instant = false

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/login')

  const { data: player } = await supabase.from('players').select('status, points').eq('id', user.id).single()
  const isEliminated = player?.status === 'ELIMINATED' || player?.status === 'FINAL_SALVATION'

  // Fetch all events
  const { data: eventsData } = await supabase
    .from('events')
    .select('*')
    .order('start_time', { ascending: false })

  // Fetch user's participations
  const { data: participationsData } = await supabase
    .from('event_participants')
    .select('*')
    .eq('player_id', user.id)

  const participations = new Map(participationsData?.map(p => [p.event_id, p]))

  // We should fetch standings for all events, but realistically we only need top 3 or just winner for UI
  // Since this is a simple page, let's fetch all participants and aggregate
  const { data: allParticipantsData } = await supabase
    .from('event_participants')
    .select('event_id, player_id, score, players(handle)')
    .order('score', { ascending: false })

  const standingsByEvent = new Map()
  if (allParticipantsData) {
    for (const p of allParticipantsData) {
      if (!standingsByEvent.has(p.event_id)) {
        standingsByEvent.set(p.event_id, [])
      }
      standingsByEvent.get(p.event_id).push(p)
    }
  }

  const events = eventsData || []

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl mt-4 sm:mt-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-border pb-6 gap-4">
        <div>
          <h2 className="text-xs font-mono text-muted-foreground tracking-widest mb-2">GLOBAL ARENA</h2>
          <h1 className="text-4xl font-bold tracking-tighter">EVENTS DECREE</h1>
        </div>
        <div className="flex gap-4">
          <Link href="/game" className="btn btn-outline text-xs tracking-widest px-6 h-10 flex items-center">
            &larr; BACK TO ARENA
          </Link>
        </div>
      </div>

      {isEliminated && (
        <div className="panel border-danger/30 bg-danger/10 p-4 text-center">
          <div className="text-danger font-mono text-sm font-bold tracking-widest">
            CLEARANCE DENIED: ELIMINATED / FINAL SALVATION STATUS PREVENTS EVENT REGISTRATION
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div className="panel p-12 text-center border-dashed opacity-50">
          <div className="text-sm font-mono tracking-widest">NO EVENTS SCHEDULED</div>
        </div>
      ) : (
        <div className="space-y-8">
          {events.map(event => {
            const isRegistered = participations.has(event.id)
            const myParticipation = participations.get(event.id)
            const standings = standingsByEvent.get(event.id) || []
            const topScore = standings.length > 0 ? standings[0].score : 0
            const iAmWinner = isRegistered && topScore > 0 && myParticipation.score === topScore

            return (
              <div key={event.id} className={`panel border ${event.status === 'ACTIVE' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border/50 bg-black/40'}`}>
                
                {/* Event Header */}
                <div className="p-6 border-b border-border/50">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`text-[10px] font-mono tracking-widest px-2 py-0.5 rounded ${
                          event.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-500' : 
                          event.status === 'UPCOMING' ? 'bg-white/20 text-white' : 
                          event.status === 'CANCELLED' ? 'bg-danger/20 text-danger' : 
                          'bg-white/10 text-muted-foreground'
                        }`}>
                          {event.status}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground border border-border/50 px-2 py-0.5 rounded">
                          {event.type.replace('_', ' ')}
                        </span>
                      </div>
                      <h3 className="text-2xl font-bold tracking-tight text-white">{event.title}</h3>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-mono text-muted-foreground tracking-widest mb-1">REWARD</div>
                      <div className="text-lg font-mono text-emerald-500 font-bold">{event.reward_points} PTS</div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {event.description}
                  </p>

                  <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <div className="text-muted-foreground mb-1">START</div>
                      <div>{new Date(event.start_time).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">END</div>
                      <div>{new Date(event.end_time).toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                {/* Event Body */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                  
                  {/* Actions / Registration */}
                  <div className="space-y-6">
                    <h4 className="text-xs font-mono text-white tracking-widest border-b border-border/50 pb-2">YOUR STATUS</h4>
                    
                    {!isRegistered ? (
                      <div>
                        <div className="text-sm text-muted-foreground mb-4">You are not registered for this event. Registration is required to submit qualifying battles.</div>
                        {(event.status === 'UPCOMING' || event.status === 'ACTIVE') && (
                          <RegisterButton eventId={event.id} disabled={isEliminated} />
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 border border-emerald-500/30 bg-emerald-500/10">
                          <span className="text-xs font-mono tracking-widest text-emerald-500">CURRENT SCORE</span>
                          <span className="text-xl font-bold font-mono text-white">{myParticipation.score}</span>
                        </div>

                        {event.status === 'ACTIVE' && (
                          <div className="pt-2">
                            <div className="text-[10px] font-mono text-muted-foreground mb-2">SUBMIT COMPLETED BATTLE ID</div>
                            <SubmitBattleForm eventId={event.id} disabled={isEliminated} />
                          </div>
                        )}

                        {event.status === 'COMPLETED' && iAmWinner && (
                          <div className="pt-2">
                            {myParticipation.reward_claimed ? (
                              <div className="text-xs font-mono text-emerald-500 tracking-widest p-2 border border-emerald-500/30 text-center">
                                REWARD CLAIMED
                              </div>
                            ) : (
                              <ClaimRewardButton eventId={event.id} disabled={isEliminated} />
                            )}
                          </div>
                        )}

                        {event.status === 'COMPLETED' && !iAmWinner && (
                          <div className="text-xs font-mono text-muted-foreground tracking-widest p-2 border border-border/50 text-center">
                            EVENT CONCLUDED
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Standings */}
                  <div>
                    <h4 className="text-xs font-mono text-white tracking-widest border-b border-border/50 pb-2 mb-4">CURRENT STANDINGS</h4>
                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                      {standings.length === 0 ? (
                        <div className="text-xs font-mono text-muted-foreground text-center py-4 border border-dashed border-border/50">
                          NO REGISTRATIONS
                        </div>
                      ) : (
                        standings.slice(0, 10).map((s: Record<string, any>, idx: number) => (
                          <div key={s.player_id} className={`flex justify-between items-center p-2 text-sm font-mono ${s.player_id === user.id ? 'bg-white/10 border border-white/20' : 'border border-transparent'}`}>
                            <div className="flex items-center gap-3">
                              <span className={`text-xs ${idx === 0 ? 'text-emerald-500 font-bold' : 'text-muted-foreground'}`}>
                                #{idx + 1}
                              </span>
                              <span className={s.player_id === user.id ? 'text-white' : 'text-muted-foreground'}>
                                {s.players?.handle}
                              </span>
                            </div>
                            <span className="font-bold">{s.score}</span>
                          </div>
                        ))
                      )}
                      {standings.length > 10 && (
                        <div className="text-[10px] font-mono text-center text-muted-foreground pt-2">
                          + {standings.length - 10} MORE
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
