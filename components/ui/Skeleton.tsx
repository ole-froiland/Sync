import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-gray-100 dark:bg-gray-800', className)} />
  )
}

export function PostSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  )
}

export function ProjectCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-14 rounded-md" />
        <Skeleton className="h-5 w-20 rounded-md" />
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-gray-50 dark:border-gray-800/50">
        <div className="flex -space-x-1.5">
          <Skeleton className="w-6 h-6 rounded-full ring-2 ring-white" />
          <Skeleton className="w-6 h-6 rounded-full ring-2 ring-white" />
        </div>
        <Skeleton className="h-3 w-8" />
      </div>
    </div>
  )
}

export function PersonCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex flex-col gap-1.5 flex-1">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-14 rounded-md" />
        <Skeleton className="h-5 w-12 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-md" />
      </div>
    </div>
  )
}
