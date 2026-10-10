'use client'

import { useState, useEffect } from 'react'
import { submitNimAction, processBotNimTurn } from '@/app/actions/challenge'
import { UseItemPanel } from '@/components/UseItemPanel'

export default function NimGame({ challenge, userId, mySigil, myItems }: { challenge: any, userId: string, mySigil?: any, myItems?: any[] }) {
  const [loading, setLoading] = useState(false)
  const [sigilUsed, setSigilUsed] = useState(false)
  const [sigilMessage, setSigilMessage] = useState<string | null>(null)
  
  const isP1 = challenge.challenger_id === userId
  const pub = challenge.public_state || {}
  
  const myHp = isP1 ? pub.p1_hp : pub.p2_hp
  const oppHp = isP1 ? pub.p2_hp : pub.p1_hp
  const isMyTurn = (isP1 && pub.current_turn === 'p1') || (!isP1 && pub.current_turn === 'p2')
  
  const oppIsBot = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333'
  ].includes(challenge.challenged_id)

  const pearls = pub.pearls_left || 21
  const log = pub.log || []

  useEffect(() => {
    if (oppIsBot && pub.current_turn === 'p2' && pub.p1_hp > 0 && pub.p2_hp > 0) {
      const timer = setTimeout(() => {
        processBotNimTurn(challenge.id)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [oppIsBot, pub.current_turn, challenge.id, pub.p1_hp, pub.p2_hp, challenge.updated_at])

  const handleTake = async (amount: number) => {
    if (!isMyTurn || loading) return
    setLoading(true)
    const res = await submitNimAction(challenge.id, amount)
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
          {isMyTurn ? 'YOUR TURN' : 'WAITING FOR OPPONENT'}
        </h3>
        
        <div className="flex flex-col items-center justify-center space-y-6 mb-8">
          <p className="font-mono text-purple-400 text-3xl">{pearls}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">SOULS REMAINING</p>
          
          <div className="flex flex-wrap gap-2 justify-center max-w-xs">
             {[...Array(pearls)].map((_, i) => (
               <div key={i} className={`w-3 h-3 rounded-full ${i === pearls - 1 ? 'bg-danger animate-pulse shadow-[0_0_10px_red]' : 'bg-purple-500/50'}`}></div>
             ))}
          </div>
        </div>

        {isMyTurn ? (
          <div className="grid grid-cols-3 gap-4">
            <button className="btn btn-outline border-purple-500/30 hover:bg-purple-500/10" onClick={() => handleTake(1)} disabled={loading || pearls < 1}>TAKE 1</button>
            <button className="btn btn-outline border-purple-500/30 hover:bg-purple-500/10" onClick={() => handleTake(2)} disabled={loading || pearls < 2}>TAKE 2</button>
            <button className="btn btn-outline border-purple-500/30 hover:bg-purple-500/10" onClick={() => handleTake(3)} disabled={loading || pearls < 3}>TAKE 3</button>
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
                msg = `You weave into the opponent's strategy... They always try to leave you with a multiple of 4 + 1. If you can break that pattern, you win.`
              } else if (name.includes('void') || name.includes('gaze')) {
                let target = pearls % 4;
                let hint = target === 0 ? "You are in a cursed position! Take any amount and pray." : `Take exactly ${target} souls to control the board.`
                msg = `The void reveals the mathematical truth: ${hint}`
              } else if (name.includes('blood') || name.includes('pact')) {
                msg = `You drain the spirits for insight: There are ${pearls} souls left. Beware the final one.`
              } else {
                let target = pearls % 4;
                let hint = target === 0 ? "You are currently in a losing position! Take any amount and pray." : `Take exactly ${target} souls to secure victory this round.`
                msg = `The spirits reveal the path... ${hint}`
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
