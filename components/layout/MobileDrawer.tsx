'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'
import SidebarContent from './SidebarContent'

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
  profile: Profile | null
  onSignOut: () => void
  signingOut?: boolean
}

export default function MobileDrawer({ open, onClose, profile, onSignOut, signingOut }: MobileDrawerProps) {
  const pathname = usePathname()

  // Auto-close when route changes (user tapped a nav link inside).
  useEffect(() => {
    if (open) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only watch pathname
  }, [pathname])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    function handler(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Body scroll-lock while open.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[60] lg:hidden',
        open ? 'pointer-events-auto' : 'pointer-events-none'
      )}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-black/40 transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0'
        )}
      />

      {/* Drawer panel */}
      <div
        className={cn(
          'absolute left-0 top-0 h-full w-72 max-w-[85%] bg-white dark:bg-gray-900 shadow-xl transition-transform duration-200 ease-out',
          'border-r border-gray-100 dark:border-gray-800',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <SidebarContent profile={profile} onSignOut={onSignOut} signingOut={signingOut} />
      </div>
    </div>,
    document.body
  )
}
