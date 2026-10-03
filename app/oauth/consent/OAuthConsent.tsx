'use client'

import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import Button from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'

type AuthorizationDetails = {
  authorizationId: string
  clientName: string
  clientUri: string
  email: string
  scopes: string[]
}

export default function OAuthConsent({
  authorizationId,
  clientName,
  clientUri,
  email,
  scopes,
}: AuthorizationDetails) {
  const [pending, setPending] = useState<'approve' | 'deny' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(action: 'approve' | 'deny') {
    setPending(action)
    setError(null)

    const supabase = createClient()
    const result =
      action === 'approve'
        ? await supabase.auth.oauth.approveAuthorization(authorizationId, {
            skipBrowserRedirect: true,
          })
        : await supabase.auth.oauth.denyAuthorization(authorizationId, {
            skipBrowserRedirect: true,
          })

    if (result.error || !result.data?.redirect_url) {
      setError(result.error?.message || 'Kunne ikke fullføre forespørselen.')
      setPending(null)
      return
    }

    window.location.assign(result.data.redirect_url)
  }

  return (
    <div className="relative min-h-screen bg-[#fafafa] flex items-center justify-center p-4 overflow-hidden">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-600 text-lg font-bold text-white shadow-md">
            S
          </span>
          <span className="text-2xl font-bold tracking-tight text-fuchsia-500" data-no-translate>
            Sync
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_2px_20px_0_rgba(0,0,0,0.07)]">
          <div className="space-y-5 p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-50 text-fuchsia-600">
                <ShieldCheck size={21} />
              </span>
              <div>
                <h1 className="text-base font-semibold text-gray-900">
                  Koble {clientName} til Sync?
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Du er logget inn som {email}.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-800">{clientName} ber om tilgang til:</p>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                <li>• Se prosjekter, mapper og oppgaver</li>
                <li>• Opprette prosjekter, mapper og oppgaver når du ber om det</li>
                {scopes.map((scope) => (
                  <li key={scope} className="text-xs text-gray-400">
                    OAuth: {scope}
                  </li>
                ))}
              </ul>
            </div>

            {clientUri && (
              <p className="break-all text-xs text-gray-400">
                Klient: {clientUri}
              </p>
            )}

            {error && (
              <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                loading={pending === 'deny'}
                disabled={pending !== null}
                onClick={() => decide('deny')}
              >
                Avslå
              </Button>
              <Button
                type="button"
                loading={pending === 'approve'}
                disabled={pending !== null}
                onClick={() => decide('approve')}
              >
                Tillat tilgang
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
