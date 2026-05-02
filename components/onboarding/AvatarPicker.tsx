'use client'

import { AVATARS } from '@/lib/avatars'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (id: string) => void
}

export default function AvatarPicker({ value, onChange }: Props) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Pick your avatar
      </p>
      <div className="grid grid-cols-10 gap-1.5 max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
        {AVATARS.map((avatar) => (
          <button
            key={avatar.id}
            type="button"
            onClick={() => onChange(avatar.id)}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-base transition-all duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1',
              value === avatar.id
                ? 'ring-2 ring-indigo-500 ring-offset-2 scale-110'
                : 'opacity-75 hover:opacity-100'
            )}
            style={{ backgroundColor: avatar.color }}
            title={`Avatar ${avatar.emoji}`}
            aria-pressed={value === avatar.id}
          >
            <span className="text-sm leading-none select-none">{avatar.emoji}</span>
          </button>
        ))}
      </div>
      {value ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Selected:{' '}
          <span className="text-base">
            {AVATARS.find((a) => a.id === value)?.emoji}
          </span>
        </p>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">No avatar selected yet.</p>
      )}
    </div>
  )
}
