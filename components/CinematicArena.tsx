'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'

type LogEntry = {
  turn: number
  actor: 'player' | 'boss'
  action: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: any
}

export function CinematicArena({
  playerId,
  bossId,
  myHealth,
  bossHealth,
  turnCounter,
  latestLog
}: {
  playerId: string
  bossId: string
  myHealth: number
  bossHealth: number
  turnCounter: number
  latestLog: LogEntry | null
}) {
  // Map player ID to one of the 6 images deterministically
  const playerImageIndex = (playerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 6) + 1
  const playerImages = {
    1: '/images/player_1_1791581883056.jpg',
    2: '/images/player_2_1791581894403.jpg',
    3: '/images/player_3_1791581906117.jpg',
    4: '/images/player_4_1791581916663.jpg',
    5: '/images/player_5_1791581926366.jpg',
    6: '/images/player_6_1791581939282.jpg',
  }
  const playerImage = playerImages[playerImageIndex as keyof typeof playerImages] || '/images/player_1_1791581883056.jpg'

  // Boss and bg mapping
  const bossMapping: Record<string, { img: string, bg: string }> = {
    'boss_hollow_knight': { img: '/images/boss_hollow_knight_1791581817765.jpg', bg: '/images/bg_ruined_arena_1791581847486.jpg' },
    'boss_phantom': { img: '/images/boss_phantom_1791581827879.jpg', bg: '/images/bg_abandoned_city_1791581858665.jpg' },
    'boss_executioner': { img: '/images/boss_executioner_1791581838474.jpg', bg: '/images/bg_ruined_arena_1791581847486.jpg' }
  }
  const defaultBoss = { img: '/images/boss_hollow_knight_1791581817765.jpg', bg: '/images/bg_ruined_arena_1791581847486.jpg' }
  const { img: bossImage, bg: bgImage } = bossMapping[bossId] || defaultBoss

  const [playerAnim, setPlayerAnim] = useState('idle')
  const [bossAnim, setBossAnim] = useState('idle')
  const [effect, setEffect] = useState<{type: string, x: string, y: string} | null>(null)
  
  const prevTurnRef = useRef(turnCounter)

  useEffect(() => {
    if (turnCounter > prevTurnRef.current && latestLog) {
      // An action happened. We can play animations.
      // We animate the actor, then the target.
      // In this simple model, we assume the latest log represents the resolution of the turn.
      // If it's a boss turn, the boss is the actor. If it's player turn, player is actor.
      // Wait, the action log might have multiple entries per turn if counter/etc happens.
      // We just use the absolute latest log to trigger a visual flair.
      
      const isPlayer = latestLog.actor === 'player'
      const isAttack = latestLog.action === 'ATTACK' || latestLog.action === 'SIGIL_ABILITY'
      const isDefend = latestLog.action === 'DEFEND' || latestLog.action === 'SHIELD'
      const isHeal = latestLog.action === 'USE_ITEM' || latestLog.details?.ability === 'HEAL'

      const triggerHit = (target: 'player'|'boss', delay: number) => {
        setTimeout(() => {
          if (target === 'player') setPlayerAnim('hit')
          else setBossAnim('hit')
          
          setEffect({ type: 'hit', x: target === 'player' ? '25%' : '75%', y: '50%' })
          
          setTimeout(() => {
            setPlayerAnim('idle')
            setBossAnim('idle')
            setEffect(null)
          }, 300)
        }, delay)
      }

      if (isAttack) {
        if (isPlayer) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setPlayerAnim('attack')
          triggerHit('boss', 200)
        } else {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setBossAnim('attack')
          triggerHit('player', 200)
        }
      } else if (isHeal) {
        if (isPlayer) {
          setPlayerAnim('heal')
          setEffect({ type: 'heal', x: '25%', y: '50%' })
        } else {
          setBossAnim('heal')
          setEffect({ type: 'heal', x: '75%', y: '50%' })
        }
        setTimeout(() => {
          setPlayerAnim('idle')
          setBossAnim('idle')
          setEffect(null)
        }, 500)
      } else if (isDefend) {
        if (isPlayer) {
          setPlayerAnim('defend')
        } else {
          setBossAnim('defend')
        }
        setTimeout(() => {
          setPlayerAnim('idle')
          setBossAnim('idle')
        }, 500)
      }
      
      prevTurnRef.current = turnCounter
    }
  }, [turnCounter, latestLog])

  return (
    <div className="relative w-full h-[400px] sm:h-[500px] rounded-lg overflow-hidden border border-border/50 shadow-2xl bg-black">
      {/* Background */}
      <Image 
        src={bgImage} 
        alt="Arena Background" 
        fill
        className="object-cover opacity-40 mix-blend-luminosity" 
        priority
      />

      {/* Custom Animations */}
      <style>{`
        @keyframes slashEffect {
          0% { transform: translate(-50%, -50%) scale(0.5) rotate(-30deg); opacity: 1; filter: brightness(2); }
          100% { transform: translate(-50%, -50%) scale(2) rotate(-30deg); opacity: 0; filter: brightness(1); }
        }
        @keyframes healEffect {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
        }
        .character-mask {
          mask-image: radial-gradient(circle at center, black 40%, transparent 70%);
          -webkit-mask-image: radial-gradient(circle at center, black 40%, transparent 70%);
        }
      `}</style>

      {/* FX Layer */}
      {effect && effect.type === 'hit' && (
        <div 
          className="absolute w-64 h-16 bg-danger blur-md rounded-full pointer-events-none z-20"
          style={{ 
            left: effect.x, 
            top: effect.y, 
            animation: 'slashEffect 400ms cubic-bezier(0.1, 0.9, 0.2, 1) forwards' 
          }}
        />
      )}
      {effect && effect.type === 'heal' && (
        <div 
          className="absolute w-48 h-48 bg-emerald-500/50 blur-2xl rounded-full pointer-events-none"
          style={{ 
            left: effect.x, 
            top: effect.y, 
            animation: 'healEffect 500ms ease-out forwards' 
          }}
        />
      )}

      {/* Combatants */}
      <div className="absolute inset-0 flex items-end justify-between px-[5%] sm:px-[10%] pb-[5%]">
        {/* Player Sprite */}
        <div className={`relative w-48 h-48 sm:w-80 sm:h-80 transition-all duration-300 ease-out z-10 character-mask
          ${playerAnim === 'attack' ? 'translate-x-[60px] scale-105 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]' : ''}
          ${playerAnim === 'hit' ? '-translate-x-[20px] brightness-[1.5] sepia-[.5] hue-rotate-[-30deg] saturate-[2]' : ''}
          ${playerAnim === 'defend' ? 'scale-95 brightness-75 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]' : ''}
          ${playerAnim === 'heal' ? 'brightness-125 drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]' : ''}
          ${myHealth <= 0 ? 'grayscale opacity-30 translate-y-10 rotate-90' : 'drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]'}
        `}>
          <Image 
            src={playerImage}
            alt="Player"
            fill
            sizes="(max-width: 768px) 192px, 320px"
            className="object-contain"
            priority
          />
        </div>

        {/* Boss Sprite */}
        <div className={`relative w-48 h-48 sm:w-80 sm:h-80 transition-all duration-300 ease-out z-10 character-mask
          ${bossAnim === 'attack' ? '-translate-x-[60px] scale-105 drop-shadow-[0_0_30px_rgba(220,38,38,0.5)]' : ''}
          ${bossAnim === 'hit' ? 'translate-x-[20px] brightness-[1.5] sepia-[.5] hue-rotate-[-30deg] saturate-[2]' : ''}
          ${bossAnim === 'defend' ? 'scale-95 brightness-75 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]' : ''}
          ${bossAnim === 'heal' ? 'brightness-125 drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]' : ''}
          ${bossHealth <= 0 ? 'grayscale opacity-30 translate-y-10 -rotate-90' : 'drop-shadow-[0_0_20px_rgba(220,38,38,0.2)]'}
        `}>
          <Image 
            src={bossImage}
            alt="Boss"
            fill
            sizes="(max-width: 768px) 192px, 320px"
            className="object-contain"
            priority
          />
        </div>
      </div>
      
      {/* Fog/Atmosphere overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80 pointer-events-none" />
    </div>
  )
}
