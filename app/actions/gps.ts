'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateLocationAction(lat: number, lng: number) {
  const supabase = await createClient()
  
  const { error } = await supabase.rpc('update_player_location', { p_lat: lat, p_lng: lng })
  
  if (error) {
    console.error('Failed to update location:', error)
    return { success: false }
  }

  revalidatePath('/players')
  return { success: true }
}
