import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const STATUS_LABELS: Record<string, string> = {
  idea: 'Idea',
  building: 'Building',
  live: 'Live',
}

export const STATUS_COLORS: Record<string, string> = {
  idea: 'bg-amber-100 text-amber-700',
  building: 'bg-blue-100 text-blue-700',
  live: 'bg-emerald-100 text-emerald-700',
}

export const POST_TYPE_COLORS: Record<string, string> = {
  update: 'bg-indigo-100 text-indigo-700',
  news: 'bg-sky-100 text-sky-700',
  question: 'bg-violet-100 text-violet-700',
  resource: 'bg-teal-100 text-teal-700',
}
