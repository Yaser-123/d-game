'use client'

import { useState } from 'react'
import { submitLogicAnswer } from '@/app/actions/challenge'

export default function LogicDuelGame({ challenge, userId }: { challenge: any, userId: string }) {
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const publicState = challenge.public_state || {}
  
  const isP1 = challenge.challenger_id === userId
  const mySubmitted = isP1 ? publicState.p1_submitted : publicState.p2_submitted
  const oppSubmitted = isP1 ? publicState.p2_submitted : publicState.p1_submitted

  const puzzle = publicState.puzzle || 'What has keys but cannot open locks?'
  const options = publicState.options || ['A', 'B', 'C']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!answer) return
    setLoading(true)
    setError(null)
    const result = await submitLogicAnswer(challenge.id, answer)
    if (result && result.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="panel p-6 max-w-xl mx-auto">
      <h3 className="text-xl font-bold mb-4 tracking-tighter text-emerald-500">LOGIC DUEL</h3>
      
      <div className="mb-6 space-y-4">
        <p className="text-sm text-muted-foreground font-mono">Solve the puzzle. First to answer correctly wins. Incorrect answers result in immediate elimination from this challenge.</p>
        
        <div className="p-4 bg-black/40 border border-border/50 rounded">
          <p className="text-lg font-bold text-white mb-4 text-center">{puzzle}</p>
          <div className="space-y-2">
            {options.map((opt: string) => {
              const optionLetter = opt.charAt(0) // Assuming format "A. Something"
              return (
                <button
                  key={optionLetter}
                  type="button"
                  onClick={() => setAnswer(optionLetter)}
                  className={`w-full text-left p-3 rounded border font-mono transition-colors ${
                    answer === optionLetter 
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' 
                      : 'border-border/30 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-muted-foreground'
                  }`}
                  disabled={mySubmitted || loading}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {mySubmitted ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded text-center">
            <p className="text-emerald-500 font-mono text-sm tracking-widest">ANSWER SUBMITTED</p>
            <p className="text-xs text-muted-foreground mt-2">Waiting for opponent or resolution...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-xs text-danger font-mono text-center">{error}</p>}
            <button type="submit" disabled={loading || !answer} className="btn w-full bg-emerald-500 text-black hover:bg-emerald-400">
              {loading ? 'SUBMITTING...' : 'CONFIRM ANSWER'}
            </button>
          </form>
        )}
        
        {oppSubmitted && !mySubmitted && (
          <p className="text-warning text-xs font-mono text-center animate-pulse">
            WARNING: Opponent has submitted an answer.
          </p>
        )}
      </div>
    </div>
  )
}
