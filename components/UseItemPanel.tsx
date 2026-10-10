'use client'

import { useState } from 'react'
import { useItemAction } from '@/app/actions/useItem'

export function UseItemPanel({ challengeId, myItems, isMyTurn }: { challengeId: string, myItems: any[], isMyTurn: boolean }) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  
  if (!myItems || myItems.length === 0) return null

  const handleUseItem = async (inventoryId: string) => {
    setLoadingId(inventoryId)
    const res = await useItemAction(challengeId, inventoryId)
    if (res?.error) alert(res.error)
    setLoadingId(null)
  }

  return (
    <div className="mt-6 border-t border-border/20 pt-6">
      <h3 className="text-xs font-mono text-muted-foreground tracking-widest mb-4">TACTICAL ITEMS</h3>
      <div className="flex flex-wrap gap-2">
        {myItems.map(item => (
          <button
            key={item.id}
            disabled={loadingId === item.id || (!isMyTurn && item.effects?.skip_turn)}
            onClick={() => handleUseItem(item.id)}
            className="btn btn-outline border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 flex flex-col items-center p-2 h-auto text-xs"
          >
            <span className="font-bold">{item.name.toUpperCase()} (x{item.quantity})</span>
            {item.effects?.heal && <span className="text-[10px] opacity-70">RESTORES 1 HP</span>}
            {item.effects?.skip_turn && <span className="text-[10px] opacity-70">SKIPS TURN</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
