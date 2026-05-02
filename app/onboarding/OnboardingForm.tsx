'use client'

import { useActionState, useState } from 'react'
import { onboardingAction } from './actions'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import AvatarPicker from '@/components/onboarding/AvatarPicker'
import { Zap, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react'

const PASSWORD_RULES = [
  {
    label: 'At least 10 characters',
    test: (p: string) => p.length >= 10,
  },
  {
    label: 'At least one special character',
    test: (p: string) => /[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?`~]/.test(p),
  },
]

interface Props {
  defaultFirst: string
  defaultLast: string
}

export default function OnboardingForm({ defaultFirst, defaultLast }: Props) {
  const [state, action, pending] = useActionState(onboardingAction, null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [avatarId, setAvatarId] = useState('')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mb-4 shadow-sm">
            <Zap size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            Welcome to Sync
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Set up your profile to get started.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
          <form action={action} className="space-y-5">
            {/* Hidden avatar ID – value comes from React state */}
            <input type="hidden" name="avatarId" value={avatarId} />

            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                id="firstName"
                name="firstName"
                label="First name"
                placeholder="Ada"
                defaultValue={defaultFirst}
                required
                autoComplete="given-name"
              />
              <Input
                id="lastName"
                name="lastName"
                label="Last name"
                placeholder="Lovelace"
                defaultValue={defaultLast}
                required
                autoComplete="family-name"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 10 chars + special character"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Live password rule checklist */}
              {password.length > 0 && (
                <div className="mt-1 space-y-1">
                  {PASSWORD_RULES.map((rule) => {
                    const ok = rule.test(password)
                    return (
                      <div key={rule.label} className="flex items-center gap-1.5 text-xs">
                        {ok ? (
                          <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle size={13} className="text-red-400 shrink-0" />
                        )}
                        <span
                          className={
                            ok
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }
                        >
                          {rule.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Avatar picker */}
            <AvatarPicker value={avatarId} onChange={setAvatarId} />

            {/* Server error */}
            {state?.error && (
              <p className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                {state.error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center"
              loading={pending}
              disabled={pending || !avatarId}
            >
              {pending ? 'Saving…' : 'Finish setup →'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
