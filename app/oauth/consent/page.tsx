import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OAuthConsent from './OAuthConsent'

type ConsentPageProps = {
  searchParams: Promise<{ authorization_id?: string | string[] }>
}

export default async function ConsentPage({ searchParams }: ConsentPageProps) {
  const rawAuthorizationId = (await searchParams).authorization_id
  const authorizationId =
    typeof rawAuthorizationId === 'string' ? rawAuthorizationId : ''

  if (!authorizationId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fafafa] p-4 text-sm text-gray-600">
        Ugyldig OAuth-forespørsel: authorization_id mangler.
      </main>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const next = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fafafa] p-4 text-sm text-red-600">
        Kunne ikke laste OAuth-forespørselen. Kontroller at OAuth-serveren er aktivert i Supabase.
      </main>
    )
  }

  if ('redirect_url' in data) redirect(data.redirect_url)

  return (
    <OAuthConsent
      authorizationId={data.authorization_id}
      clientName={data.client.name || 'AI-klienten'}
      clientUri={data.client.uri || ''}
      email={data.user.email}
      scopes={data.scope.split(/\s+/).filter(Boolean)}
    />
  )
}
