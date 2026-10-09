'use client'

import { useState } from 'react'
import { createChallenge } from '@/app/actions/challenge'

export function ChallengeButton({ opponentId }: { opponentId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChallenge() {
    setLoading(true)
    setError(null)
    const result = await createChallenge(opponentId)
    if (result && result.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end">
      <button 
        onClick={handleChallenge} 
        disabled={loading}
        className="btn btn-danger text-[10px] h-6 px-3 tracking-widest whitespace-nowrap"
      >
        {loading ? 'SENDING...' : 'CHALLENGE'}
      </button>
      {error && (
        <span className="text-[10px] text-danger mt-1 font-mono max-w-[150px] text-right truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  )
}
