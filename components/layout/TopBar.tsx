'use client'

import { Bell } from 'lucide-react'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { cn } from '@/lib/utils'

interface TopBarProps {
  title: string
  actions?: React.ReactNode
  className?: string
  titleClassName?: string
}

export default function TopBar({ title, actions, className, titleClassName }: TopBarProps) {
  return (
    <header
      className={cn(
        'h-14 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 flex items-center justify-between flex-shrink-0',
        className
      )}
    >
      <h1 className={cn('text-base font-semibold text-gray-900 dark:text-gray-100', titleClassName)}>
        {title}
      </h1>
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
