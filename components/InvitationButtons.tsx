'use client'

import { useState } from 'react'
import { acceptChallenge, declineChallenge, cancelChallenge } from '@/app/actions/challenge'

export function AcceptButton({ inviteId }: { inviteId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAction() {
    setLoading(true)
    setError(null)
    const result = await acceptChallenge(inviteId)
    if (result && result.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center">
      <button onClick={handleAction} disabled={loading} className="btn btn-outline border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10 text-[10px] h-6 px-3 tracking-widest whitespace-nowrap">
        {loading ? 'PROCESSING...' : 'ACCEPT'}
      </button>
      {error && <span className="text-[10px] text-danger mt-1 font-mono max-w-[150px] truncate" title={error}>{error}</span>}
    </div>
  )
}

export function DeclineButton({ inviteId }: { inviteId: string }) {
  const [loading, setLoading] = useState(false)
  
  async function handleAction() {
    setLoading(true)
    await declineChallenge(inviteId)
  }

  return (
    <button onClick={handleAction} disabled={loading} className="btn btn-outline border-border/50 text-muted-foreground hover:text-white text-[10px] h-6 px-3 tracking-widest whitespace-nowrap">
      DECLINE
    </button>
  )
}

export function CancelButton({ inviteId }: { inviteId: string }) {
  const [loading, setLoading] = useState(false)
  
  async function handleAction() {
    setLoading(true)
    await cancelChallenge(inviteId)
  }

  return (
    <button onClick={handleAction} disabled={loading} className="btn btn-outline border-danger/30 text-danger hover:bg-danger/10 text-[10px] h-6 px-3 tracking-widest whitespace-nowrap">
      CANCEL
    </button>
  )
}
