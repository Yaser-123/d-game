'use client'

import { useState, useEffect } from 'react'
import { submitVoidChamberAction, processBotVoidChamber } from '@/app/actions/challenge'
import { Target, Skull } from 'lucide-react'
import { UseItemPanel } from '@/components/UseItemPanel'

export default function VoidChamberGame({ challenge, userId, mySigil, myItems }: { challenge: any, userId: string, mySigil?: any, myItems?: any[] }) {
  const [loading, setLoading] = useState(false)
  const [sigilUsed, setSigilUsed] = useState(false)
  const [sigilMessage, setSigilMessage] = useState<string | null>(null)
  const isP1 = challenge.challenger_id === userId
  const pub = challenge.public_state
  
  // My stats vs Opponent stats
  const myHp = isP1 ? pub.p1_hp : pub.p2_hp
  const oppHp = isP1 ? pub.p2_hp : pub.p1_hp
  const isMyTurn = (isP1 && pub.current_turn === 'p1') || (!isP1 && pub.current_turn === 'p2')
  const oppIsBot = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333'
  ].includes(challenge.challenged_id)

  // Bot processor
  useEffect(() => {
    if (oppIsBot && pub.current_turn === 'p2' && pub.p1_hp > 0 && pub.p2_hp > 0) {
      const timer = setTimeout(() => {
        processBotVoidChamber(challenge.id)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [oppIsBot, pub.current_turn, challenge.id, pub.p1_hp, pub.p2_hp, challenge.updated_at])

  const handleAction = async (action: 'SHOOT_SELF' | 'SHOOT_OPPONENT') => {
    if (!isMyTurn || loading) return
    setLoading(true)
    const res = await submitVoidChamberAction(challenge.id, action)
    if (res?.error) alert(res.error)
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-black/40 p-4 border border-border/20 rounded-md">
        <div>
          <div className="text-xs tracking-widest text-muted-foreground mb-1">YOU</div>
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`w-8 h-8 flex items-center justify-center border ${i < myHp ? 'border-emerald-500/50 text-emerald-500 bg-emerald-500/10' : 'border-border/20 text-muted-foreground/20'}`}>
                <Skull size={14} />
              </div>
            ))}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs tracking-widest text-muted-foreground mb-2">CHAMBER STATUS</div>
          <div className="flex gap-4 font-mono text-sm">
            <div className="flex flex-col items-center">
              <span className="text-danger font-bold text-xl">{pub.live_count}</span>
              <span className="text-[10px]">LIVE</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-muted-foreground font-bold text-xl">{pub.blank_count}</span>
              <span className="text-[10px]">BLANK</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs tracking-widest text-muted-foreground mb-1">OPPONENT</div>
          <div className="flex gap-1 justify-end">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`w-8 h-8 flex items-center justify-center border ${i < oppHp ? 'border-danger/50 text-danger bg-danger/10' : 'border-border/20 text-muted-foreground/20'}`}>
                <Skull size={14} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel p-6 text-center space-y-6">
        <h3 className="text-lg font-bold tracking-widest">
          {isMyTurn ? 'YOUR TURN' : 'WAITING FOR OPPONENT'}
        </h3>
        
        <div className="flex justify-center gap-4">
          <button 
            className="btn btn-outline border-danger/50 text-danger hover:bg-danger/10 w-48 h-16 flex flex-col items-center justify-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
            disabled={!isMyTurn || loading}
            onClick={() => handleAction('SHOOT_OPPONENT')}
          >
            <Target size={16} />
            <span className="text-xs tracking-widest font-bold">SHOOT OPPONENT</span>
          </button>
          <button 
            className="btn btn-outline border-warning/50 text-warning hover:bg-warning/10 w-48 h-16 flex flex-col items-center justify-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
            disabled={!isMyTurn || loading}
            onClick={() => handleAction('SHOOT_SELF')}
          >
            <Skull size={16} />
            <span className="text-xs tracking-widest font-bold">SHOOT SELF</span>
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-4">Shooting yourself with a blank grants an extra turn.</p>
        
        {mySigil && !sigilUsed && isMyTurn && (
          <div className="mt-6 border-t border-border/20 pt-6">
            <button 
              className="btn btn-outline border-purple-500/50 text-purple-400 hover:bg-purple-500/10 w-full"
              onClick={() => {
                setSigilUsed(true)
                const name = mySigil.name?.toLowerCase() || ''
                let msg = ''
                if (name.includes('neural') || name.includes('weave')) {
                  msg = `You weave into the opponent's nervous system. If you shoot them now, their reaction speed will be severely delayed on their next turn.`
                } else if (name.includes('void') || name.includes('gaze')) {
                  msg = `The void gazes back... There are ${pub.live_count} LIVE rounds and ${pub.blank_count} BLANK rounds currently loaded in the chamber.`
                } else if (name.includes('blood') || name.includes('pact')) {
                  msg = `You taste the copper in the air... If the next shot is LIVE, the blood pact will attempt to reflect the damage.`
                } else {
                  msg = `The spirits whisper... There are currently ${pub.live_count} LIVE rounds remaining. Use this knowledge wisely.`
                }
                setSigilMessage(msg)
              }}
            >
              UNLEASH SIGIL: {mySigil.name}
            </button>
            <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest">{mySigil.basic_ability}</p>
          </div>
        )}
        
      </div>

      <div className="panel p-4 max-h-48 overflow-y-auto space-y-2 font-mono text-xs">
        {pub.log?.map((msg: string, idx: number) => (
          <div key={idx} className="text-muted-foreground/80 border-b border-border/10 pb-2 last:border-0 last:pb-0">
            {msg}
          </div>
        ))}
      </div>
      
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
