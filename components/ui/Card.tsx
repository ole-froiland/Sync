import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export default function Card({ hover, padding = 'md', className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm',
        hover && 'hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer',
        padding === 'none' && 'p-0',
        padding === 'sm' && 'p-4',
        padding === 'md' && 'p-5',
        padding === 'lg' && 'p-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
