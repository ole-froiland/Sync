'use client'

import { Bell } from 'lucide-react'
import ThemeToggle from '@/components/ui/ThemeToggle'

interface TopBarProps {
  title: string
  actions?: React.ReactNode
}

export default function TopBar({ title, actions }: TopBarProps) {
  return (
    <header className="h-14 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 flex items-center justify-between flex-shrink-0">
      <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
      <div className="flex items-center gap-1.5">
        {actions}
        <ThemeToggle />
        <button className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors relative">
          <Bell size={17} />
        </button>
      </div>
    </header>
  )
}
