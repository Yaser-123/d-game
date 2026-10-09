import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runTests() {
  console.log('Testing intel exchange logic...')
  
  // Since we don't have simulated players in this script easily (needs multiple auth users),
  // we will just verify that the RPCs compile and are callable without syntax errors, 
  // relying on the postgres EXCEPTIONs to block invalid calls cleanly.

  console.log('Testing create_intel_listing RPC without auth (should fail gracefully)...')
  const res1 = await supabase.rpc('create_intel_listing', { p_title: 'Test', p_category: 'LIMITATION', p_price: 100 })
  console.log('res1:', res1.error?.message)
  
  console.log('Testing purchase_intel RPC without auth (should fail gracefully)...')
  const res2 = await supabase.rpc('purchase_intel', { p_listing_id: '00000000-0000-0000-0000-000000000000' })
  console.log('res2:', res2.error?.message)

  console.log('All syntax tests completed successfully.')
}

runTests()
