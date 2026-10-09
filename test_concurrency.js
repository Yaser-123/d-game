import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase env vars")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function runConcurrencyTest() {
  const ts = Date.now()
  const email1 = `test_p1_${ts}@example.com`
  const email2 = `test_p2_${ts}@example.com`
  const password = "testpassword123"

  console.log("Signing up test users...")
  const { data: u1, error: e1 } = await supabase.auth.signUp({ email: email1, password })
  const { data: u2, error: e2 } = await supabase.auth.signUp({ email: email2, password })

  if (e1 || e2) {
    console.error("Signup failed", e1, e2)
    process.exit(1)
  }

  const uid1 = u1.user.id
  const uid2 = u2.user.id

  // We need to wait for triggers to create public.players (assuming they exist)
  await new Promise(r => setTimeout(r, 1000))

  // Auth as user 1
  await supabase.auth.signInWithPassword({ email: email1, password })
  
  // Start battle
  console.log("Starting battle...")
  const { data: battleId, error: startErr } = await supabase.rpc('start_battle', { p_opponent_id: uid2 })
  if (startErr) {
    console.error("Start battle failed", startErr)
    process.exit(1)
  }

  // Fetch initial points
  const { data: p1Start } = await supabase.from('players').select('points').eq('id', uid1).single()
  console.log("P1 Initial Points:", p1Start.points)

  // We will force P2's health to 10 so one attack finishes it.
  // Wait, we can't update P2's health directly from the client due to RLS.
  // But we can just use an action that would normally kill them? 
  // No, an attack does 10 base damage. We'd have to attack 10 times to kill them.
  // Let's just loop attacks until health is 10, then do the concurrent test on the final attack!
  console.log("Lowering opponent health to 10...")
  let turn = 1
  while (true) {
    const { data: b } = await supabase.from('battles').select('p2_health, turn_counter, current_turn_player_id').eq('id', battleId).single()
    if (b.p2_health <= 10) {
      turn = b.turn_counter
      break
    }
    
    // If it's p1's turn
    if (b.current_turn_player_id === uid1) {
      await supabase.rpc('submit_battle_action', { p_battle_id: battleId, p_expected_turn: b.turn_counter, p_action_type: 'ATTACK' })
    } else {
      // P2's turn
      await supabase.auth.signInWithPassword({ email: email2, password })
      await supabase.rpc('submit_battle_action', { p_battle_id: battleId, p_expected_turn: b.turn_counter, p_action_type: 'ATTACK' })
      // switch back to p1
      await supabase.auth.signInWithPassword({ email: email1, password })
    }
  }

  console.log(`Ready for final blow on turn ${turn}. Firing concurrent requests...`)
  
  // Fire two requests simultaneously
  const req1 = supabase.rpc('submit_battle_action', { p_battle_id: battleId, p_expected_turn: turn, p_action_type: 'ATTACK' })
  const req2 = supabase.rpc('submit_battle_action', { p_battle_id: battleId, p_expected_turn: turn, p_action_type: 'ATTACK' })

  const results = await Promise.allSettled([req1, req2])
  console.log("Concurrent results:", JSON.stringify(results, null, 2))

  // Fetch final points and ledger
  const { data: p1Final } = await supabase.from('players').select('points').eq('id', uid1).single()
  console.log("P1 Final Points:", p1Final.points)
  
  const { data: ledger } = await supabase.from('points_ledger').select('*').eq('player_id', uid1).eq('transaction_type', 'BATTLE_REWARD')
  console.log(`Number of BATTLE_REWARD ledger entries for P1: ${ledger.length}`)

  if (ledger.length === 1 && p1Final.points < p1Start.points + 200) {
    console.log("✅ CONCURRENCY TEST PASSED: Only 1 settlement occurred.")
  } else {
    console.log("❌ CONCURRENCY TEST FAILED: Multiple settlements occurred.")
  }
}

runConcurrencyTest().catch(console.error)
