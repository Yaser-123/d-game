import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'


export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch player and their sigil
  const { data: player } = await supabase
    .from('players')
    .select('*, sigils(*)')
    .eq('id', user.id)
    .single()

  if (!player) {
    redirect('/initialize')
  }

  if (player.status === 'ELIMINATED') {
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

  // Fetch recent ledger activity
  const { data: ledger } = await supabase
    .from('points_ledger')
    .select('*')
    .eq('player_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const sigil = Array.isArray(player.sigils) ? player.sigils[0] : player.sigils

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl mt-4 sm:mt-8 space-y-8 sm:space-y-12">
      
      {/* Header */}
      <div className="border-b border-border pb-6 flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-xs font-mono text-muted-foreground tracking-widest mb-2">DOSSIER</h2>
          <h1 className="text-4xl font-bold tracking-tighter">{player.handle}</h1>
        </div>
        <div className="sm:text-right flex justify-between sm:flex-col items-center sm:items-end">
          <div className="flex gap-6 text-left sm:text-right mb-2 sm:mb-4">
            <div>
              <p className="text-xs font-mono text-muted-foreground tracking-widest mb-1">STATUS</p>
              <p className={`text-xl font-bold font-mono tracking-tighter ${player.status === 'FINAL_SALVATION' ? 'text-warning' : 'text-emerald-500'}`}>
                {player.status}
              </p>
            </div>
            <div>
              <p className="text-xs font-mono text-muted-foreground tracking-widest mb-1">AVAILABLE POINTS</p>
              <p className={`text-xl font-bold font-mono tracking-tighter ${player.points < 100 ? 'text-warning' : 'text-white'}`}>
                {player.points.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-mono text-muted-foreground">CREATED</p>
            <p className="text-sm">{new Date(player.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-4 border-b border-border pb-6">
        <Link href="/inventory" className="btn btn-outline border-border/50 text-xs px-4 h-8 tracking-widest hover:border-white">
          VIEW TACTICAL INVENTORY &rarr;
        </Link>
      </div>

      {/* Sigil Section */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold tracking-tighter text-danger border-l-2 border-danger pl-3">ASSIGNED SIGIL</h2>
        
        {sigil ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="panel space-y-4 p-5 sm:p-6">
              <div>
                <h3 className="text-xs font-mono text-muted-foreground tracking-widest mb-1">DESIGNATION</h3>
                <p className="text-2xl font-bold text-white">{sigil.name}</p>
              </div>
              
              <div>
                <h3 className="text-xs font-mono text-muted-foreground tracking-widest mb-1">CAPABILITY</h3>
                <p className="text-sm text-foreground/80 leading-relaxed">{sigil.basic_ability}</p>
              </div>
            </div>

            <div className="panel space-y-4 bg-danger/5 border-danger/20 p-5 sm:p-6">
              <div>
                <h3 className="text-xs font-mono text-danger tracking-widest mb-1">RESTRICTION</h3>
                <p className="text-sm text-foreground/80 leading-relaxed">{sigil.limitation}</p>
              </div>

              <div className="pt-4 border-t border-danger/10">
                <h3 className="text-xs font-mono text-muted-foreground tracking-widest mb-2">MASTERY LEVEL</h3>
                <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-danger rounded-full" 
                    style={{ width: `${Math.max(5, sigil.mastery)}%` }} 
                  />
                </div>
                <p className="text-xs font-mono text-right mt-1 text-muted-foreground">{sigil.mastery} / 100</p>
              </div>
            </div>

            <div className="panel md:col-span-2 space-y-2 opacity-70 p-5 sm:p-6">
              <h3 className="text-xs font-mono text-muted-foreground tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-muted-foreground rounded-full inline-block" />
                CLASSIFIED MECHANIC
              </h3>
              <p className="text-sm font-mono text-muted-foreground italic">
                {sigil.hidden_mechanic 
                  ? "Mechanic discovered. Viewable only to owner."
                  : "Data corrupted. Further field testing required to unlock hidden mechanics."}
              </p>
              {sigil.hidden_mechanic && (
                <div className="mt-4 p-3 bg-black/50 border border-border/50 rounded text-sm text-foreground/80 font-mono">
                  &gt; {sigil.hidden_mechanic}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="panel text-center py-12 opacity-50">
            <p className="font-mono text-sm tracking-widest">NO SIGIL RECORD FOUND</p>
          </div>
        )}
      </div>

      {/* Ledger Section */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold tracking-tighter text-emerald-500 border-l-2 border-emerald-500 pl-3">POINTS LEDGER</h2>
        <div className="panel p-0 overflow-hidden">
          {ledger && ledger.length > 0 ? (
            <div className="divide-y divide-border/50">
              {ledger.map(entry => (
                <div key={entry.id} className="p-4 sm:p-5 flex justify-between items-center hover:bg-white/[0.02] transition-colors">
                  <div>
                    <p className="text-sm font-bold text-white mb-1">{entry.transaction_type.replace(/_/g, ' ')}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</p>
                  </div>
                  <div className={`text-lg font-bold font-mono ${entry.amount > 0 ? 'text-emerald-500' : 'text-danger'}`}>
                    {entry.amount > 0 ? '+' : ''}{entry.amount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center opacity-50">
              <p className="font-mono text-sm tracking-widest">NO RECENT ACTIVITY</p>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
