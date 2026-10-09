'use client'

import { useState } from 'react'
import { submitPvEAction } from '@/app/actions/pve'
import { useRouter } from 'next/navigation'

type UsableItem = {
  id: string
  quantity: number
  items: {
    id: string
    name: string
    effects: Record<string, unknown>
  }
}

export function PvEControls({ 
  encounterId, 
  isCompleted,
  usableItems,
  sigil
}: {
  encounterId: string
  isCompleted: boolean
  usableItems: UsableItem[]
  sigil?: {
    hasAbility: boolean
    name: string
    type: string
    onCooldown: boolean
    cooldownRemaining: number
  }
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleAction(actionType: string, itemId?: string) {
    setLoading(true)
    setError(null)
    const result = await submitPvEAction(encounterId, actionType, itemId)
    
    if (result && result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.refresh()
      setLoading(false)
    }
  }

  if (isCompleted) {
    return (
      <div className="text-center p-4 opacity-50 border border-dashed border-border/50 rounded">
        <p className="text-xs font-mono tracking-widest text-muted-foreground">ENCOUNTER CONCLUDED</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <button 
          onClick={() => handleAction('ATTACK')} 
          disabled={loading}
          className="btn btn-danger h-12 tracking-widest"
        >
          {loading ? '...' : 'ATTACK'}
        </button>
        <button 
          onClick={() => handleAction('DEFEND')} 
          disabled={loading}
          className="btn btn-outline border-info/50 text-info hover:bg-info/10 h-12 tracking-widest"
        >
          {loading ? '...' : 'DEFEND'}
        </button>
      </div>

      <div className="border border-border/50 rounded p-4">
        <h4 className="text-[10px] font-mono text-muted-foreground tracking-widest mb-3">UTILITY BELT</h4>
        {usableItems.length > 0 ? (
          <div className="space-y-2">
            {usableItems.map(inv => {
              const effectStr = inv.items.effects?.healing ? `(+${inv.items.effects.healing} HP)` : ''
              return (
                <div key={inv.id} className="flex justify-between items-center bg-black/40 p-2 rounded">
                  <div>
                    <span className="text-xs font-bold text-white">{inv.items.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground ml-2">x{inv.quantity} {effectStr}</span>
                  </div>
                  <button 
                    onClick={() => handleAction('USE_ITEM', inv.items.id)}
                    disabled={loading}
                    className="text-[10px] font-mono bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded transition-colors"
                  >
                    USE
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/50 italic">No usable items available.</p>
        )}
      </div>

      {sigil && sigil.hasAbility ? (
        <button 
          onClick={() => handleAction('SIGIL_ABILITY')}
          disabled={loading || sigil.onCooldown}
          className={`w-full btn h-12 tracking-widest flex flex-col items-center justify-center gap-1 ${
            sigil.onCooldown ? 'btn-outline border-border/20 text-muted-foreground/30 cursor-not-allowed' : 'btn-outline border-purple-500/50 text-purple-400 hover:bg-purple-500/10'
          }`}
        >
          <span>{sigil.onCooldown ? `COOLDOWN (${sigil.cooldownRemaining}T)` : 'UNLEASH SIGIL'}</span>
          <span className="text-[8px] normal-case tracking-normal">{sigil.name} • {sigil.type}</span>
        </button>
      ) : (
        <button 
          disabled
          className="w-full btn btn-outline border-border/20 text-muted-foreground/30 cursor-not-allowed h-12 tracking-widest flex flex-col items-center justify-center gap-1"
        >
          <span>SIGIL ABILITY (LOCKED)</span>
          <span className="text-[8px] normal-case tracking-normal">Structured combat metadata pending update</span>
        </button>
      )}

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger text-xs font-mono p-3 rounded">
          ERROR: {error}
        </div>
      )}
    </div>
  )
}
