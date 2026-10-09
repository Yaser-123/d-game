'use client'

import { useState } from 'react'
import { purchaseIntelListing, cancelIntelListing } from '@/app/actions/intel'
import { useRouter } from 'next/navigation'

export function PurchaseIntelButton({ listingId, price, disabled, title }: { listingId: string, price: number, disabled: boolean, title: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handlePurchase = async () => {
    if (!confirm(`Purchase intel "${title}" for ${price} PTS?`)) return

    setLoading(true)
    setError(null)
    
    const res = await purchaseIntelListing(listingId)
    if (res.error) {
      setError(res.error)
      setLoading(false)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <button 
        onClick={handlePurchase} 
        disabled={disabled || loading}
        className="btn btn-outline border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500 text-xs tracking-widest h-10 w-full"
      >
        {loading ? 'PROCESSING...' : `ACQUIRE INTEL [${price} PTS]`}
      </button>
      {error && <div className="text-[10px] font-mono text-danger tracking-widest text-center">{error}</div>}
    </div>
  )
}

export function CancelIntelButton({ listingId }: { listingId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this listing?')) return
    setLoading(true)
    await cancelIntelListing(listingId)
    router.refresh()
  }

  return (
    <button 
      onClick={handleCancel} 
      disabled={loading}
      className="btn btn-outline border-danger/30 text-danger hover:bg-danger/10 hover:border-danger text-xs tracking-widest h-8 px-4"
    >
      {loading ? 'CANCELLING...' : 'CANCEL LISTING'}
    </button>
  )
}
