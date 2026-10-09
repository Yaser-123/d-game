'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function purchaseItem(itemId: string, quantity: number = 1) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase.rpc('purchase_item', {
    p_item_id: itemId,
    p_quantity: quantity
  })

  if (error) {
    console.error('Failed to purchase item:', error)
    return { error: error.message || 'Failed to complete transaction' }
  }

  revalidatePath('/shop')
  revalidatePath('/inventory')
  revalidatePath('/game')
  return { success: true }
}
