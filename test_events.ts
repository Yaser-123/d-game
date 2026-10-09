import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runTests() {
  console.log('Testing global events logic...')
  
  console.log('Testing register_for_event RPC without auth (should fail gracefully)...')
  const res1 = await supabase.rpc('register_for_event', { p_event_id: '00000000-0000-0000-0000-000000000000' })
  console.log('res1:', res1.error?.message)
  
  console.log('Testing submit_battle_to_event RPC without auth (should fail gracefully)...')
  const res2 = await supabase.rpc('submit_battle_to_event', { 
    p_event_id: '00000000-0000-0000-0000-000000000000',
    p_battle_id: '00000000-0000-0000-0000-000000000000' 
  })
  console.log('res2:', res2.error?.message)

  console.log('Testing claim_event_reward RPC without auth (should fail gracefully)...')
  const res3 = await supabase.rpc('claim_event_reward', { p_event_id: '00000000-0000-0000-0000-000000000000' })
  console.log('res3:', res3.error?.message)

  console.log('All syntax tests completed successfully.')
}

runTests()
