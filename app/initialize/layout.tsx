import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function InitializeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if player is already initialized
  const { data: sigil } = await supabase
    .from('sigils')
    .select('id')
    .eq('player_id', user.id)
    .maybeSingle()

  if (sigil) {
    console.log('User has sigil, redirecting to /game', sigil.id)
    redirect('/game')
  } else {
    console.log('User does not have sigil', user.id)
  }

  return <>{children}</>
}
