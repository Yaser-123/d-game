'use client'

import { useState } from 'react'
import { createClan, invitePlayer } from '@/app/actions/clans'
import { useRouter } from 'next/navigation'

export function ActionButton({ 
  action, 
  label, 
  confirmText, 
  danger = false 
}: { 
  action: () => Promise<{error?: string, success?: boolean}>, 
  label: string, 
  confirmText?: string, 
  danger?: boolean 
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleAction = async () => {
    if (confirmText && !confirm(confirmText)) return
    setLoading(true)
    setError(null)
    const res = await action()
    if (res?.error) {
      setError(res.error)
      setLoading(false)
    } else {
      router.refresh()
    }
  }

  const baseClass = danger 
    ? "btn btn-outline border-danger/30 text-danger hover:bg-danger/10 hover:border-danger text-[10px] tracking-widest h-8 px-4"
    : "btn btn-outline border-white/20 hover:bg-white/10 hover:border-white text-[10px] tracking-widest h-8 px-4"

  return (
    <div className="flex flex-col gap-1 items-end">
      <button onClick={handleAction} disabled={loading} className={baseClass}>
        {loading ? '...' : label}
      </button>
      {error && <div className="text-[9px] font-mono text-danger tracking-widest">{error}</div>}
    </div>
  )
}

export function CreateClanForm({ disabled }: { disabled: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await createClan(new FormData(e.currentTarget))
    if (res.error) {
      setError(res.error)
      setLoading(false)
    } else {
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-[10px] font-mono text-muted-foreground tracking-widest mb-1">CLAN DESIGNATION</label>
          <input name="name" required minLength={3} maxLength={30} disabled={disabled || loading} className="w-full bg-black/40 border border-border/50 text-white text-sm p-2 focus:outline-none focus:border-white/50" />
        </div>
        <div className="w-24">
          <label className="block text-[10px] font-mono text-muted-foreground tracking-widest mb-1">TAG (2-5)</label>
          <input name="tag" required minLength={2} maxLength={5} disabled={disabled || loading} className="w-full bg-black/40 border border-border/50 text-white text-sm p-2 focus:outline-none focus:border-white/50 uppercase" />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-mono text-muted-foreground tracking-widest mb-1">MANIFESTO</label>
        <textarea name="description" required maxLength={500} disabled={disabled || loading} className="w-full bg-black/40 border border-border/50 text-white text-sm p-2 focus:outline-none focus:border-white/50 min-h-[80px]" />
      </div>
      <button type="submit" disabled={disabled || loading} className="btn btn-outline border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500 text-xs tracking-widest h-10 w-full">
        {loading ? 'INITIALIZING...' : 'ESTABLISH CLAN'}
      </button>
      {error && <div className="text-[10px] font-mono text-danger tracking-widest text-center mt-2 p-2 border border-danger/30 bg-danger/10">{error}</div>}
    </form>
  )
}

export function InvitePlayerForm({ disabled }: { disabled: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playerId, setPlayerId] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!playerId) return
    setLoading(true)
    setError(null)
    const res = await invitePlayer(playerId)
    if (res.error) {
      setError(res.error)
      setLoading(false)
    } else {
      setPlayerId('')
      setLoading(false)
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input 
        value={playerId} 
        onChange={(e) => setPlayerId(e.target.value)} 
        placeholder="PLAYER UUID" 
        required 
        disabled={disabled || loading} 
        className="w-full bg-black/40 border border-border/50 text-white text-xs p-2 font-mono focus:outline-none focus:border-white/50" 
      />
      <button type="submit" disabled={disabled || loading || !playerId} className="btn btn-outline border-white/20 hover:border-white text-[10px] tracking-widest h-8 px-4 shrink-0 mt-0.5">
        INVITE
      </button>
      {error && <div className="text-[10px] font-mono text-danger tracking-widest self-center ml-2">{error}</div>}
    </form>
  )
}
