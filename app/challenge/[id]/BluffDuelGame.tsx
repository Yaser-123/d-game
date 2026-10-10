'use client'

import { useState, useEffect } from 'react'
import { submitChaliceAction, processBotChaliceTurn } from '@/app/actions/challenge'
import { UseItemPanel } from '@/components/UseItemPanel'

export default function BluffDuelGame({ challenge, userId, mySigil, myItems }: { challenge: any, userId: string, mySigil?: any, myItems?: any[] }) {
  const [loading, setLoading] = useState(false)
  const [sigilUsed, setSigilUsed] = useState(false)
  const [sigilMessage, setSigilMessage] = useState<string | null>(null)
  
  const [selectedContent, setSelectedContent] = useState<'POISON' | 'WINE' | null>(null)
  const [selectedTaunt, setSelectedTaunt] = useState('')

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

  const phase = pub.phase // 'POISON' or 'TASTE'
  const currentTaunt = pub.taunt
  const log = pub.log || []

  useEffect(() => {
    if (oppIsBot && pub.current_turn === 'p2' && pub.p1_hp > 0 && pub.p2_hp > 0) {
      const timer = setTimeout(() => {
        processBotChaliceTurn(challenge.id)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [oppIsBot, pub.current_turn, challenge.id, pub.p1_hp, pub.p2_hp, challenge.updated_at])

  const handlePoison = async () => {
    if (!selectedContent || !selectedTaunt) return alert("Select contents and a taunt!")
    if (!isMyTurn || loading) return
    setLoading(true)
    const res = await submitChaliceAction(challenge.id, 'POISON_CUP', selectedContent, selectedTaunt)
    if (res?.error) alert(res.error)
    setLoading(false)
    setSelectedContent(null)
    setSelectedTaunt('')
  }

  const handleTaste = async (decision: 'DRINK' | 'PASS') => {
    if (!isMyTurn || loading) return
    setLoading(true)
    const res = await submitChaliceAction(challenge.id, 'TASTE_CUP', undefined, undefined, decision)
    if (res?.error) alert(res.error)
    setLoading(false)
  }

  const taunts = [
    "I swear this is safe.", 
    "Don't be a coward.", 
    "Drink your doom.", 
    "This is definitely poison."
  ]

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
        
        {isMyTurn ? (
          phase === 'POISON' ? (
            <div className="space-y-6">
              <p className="text-center text-xs font-mono mb-4 text-purple-400">POUR THE CHALICE</p>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  className={`btn ${selectedContent === 'WINE' ? 'bg-purple-900 border-purple-500 text-white' : 'btn-outline border-border/30 text-muted-foreground'}`}
                  onClick={() => setSelectedContent('WINE')}
                  disabled={loading}
                >
                  POUR WINE (SAFE)
                </button>
                <button 
                  className={`btn ${selectedContent === 'POISON' ? 'bg-danger/80 border-danger text-white' : 'btn-outline border-border/30 text-muted-foreground'}`}
                  onClick={() => setSelectedContent('POISON')}
                  disabled={loading}
                >
                  POUR POISON (DEADLY)
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] tracking-widest text-muted-foreground">SELECT A MESSAGE</p>
                <div className="grid grid-cols-1 gap-2">
                  {taunts.map(t => (
                    <button 
                      key={t}
                      className={`text-xs p-2 rounded border font-mono text-left ${selectedTaunt === t ? 'border-primary text-primary bg-primary/10' : 'border-border/30 text-muted-foreground hover:border-border'}`}
                      onClick={() => setSelectedTaunt(t)}
                    >
                      "{t}"
                    </button>
                  ))}
                </div>
              </div>

              <button 
                className="btn btn-primary w-full mt-4" 
                onClick={handlePoison}
                disabled={loading || !selectedContent || !selectedTaunt}
              >
                {loading ? 'OFFERING...' : 'OFFER CHALICE'}
              </button>
            </div>
          ) : (
            <div className="space-y-6 text-center">
              <p className="text-sm font-mono text-danger mb-2">YOU HAVE BEEN OFFERED A CHALICE</p>
              <div className="p-4 border border-white/10 bg-white/5 rounded-md italic text-gray-300 font-serif">
                "{currentTaunt}"
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-6">
                <button 
                  className="btn btn-outline border-green-500/50 text-green-400 hover:bg-green-500/10"
                  onClick={() => handleTaste('DRINK')}
                  disabled={loading}
                >
                  DRINK
                </button>
                <button 
                  className="btn btn-outline border-danger/50 text-danger hover:bg-danger/10"
                  onClick={() => handleTaste('PASS')}
                  disabled={loading}
                >
                  REFUSE
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-4 text-center">
                Drinking Poison = You take 1 DMG.<br/>
                Refusing Poison = Opponent takes 1 DMG.<br/>
                Drinking Wine = Opponent takes 1 DMG.<br/>
                Refusing Wine = You take 1 DMG.
              </p>
            </div>
          )
        ) : (
          <div className="flex justify-center py-8">
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

      {mySigil && !sigilUsed && isMyTurn && phase === 'TASTE' && (
        <div className="mt-6 border-t border-border/20 pt-6">
          <button 
            className="btn btn-outline border-purple-500/50 text-purple-400 hover:bg-purple-500/10 w-full"
            onClick={() => {
              setSigilUsed(true)
              const name = mySigil.name?.toLowerCase() || ''
              let msg = ''
              if (name.includes('neural') || name.includes('weave')) {
                msg = `You dive into their neurons... Their micro-expressions suggest they are ${Math.random() > 0.5 ? 'bluffing' : 'telling the truth'}, but it's hard to be sure.`
              } else if (name.includes('void') || name.includes('gaze')) {
                msg = `The void reflects reality... There is a 50% chance it is poisoned.`
              } else if (name.includes('blood') || name.includes('pact')) {
                msg = `Your blood runs cold. A shiver means poison. You feel... ${Math.random() > 0.5 ? 'a slight chill' : 'warmth'}.`
              } else {
                msg = "The spirits guide your hand... It is highly likely the opponent is trying to trick you with Reverse Psychology."
              }
              setSigilMessage(msg)
            }}
          >
            UNLEASH SIGIL: {mySigil.name}
          </button>
          <p className="text-[10px] text-muted-foreground mt-2 text-center uppercase tracking-widest">{mySigil.basic_ability}</p>
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
