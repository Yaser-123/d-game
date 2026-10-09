import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { logout } from '@/app/auth/actions'

export default async function AuthNav() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    return (
      <form action={logout}>
        <button type="submit" className="btn btn-outline h-9 px-4 text-xs tracking-wider font-bold">
          LOGOUT
        </button>
      </form>
    )
  }

  return (
    <>
      <Link href="/login" className="hidden sm:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
        Login
      </Link>
      <Link href="/register" className="btn btn-danger h-9 px-4 text-xs tracking-wider font-bold">
        INITIALIZE
      </Link>
    </>
  )
}
