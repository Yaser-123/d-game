import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { EquipButton } from '@/components/EquipButton'


type InventoryItem = {
  id: string
  quantity: number
  equipped: boolean
  items: {
    id: string
    name: string
    category: string
    description: string
    equipment_slot: string | null
    effects: Record<string, unknown>
  }
}

export default async function InventoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch current player status
  const { data: currentPlayer } = await supabase
    .from('players')
    .select('status')
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

  // Fetch player inventory with items data
  const { data: invData } = await supabase
    .from('inventory')
    .select('id, quantity, equipped, items(id, name, category, description, equipment_slot, effects)')
    .eq('player_id', user.id)
    .order('created_at', { ascending: false })

  const inventory = (invData || []) as unknown as InventoryItem[]

  const weapons = inventory.filter(i => i.items.category === 'weapon')
  const defence = inventory.filter(i => i.items.category === 'defence')
  const utility = inventory.filter(i => i.items.category === 'utility')

  function renderCategory(title: string, items: InventoryItem[]) {
    if (items.length === 0) return null
    return (
      <div className="space-y-4 mb-8">
        <h3 className="text-xs font-mono text-muted-foreground tracking-widest border-b border-border/50 pb-2">{title}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(entry => (
            <div key={entry.id} className={`panel p-4 flex flex-col gap-3 ${entry.equipped ? 'border-danger/40 bg-danger/5' : ''}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white tracking-tight">{entry.items.name}</h4>
                    {entry.quantity > 1 && (
                      <span className="text-[10px] font-mono bg-white/10 px-1.5 py-0.5 rounded text-white/70">
                        x{entry.quantity}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">SLOT: {entry.items.equipment_slot?.replace('_', ' ').toUpperCase() || 'NONE'}</p>
                </div>
                {entry.items.equipment_slot && (
                  <EquipButton inventoryId={entry.id} currentlyEquipped={entry.equipped} />
                )}
              </div>
              <p className="text-xs text-muted-foreground/80 leading-relaxed">
                {entry.items.description}
              </p>
              {entry.equipped && (
                <div className="text-[10px] font-mono text-danger tracking-widest">
                  [ EQUIPPED ]
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl mt-4 sm:mt-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-border pb-6 gap-4">
        <div>
          <h2 className="text-xs font-mono text-muted-foreground tracking-widest mb-2">QUARTERMASTER</h2>
          <h1 className="text-4xl font-bold tracking-tighter">INVENTORY</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/shop" className="btn btn-outline border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500 text-xs tracking-widest px-6 h-10 flex items-center">
            BLACK MARKET &rarr;
          </Link>
          <Link href="/game" className="btn btn-outline text-xs tracking-widest px-6 h-10 flex items-center">
            &larr; BACK TO ARENA
          </Link>
        </div>
      </div>

      {inventory.length === 0 ? (
        <div className="panel p-12 text-center border-dashed opacity-70">
          <p className="text-sm font-mono text-muted-foreground tracking-widest mb-2">INVENTORY EMPTY</p>
          <p className="text-xs text-muted-foreground">You currently possess no tactical assets or equipment.</p>
        </div>
      ) : (
        <div>
          {renderCategory('WEAPONS', weapons)}
          {renderCategory('DEFENCE', defence)}
          {renderCategory('UTILITY', utility)}
        </div>
      )}

    </div>
  )
}
