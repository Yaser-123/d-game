'use client'

import { useState } from 'react'
import { startPvEEncounter } from '@/app/actions/pve'

export function BossHuntButton({ bossId }: { bossId: string }) {
  const [loading, setLoading] = useState(false)

  return (
    <button
      className="btn btn-danger w-full h-12 tracking-widest text-xs disabled:opacity-50"
      disabled={loading}
      onClick={async () => {
        setLoading(true)
        const res = await startPvEEncounter(bossId)
        if (res?.error) {
          alert(res.error)
          setLoading(false)
        }
      }}
    >
      {loading ? 'INITIALIZING...' : 'CHALLENGE BOSS'}
    </button>
  )
}
