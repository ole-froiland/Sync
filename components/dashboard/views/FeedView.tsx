'use client'

import PostCard from '@/components/dashboard/PostCard'
import GitHubTrending from '@/components/dashboard/GitHubTrending'
import Button from '@/components/ui/Button'
import { PostSkeleton } from '@/components/ui/Skeleton'
import { CloudOff, Rss } from 'lucide-react'
import type { Post } from '@/types'

interface FeedViewProps {
  posts: Post[]
  postsLoading: boolean
  postsError?: boolean
  onRetry?: () => void
  onPostClick: (post: Post) => void
}

export default function FeedView({
  posts,
  postsLoading,
  postsError,
  onRetry,
  onPostClick,
}: FeedViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-8">
      <div className="flex items-center gap-2 pb-1 border-b border-gray-100 dark:border-gray-800">
        <Rss size={14} className="text-gray-400 dark:text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Feed</h2>
        {!postsLoading && !postsError && (
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
            {posts.length} posts
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {postsLoading ? (
          Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />)
        ) : postsError ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <CloudOff size={24} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Could not load the feed right now.</p>
            {onRetry && (
              <Button size="sm" variant="secondary" onClick={onRetry} className="mt-4">
                Try again
              </Button>
            )}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <Rss size={24} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No posts yet. Be the first to share something.</p>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} post={post} onClick={() => onPostClick(post)} />
          ))
        )}
      </div>

      <GitHubTrending />
    </div>
  )
}
