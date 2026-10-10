'use client'

import { useState } from 'react'
import { generateMissionAction, claimMissionRewardAction } from '@/app/actions/missions'
import { Target, Loader2, CheckCircle } from 'lucide-react'

export function OutdoorMissions() {
  const [mission, setMission] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [claimed, setClaimed] = useState(false)

  const handleRequestMission = async () => {
    setLoading(true)
    setClaimed(false)
    const newMission = await generateMissionAction()
    setMission(newMission)
    setLoading(false)
  }

  const handleClaim = async () => {
    setLoading(true)
    await claimMissionRewardAction()
    setClaimed(true)
    setLoading(false)
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
        POWERED BY GEMINI
      </span>
      
      {!mission ? (
        <>
          <p className="text-xs text-muted-foreground leading-relaxed mb-6">
            Connect to the central AI dispatcher to receive a localized outdoor mission. Complete real-world objectives to earn easy points.
          </p>

          <button
            onClick={handleRequestMission}
            disabled={loading}
            className="w-full btn btn-outline border-blue-500/50 text-blue-500 hover:bg-blue-500/10 h-10 tracking-widest text-xs flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                CONNECTING...
              </>
            ) : (
              'REQUEST MISSION'
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

          {!claimed ? (
             <button
              onClick={handleClaim}
              disabled={loading}
              className="w-full btn bg-blue-500/10 text-blue-500 border border-blue-500 hover:bg-blue-500 hover:text-black h-10 tracking-widest text-xs font-bold transition-all"
             >
               {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'CONFIRM COMPLETION (+50 PTS)'}
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
