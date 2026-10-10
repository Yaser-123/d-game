'use server'

import { createClient } from '@/utils/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function challengeBossBot(bossId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Map boss string IDs to bot UUIDs
  const botMap: Record<string, string> = {
    'boss_hollow_knight': '11111111-1111-4111-8111-111111111111',
    'boss_phantom': '22222222-2222-4222-8222-222222222222',
    'boss_executioner': '33333333-3333-4333-8333-333333333333'
  }
  // Allow bossId to be either the string name or the UUID itself
  const botId = botMap[bossId] || (Object.values(botMap).includes(bossId) ? bossId : null)
  if (!botId) return { error: 'Invalid boss ID' }

  // Randomly select challenge type
  const types = ['BLUFF_DUEL', 'VOID_CHAMBER', 'NIM_GAME', 'DEATHJACK', 'DOOMSDAY', 'MINEFIELD']
  const type = types[Math.floor(Math.random() * types.length)]

  let public_state = {}
  let private_state = {}
  let p2_private_state = {}

  if (type === 'CODEBREAKER') {
    private_state = {
      secret: Math.floor(Math.random() * 9000 + 1000).toString(),
      guesser_id: user.id
    }
    public_state = {
      guesses: [],
      attempts_left: 8
    }
  } else if (type === 'LOGIC_DUEL') {
    private_state = { answer: 'A' }
    public_state = {
      puzzle: 'I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?',
      options: ['A. Echo', 'B. Shadow', 'C. Cloud'],
      p1_submitted: false,
      p2_submitted: false
    }
  } else if (type === 'BLUFF_DUEL') {
    private_state = { cup_content: '' }
    public_state = {
      p1_hp: 3,
      p2_hp: 3,
      current_turn: 'p1',
      phase: 'POISON',
      taunt: '',
      log: ['The chalice is empty. Awaiting the first pour...']
    }
  } else if (type === 'VOID_CHAMBER') {
    const liveCount = Math.floor(Math.random() * 2) + 1; // 1 or 2
    const blankCount = Math.floor(Math.random() * 2) + 1; // 1 or 2
    let chamber = [];
    for(let i=0; i<liveCount; i++) chamber.push('LIVE');
    for(let i=0; i<blankCount; i++) chamber.push('BLANK');
    // Shuffle
    chamber.sort(() => Math.random() - 0.5);
    
    private_state = {
      chamber,
      chamber_index: 0
    }
    public_state = {
      p1_hp: 3,
      p2_hp: 3,
      current_turn: 'p1', // Player always starts against boss
      live_count: liveCount,
      blank_count: blankCount,
      log: [`Initial load: ${liveCount} LIVE, ${blankCount} BLANK.`]
    }
  } else if (type === 'NIM_GAME') {
    private_state = {}
    public_state = {
      p1_hp: 3,
      p2_hp: 3,
      current_turn: 'p1',
      pearls_left: 21,
      log: ['21 Cursed Souls remain. Take 1 to 3. The one who takes the last soul loses 1 HP.']
    }
  } else if (type === 'DEATHJACK') {
    private_state = {
      p1_hidden: Math.floor(Math.random() * 10) + 1,
      p2_hidden: Math.floor(Math.random() * 10) + 1
    }
    public_state = {
      p1_hp: 3,
      p2_hp: 3,
      current_turn: 'p1',
      phase: 'P1_TURN',
      p1_visible: [Math.floor(Math.random() * 10) + 1],
      p2_visible: [Math.floor(Math.random() * 10) + 1],
      log: ['The cards are dealt. Push your luck, but do not exceed 21.']
    }
  } else if (type === 'DOOMSDAY') {
    private_state = {
      threshold: Math.floor(Math.random() * 6) + 8 // 8 to 13
    }
    public_state = {
      p1_hp: 3,
      p2_hp: 3,
      current_turn: 'p1',
      clock: 0,
      log: ['The Doomsday Clock starts at 0. Detonate past the secret threshold to deal damage.']
    }
  } else if (type === 'MINEFIELD') {
    // Pick 4 unique mines from 0-15
    let mines = []
    while(mines.length < 4) {
      const r = Math.floor(Math.random() * 16)
      if(!mines.includes(r)) mines.push(r)
    }
    private_state = { mines }
    public_state = {
      p1_hp: 3,
      p2_hp: 3,
      current_turn: 'p1',
      revealed: {},
      log: ['The Phantom Grid is laid out. 4 hidden traps await. Step carefully.']
    }
  }

  // Check if player is already in a challenge with this bot
  const { data: existing } = await supabase
    .from('challenges')
    .select('id')
    .eq('challenger_id', user.id)
    .eq('challenged_id', botId)
    .in('status', ['PENDING', 'ACTIVE'])
    .single()

  if (existing) {
    redirect(`/challenge/${existing.id}`)
  }

  const { data: challengeId, error } = await supabase.rpc('create_boss_challenge', {
    p_boss_id: botId,
    p_game_type: type,
    p_public_state: public_state,
    p_private_state: private_state,
    p_p2_private_state: p2_private_state
  })

  if (error || !challengeId) {
    console.error('Error challenging bot:', error)
    return { error: error?.message || 'Failed to challenge boss' }
  }

  revalidatePath('/bosses')
  redirect(`/challenge/${challengeId}`)
}

export async function createChallenge(opponentId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase.rpc('create_challenge', {
    p_target_id: opponentId
  })

  if (error) {
    console.error('Failed to create challenge:', error)
    return { error: error.message || 'Failed to create challenge' }
  }

  revalidatePath('/game')
  revalidatePath('/players')
  return { success: true }
}

export async function acceptChallenge(challengeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: acceptedId, error } = await supabase.rpc('accept_challenge', {
    p_challenge_id: challengeId
  })

  if (error) {
    console.error('Failed to accept challenge:', error)
    return { error: error.message || 'Failed to accept challenge' }
  }

  revalidatePath('/game')
  revalidatePath('/players')
  redirect(`/challenge/${acceptedId}`)
}

export async function declineChallenge(challengeId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('decline_challenge', { p_challenge_id: challengeId })
  if (error) return { error: error.message }
  revalidatePath('/game')
  revalidatePath('/players')
  return { success: true }
}

export async function cancelChallenge(challengeId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_challenge', { p_challenge_id: challengeId })
  if (error) return { error: error.message }
  revalidatePath('/game')
  revalidatePath('/players')
  return { success: true }
}

export async function submitCodebreakerGuess(challengeId: string, guess: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_codebreaker_guess', { p_challenge_id: challengeId, p_guess: guess })
  if (error) return { error: error.message }
  revalidatePath(`/challenge/${challengeId}`)
  return { success: true }
}

export async function submitLogicAnswer(challengeId: string, answer: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_logic_answer', { p_challenge_id: challengeId, p_answer: answer })
  if (error) return { error: error.message }
  revalidatePath(`/challenge/${challengeId}`)
  return { success: true }
}


export async function submitChaliceAction(
  challengeId: string, 
  actionType: 'POISON_CUP' | 'TASTE_CUP', 
  content?: 'POISON' | 'WINE', 
  taunt?: string, 
  decision?: 'DRINK' | 'PASS'
) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_chalice_action', {
    p_challenge_id: challengeId,
    p_action_type: actionType,
    p_content: content || null,
    p_taunt: taunt || null,
    p_decision: decision || null
  })
  if (error) return { error: error.message }
  revalidatePath(`/challenge/${challengeId}`)
  return { success: true }
}

export async function processBotChaliceTurn(challengeId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('process_bot_chalice_turn', { p_challenge_id: challengeId })
  if (error) {
    console.error('Error processing bot chalice turn:', error)
    return { success: false, error: error.message }
  }
  revalidatePath(`/challenge/${challengeId}`)
  return { success: true }
}

export async function submitVoidChamberAction(challengeId: string, action: 'SHOOT_SELF' | 'SHOOT_OPPONENT') {
  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_void_chamber_action', { p_challenge_id: challengeId, p_action: action })
  if (error) return { error: error.message }
  revalidatePath(`/challenge/${challengeId}`)
  return { success: true }
}

export async function processBotVoidChamber(challengeId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('process_bot_void_chamber_turn', { p_challenge_id: challengeId })
  if (error) { console.error('Error processing bot turn:', error); return { success: false, error: error.message } }
  revalidatePath(`/challenge/${challengeId}`)
  return { success: true }
}

export async function submitNimAction(challengeId: string, amount: number) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_nim_action', { p_challenge_id: challengeId, p_amount: amount })
  if (error) return { error: error.message }
  revalidatePath(`/challenge/${challengeId}`)
  return { success: true }
}
export async function processBotNimTurn(challengeId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('process_bot_nim_turn', { p_challenge_id: challengeId })
  if (error) return { error: error.message }
  revalidatePath(`/challenge/${challengeId}`)
  return { success: true }
}

export async function submitDeathjackAction(challengeId: string, action: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_deathjack_action', { p_challenge_id: challengeId, p_action: action })
  if (error) return { error: error.message }
  revalidatePath(`/challenge/${challengeId}`)
  return { success: true }
}
export async function processBotDeathjackTurn(challengeId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('process_bot_deathjack_turn', { p_challenge_id: challengeId })
  if (error) return { error: error.message }
  revalidatePath(`/challenge/${challengeId}`)
  return { success: true }
}

export async function submitDoomsdayAction(challengeId: string, action: string, ticks?: number) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_doomsday_action', { p_challenge_id: challengeId, p_action: action, p_ticks: ticks || 0 })
  if (error) return { error: error.message }
  revalidatePath(`/challenge/${challengeId}`)
  return { success: true }
}
export async function processBotDoomsdayTurn(challengeId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('process_bot_doomsday_turn', { p_challenge_id: challengeId })
  if (error) return { error: error.message }
  revalidatePath(`/challenge/${challengeId}`)
  return { success: true }
}

export async function submitMinefieldAction(challengeId: string, index: number) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_minefield_action', { p_challenge_id: challengeId, p_index: index })
  if (error) return { error: error.message }
  revalidatePath(`/challenge/${challengeId}`)
  return { success: true }
}
export async function processBotMinefieldTurn(challengeId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('process_bot_minefield_turn', { p_challenge_id: challengeId })
  if (error) return { error: error.message }
  revalidatePath(`/challenge/${challengeId}`)
  return { success: true }
}

