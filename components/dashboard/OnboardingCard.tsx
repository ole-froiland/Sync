'use client'

import { useState } from 'react'
import Card from '@/components/ui/Card'
import { X, FolderKanban, CheckSquare, Rss, MessageSquare } from 'lucide-react'

const steps = [
  { icon: FolderKanban, text: 'Create or join a project' },
  { icon: CheckSquare, text: 'Add tasks, links and members' },
  { icon: Rss, text: 'Use the feed to stay updated' },
  { icon: MessageSquare, text: 'Use chat to coordinate' },
]

export default function OnboardingCard() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <Card className="border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/80 dark:from-indigo-950/40 to-white dark:to-gray-900 relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-colors"
      >
        <X size={15} />
      </button>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 bg-indigo-600 rounded flex items-center justify-center">
          <span className="text-white text-xs font-bold">S</span>
        </div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">How to use Sync</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {steps.map(({ icon: Icon, text }, i) => (
          <div key={i} className="flex items-center gap-2.5 bg-white/70 dark:bg-gray-800/50 rounded-lg px-3 py-2.5">
            <div className="w-7 h-7 bg-indigo-100 dark:bg-indigo-900/60 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon size={14} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="text-xs text-gray-700 dark:text-gray-300">{text}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
