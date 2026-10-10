'use client'

import { useState, useEffect } from 'react'
import { submitMinefieldAction, processBotMinefieldTurn } from '@/app/actions/challenge'
import { UseItemPanel } from '@/components/UseItemPanel'

export default function MinefieldGame({ challenge, userId, mySigil, myItems }: { challenge: any, userId: string, mySigil?: any, myItems?: any[] }) {
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

  const revealed = pub.revealed || {}
  const log = pub.log || []

  useEffect(() => {
    if (oppIsBot && pub.current_turn === 'p2' && pub.p1_hp > 0 && pub.p2_hp > 0) {
      const timer = setTimeout(() => {
        processBotMinefieldTurn(challenge.id)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [oppIsBot, pub.current_turn, challenge.id, pub.p1_hp, pub.p2_hp, challenge.updated_at])

  const handleTileClick = async (index: number) => {
    if (!isMyTurn || loading || revealed[index]) return
    setLoading(true)
    const res = await submitMinefieldAction(challenge.id, index)
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
          {isMyTurn ? 'YOUR TURN: SELECT A TILE' : 'WAITING FOR OPPONENT'}
        </h3>
        
        <div className="grid grid-cols-4 gap-2 mb-8 mx-auto max-w-[250px]">
           {[...Array(16)].map((_, i) => (
             <button 
               key={i} 
               onClick={() => handleTileClick(i)}
               disabled={!isMyTurn || loading || !!revealed[i]}
               className={`h-14 w-14 rounded-md border flex items-center justify-center transition-all ${
                 revealed[i] === 'SAFE' ? 'bg-green-500/20 border-green-500 text-green-400' : 
                 revealed[i] === 'MINE' ? 'bg-danger/20 border-danger text-danger' : 
                 'bg-white/5 border-white/10 hover:border-purple-500/50 hover:bg-purple-500/10'
               }`}
             >
               {revealed[i] === 'SAFE' && '✓'}
               {revealed[i] === 'MINE' && '☠'}
             </button>
           ))}
        </div>

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
              let msg = "The spirits remain silent."
              if (name.includes('neural') || name.includes('weave')) {
                msg = `You sense the opponent's subconscious fear... They are avoiding the center tiles (5,6,9,10). One might be safe, or deeply trapped.`
              } else if (name.includes('void') || name.includes('gaze')) {
                msg = `The void illuminates a path... The top row (0-3) contains at least one safe tile.`
              } else if (name.includes('blood') || name.includes('pact')) {
                msg = `Your blood boils near danger. Avoid clicking consecutive adjacent tiles.`
              } else {
                msg = `The spirits reveal a path... There is definitely a safe tile in the corners.`
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
