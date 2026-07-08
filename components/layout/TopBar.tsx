'use client'

import { GitBranch, Menu, PanelLeft, Plus, Sparkles } from 'lucide-react'
import ThemeToggle from '@/components/ui/ThemeToggle'
import FullscreenToggle from '@/components/ui/FullscreenToggle'
import Button from '@/components/ui/Button'

interface TopBarProps {
  title: string
  actions?: React.ReactNode
  className?: string
  titleClassName?: string
  noTranslateTitle?: boolean
}

export default function TopBar({ title, noTranslateTitle }: TopBarProps) {
  function openRepoModal() {
    window.dispatchEvent(new Event('sync:open-repo-modal'))
  }

  function openPostModal() {
    window.dispatchEvent(new Event('sync:open-post-modal'))
  }

  function openDrawer() {
    window.dispatchEvent(new Event('sync:open-drawer'))
  }

  function toggleSidebar() {
    window.dispatchEvent(new Event('sync:toggle-sidebar'))
  }

  function openAssistant() {
    window.dispatchEvent(new Event('sync:open-assistant'))
  }

  return (
    <header
      className="h-14 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 lg:px-6 flex items-center justify-between flex-shrink-0 gap-3"
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={openDrawer}
          aria-label="Open menu"
          className="lg:hidden inline-flex h-10 w-10 items-center justify-center -ml-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <Menu size={20} />
        </button>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          className="hidden lg:inline-flex h-9 w-9 items-center justify-center -ml-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <PanelLeft size={17} />
        </button>
        <h1
          className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate"
          data-no-translate={noTranslateTitle ? true : undefined}
        >
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openAssistant}
          aria-label="Open Sync AI"
          title="Sync AI"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 shadow-sm transition-colors hover:border-fuchsia-300 hover:bg-fuchsia-100 dark:border-fuchsia-900/70 dark:bg-fuchsia-950/30 dark:text-fuchsia-200 dark:hover:border-fuchsia-800 dark:hover:bg-fuchsia-950/50"
        >
          <Sparkles size={15} />
        </button>
        <Button
          size="sm"
          variant="secondary"
          onClick={openRepoModal}
          className="h-8"
          aria-label="New repo"
        >
          <GitBranch size={14} />
          <span className="hidden sm:inline">New repo</span>
        </Button>
        <Button
          size="sm"
          onClick={openPostModal}
          className="h-8"
          aria-label="New post"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">New post</span>
        </Button>
        <FullscreenToggle />
        <ThemeToggle />
      </div>
    </header>
  )
}
