import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // For admin setup

const adminAuth = createClient(supabaseUrl, supabaseServiceKey)

async function testShop() {
  console.log('--- STARTING SHOP TESTS ---')
  
  // Create a test user directly using admin client
  const email = `test_shop_${Date.now()}@test.com`
  const { data: { user }, error: userError } = await adminAuth.auth.admin.createUser({
    email,
    password: 'password123',
    email_confirm: true
  })
  if (userError) throw userError

  // Log in as this user to get standard RLS permissions
  const authClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await authClient.auth.signInWithPassword({
    email,
    password: 'password123'
  })

  // Initialize the player
  await authClient.rpc('initialize_player', {
    p_handle: `ShopTester_${Math.floor(Math.random() * 1000)}`,
    p_seed: 'seed123'
  })

  console.log('Player initialized (1000 pts)')

  // Helper to fetch current points
  const getPoints = async () => {
    const { data } = await authClient.from('players').select('points').single()
    return data!.points
  }

  const getInventory = async (itemId: string) => {
    const { data } = await authClient.from('inventory').select('quantity').eq('item_id', itemId).maybeSingle()
    return data?.quantity || 0
  }

  // 1. Successful purchase (Smoke Grenade - 75 pts)
  console.log('1. Purchasing smoke grenade...')
  let res = await authClient.rpc('purchase_item', { p_item_id: 'util_smoke', p_quantity: 1 })
  if (res.error) console.error('Failed purchase 1', res.error)
  else console.log('Purchased smoke grenade! Points:', await getPoints(), 'Qty:', await getInventory('util_smoke'))

  // 2. Stackable increment
  console.log('2. Purchasing 2 more smoke grenades...')
  res = await authClient.rpc('purchase_item', { p_item_id: 'util_smoke', p_quantity: 2 })
  if (res.error) console.error('Failed purchase 2', res.error)
  else console.log('Purchased 2 more! Points:', await getPoints(), 'Qty:', await getInventory('util_smoke'))

  // 3. Duplicate non-stackable rejection
  console.log('3. Purchasing compact pistol...')
  res = await authClient.rpc('purchase_item', { p_item_id: 'wpn_pistol', p_quantity: 1 })
  console.log('Purchased pistol! Points:', await getPoints())

  console.log('3a. Trying to purchase pistol again...')
  res = await authClient.rpc('purchase_item', { p_item_id: 'wpn_pistol', p_quantity: 1 })
  if (res.error) console.log('Correctly rejected duplicate non-stackable:', res.error.message)
  else console.error('FAIL: Should have rejected duplicate pistol purchase')

  // 4. Below 100 points boundary test
  // Current points should be 1000 - 75 - 150 - 300 = 475
  // Let's buy a vest (400) - wait, this would leave 75 points (below 100).
  console.log('4. Purchasing Vest (400 pts) with 475 pts remaining...')
  res = await authClient.rpc('purchase_item', { p_item_id: 'def_vest', p_quantity: 1 })
  if (res.error) console.log('Correctly rejected going below 100 pts:', res.error.message)
  else console.error('FAIL: Should have rejected dropping below 100 pts')

  // Buy a medkit (50) - 475 - 50 = 425
  res = await authClient.rpc('purchase_item', { p_item_id: 'util_medkit', p_quantity: 1 })
  console.log('Purchased medkit. Points:', await getPoints())

  // Buy a knife (150) - wait, starter knife is given? Let's check inventory.
  const knifeQty = await getInventory('wpn_knife')
  if (knifeQty > 0) {
    console.log('Player already has starter knife.')
  } else {
    await authClient.rpc('purchase_item', { p_item_id: 'wpn_knife', p_quantity: 1 })
  }

  // 5. Negative quantity rejection
  console.log('5. Attempting negative quantity...')
  res = await authClient.rpc('purchase_item', { p_item_id: 'util_smoke', p_quantity: -1 })
  if (res.error) console.log('Correctly rejected negative quantity:', res.error.message)
  else console.error('FAIL: Allowed negative quantity')

  // 6. Insufficient points
  // Need to drop points below cost. Let's spend down to 125.
  // We have 425. Let's buy 3 medkits (150).
  await authClient.rpc('purchase_item', { p_item_id: 'util_medkit', p_quantity: 3 })
  console.log('Spent down to:', await getPoints()) // 275
  await authClient.rpc('purchase_item', { p_item_id: 'util_flash', p_quantity: 1 }) // 175
  
  // We have 175 points. A pistol costs 300.
  console.log('6. Purchasing pistol (300) with 175 points...')
  res = await authClient.rpc('purchase_item', { p_item_id: 'wpn_sword', p_quantity: 1 }) // 600 cost
  if (res.error) console.log('Correctly rejected insufficient points:', res.error.message)
  else console.error('FAIL: Allowed insufficient points purchase')

  // Cleanup
  console.log('--- TESTS COMPLETE ---')
  
  await adminAuth.auth.admin.deleteUser(user!.id)
}

testShop().catch(console.error)
