'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function startBattle(opponentId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase.rpc('create_invitation', {
    p_target_id: opponentId
  })

  if (error) {
    console.error('Failed to create invitation:', error)
    return { error: error.message || 'Failed to create invitation' }
  }

  revalidatePath('/game')
  revalidatePath('/players')
  return { success: true }
}

export async function acceptInvitation(inviteId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: battleId, error } = await supabase.rpc('accept_invitation', {
    p_invite_id: inviteId
  })

  if (error) {
    console.error('Failed to accept invitation:', error)
    return { error: error.message || 'Failed to accept invitation' }
  }

  revalidatePath('/game')
  revalidatePath('/players')
  redirect(`/battle/${battleId}`)
}

export async function declineInvitation(inviteId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('decline_invitation', { p_invite_id: inviteId })
  if (error) return { error: error.message }
  revalidatePath('/game')
  revalidatePath('/players')
  return { success: true }
}

export async function cancelInvitation(inviteId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_invitation', { p_invite_id: inviteId })
  if (error) return { error: error.message }
  revalidatePath('/game')
  revalidatePath('/players')
  return { success: true }
}

export async function submitBattleAction(
  battleId: string, 
  expectedTurn: number, 
  actionType: string, 
  itemId?: string
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase.rpc('submit_battle_action', {
    p_battle_id: battleId,
    p_expected_turn: expectedTurn,
    p_action_type: actionType,
    p_item_id: itemId || null
  })

  if (error) {
    console.error('Battle Action Error:', error)
    return { error: error.message || 'Failed to submit action' }
  }

  revalidatePath(`/battle/${battleId}`)
  revalidatePath('/game')
  return { success: true }
}
