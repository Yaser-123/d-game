'use client'

import { useState } from 'react'
import { register } from '@/app/auth/actions'
import Link from 'next/link'

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await register(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 panel text-center">
          <h1 className="text-2xl font-bold tracking-tighter text-danger">INITIALIZATION PENDING</h1>
          <p className="text-muted-foreground">
            Please check your identifier messages to confirm your access. 
            Once confirmed, you may authenticate.
          </p>
          <Link href="/login" className="btn btn-outline w-full mt-4">
            PROCEED TO LOGIN
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 panel">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tighter">INITIALIZE</h1>
          <p className="text-sm text-muted-foreground">Register your presence in the system.</p>
        </div>
        
        {error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded text-danger text-sm font-medium">
            {error}
          </div>
        )}
        
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="label" htmlFor="email">Email Address</label>
            <input 
              id="email"
              name="email"
              className="input-field" 
              placeholder="operative@system.net" 
              type="email" 
              required
            />
          </div>
          <div className="space-y-2">
            <label className="label" htmlFor="password">Passcode</label>
            <input 
              id="password"
              name="password"
              className="input-field" 
              type="password" 
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <label className="label" htmlFor="confirmPassword">Confirm Passcode</label>
            <input 
              id="confirmPassword"
              name="confirmPassword"
              className="input-field" 
              type="password" 
              required
              minLength={6}
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-danger w-full"
            disabled={loading}
          >
            {loading ? 'INITIALIZING...' : 'JOIN GAME'}
          </button>
        </form>
        <div className="text-center text-sm pt-4 border-t border-border">
          <span className="text-muted-foreground">Already registered? </span>
          <Link href="/login" className="text-foreground hover:text-danger font-medium transition-colors">
            Authenticate
          </Link>
        </div>
      </div>
    </div>
  )
}
