import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PurchaseButton } from '@/components/PurchaseButton'


type Item = {
  id: string
  name: string
  category: string
  description: string
  equipment_slot: string | null
  effects: any
  is_stackable: boolean
  price: number
}

type InventoryItem = {
  item_id: string
  quantity: number
}

export default async function ShopPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch player status and points
  const { data: player } = await supabase
    .from('players')
    .select('status, points')
    .eq('id', user.id)
    .single()

  if (!player || player.status === 'ELIMINATED' || player.status === 'FINAL_SALVATION') {
    return (
      <div className="container mx-auto p-4 sm:p-6 mt-8 max-w-2xl text-center space-y-6">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tighter text-danger">ACCESS DENIED</h1>
        <div className="panel p-8 space-y-4">
          <p className="text-muted-foreground text-lg">Your current operative status prohibits access to the Black Market.</p>
          <Link href="/game" className="btn btn-outline text-xs tracking-widest px-6 mt-4 inline-block">
            RETURN
          </Link>
        </div>
      </div>
    )
  }

  // Fetch catalogue
  const { data: catalogueData } = await supabase
    .from('items')
    .select('*')
    .order('price', { ascending: true })
    
  const catalogue = (catalogueData || []) as Item[]

  // Fetch inventory
  const { data: inventoryData } = await supabase
    .from('inventory')
    .select('item_id, quantity')
    .eq('player_id', user.id)
    
  const inventory = (inventoryData || []) as InventoryItem[]

  // Group items by category
  const categories: Record<string, Item[]> = {}
  catalogue.forEach(item => {
    if (!categories[item.category]) categories[item.category] = []
    categories[item.category].push(item)
  })

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl mt-4 sm:mt-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-border pb-6 gap-4">
        <div>
          <h2 className="text-xs font-mono text-muted-foreground tracking-widest mb-2">UNDERGROUND NETWORK</h2>
          <h1 className="text-4xl font-bold tracking-tighter text-white">BLACK MARKET</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] font-mono text-muted-foreground block mb-1">AVAILABLE BALANCE</span>
            <span className="text-xl font-bold font-mono text-emerald-500">{player.points.toLocaleString()} PTS</span>
          </div>
          <Link href="/game" className="btn btn-outline text-xs tracking-widest px-6 h-12 flex items-center">
            &larr; ARENA
          </Link>
        </div>
      </div>

      {catalogue.length === 0 ? (
        <div className="panel p-12 text-center border-dashed opacity-70">
          <p className="text-sm font-mono text-muted-foreground tracking-widest mb-2">CATALOGUE OFFLINE</p>
          <p className="text-xs text-muted-foreground">The vendor is currently unresponsive. Check back later.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {Object.entries(categories).map(([category, items]) => (
            <div key={category} className="space-y-6">
              <h3 className="text-xl font-bold tracking-widest uppercase border-b border-border/50 pb-2 text-muted-foreground">
                {category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map(item => {
                  const owned = inventory.find(i => i.item_id === item.id)
                  const ownedQty = owned?.quantity || 0
                  
                  const cannotAfford = player.points < item.price
                  const wouldTriggerFinalSalvation = (player.points - item.price) < 100
                  const nonStackableAlreadyOwned = !item.is_stackable && ownedQty > 0
                  
                  const isDisabled = cannotAfford || wouldTriggerFinalSalvation || nonStackableAlreadyOwned

                  let errorMsg = null
                  if (nonStackableAlreadyOwned) {
                    errorMsg = 'ALREADY OWNED'
                  } else if (cannotAfford) {
                    errorMsg = 'INSUFFICIENT FUNDS'
                  } else if (wouldTriggerFinalSalvation) {
                    errorMsg = 'MAINTAIN 100 PTS MINIMUM'
                  }

                  return (
                    <div key={item.id} className="panel p-5 flex flex-col justify-between hover:border-white/20 transition-colors">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-lg font-bold tracking-tight text-white">{item.name}</h4>
                          <span className="text-xs font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                            {item.price}
                          </span>
                        </div>
                        
                        <p className="text-[10px] font-mono text-muted-foreground tracking-widest mb-4">
                          SLOT: {item.equipment_slot ? item.equipment_slot.toUpperCase() : 'NONE'}
                        </p>
                        
                        <p className="text-sm text-muted-foreground mb-4">
                          {item.description}
                        </p>

                        <div className="space-y-1 mb-4">
                          {Object.entries(item.effects).map(([key, val]) => (
                            <div key={key} className="flex justify-between text-xs font-mono">
                              <span className="text-muted-foreground">{key.toUpperCase()}</span>
                              <span className={typeof val === 'number' && val > 0 ? 'text-emerald-500' : 'text-white'}>
                                {typeof val === 'number' && val > 0 ? '+' : ''}{String(val)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-border/30">
                        <div className="flex justify-between items-center text-[10px] font-mono mb-2">
                          <span className="text-muted-foreground">OWNED: {ownedQty}</span>
                          <span className="text-muted-foreground">
                            {item.is_stackable ? 'STACKABLE' : 'UNIQUE'}
                          </span>
                        </div>
                        
                        {errorMsg ? (
                          <div className="w-full text-center py-2 mt-4 text-[10px] font-mono text-danger border border-danger/20 bg-danger/5 rounded">
                            {errorMsg}
                          </div>
                        ) : (
                          <PurchaseButton 
                            itemId={item.id} 
                            price={item.price} 
                            disabled={isDisabled}
                            isStackable={item.is_stackable}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
