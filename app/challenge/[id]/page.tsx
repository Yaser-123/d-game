import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CodebreakerGame from './CodebreakerGame'
import LogicDuelGame from './LogicDuelGame'
import BluffDuelGame from './BluffDuelGame'
import VoidChamberGame from './VoidChamberGame'
import NimGame from './NimGame'
import DeathjackGame from './DeathjackGame'
import DoomsdayGame from './DoomsdayGame'
import MinefieldGame from './MinefieldGame'

export default async function ChallengeRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: challenge } = await supabase
    .from('challenges')
    .select(`
      *,
      p1:players!challenges_challenger_id_fkey(handle, points),
      p2:players!challenges_challenged_id_fkey(handle, points),
      winner:players!challenges_winner_id_fkey(handle)
    `)
    .eq('id', id)
    .single()

  const { data: sigils } = await supabase.from('sigils').select('*').eq('player_id', user.id).limit(1)
  const mySigil = sigils?.[0]

  // Fetch usable utility items
  const { data: inventoryData } = await supabase
    .from('inventory')
    .select(`
      id,
      quantity,
      items (
        id,
        name,
        effects
      )
    `)
    .eq('player_id', user.id)
    
  const myItems = inventoryData
    ?.filter(inv => inv.items?.effects?.heal || inv.items?.effects?.skip_turn)
    .map(inv => ({
      id: inv.id,
      item_id: inv.items.id,
      name: inv.items.name,
      quantity: inv.quantity,
      effects: inv.items.effects
    })) || []

  if (!challenge) {
    return (
      <div className="container mx-auto p-6 max-w-4xl text-center mt-12">
        <h1 className="text-3xl font-bold mb-4">CHALLENGE NOT FOUND</h1>
        <Link href="/game" className="btn btn-outline">RETURN TO HUB</Link>
      </div>
    )
  }

  const isP1 = challenge.challenger_id === user.id
  const isP2 = challenge.challenged_id === user.id
  
  if (!isP1 && !isP2) {
    redirect('/game')
  }

  const myHandle = isP1 ? challenge.p1?.handle : challenge.p2?.handle
  const opponentHandle = isP1 ? challenge.p2?.handle : challenge.p1?.handle
  
  let guesserId = null
  if (challenge.type === 'CODEBREAKER' && challenge.private_state?.guesser_id) {
    guesserId = challenge.private_state.guesser_id
  }

  // SCRUB PRIVATE STATE BEFORE PASSING TO CLIENT
  const safeChallenge = { ...challenge, guesser_id: guesserId }
  delete safeChallenge.private_state
  delete safeChallenge.p1_private_state
  delete safeChallenge.p2_private_state
  
  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl mt-4 sm:mt-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-border pb-4 gap-4">
        <div>
          <h2 className="text-xs font-mono text-muted-foreground tracking-widest mb-1">PSYCHOLOGICAL DUEL</h2>
          <h1 className="text-3xl font-bold tracking-tighter">{challenge.type.replace('_', ' ')}</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs font-mono text-muted-foreground">OPPONENT</p>
            <p className="font-bold text-danger">{opponentHandle}</p>
          </div>
          <Link href="/game" className="btn btn-outline text-xs h-8 px-3 tracking-widest">
            LEAVE
          </Link>
        </div>
      </div>

      {challenge.status === 'COMPLETED' && (
        <div className="panel p-8 text-center bg-black/60 border-danger/30">
          <h2 className="text-2xl font-bold tracking-tighter mb-2">ENGAGEMENT CONCLUDED</h2>
          
          {challenge.type === 'BLUFF_DUEL' && challenge.public_state?.p1_choice && (
            <div className="flex justify-center gap-8 my-6 text-sm font-mono">
              <div className="flex flex-col items-center">
                <span className="text-muted-foreground">{challenge.p1?.handle || 'PLAYER 1'}</span>
                <span className={`text-lg font-bold ${isP1 ? 'text-white' : 'text-danger'}`}>{challenge.public_state.p1_choice}</span>
              </div>
              <div className="flex flex-col items-center justify-center text-muted-foreground">VS</div>
              <div className="flex flex-col items-center">
                <span className="text-muted-foreground">{challenge.p2?.handle || 'PLAYER 2'}</span>
                <span className={`text-lg font-bold ${isP2 ? 'text-white' : 'text-danger'}`}>{challenge.public_state.p2_choice}</span>
              </div>
            </div>
          )}

          {challenge.is_draw ? (
            <p className="text-warning font-mono">THE MATCH ENDED IN A DRAW</p>
          ) : (
            <p className="text-danger font-mono text-lg">WINNER: {challenge.winner?.handle}</p>
          )}
          <div className="mt-6">
             <Link href="/game" className="btn btn-danger px-8">RETURN TO HUB</Link>
          </div>
        </div>
      )}

      {challenge.status === 'ACTIVE' && (
        <div className="mt-8">
          {challenge.type === 'CODEBREAKER' && <CodebreakerGame challenge={safeChallenge} userId={user.id} mySigil={mySigil} />}
          {challenge.type === 'LOGIC_DUEL' && <LogicDuelGame challenge={safeChallenge} userId={user.id} mySigil={mySigil} />}
          {challenge.type === 'BLUFF_DUEL' && <BluffDuelGame challenge={safeChallenge} userId={user.id} mySigil={mySigil} myItems={myItems} />}
          {challenge.type === 'VOID_CHAMBER' && <VoidChamberGame challenge={safeChallenge} userId={user.id} mySigil={mySigil} myItems={myItems} />}
          {challenge.type === 'NIM_GAME' && <NimGame challenge={safeChallenge} userId={user.id} mySigil={mySigil} myItems={myItems} />}
          {challenge.type === 'DEATHJACK' && <DeathjackGame challenge={safeChallenge} userId={user.id} mySigil={mySigil} myItems={myItems} />}
          {challenge.type === 'DOOMSDAY' && <DoomsdayGame challenge={safeChallenge} userId={user.id} mySigil={mySigil} myItems={myItems} />}
          {challenge.type === 'MINEFIELD' && <MinefieldGame challenge={safeChallenge} userId={user.id} mySigil={mySigil} myItems={myItems} />}
        </div>
      )}
    </div>
  )
}
