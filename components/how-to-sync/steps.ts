import { Sparkles, FolderKanban, Code2, Users, type LucideIcon } from 'lucide-react'

export type StepId = 'build' | 'create' | 'code' | 'sync'

export interface Step {
  id: StepId
  eyebrow: string
  icon: LucideIcon
  title: string
  subtitle: string
  /** Solid accent hex, used to drive glows, borders and the ambient background. */
  accent: string
  /** rgb triplet (for `rgb(var)` / alpha compositing in inline styles). */
  accentRgb: string
}

export const STEPS: Step[] = [
  {
    id: 'build',
    eyebrow: 'Welcome to Sync',
    icon: Sparkles,
    title: 'Build together, without the noise',
    subtitle:
      'Sync brings your projects, code, conversations and team into one focused workspace.',
    accent: '#8b5cf6',
    accentRgb: '139 92 246',
  },
  {
    id: 'create',
    eyebrow: 'Projects',
    icon: FolderKanban,
    title: 'Create focused projects',
    subtitle:
      'Organize work into lightweight project spaces with tasks, members, links and context.',
    accent: '#3b82f6',
    accentRgb: '59 130 246',
  },
  {
    id: 'code',
    eyebrow: 'Integrations',
    icon: Code2,
    title: 'Connect where you already build',
    subtitle:
      'Keep GitHub, Cursor, Codex, VS Code and your favorite AI coding tools close to the work.',
    accent: '#10b981',
    accentRgb: '16 185 129',
  },
  {
    id: 'sync',
    eyebrow: 'Your team',
    icon: Users,
    title: 'Sync with your team',
    subtitle: 'Invite collaborators, share progress and keep everyone aligned.',
    accent: '#a855f7',
    accentRgb: '168 85 247',
  },
]

export const STEP_DURATION_MS = 8000
