'use client'

import { useState } from 'react'
import { createIntelListing } from '@/app/actions/intel'
import { useRouter } from 'next/navigation'

export function CreateIntelForm({ sigilHasMeta, sigilHasHint, sigilHasLimitation, sigilHasHidden }: { 
  sigilHasMeta: boolean, 
  sigilHasHint: boolean, 
  sigilHasLimitation: boolean, 
  sigilHasHidden: boolean 
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    const res = await createIntelListing(formData)
    
    if (res.error) {
      setError(res.error)
      setLoading(false)
    } else {
      router.refresh()
      setLoading(false)
      // reset form handled by unmount if we wanted, but simple reset is fine
      ;(e.target as HTMLFormElement).reset()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-[10px] font-mono text-muted-foreground tracking-widest mb-1">INTEL DESIGNATION (TITLE)</label>
        <input 
          type="text" 
          name="title" 
          required 
          maxLength={40}
          placeholder="E.g. Tactical Weakness"
          className="w-full bg-black/40 border border-border/50 text-white text-sm p-3 focus:outline-none focus:border-emerald-500/50"
        />
      </div>
      
      <div>
        <label className="block text-[10px] font-mono text-muted-foreground tracking-widest mb-1">DISCLOSURE CATEGORY</label>
        <select 
          name="category" 
          required 
          className="w-full bg-black/40 border border-border/50 text-white text-sm p-3 focus:outline-none focus:border-emerald-500/50 appearance-none"
        >
          <option value="">-- SELECT CLASSIFICATION --</option>
          {sigilHasMeta && <option value="SIGIL_CLASS">SIGIL CLASS (Broad Category)</option>}
          {sigilHasHint && <option value="ABILITY_HINT">ABILITY HINT (Combat Effect)</option>}
          {sigilHasLimitation && <option value="LIMITATION">LIMITATION (Weakness)</option>}
          {sigilHasHidden && <option value="MECHANIC_CLUE">MECHANIC CLUE (Structured Mechanic)</option>}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-mono text-muted-foreground tracking-widest mb-1">PRICE (PTS)</label>
        <input 
          type="number" 
          name="price" 
          required 
          min={1} 
          max={1000}
          defaultValue={100}
          className="w-full bg-black/40 border border-border/50 text-white text-sm p-3 focus:outline-none focus:border-emerald-500/50"
        />
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="btn btn-outline border-white/20 hover:bg-white/10 hover:border-white text-xs tracking-widest h-12 w-full mt-4"
      >
        {loading ? 'INITIALIZING...' : 'LIST INTEL ON EXCHANGE'}
      </button>

      {error && (
        <div className="text-[10px] font-mono text-danger tracking-widest text-center mt-2 border border-danger/30 bg-danger/10 p-2">
          {error}
        </div>
      )}
    </form>
  )
}
