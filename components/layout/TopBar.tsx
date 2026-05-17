'use client'

import Image from 'next/image'
import { Bell, GitBranch } from 'lucide-react'
import ThemeToggle from '@/components/ui/ThemeToggle'
import Button from '@/components/ui/Button'

interface TopBarProps {
  title: string
  actions?: React.ReactNode
  className?: string
  titleClassName?: string
}

export default function TopBar({ title }: TopBarProps) {
  function openRepoModal() {
    window.dispatchEvent(new Event('sync:open-repo-modal'))
  }

  function openPostModal() {
    window.dispatchEvent(new Event('sync:open-post-modal'))
  }

  const aiButtonClass =
    'inline-flex h-8 w-8 items-center justify-center text-gray-700 transition-all duration-200 hover:scale-[1.04] hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 dark:text-gray-200'

  return (
    <header
      className="h-14 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 flex items-center justify-between flex-shrink-0"
    >
      <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
      <div className="flex items-center gap-2">
        <a
          href="https://claude.ai"
          target="_blank"
          rel="noreferrer"
          aria-label="Open Claude"
          title="Claude"
          className={aiButtonClass}
        >
          <Image src="/brand/claude-logo.svg" alt="" width={18} height={18} aria-hidden="true" />
        </a>
        <a
          href="https://chatgpt.com"
          target="_blank"
          rel="noreferrer"
          aria-label="Open ChatGPT"
          title="ChatGPT"
          className={aiButtonClass}
        >
          <Image
            src="/brand/chatgpt-logo.png"
            alt=""
            width={24}
            height={24}
            aria-hidden="true"
            className="rounded-sm"
          />
        </a>
        <Button size="sm" variant="secondary" onClick={openRepoModal} className="h-8">
          <GitBranch size={14} />
          New repo
        </Button>
        <Button size="sm" onClick={openPostModal} className="h-8">
          New post
        </Button>
        <ThemeToggle />
        <button className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors relative">
          <Bell size={17} />
        </button>
      </div>
    </header>
  )
}
