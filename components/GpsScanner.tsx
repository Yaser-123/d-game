'use client'

import { useState } from 'react'
import { updateLocationAction } from '@/app/actions/gps'
import { MapPin, Loader2, Radar } from 'lucide-react'

export function GpsScanner() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string>('OFFLINE')

  const handleScan = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }

    setLoading(true)
    setStatus('ACQUIRING SATELLITE LOCK...')

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setStatus('UPLOADING COORDINATES...')
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        
        await updateLocationAction(lat, lng)
        
        setStatus('ONLINE - AREA SCANNED')
        setLoading(false)
      },
      (error) => {
        console.error(error)
        setStatus('GPS ERROR')
        setLoading(false)
        alert('Failed to get location. Make sure you granted permissions.')
      }
    )
  }

  return (
    <div className="panel p-6 border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4">
        <span className="flex h-2 w-2">
          <span className={`relative inline-flex rounded-full h-2 w-2 ${loading ? 'bg-emerald-500 animate-ping' : status === 'OFFLINE' ? 'bg-muted' : 'bg-emerald-500'}`}></span>
        </span>
      </div>
      
      <div className="flex items-center gap-2 mb-2">
        <Radar className={`w-4 h-4 ${loading ? 'text-emerald-500 animate-spin' : 'text-emerald-500'}`} />
        <h3 className="text-sm font-bold tracking-widest text-emerald-500">PROXIMITY SYSTEM</h3>
      </div>
      
      <span className="inline-block text-[10px] font-mono bg-black/40 px-2 py-1 rounded mb-4 text-emerald-500/70 border border-emerald-500/20">
        STATUS: {status}
      </span>
      
      <p className="text-xs text-muted-foreground leading-relaxed mb-6">
        Activate your device's GPS module to broadcast your real-world coordinates and calculate distances to other nearby operatives.
      </p>

      <button
        onClick={handleScan}
        disabled={loading}
        className="w-full btn btn-outline border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10 h-10 tracking-widest text-xs flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            SCANNING...
          </>
        ) : (
          <>
            <MapPin className="w-3 h-3" />
            ACTIVATE RADAR
          </>
        )}
      </button>
    </div>
  )
}
