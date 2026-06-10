'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Plus, UserPlus } from 'lucide-react'

/**
 * Final-step call to action. Two clear next steps: spin up a project or bring
 * the team in. Rendered inside the narrative column on the last step.
 */
export default function CTACard({ onInvite }: { onInvite: () => void }) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      className="flex flex-col gap-2.5 sm:flex-row"
    >
      <Link
        href="/projects"
        className="group relative flex flex-1 items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-purple-500 to-fuchsia-500 px-4 py-3.5 text-left text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-xl hover:shadow-purple-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <Plus size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Create your first project</span>
          <span className="block text-xs text-white/80">Start building in seconds</span>
        </span>
        <ArrowRight
          size={16}
          className="shrink-0 transition-transform group-hover:translate-x-0.5"
        />
      </Link>

      <button
        type="button"
        onClick={onInvite}
        className="group flex flex-1 items-center gap-3 rounded-2xl border border-gray-200/80 bg-white/70 px-4 py-3.5 text-left text-gray-900 backdrop-blur-md transition-all hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:hover:bg-white/[0.09]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700 transition-colors group-hover:bg-gray-200 dark:bg-white/10 dark:text-gray-200">
          <UserPlus size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Invite your team</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            Share progress together
          </span>
        </span>
        <ArrowRight
          size={16}
          className="shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5"
        />
      </button>
    </motion.div>
  )
}
