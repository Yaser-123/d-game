'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function startPvEEncounter(bossId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: encounterId, error } = await supabase.rpc('start_pve_encounter', {
    p_boss_id: bossId
  })

  if (error) {
    console.error('Error starting PvE encounter:', error)
    return { error: error.message }
  }

  revalidatePath('/bosses')
  redirect(`/bosses/${encounterId}`)
}

export async function submitPvEAction(encounterId: string, actionType: string, itemId?: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase.rpc('submit_pve_action', {
    p_encounter_id: encounterId,
    p_action_type: actionType,
    p_item_id: itemId || null
  })

  if (error) {
    console.error('Error submitting PvE action:', error)
    return { error: error.message }
  }

  revalidatePath(`/bosses/${encounterId}`)
  return { success: true }
}
