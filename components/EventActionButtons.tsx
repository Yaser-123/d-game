'use client'

import { useState } from 'react'
import { registerForEvent, submitBattleToEvent, claimEventReward } from '@/app/actions/events'
import { useRouter } from 'next/navigation'

export function RegisterButton({ eventId, disabled }: { eventId: string, disabled?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleRegister = async () => {
    setLoading(true)
    setError(null)
    const res = await registerForEvent(eventId)
    if (res.error) {
      setError(res.error)
      setLoading(false)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button 
        onClick={handleRegister} 
        disabled={disabled || loading}
        className="btn btn-outline border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500 text-xs tracking-widest h-10 px-6"
      >
        {loading ? 'REGISTERING...' : 'REGISTER FOR EVENT'}
      </button>
      {error && <div className="text-[10px] font-mono text-danger tracking-widest text-center max-w-[200px] leading-tight">{error}</div>}
    </div>
  )
}

export function SubmitBattleForm({ eventId, disabled }: { eventId: string, disabled?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [battleId, setBattleId] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!battleId) return
    setLoading(true)
    setError(null)
    const res = await submitBattleToEvent(eventId, battleId)
    if (res.error) {
      setError(res.error)
      setLoading(false)
    } else {
      setBattleId('')
      setLoading(false)
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input 
          type="text" 
          value={battleId}
          onChange={(e) => setBattleId(e.target.value)}
          placeholder="ENTER BATTLE ID"
          required
          disabled={disabled || loading}
          className="bg-black/40 border border-border/50 text-white text-xs p-2 focus:outline-none focus:border-white/50 w-full font-mono"
        />
        <button 
          type="submit" 
          disabled={disabled || loading || !battleId}
          className="btn btn-outline text-xs tracking-widest h-8 px-4 border-white/20 hover:border-white shrink-0"
        >
          {loading ? 'SUBMITTING...' : 'SUBMIT'}
        </button>
      </div>
      {error && <div className="text-[10px] font-mono text-danger tracking-widest">{error}</div>}
    </form>
  )
}

export function ClaimRewardButton({ eventId, disabled }: { eventId: string, disabled?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleClaim = async () => {
    setLoading(true)
    setError(null)
    const res = await claimEventReward(eventId)
    if (res.error) {
      setError(res.error)
      setLoading(false)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button 
        onClick={handleClaim} 
        disabled={disabled || loading}
        className="btn btn-outline border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500 text-xs tracking-widest h-10 px-6 font-bold"
      >
        {loading ? 'CLAIMING...' : 'CLAIM REWARD'}
      </button>
      {error && <div className="text-[10px] font-mono text-danger tracking-widest text-center max-w-[200px] leading-tight">{error}</div>}
    </div>
  )
}
