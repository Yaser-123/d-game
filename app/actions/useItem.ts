'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function useItemAction(challengeId: string, inventoryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Fetch inventory
  const { data: inv } = await supabase
    .from('inventory')
    .select('*, items(*)')
    .eq('id', inventoryId)
    .eq('player_id', user.id)
    .single()
    
  if (!inv || inv.quantity < 1) return { error: 'Item not found in inventory' }

  // Fetch challenge
  const { data: challenge } = await supabase
    .from('challenges')
    .select('*')
    .eq('id', challengeId)
    .single()
    
  if (!challenge || challenge.status !== 'ACTIVE') return { error: 'Challenge not active' }
  
  const isP1 = challenge.challenger_id === user.id
  const isP2 = challenge.challenged_id === user.id
  if (!isP1 && !isP2) return { error: 'Not your challenge' }
  
  const pub = challenge.public_state
  const effects = inv.items.effects
  
  let newPub = { ...pub }
  let logMsg = ''

  if (effects.heal) {
    if (isP1) {
      newPub.p1_hp = Math.min(3, newPub.p1_hp + effects.heal)
    } else {
      newPub.p2_hp = Math.min(3, newPub.p2_hp + effects.heal)
    }
    logMsg = `Player used ${inv.items.name}, restoring ${effects.heal} HP!`
  }
  
  if (effects.skip_turn) {
    if (newPub.current_turn === (isP1 ? 'p1' : 'p2')) {
      newPub.current_turn = isP1 ? 'p2' : 'p1'
      logMsg = `Player used ${inv.items.name}! The timeline distorts, forcing their opponent to act instead.`
    } else {
      return { error: 'You can only skip your turn when it is your turn!' }
    }
  }

  if (newPub.log) {
    newPub.log = [...newPub.log, logMsg]
    if (newPub.log.length > 10) newPub.log.shift()
  } else {
    newPub.log = [logMsg]
  }

  // Deduct inventory
  await supabase.from('inventory').update({ quantity: inv.quantity - 1 }).eq('id', inventoryId)
  
  // Update challenge
  const { error } = await supabase
    .from('challenges')
    .update({ public_state: newPub, updated_at: new Date().toISOString() })
    .eq('id', challengeId)
    
  if (error) return { error: error.message }
  
  revalidatePath(`/challenge/${challengeId}`)
  return { success: true }
}
