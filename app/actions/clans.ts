'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createClan(formData: FormData) {
  const supabase = await createClient()
  const name = formData.get('name') as string
  const tag = formData.get('tag') as string
  const description = formData.get('description') as string

  if (!name || name.length < 3 || name.length > 30) return { error: 'Name must be 3-30 characters' }
  if (!tag || tag.length < 2 || tag.length > 5) return { error: 'Tag must be 2-5 characters' }
  if (!description || description.length > 500) return { error: 'Description too long' }

  const { error } = await supabase.rpc('create_clan', {
    p_name: name,
    p_tag: tag.toUpperCase(),
    p_description: description
  })

  if (error) return { error: error.message }
  revalidatePath('/clans')
  return { success: true }
}

export async function respondToInvite(invitationId: string, accept: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('respond_to_clan_invitation', {
    p_invitation_id: invitationId,
    p_accept: accept
  })
  if (error) return { error: error.message }
  revalidatePath('/clans')
  return { success: true }
}

export async function leaveClan() {
  const supabase = await createClient()
  const { error } = await supabase.rpc('leave_clan')
  if (error) return { error: error.message }
  revalidatePath('/clans')
  return { success: true }
}

export async function disbandClan() {
  const supabase = await createClient()
  const { error } = await supabase.rpc('disband_clan')
  if (error) return { error: error.message }
  revalidatePath('/clans')
  return { success: true }
}

export async function removeMember(playerId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_clan_member', { p_player_id: playerId })
  if (error) return { error: error.message }
  revalidatePath('/clans')
  return { success: true }
}

export async function invitePlayer(playerId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('invite_to_clan', { p_invitee_id: playerId })
  if (error) return { error: error.message }
  revalidatePath('/clans')
  return { success: true }
}

export async function cancelInvite(invitationId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_clan_invitation', { p_invitation_id: invitationId })
  if (error) return { error: error.message }
  revalidatePath('/clans')
  return { success: true }
}

export async function transferLeadership(newLeaderId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('transfer_clan_leadership', { p_new_leader_id: newLeaderId })
  if (error) return { error: error.message }
  revalidatePath('/clans')
  return { success: true }
}
