'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createIntelListing(formData: FormData) {
  const supabase = await createClient()
  
  const title = formData.get('title') as string
  const category = formData.get('category') as string
  const price = parseInt(formData.get('price') as string, 10)

  if (!title || !category || isNaN(price) || price <= 0 || price > 1000) {
    return { error: 'Invalid listing parameters.' }
  }

  const { error } = await supabase.rpc('create_intel_listing', {
    p_title: title,
    p_category: category,
    p_price: price
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/intel')
  revalidatePath('/profile')
  return { success: true }
}

export async function purchaseIntelListing(listingId: string) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('purchase_intel', {
    p_listing_id: listingId
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/intel')
  revalidatePath('/game')
  return { success: true }
}

export async function cancelIntelListing(listingId: string) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('cancel_intel_listing', {
    p_listing_id: listingId
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/intel')
  revalidatePath('/profile')
  return { success: true }
}
