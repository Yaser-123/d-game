'use client'

import { useState } from 'react'
import { submitBluffChoice } from '@/app/actions/challenge'

export default function BluffDuelGame({ challenge, userId }: { challenge: any, userId: string }) {
  const [choice, setChoice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const publicState = challenge.public_state || {}
  
  const isP1 = challenge.challenger_id === userId
  const mySubmitted = isP1 ? publicState.p1_submitted : publicState.p2_submitted
  const oppSubmitted = isP1 ? publicState.p2_submitted : publicState.p1_submitted

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!choice) return
    setLoading(true)
    setError(null)
    const result = await submitBluffChoice(challenge.id, choice)
    if (result && result.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  const options = ['TRUST', 'BLUFF', 'CHALLENGE']

  return (
    <div className="panel p-6 max-w-xl mx-auto">
      <h3 className="text-xl font-bold mb-4 tracking-tighter text-blue-500">BLUFF DUEL</h3>
      
      <div className="mb-8 space-y-4">
        <p className="text-sm text-muted-foreground font-mono leading-relaxed">
          Select your stance. You and your opponent reveal simultaneously.
          <br /><br />
          <strong>Payoff Matrix:</strong><br/>
          TRUST beats CHALLENGE<br/>
          BLUFF beats TRUST<br/>
          CHALLENGE beats BLUFF<br/>
          Matching stances result in a DRAW.
        </p>
      </div>

      <div className="space-y-6">
        {mySubmitted ? (
          <div className="p-6 bg-blue-500/10 border border-blue-500/30 rounded text-center">
            <p className="text-blue-500 font-mono text-lg tracking-widest">STANCE LOCKED</p>
            <p className="text-sm text-muted-foreground mt-2">Awaiting opponent's stance to resolve...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {options.map((opt: string) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setChoice(opt)}
                  className={`p-4 rounded border font-mono tracking-widest font-bold transition-all ${
                    choice === opt 
                      ? 'bg-blue-500 text-white border-blue-500 scale-105 shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                      : 'border-border/50 hover:border-blue-500/50 hover:bg-blue-500/10 text-muted-foreground'
                  }`}
                  disabled={loading}
                >
                  {opt}
                </button>
              ))}
            </div>
            
            {error && <p className="text-xs text-danger font-mono text-center">{error}</p>}
            
            <button type="submit" disabled={loading || !choice} className="btn w-full bg-white text-black hover:bg-gray-200">
              {loading ? 'LOCKING STANCE...' : 'LOCK STANCE'}
            </button>
          </form>
        )}
        
        <div className="flex items-center justify-between p-4 border border-border/30 bg-black/40 rounded">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-muted-foreground">OPPONENT STATUS</span>
            <span className={`text-sm font-bold tracking-widest ${oppSubmitted ? 'text-blue-500' : 'text-muted-foreground'}`}>
              {oppSubmitted ? 'LOCKED' : 'DECIDING...'}
            </span>
          </div>
          {oppSubmitted && !mySubmitted && (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
