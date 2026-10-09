'use client'

import { useState } from 'react'
import { purchaseItem } from '@/app/actions/shop'

export function PurchaseButton({ itemId, price, disabled, isStackable }: { itemId: string, price: number, disabled: boolean, isStackable: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState<number>(1)

  async function handlePurchase() {
    setLoading(true)
    setError(null)
    const result = await purchaseItem(itemId, quantity)
    if (result && result.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2 w-full mt-4">
      {isStackable && !disabled && (
        <div className="flex items-center gap-2 mb-2 w-full justify-between sm:justify-end">
          <span className="text-[10px] font-mono text-muted-foreground">QTY:</span>
          <div className="flex border border-border/50 rounded">
            <button 
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="px-2 py-1 text-xs hover:bg-white/10"
              disabled={loading || quantity <= 1}
            >-</button>
            <span className="px-3 py-1 text-xs font-mono min-w-[40px] text-center">{quantity}</span>
            <button 
              onClick={() => setQuantity(quantity + 1)}
              className="px-2 py-1 text-xs hover:bg-white/10"
              disabled={loading}
            >+</button>
          </div>
        </div>
      )}
      
      <button 
        onClick={handlePurchase} 
        disabled={loading || disabled}
        className="btn btn-outline border-emerald-500/30 hover:border-emerald-500 text-emerald-500 hover:bg-emerald-500/10 text-xs px-4 h-8 tracking-widest whitespace-nowrap w-full"
      >
        {loading ? 'PROCESSING...' : `ACQUIRE (${price * quantity} PTS)`}
      </button>

      {error && (
        <span className="text-[10px] text-danger mt-1 font-mono max-w-full text-right leading-tight" title={error}>
          {error}
        </span>
      )}
    </div>
  )
}
