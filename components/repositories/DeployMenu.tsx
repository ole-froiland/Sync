'use client'

import { useEffect, useRef, useState } from 'react'
import { Rocket, ChevronDown } from 'lucide-react'

type DeployProvider = {
  id: string
  label: string
  deployUrl: (repoUrl: string) => string
}

const PROVIDERS: DeployProvider[] = [
  {
    id: 'netlify',
    label: 'Netlify',
    deployUrl: (repoUrl) =>
      `https://app.netlify.com/start/deploy?repository=${encodeURIComponent(repoUrl)}`,
  },
  // Add Vercel / Cloudflare Pages / Render here later — the dropdown below
  // renders automatically once there is more than one provider.
]

const BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'

export default function DeployMenu({
  repoUrl,
  appearance = 'button',
  onSelect,
}: {
  repoUrl: string
  appearance?: 'button' | 'menu-item'
  onSelect?: () => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (appearance === 'menu-item') {
    const provider = PROVIDERS[0]
    return (
      <a
        href={provider.deployUrl(repoUrl)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onSelect}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <Rocket size={14} className="text-gray-400" />
        Deploy to {provider.label}
      </a>
    )
  }

  // Single provider: render a plain link so middle-click / cmd-click works.
  if (PROVIDERS.length === 1) {
    const provider = PROVIDERS[0]
    return (
      <a
        href={provider.deployUrl(repoUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className={BUTTON_CLASS}
      >
        <Rocket size={13} />
        Deploy
      </a>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={BUTTON_CLASS}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Rocket size={13} />
        Deploy
        <ChevronDown size={12} className="opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {PROVIDERS.map((provider) => (
            <a
              key={provider.id}
              href={provider.deployUrl(repoUrl)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Deploy to {provider.label}
            </a>
          ))}
          <p className="border-t border-gray-100 px-3 pb-1 pt-1.5 text-[11px] text-gray-400 dark:border-gray-800 dark:text-gray-500">
            You&apos;ll finish signing in on the provider&apos;s site.
          </p>
        </div>
      )}
    </div>
  )
}
