import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function loginUser(email) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: 'password123'
  })
  if (error) throw error
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }
  })
}

async function runTests() {
  console.log('--- STARTING CHALLENGE PROTOCOL TESTS ---')
  const client1 = await loginUser('u1@test.com')
  const client2 = await loginUser('u2@test.com')
  const { data: { user: user1 } } = await client1.auth.getUser()
  const { data: { user: user2 } } = await client2.auth.getUser()

  console.log(`User1: ${user1.id}`)
  console.log(`User2: ${user2.id}`)

  // Reset players so they have enough points and aren't eliminated
  await client1.rpc('exec_sql', { query: `UPDATE public.players SET points = 500, status = 'ACTIVE' WHERE id IN ('${user1.id}', '${user2.id}')` })

  // Clean up any pending or active challenges
  await client1.rpc('exec_sql', { query: `DELETE FROM public.challenges WHERE challenger_id IN ('${user1.id}', '${user2.id}') OR challenged_id IN ('${user1.id}', '${user2.id}')` })

  console.log('1. Test creating a challenge')
  const { data: chalId, error: chalErr } = await client1.rpc('create_challenge', { p_target_id: user2.id })
  if (chalErr) {
    console.error('Failed to create challenge:', chalErr)
  } else {
    console.log('Challenge created:', chalId)
  }

  console.log('2. Test accepting a challenge')
  const { data: acceptedId, error: accErr } = await client2.rpc('accept_challenge', { p_challenge_id: chalId })
  if (accErr) {
    console.error('Failed to accept challenge:', accErr)
  } else {
    console.log('Challenge accepted, status changed to ACTIVE')
  }

  // Find out what type it is
  const { data: challenge } = await client1.from('challenges').select('*').eq('id', chalId).single()
  console.log('Challenge Type:', challenge.type)
  console.log('Public State:', challenge.public_state)

  console.log('--- TESTS COMPLETED ---')
}

runTests().catch(console.error)
