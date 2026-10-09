'use server'

import { createClient } from '@/utils/supabase/server'
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
  const botId = botMap[bossId]
  if (!botId) return { error: 'Invalid boss ID' }

  // Admin client to bypass RLS for bot creation
  const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Randomly select challenge type
  const types = ['CODEBREAKER', 'LOGIC_DUEL', 'BLUFF_DUEL']
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
    const choices = ['TRUST', 'BLUFF', 'CHALLENGE']
    const botChoice = choices[Math.floor(Math.random() * choices.length)]
    p2_private_state = { choice: botChoice }
    public_state = {
      p1_submitted: false,
      p2_submitted: true // Bot already chose
    }
  }

  // Check if player is already in a challenge with this bot
  const { data: existing } = await adminClient
    .from('challenges')
    .select('id')
    .eq('challenger_id', user.id)
    .eq('challenged_id', botId)
    .in('status', ['PENDING', 'ACTIVE'])
    .single()

  if (existing) {
    redirect(`/challenge/${existing.id}`)
  }

  const { data: challenge, error } = await adminClient
    .from('challenges')
    .insert({
      challenger_id: user.id,
      challenged_id: botId,
      type,
      status: 'ACTIVE',
      public_state,
      private_state,
      p2_private_state
    })
    .select()
    .single()

  if (error || !challenge) {
    console.error('Error challenging bot:', error)
    return { error: error?.message || 'Failed to challenge boss' }
  }

  revalidatePath('/bosses')
  redirect(`/challenge/${challenge.id}`)
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

export async function submitBluffChoice(challengeId: string, choice: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_bluff_choice', { p_challenge_id: challengeId, p_choice: choice })
  if (error) return { error: error.message }
  revalidatePath(`/challenge/${challengeId}`)
  return { success: true }
}
