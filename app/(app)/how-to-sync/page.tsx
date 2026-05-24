'use client'

import { useState } from 'react'
import { Lightbulb, FolderKanban, Code2, Users, Sparkles } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import SyncWithOthersModal from '@/components/how-to-sync/SyncWithOthersModal'
import Button from '@/components/ui/Button'
import { useUser } from '@/context/UserContext'

const STEPS = [
  {
    icon: Lightbulb,
    title: 'Want to build something?',
    description: 'Sync gives you one place for your projects, code, and people.',
  },
  {
    icon: FolderKanban,
    title: 'Create a project',
    description: 'Give it a name, connect a repo, and keep everything organized.',
  },
  {
    icon: Code2,
    title: 'Open it where you build',
    description: 'Use GitHub, VS Code, Cursor, Codex, or your favorite AI coding tool.',
  },
  {
    icon: Users,
    title: 'Sync with your team',
    description: 'Invite friends, share projects, and work together in one place.',
  },
]

export default function HowToSyncPage() {
  const profile = useUser()
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <TopBar title="How to Sync" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-12">
          <div className="mb-12">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3.5 py-1 text-xs font-medium text-purple-600 dark:text-purple-400">
              <Sparkles size={12} />
              Getting started
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              How to Sync
            </h1>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
              Get your projects and team in sync in four steps.
            </p>
          </div>

          <div className="space-y-3">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/60 text-sm font-semibold text-purple-600 dark:text-purple-400">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <step.icon size={16} className="shrink-0 text-purple-500 dark:text-purple-400" />
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {step.title}
                      </h3>
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Ready to sync?
                </h3>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  Invite your team and start building together.
                </p>
              </div>
              <Button onClick={() => setModalOpen(true)} className="shrink-0">
                <Users size={15} />
                Invite people
              </Button>
            </div>
          </div>
        </div>
      </div>

      <SyncWithOthersModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        userId={profile?.id ?? ''}
      />
    </>
  )
}
