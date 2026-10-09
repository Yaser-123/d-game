'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function toggleEquipment(inventoryId: string, equip: boolean) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase.rpc('equip_item', {
    p_inventory_id: inventoryId,
    p_equip: equip
  })

  if (error) {
    console.error('Equip Error:', error)
    return { error: 'Failed to update equipment' }
  }

  revalidatePath('/inventory')
  revalidatePath('/game')
  revalidatePath('/profile')

  return { success: true }
}
