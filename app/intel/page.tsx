import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PurchaseIntelButton, CancelIntelButton } from '@/components/IntelActionButtons'
import { CreateIntelForm } from '@/components/CreateIntelForm'


export default async function IntelExchangePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/login')

  const { data: player } = await supabase.from('players').select('status, points').eq('id', user.id).single()
  const { data: sigil } = await supabase.from('sigils').select('*').eq('player_id', user.id).single()

  // Fetch available market listings (ACTIVE and not owned by current user)
  const { data: marketListingsData } = await supabase
    .from('intel_listings')
    .select('*, seller:players!intel_listings_seller_id_fkey(handle)')
    .eq('status', 'ACTIVE')
    .neq('seller_id', user.id)
    .order('created_at', { ascending: false })
  
  // Fetch user's purchased intel (join with disclosures)
  const { data: purchasedData } = await supabase
    .from('intel_purchases')
    .select('*, listing:intel_listings(*, seller:players!intel_listings_seller_id_fkey(handle)), disclosure:intel_disclosures(content)')
    .eq('buyer_id', user.id)
    .order('purchased_at', { ascending: false })

  // Fetch user's own listings
  const { data: myListingsData } = await supabase
    .from('intel_listings')
    .select('*, disclosure:intel_disclosures(content)')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })

  const marketListings = marketListingsData || []
  const purchasedIntel = purchasedData || []
  const myListings = myListingsData || []

  // purchased listing ids to prevent duplicate purchases
  const purchasedIds = new Set(purchasedIntel.map((p: any) => p.listing_id))
  
  const canSell = player?.status === 'ACTIVE'
  const canBuy = player?.status === 'ACTIVE'
  const isEliminated = player?.status === 'ELIMINATED' || player?.status === 'FINAL_SALVATION'

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl mt-4 sm:mt-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-border pb-6 gap-4">
        <div>
          <h2 className="text-xs font-mono text-muted-foreground tracking-widest mb-2">INFORMATION BROKERAGE</h2>
          <h1 className="text-4xl font-bold tracking-tighter">INTEL EXCHANGE</h1>
        </div>
        <div className="flex gap-4">
          <div className="text-right mr-4 hidden sm:block">
            <div className="text-[10px] font-mono text-muted-foreground tracking-widest">CURRENT BALANCE</div>
            <div className="text-lg font-mono text-emerald-500 font-bold">{player?.points.toLocaleString()} PTS</div>
          </div>
          <Link href="/game" className="btn btn-outline text-xs tracking-widest px-6 h-10 flex items-center">
            &larr; BACK TO ARENA
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Market & Purchases */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Purchased Reports */}
          <section>
            <h3 className="text-sm font-mono text-white tracking-widest mb-4 border-b border-border/50 pb-2">PURCHASED INTEL REPORTS</h3>
            <div className="space-y-4">
              {purchasedIntel.length === 0 ? (
                <div className="panel p-6 text-center border-dashed opacity-70">
                  <p className="text-xs font-mono text-muted-foreground tracking-widest">NO ACQUIRED INTEL</p>
                </div>
              ) : (
                purchasedIntel.map((p: any) => (
                  <div key={p.id} className="panel p-5 border border-emerald-500/30 bg-emerald-500/5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-xs font-mono text-muted-foreground tracking-widest mb-1">
                          SUBJECT: <span className="text-emerald-500">{p.listing.seller?.handle}</span>
                        </div>
                        <h4 className="text-lg font-bold text-white tracking-tight">{p.listing.title}</h4>
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground border border-border/50 px-2 py-0.5 rounded">
                        {p.listing.category.replace('_', ' ')}
                      </div>
                    </div>
                    <div className="p-3 bg-black/60 border border-border/50 font-mono text-sm text-emerald-400">
                      {p.disclosure?.content || 'RESTRICTED_DATA'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Market Listings */}
          <section>
            <h3 className="text-sm font-mono text-white tracking-widest mb-4 border-b border-border/50 pb-2">GLOBAL MARKETPLACE</h3>
            
            {isEliminated && (
              <div className="mb-4 text-xs font-mono tracking-widest text-danger border border-danger/30 bg-danger/10 p-3">
                CLEARANCE DENIED: ELIMINATED / FINAL SALVATION STATUS PREVENTS PURCHASES
              </div>
            )}

            <div className="space-y-4">
              {marketListings.length === 0 ? (
                <div className="panel p-6 text-center border-dashed opacity-70">
                  <p className="text-xs font-mono text-muted-foreground tracking-widest">MARKET IS EMPTY</p>
                </div>
              ) : (
                marketListings.map((l: any) => {
                  const affordable = (player?.points || 0) - l.price >= 100
                  const alreadyBought = purchasedIds.has(l.id)
                  
                  return (
                    <div key={l.id} className="panel p-5 border border-border/50 bg-black/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-muted-foreground tracking-widest">
                            SELLER: <span className="text-white">{l.seller?.handle}</span>
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground border border-border/50 px-1.5 py-0.5 rounded">
                            {l.category.replace('_', ' ')}
                          </span>
                        </div>
                        <h4 className="text-lg font-bold text-white tracking-tight">{l.title}</h4>
                      </div>
                      <div className="w-full sm:w-auto shrink-0 sm:min-w-[200px]">
                        <PurchaseIntelButton 
                          listingId={l.id} 
                          price={l.price} 
                          title={l.title}
                          disabled={!canBuy || !affordable || alreadyBought} 
                        />
                        {!affordable && canBuy && !alreadyBought && (
                          <div className="text-[9px] font-mono text-danger text-center mt-1">REQUIRES {l.price + 100} PTS</div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>

        </div>

        {/* Right Column: Seller Dashboard */}
        <div className="space-y-8">
          
          <section className="panel border border-border/50 bg-black/40">
            <h3 className="text-sm font-mono text-white tracking-widest mb-4 border-b border-border/50 pb-2">SELL INTELLIGENCE</h3>
            
            {!canSell ? (
              <div className="text-xs font-mono tracking-widest text-danger">
                UNAVAILABLE FOR ELIMINATED OPERATIVES
              </div>
            ) : sigil ? (
              <CreateIntelForm 
                sigilHasMeta={!!sigil.ability_meta}
                sigilHasHint={!!sigil.basic_ability}
                sigilHasLimitation={!!sigil.limitation}
                sigilHasHidden={!!sigil.hidden_mechanic}
              />
            ) : (
              <div className="text-xs font-mono tracking-widest text-muted-foreground">
                NO SIGIL FOUND TO DISCLOSE
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-mono text-white tracking-widest mb-4 border-b border-border/50 pb-2">MY LISTINGS</h3>
            <div className="space-y-3">
              {myListings.length === 0 ? (
                <div className="text-xs font-mono text-muted-foreground tracking-widest text-center p-4 border border-dashed border-border/50">
                  NO ACTIVE LISTINGS
                </div>
              ) : (
                myListings.map((l: any) => (
                  <div key={l.id} className={`panel p-4 border text-sm ${l.status === 'ACTIVE' ? 'border-border/50' : l.status === 'SOLD' ? 'border-emerald-500/30' : 'border-danger/30 opacity-60'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold">{l.title}</div>
                      <div className={`text-[10px] font-mono tracking-widest px-1.5 py-0.5 rounded ${l.status === 'ACTIVE' ? 'bg-white/10' : l.status === 'SOLD' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-danger/20 text-danger'}`}>
                        {l.status}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs font-mono text-muted-foreground mb-3">
                      <span>{l.category.replace('_', ' ')}</span>
                      <span>{l.price} PTS</span>
                    </div>
                    {l.status === 'ACTIVE' && (
                      <div className="pt-2 border-t border-border/30">
                        <CancelIntelButton listingId={l.id} />
                      </div>
                    )}
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
