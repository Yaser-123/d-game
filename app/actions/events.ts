'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function registerForEvent(eventId: string) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('register_for_event', {
    p_event_id: eventId
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/events')
  return { success: true }
}

export async function submitBattleToEvent(eventId: string, battleId: string) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('submit_battle_to_event', {
    p_event_id: eventId,
    p_battle_id: battleId
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/events')
  return { success: true }
}

export async function claimEventReward(eventId: string) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('claim_event_reward', {
    p_event_id: eventId
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/events')
  revalidatePath('/profile')
  return { success: true }
}
