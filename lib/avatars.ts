export interface Avatar {
  id: string
  emoji: string
  color: string
}

const EMOJIS = [
  '🐱', '🐶', '🐭', '🐰', '🦊',
  '🐻', '🐼', '🐯', '🦁', '🐸',
  '🐧', '🦉', '🦋', '🐙', '🦄',
  '🐲', '🤖', '👾', '🎭', '🧙',
]

const COLORS = [
  { name: 'indigo',  value: '#4f46e5' },
  { name: 'emerald', value: '#059669' },
  { name: 'rose',    value: '#e11d48' },
  { name: 'amber',   value: '#d97706' },
  { name: 'violet',  value: '#7c3aed' },
]

export const AVATARS: Avatar[] = EMOJIS.flatMap((emoji, ei) =>
  COLORS.map((color) => ({
    id: `${ei}-${color.name}`,
    emoji,
    color: color.value,
  }))
)

export function getAvatar(id: string): Avatar {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0]
}

export function avatarToUrl(emoji: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="20" fill="${color}"/><text x="20" y="21.5" font-size="20" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
