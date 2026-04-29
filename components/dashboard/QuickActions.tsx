'use client'

import { FolderPlus, PenLine, UserPlus } from 'lucide-react'

interface QuickActionsProps {
  onCreateProject: () => void
  onCreatePost: () => void
  onInviteMember: () => void
}

const actions = [
  { icon: FolderPlus, label: 'New project', key: 'project' as const, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60' },
  { icon: PenLine, label: 'New post', key: 'post' as const, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60' },
  { icon: UserPlus, label: 'Invite member', key: 'invite' as const, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/60 hover:bg-violet-100 dark:hover:bg-violet-900/60' },
]

export default function QuickActions({ onCreateProject, onCreatePost, onInviteMember }: QuickActionsProps) {
  const handlers = { project: onCreateProject, post: onCreatePost, invite: onInviteMember }

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {actions.map(({ icon: Icon, label, key, color }) => (
        <button
          key={key}
          onClick={handlers[key]}
          className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-200 hover:shadow-sm hover:border-gray-200 dark:hover:border-gray-700 hover:-translate-y-0.5 group"
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color} transition-colors`}>
            <Icon size={18} />
          </div>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
        </button>
      ))}
    </div>
  )
}
