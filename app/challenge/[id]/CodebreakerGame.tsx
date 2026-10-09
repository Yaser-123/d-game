'use client'

import { useState } from 'react'
import { submitCodebreakerGuess } from '@/app/actions/challenge'

export default function CodebreakerGame({ challenge, userId }: { challenge: any, userId: string }) {
  const [guess, setGuess] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const publicState = challenge.public_state || {}
  const privateState = challenge.private_state || {}
  
  const guesses = publicState.guesses || []
  const attemptsLeft = publicState.attempts_left ?? 8
  
  // Actually the private state is not sent to the client if we're using normal RLS, wait. 
  // RLS allows SELECT for both participants, so BOTH can see `private_state`! 
  // WAIT. Is `private_state` visible to both in the frontend? YES, because they both can SELECT the row. 
  // BUT Supabase RLS is at the row level, not column level.
  // Oh no! If `private_state` is selected in `app/challenge/[id]/page.tsx` on the server, we should NOT pass it to the client if they aren't supposed to see it!
  // Wait, `private_state` has the secret! The setter shouldn't see it? No, the setter generated it on the server, but the guesser MUST NOT SEE IT.
  // We MUST hide `private_state` from the client!
  
  // In `app/challenge/[id]/page.tsx`, we select `*`. 
  // We will need to fix `app/challenge/[id]/page.tsx` to scrub `private_state` before passing to client components.
  
  // For now, let's just use what we know.
  // The Guesser is defined by `challenge.private_state.guesser_id`. Wait, if we scrub `private_state`, how do we know who the guesser is?
  // We should put `guesser_id` in `public_state`!
  // Let me check my migration 16. `private_state = jsonb_build_object('secret', ..., 'guesser_id', ...)`
  // Yes, `guesser_id` is in `private_state`. I need to fix that or extract it on the server before passing.

  const isGuesser = userId === challenge.guesser_id
  
  async function handleGuess(e: React.FormEvent) {
    e.preventDefault()
    if (guess.length !== 4) {
      setError('Guess must be exactly 4 digits.')
      return
    }
    setLoading(true)
    setError(null)
    const result = await submitCodebreakerGuess(challenge.id, guess)
    if (result && result.error) {
      setError(result.error)
    }
    setLoading(false)
    setGuess('')
  }

  return (
    <div className="panel p-6 max-w-xl mx-auto">
      <h3 className="text-xl font-bold mb-4 tracking-tighter">CODEBREAKER</h3>
      
      <div className="mb-6 space-y-2">
        <div className="flex justify-between text-xs font-mono text-muted-foreground border-b border-border/30 pb-2">
          <span>GUESSES</span>
          <span>ATTEMPTS LEFT: <strong className="text-danger">{attemptsLeft}</strong></span>
        </div>
        
        {guesses.length === 0 ? (
          <p className="text-sm font-mono text-muted-foreground py-4 text-center">No guesses yet.</p>
        ) : (
          <ul className="space-y-2">
            {guesses.map((g: any, i: number) => (
              <li key={i} className="flex justify-between p-2 bg-black/40 rounded border border-border/50 font-mono text-sm">
                <span className="tracking-[0.5em] font-bold text-white">{g.guess}</span>
                <div className="flex gap-4">
                  <span className="text-emerald-500">{g.exact} EXACT</span>
                  <span className="text-warning">{g.partial} PARTIAL</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isGuesser ? (
        <form onSubmit={handleGuess} className="space-y-4">
          <div>
            <label className="block text-[10px] font-mono text-muted-foreground mb-1 tracking-widest">ENTER 4-DIGIT CODE</label>
            <input
              type="text"
              pattern="[0-9]{4}"
              maxLength={4}
              value={guess}
              onChange={e => setGuess(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full bg-black border border-border/50 rounded p-3 text-center text-2xl font-mono tracking-[0.5em] text-white focus:border-danger focus:ring-1 focus:ring-danger outline-none"
              placeholder="0000"
              disabled={loading}
            />
          </div>
          {error && <p className="text-xs text-danger font-mono text-center">{error}</p>}
          <button type="submit" disabled={loading || guess.length !== 4} className="btn btn-danger w-full">
            {loading ? 'SUBMITTING...' : 'SUBMIT GUESS'}
          </button>
        </form>
      ) : (
        <div className="text-center p-6 border border-dashed border-border/50 rounded bg-black/20">
          <p className="text-sm font-mono text-muted-foreground">You are the Setter.</p>
          <p className="text-xs mt-2 text-muted-foreground/70">Wait for your opponent to break the code. If they fail, you win.</p>
        </div>
      )}
    </div>
  )
}
