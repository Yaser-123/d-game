import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runTests() {
  console.log('Testing get_leaderboard RPC...')
  
  const { data: leaderboard, error } = await supabase.rpc('get_leaderboard', { p_limit: 10 })
  
  if (error) {
    console.error('Error fetching leaderboard:', error)
    process.exit(1)
  }
  
  console.log('Leaderboard:', leaderboard)
  
  console.log('Testing battles history...')
  // Assuming no auth user here, but we can just query battles as admin
  const { data: battles } = await supabase.from('battles').select('*').limit(2)
  console.log('Battles:', battles)

  console.log('All tests completed successfully.')
}

runTests()
