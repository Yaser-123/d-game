'use client'

import { useState, useEffect } from 'react'
import { submitDeathjackAction, processBotDeathjackTurn } from '@/app/actions/challenge'
import { UseItemPanel } from '@/components/UseItemPanel'

export default function DeathjackGame({ challenge, userId, mySigil, myItems }: { challenge: any, userId: string, mySigil?: any, myItems?: any[] }) {
  const [loading, setLoading] = useState(false)
  const [sigilUsed, setSigilUsed] = useState(false)
  const [sigilMessage, setSigilMessage] = useState<string | null>(null)
  
  const isP1 = challenge.challenger_id === userId
  const pub = challenge.public_state || {}
  
  const myHp = isP1 ? pub.p1_hp : pub.p2_hp
  const oppHp = isP1 ? pub.p2_hp : pub.p1_hp
  
  const isMyTurn = (isP1 && pub.current_turn === 'p1' && pub.phase === 'P1_TURN') || (!isP1 && pub.current_turn === 'p2' && pub.phase === 'P2_TURN')
  
  const oppIsBot = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333'
  ].includes(challenge.challenged_id)

  const log = pub.log || []
  const myVis = isP1 ? pub.p1_visible : pub.p2_visible
  const oppVis = isP1 ? pub.p2_visible : pub.p1_visible

  useEffect(() => {
    if (oppIsBot && pub.current_turn === 'p2' && pub.phase === 'P2_TURN' && pub.p1_hp > 0 && pub.p2_hp > 0) {
      const timer = setTimeout(() => {
        processBotDeathjackTurn(challenge.id)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [oppIsBot, pub.current_turn, pub.phase, challenge.id, pub.p1_hp, pub.p2_hp, challenge.updated_at])

  const handleAction = async (action: 'HIT' | 'STAND') => {
    if (!isMyTurn || loading) return
    setLoading(true)
    const res = await submitDeathjackAction(challenge.id, action)
    if (res?.error) alert(res.error)
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-black/40 p-4 border border-border/20 rounded-md">
        <div>
          <span className="text-[10px] text-muted-foreground tracking-widest block mb-1">YOU</span>
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <span key={i} className={`text-xl ${i < myHp ? 'text-green-500' : 'text-gray-800'}`}>♥</span>
            ))}
          </div>
        </div>
        
        <div className="text-right">
          <span className="text-[10px] text-muted-foreground tracking-widest block mb-1">OPPONENT</span>
          <div className="flex gap-1 justify-end">
            {[...Array(3)].map((_, i) => (
              <span key={i} className={`text-xl ${i < oppHp ? 'text-danger' : 'text-gray-800'}`}>♥</span>
            ))}
          </div>
        </div>
      </div>

      <div className="panel p-6">
        <h3 className="text-center text-sm font-bold tracking-widest text-muted-foreground mb-8">
          {pub.phase === 'REVEAL' ? 'REVEALING...' : isMyTurn ? 'YOUR TURN' : 'OPPONENT THINKING'}
        </h3>
        
        <div className="grid grid-cols-2 gap-8 mb-8">
           <div className="space-y-2">
             <p className="text-xs font-mono text-center text-muted-foreground">YOUR CARDS</p>
             <div className="flex flex-wrap gap-2 justify-center">
               <div className="w-12 h-16 border border-purple-500/50 rounded flex items-center justify-center bg-purple-900/20 text-purple-400 font-bold font-mono">?</div>
               {myVis?.map((card: number, i: number) => (
                 <div key={i} className="w-12 h-16 border border-white/20 rounded flex items-center justify-center bg-white/5 font-bold font-mono">{card}</div>
               ))}
             </div>
           </div>
           
           <div className="space-y-2">
             <p className="text-xs font-mono text-center text-muted-foreground">OPPONENT CARDS</p>
             <div className="flex flex-wrap gap-2 justify-center">
               <div className="w-12 h-16 border border-danger/50 rounded flex items-center justify-center bg-danger/10 text-danger font-bold font-mono">?</div>
               {oppVis?.map((card: number, i: number) => (
                 <div key={i} className="w-12 h-16 border border-white/20 rounded flex items-center justify-center bg-white/5 font-bold font-mono">{card}</div>
               ))}
             </div>
           </div>
        </div>

        {isMyTurn ? (
          <div className="grid grid-cols-2 gap-4">
            <button className="btn btn-outline border-purple-500/30 hover:bg-purple-500/10" onClick={() => handleAction('HIT')} disabled={loading}>HIT</button>
            <button className="btn btn-outline border-purple-500/30 hover:bg-purple-500/10" onClick={() => handleAction('STAND')} disabled={loading}>STAND</button>
          </div>
        ) : (
          <div className="flex justify-center py-4">
            <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-danger opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-danger"></span>
          </div>
        )}
      </div>
      
      <div className="panel p-4 max-h-48 overflow-y-auto space-y-2 font-mono text-xs">
        {log.map((entry: string, i: number) => (
          <p key={i} className="text-muted-foreground">{entry}</p>
        ))}
      </div>

      {mySigil && !sigilUsed && isMyTurn && (
        <div className="mt-6 border-t border-border/20 pt-6">
          <button 
            className="btn btn-outline border-purple-500/50 text-purple-400 hover:bg-purple-500/10 w-full"
            onClick={() => {
              setSigilUsed(true)
              const name = mySigil.name?.toLowerCase() || ''
              let msg = ''
              if (name.includes('neural') || name.includes('weave')) {
                msg = `You weave into their mind... The opponent will stand if their visible total plus their hidden card is 16 or higher.`
              } else if (name.includes('void') || name.includes('gaze')) {
                msg = `The void exposes a glimpse... The opponent's hidden card is definitely an even or odd number (it's hard to tell... but it's between 1 and 10).`
              } else if (name.includes('blood') || name.includes('pact')) {
                msg = `You sacrifice blood to see your own fate. Your hidden card is exactly ${pub.p1_hidden || 'unknown (hidden)'}... wait, you should know that anyway? Actually, the deck is entirely random.`
              } else {
                msg = `The spirits whisper... The opponent's hidden card is between 1 and 10.`
              }
              setSigilMessage(msg)
            }}
          >
            UNLEASH SIGIL: {mySigil.name}
          </button>
          <p className="text-[10px] text-muted-foreground mt-2 text-center uppercase tracking-widest">{mySigil.basic_ability}</p>
        </div>
      )}
      
      {myItems && myItems.length > 0 && (
        <UseItemPanel challengeId={challenge.id} myItems={myItems} isMyTurn={isMyTurn} />
      )}

      {sigilMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="panel max-w-md w-full p-8 border-purple-500/30 text-center animate-in fade-in zoom-in duration-300">
            <h3 className="text-xl font-bold text-purple-400 tracking-widest mb-4 font-mono">SIGIL ACTIVATED: {mySigil?.name}</h3>
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed font-mono">{sigilMessage}</p>
            <button 
              className="btn bg-purple-500/20 text-purple-300 border border-purple-500/50 hover:bg-purple-500/40 w-full"
              onClick={() => setSigilMessage(null)}
            >
              ACKNOWLEDGE
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
