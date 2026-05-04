/* eslint-disable @next/next/no-img-element */
import { cn, initials } from '@/lib/utils'

interface AvatarProps {
  name: string
  src?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
}

const emojiSizes = {
  xs: 'text-sm',
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-3xl',
}

const colors = [
  'bg-indigo-100 text-indigo-700',
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
]

function colorFromName(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function parseGeneratedAvatar(src: string) {
  if (!src.startsWith('data:image/svg+xml')) return null

  const [, payload = ''] = src.split(',', 2)

  try {
    const svg = decodeURIComponent(payload)
    const color = svg.match(/<circle[^>]*fill="([^"]+)"/)?.[1]
    const emoji = svg.match(/<text[^>]*>(.*?)<\/text>/)?.[1]

    if (!color || !emoji) return null

    return { color, emoji }
  } catch {
    return null
  }
}

export default function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  if (src) {
    const generatedAvatar = parseGeneratedAvatar(src)

    if (generatedAvatar) {
      return (
        <div
          className={cn(
            'rounded-full flex shrink-0 items-center justify-center overflow-hidden',
            sizes[size],
            className
          )}
          style={{ backgroundColor: generatedAvatar.color }}
          aria-label={name}
          role="img"
        >
          <span className={cn('select-none leading-none translate-y-[0.04em]', emojiSizes[size])}>
            {generatedAvatar.emoji}
          </span>
        </div>
      )
    }

    return (
      <img
        src={src}
        alt={name}
        className={cn('block rounded-full object-cover object-center', sizes[size], className)}
      />
    )
  }
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold flex-shrink-0',
        sizes[size],
        colorFromName(name),
        className
      )}
    >
      {initials(name)}
    </div>
  )
}
