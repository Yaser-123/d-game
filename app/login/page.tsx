'use client'

import { useState } from 'react'
import { login } from '@/app/auth/actions'
import Link from 'next/link'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 panel">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tighter">AUTHENTICATE</h1>
          <p className="text-sm text-muted-foreground">Enter your credentials to access the Arena.</p>
        </div>
        
        {error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded text-danger text-sm font-medium">
            {error}
          </div>
        )}
        
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="label" htmlFor="email">Identifier</label>
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
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-danger w-full"
            disabled={loading}
          >
            {loading ? 'AUTHENTICATING...' : 'LOGIN'}
          </button>
        </form>
        <div className="text-center text-sm pt-4 border-t border-border">
          <span className="text-muted-foreground">Not registered? </span>
          <Link href="/register" className="text-foreground hover:text-danger font-medium transition-colors">
            Initialize Access
          </Link>
        </div>
      </div>
    </div>
  )
}
