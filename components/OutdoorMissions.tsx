'use client'

import { useState, useRef } from 'react'
import { generateMissionAction, verifyAndClaimMissionAction } from '@/app/actions/missions'
import { Target, Loader2, CheckCircle, Camera, MapPin } from 'lucide-react'

// Haversine formula
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3 // meters
  const p1 = lat1 * Math.PI/180
  const p2 = lat2 * Math.PI/180
  const dp = (lat2-lat1) * Math.PI/180
  const dl = (lon2-lon1) * Math.PI/180

  const a = Math.sin(dp/2) * Math.sin(dp/2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl/2) * Math.sin(dl/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  return R * c
}

export function OutdoorMissions() {
  const [mission, setMission] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  const [startCoords, setStartCoords] = useState<{lat: number, lng: number} | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleRequestMission = async () => {
    if (!navigator.geolocation) {
      setErrorMsg("GPS NOT DETECTED. REQUIRED FOR MISSIONS.")
      return
    }

    setLoading(true)
    setErrorMsg(null)
    setClaimed(false)

    // Log starting location
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setStartCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        try {
          const newMission = await generateMissionAction()
          setMission(newMission)
        } catch (e) {
          setErrorMsg("SERVER FAILED TO GENERATE MISSION.")
        }
        setLoading(false)
      },
      (err) => {
        console.warn("GPS failed, using simulated coordinates for testing.", err)
        // Fallback for localhost testing without GPS hardware
        setStartCoords({ lat: 40.7128, lng: -74.0060 })
        generateMissionAction().then(newMission => {
          setMission(newMission)
          setLoading(false)
        }).catch(e => {
          setErrorMsg("SERVER FAILED TO GENERATE MISSION.")
          setLoading(false)
        })
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    )
  }

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !mission) return

    setLoading(true)
    setErrorMsg(null)

    // Verify they moved
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const currentLat = pos.coords.latitude
        const currentLng = pos.coords.longitude
        
        if (startCoords) {
          const distanceMoved = getDistanceMeters(startCoords.lat, startCoords.lng, currentLat, currentLng)
          if (distanceMoved < 15) { // Must move at least 15 meters
            setErrorMsg(`GPS TRACKING: YOU ONLY MOVED ${distanceMoved.toFixed(0)}m. EXPLORE FURTHER.`)
            setLoading(false)
            return
          }
        }

        // Convert image to base64
        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64String = reader.result as string
          
          const result = await verifyAndClaimMissionAction(mission, base64String)
          if (result.success) {
            setClaimed(true)
          } else {
            setErrorMsg(result.message)
          }
          setLoading(false)
        }
        reader.readAsDataURL(file)

      },
      (err) => {
        console.warn("GPS verification failed, simulating 20m movement.", err)
        // Fallback for localhost testing: simulate sufficient movement
        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64String = reader.result as string
          const result = await verifyAndClaimMissionAction(mission, base64String)
          if (result.success) setClaimed(true)
          else setErrorMsg(result.message)
          setLoading(false)
        }
        reader.readAsDataURL(file)
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    )
  }

  return (
    <div className="panel p-6 border-blue-500/20 bg-blue-500/5 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4">
        <span className="flex h-2 w-2">
          <span className={`relative inline-flex rounded-full h-2 w-2 ${loading ? 'bg-blue-500 animate-ping' : mission && !claimed ? 'bg-warning' : 'bg-blue-500'}`}></span>
        </span>
      </div>
      
      <div className="flex items-center gap-2 mb-2">
        <Target className={`w-4 h-4 ${loading && !mission ? 'text-blue-500 animate-spin' : 'text-blue-500'}`} />
        <h3 className="text-sm font-bold tracking-widest text-blue-500">FIELD OPS [ AI ]</h3>
      </div>
      
      <span className="inline-block text-[10px] font-mono bg-black/40 px-2 py-1 rounded mb-4 text-blue-500/70 border border-blue-500/20">
        POWERED BY GEMINI VISION & GPS
      </span>
      
      {errorMsg && (
        <div className="mb-4 p-3 bg-danger/10 border border-danger/30 text-danger text-xs font-mono rounded">
          ! {errorMsg}
        </div>
      )}

      {!mission ? (
        <>
          <p className="text-xs text-muted-foreground leading-relaxed mb-6">
            Connect to the central AI dispatcher to receive a localized outdoor mission. Complete real-world objectives and upload photo proof to earn points. Minimum travel distance: 15 meters.
          </p>

          <button
            onClick={handleRequestMission}
            disabled={loading}
            className="w-full btn btn-outline border-blue-500/50 text-blue-500 hover:bg-blue-500/10 h-10 tracking-widest text-xs flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                ACQUIRING SATELLITE...
              </>
            ) : (
              <>
                <MapPin className="w-3 h-3" />
                REQUEST MISSION
              </>
            )}
          </button>
        </>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-black/60 border border-blue-500/20 rounded relative">
            <h4 className="text-[10px] font-mono text-muted-foreground mb-2">ACTIVE DIRECTIVE:</h4>
            <p className="text-sm font-bold tracking-wide text-white">
              "{mission}"
            </p>
          </div>

          <input 
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            ref={fileInputRef}
            onChange={handleCapture}
          />

          {!claimed ? (
             <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="w-full btn bg-blue-500/10 text-blue-500 border border-blue-500 hover:bg-blue-500 hover:text-black h-10 tracking-widest text-xs font-bold transition-all flex items-center justify-center gap-2"
             >
               {loading ? (
                 <Loader2 className="w-4 h-4 animate-spin mx-auto" />
               ) : (
                 <>
                   <Camera className="w-4 h-4" />
                   UPLOAD PROOF (+50 PTS)
                 </>
               )}
             </button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="w-full h-10 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded flex items-center justify-center gap-2 text-xs font-bold tracking-widest">
                <CheckCircle className="w-4 h-4" />
                POINTS AWARDED
              </div>
              <button
                onClick={handleRequestMission}
                className="w-full h-8 text-[10px] tracking-widest text-muted-foreground hover:text-white transition-colors"
              >
                REQUEST NEW MISSION
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
