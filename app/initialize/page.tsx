'use client'

import { useState } from 'react'
import { initializePlayer } from '@/app/actions/game'
import { useRouter } from 'next/navigation'

export default function InitializePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sigil, setSigil] = useState<{name: string, basic_ability: string, limitation: string} | null>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await initializePlayer(formData)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else if (result.success) {
      setSigil(result.sigil)
      setLoading(false)
    }
  }

  if (sigil) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-black">
        <div className="w-full max-w-2xl space-y-8 animate-in fade-in zoom-in duration-1000 text-center">
          <div className="space-y-4">
            <h2 className="text-muted-foreground text-sm tracking-[0.3em] font-mono">SIGIL ASSIGNED</h2>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tighter text-danger drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">
              {sigil.name}
            </h1>
          </div>
          
          <div className="p-8 border border-border/50 bg-card/30 backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-danger/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            
            <div className="space-y-6 relative z-10 text-left">
              <div>
                <h3 className="text-xs font-mono text-muted-foreground tracking-widest mb-2 border-b border-border/50 pb-2">CAPABILITY</h3>
                <p className="text-lg text-foreground/90 leading-relaxed">{sigil.basic_ability}</p>
              </div>
              
              <div>
                <h3 className="text-xs font-mono text-danger tracking-widest mb-2 border-b border-danger/20 pb-2">RESTRICTION</h3>
                <p className="text-foreground/80">{sigil.limitation}</p>
              </div>
            </div>
          </div>

          <div className="pt-8 flex flex-col items-center gap-4">
            <p className="text-xs text-muted-foreground font-mono">THIS ASSIGNMENT IS PERMANENT.</p>
            <button 
              onClick={() => router.push('/game')}
              className="btn btn-outline border-danger text-danger hover:bg-danger hover:text-white px-12 h-12 text-sm tracking-widest"
            >
              ENTER ARENA
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 panel">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tighter">IDENTIFICATION</h1>
          <p className="text-sm text-muted-foreground">Establish your public operative handle.</p>
        </div>
        
        {error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded text-danger text-sm font-medium">
            {error}
          </div>
        )}
        
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="label" htmlFor="handle">Handle</label>
            <input 
              id="handle"
              name="handle"
              className="input-field" 
              placeholder="e.g. Ghost_01" 
              required
              minLength={3}
              maxLength={20}
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-danger w-full"
            disabled={loading}
          >
            {loading ? 'GENERATING SIGIL...' : 'INITIALIZE'}
          </button>
        </form>
      </div>
    </div>
  )
}
