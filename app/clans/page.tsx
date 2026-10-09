import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ActionButton, CreateClanForm, InvitePlayerForm } from '@/components/ClanActionButtons'
import { respondToInvite, leaveClan, disbandClan, removeMember, cancelInvite, transferLeadership } from '@/app/actions/clans'


export default async function ClansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/login')

  const { data: player } = await supabase.from('players').select('status, points').eq('id', user.id).single()
  const isEliminated = player?.status === 'ELIMINATED' || player?.status === 'FINAL_SALVATION'
  const canAct = player?.status === 'ACTIVE'

  // Fetch my clan membership
  const { data: myMembership } = await supabase
    .from('clan_members')
    .select('*, clan:clans(*)')
    .eq('player_id', user.id)
    .single()

  const inClan = !!myMembership
  const myClan = myMembership?.clan
  const myRole = myMembership?.role

  // Fetch my clan's full roster if I'm in a clan
  let clanRoster = []
  let outboundInvites = []
  if (inClan && myClan) {
    const { data: rosterData } = await supabase
      .from('clan_members')
      .select('*, players(handle, status)')
      .eq('clan_id', myClan.id)
      .order('joined_at', { ascending: true })
    clanRoster = rosterData || []

    const { data: invitesData } = await supabase
      .from('clan_invitations')
      .select('*, invitee:players!clan_invitations_invitee_id_fkey(handle)')
      .eq('clan_id', myClan.id)
      .eq('status', 'PENDING')
    outboundInvites = invitesData || []
  }

  // Fetch incoming invites for me
  const { data: incomingInvitesData } = await supabase
    .from('clan_invitations')
    .select('*, clan:clans(name, tag), inviter:players!clan_invitations_inviter_id_fkey(handle)')
    .eq('invitee_id', user.id)
    .eq('status', 'PENDING')
  const incomingInvites = incomingInvitesData || []

  // Fetch all active clans (for browsing)
  const { data: allClansData } = await supabase
    .from('clans')
    .select('*, members:clan_members(count)')
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false })
  const allClans = allClansData || []

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl mt-4 sm:mt-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-border pb-6 gap-4">
        <div>
          <h2 className="text-xs font-mono text-muted-foreground tracking-widest mb-2">FACTIONS & SYNDICATES</h2>
          <h1 className="text-4xl font-bold tracking-tighter">CLAN REGISTRY</h1>
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
            CLEARANCE DENIED: ELIMINATED / FINAL SALVATION STATUS PREVENTS CLAN OPERATIONS
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: My Clan / Dashboard */}
        <div className="lg:col-span-2 space-y-8">
          
          {inClan && myClan ? (
            <section className="panel border border-border/50 bg-black/40">
              <div className="p-6 border-b border-border/50 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-mono bg-white/20 text-white tracking-widest px-2 py-0.5 rounded">
                      [{myClan.tag}]
                    </span>
                    <span className="text-[10px] font-mono text-emerald-500 border border-emerald-500/50 px-2 py-0.5 rounded">
                      YOUR CLAN
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight text-white mb-2">{myClan.name}</h3>
                  <p className="text-sm text-muted-foreground">{myClan.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono text-muted-foreground tracking-widest mb-1">YOUR RANK</div>
                  <div className="text-sm font-mono font-bold text-emerald-500">{myRole}</div>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                <div>
                  <h4 className="text-xs font-mono text-white tracking-widest border-b border-border/50 pb-2 mb-4">ROSTER ({clanRoster.length}/50)</h4>
                  <div className="space-y-2">
                    {clanRoster.map((m: unknown) => (
                      <div key={m.player_id} className="flex justify-between items-center p-3 border border-border/30 bg-black/20 text-sm font-mono">
                        <div className="flex items-center gap-3">
                          <span className={m.player_id === user.id ? 'text-white font-bold' : 'text-muted-foreground'}>
                            {m.players?.handle} {m.player_id === user.id && '(YOU)'}
                          </span>
                          {m.players?.status !== 'ACTIVE' && (
                            <span className="text-[9px] text-danger border border-danger/30 px-1 rounded">{m.players?.status}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-muted-foreground">{m.role}</span>
                          
                          {/* Admin actions over other members */}
                          {m.player_id !== user.id && (myRole === 'LEADER' || (myRole === 'OFFICER' && m.role === 'MEMBER')) && (
                            <ActionButton 
                              action={removeMember.bind(null, m.player_id)} 
                              label="KICK" 
                              confirmText={`Kick ${m.players?.handle}?`}
                              danger 
                            />
                          )}
                          {myRole === 'LEADER' && m.player_id !== user.id && (
                            <ActionButton 
                              action={transferLeadership.bind(null, m.player_id)} 
                              label="MAKE LEADER" 
                              confirmText={`Transfer leadership to ${m.players?.handle}? You will become an OFFICER.`}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {(myRole === 'LEADER' || myRole === 'OFFICER') && (
                  <div>
                    <h4 className="text-xs font-mono text-white tracking-widest border-b border-border/50 pb-2 mb-4">ADMINISTRATION</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-mono text-muted-foreground">INVITE OPERATIVE</span>
                        <InvitePlayerForm disabled={!canAct} />
                      </div>
                      
                      {outboundInvites.length > 0 && (
                        <div className="pt-2">
                          <span className="text-[10px] font-mono text-muted-foreground block mb-2">PENDING OUTBOUND INVITATIONS</span>
                          <div className="space-y-1">
                            {outboundInvites.map((inv: unknown) => (
                              <div key={inv.id} className="flex justify-between items-center text-xs font-mono bg-black/40 p-2 border border-border/30">
                                <span>{inv.invitee?.handle}</span>
                                <ActionButton action={cancelInvite.bind(null, inv.id)} label="CANCEL" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-border/50 flex justify-end">
                  {myRole === 'LEADER' ? (
                    <ActionButton action={disbandClan} label="DISBAND CLAN" confirmText="Permanently disband this clan? This cannot be undone." danger />
                  ) : (
                    <ActionButton action={leaveClan} label="LEAVE CLAN" confirmText="Leave your clan?" danger />
                  )}
                </div>
              </div>
            </section>
          ) : (
            <section className="panel border border-border/50 bg-black/40 p-6">
              <h3 className="text-sm font-mono text-white tracking-widest mb-4 border-b border-border/50 pb-2">ESTABLISH NEW CLAN</h3>
              <CreateClanForm disabled={!canAct} />
            </section>
          )}

          {/* Incoming Invitations */}
          {!inClan && incomingInvites.length > 0 && (
            <section className="panel border border-emerald-500/30 bg-emerald-500/5 p-6">
              <h3 className="text-sm font-mono text-white tracking-widest mb-4 border-b border-emerald-500/30 pb-2">INCOMING INVITATIONS</h3>
              <div className="space-y-3">
                {incomingInvites.map((inv: unknown) => (
                  <div key={inv.id} className="flex justify-between items-center p-3 bg-black/40 border border-border/50 text-sm font-mono">
                    <div>
                      <span className="text-white font-bold">[{inv.clan?.tag}] {inv.clan?.name}</span>
                      <div className="text-[10px] text-muted-foreground mt-1">Invited by: {inv.inviter?.handle}</div>
                    </div>
                    <div className="flex gap-2">
                      <ActionButton action={respondToInvite.bind(null, inv.id, true)} label="ACCEPT" />
                      <ActionButton action={respondToInvite.bind(null, inv.id, false)} label="DECLINE" danger />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>

        {/* Right Column: Global Registry */}
        <div className="space-y-8">
          <section>
            <h3 className="text-sm font-mono text-white tracking-widest mb-4 border-b border-border/50 pb-2">GLOBAL REGISTRY</h3>
            <div className="space-y-3">
              {allClans.length === 0 ? (
                <div className="text-xs font-mono text-muted-foreground text-center p-4 border border-dashed border-border/50">
                  NO CLANS ESTABLISHED
                </div>
              ) : (
                allClans.map((c: unknown) => (
                  <div key={c.id} className="panel p-4 border border-border/50 bg-black/20 text-sm font-mono">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-white">[{c.tag}] {c.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {c.members[0].count}/50
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground leading-relaxed">
                      {c.description}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

      </div>

    </div>
  )
}
