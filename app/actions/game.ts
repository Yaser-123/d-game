'use server'

import { createClient } from '@/utils/supabase/server'
import { generateSigil } from '@/game-engine/generator'
import { revalidatePath } from 'next/cache'

export async function initializePlayer(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const handle = formData.get('handle') as string
  if (!handle || handle.length < 3 || handle.length > 20) {
    return { error: 'Handle must be between 3 and 20 characters' }
  }

  // Generate sigil until we succeed or max retries hit
  let success = false
  let attempts = 0
  let generatedSigil = null
  let rpcError = null

  while (!success && attempts < 10) {
    attempts++
    const candidate = generateSigil(Math.random())
    
    // Call our atomic RPC
    const { error } = await supabase.rpc('initialize_player', {
      p_handle: handle,
      p_fingerprint: candidate.fingerprint,
      p_name: candidate.name,
      p_basic_ability: candidate.basic_ability,
      p_limitation: candidate.limitation,
      p_hidden_mechanic: candidate.hidden_mechanic,
      p_ability_meta: candidate.ability_meta
    })

    if (error) {
      // Check if it's a unique violation for the handle
      if (error.message.includes('players_handle_key')) {
        return { error: 'Handle is already taken' }
      }
      // If it's a unique violation for the fingerprint, the loop continues to retry
      rpcError = error
    } else {
      success = true
      generatedSigil = candidate
    }
  }

  if (!success) {
    console.error('Failed to initialize player after 10 attempts', rpcError)
    return { error: 'System overload. Could not generate a unique Sigil. Try again.' }
  }

  revalidatePath('/game')
  revalidatePath('/profile')
  
  return { success: true, sigil: generatedSigil }
}
