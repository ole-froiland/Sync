'use client'

import PostCard from '@/components/dashboard/PostCard'
import QuickActions from '@/components/dashboard/QuickActions'
import GitHubTrending from '@/components/dashboard/GitHubTrending'
import { PostSkeleton, Skeleton } from '@/components/ui/Skeleton'
import { Rss, Newspaper, DollarSign, RefreshCw } from 'lucide-react'
import type { Post, FeedItem, ModelCost } from '@/types'

const TIER_COLORS: Record<string, string> = {
  low: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50',
  mid: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50',
  high: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50',
}

function timeSince(unixSeconds: number): string {
  const diff = Date.now() / 1000 - unixSeconds
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

interface FeedViewProps {
  posts: Post[]
  postsLoading: boolean
  news: FeedItem[]
  newsLoading: boolean
  modelCosts: ModelCost[]
  onPostClick: (post: Post) => void
  onFetchNews: () => void
  onCreateProject: () => void
  onCreatePost: () => void
  onInviteMember: () => void
}

export default function FeedView({
  posts,
  postsLoading,
  news,
  newsLoading,
  modelCosts,
  onPostClick,
  onFetchNews,
  onCreateProject,
  onCreatePost,
  onInviteMember,
}: FeedViewProps) {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-3 gap-8">
      {/* Left column — feed */}
      <div className="col-span-2 flex flex-col gap-5">
        <div className="flex items-center gap-2 pb-1 border-b border-gray-100 dark:border-gray-800">
          <Rss size={14} className="text-gray-400 dark:text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Feed</h2>
          {!postsLoading && (
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
              {posts.length} posts
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {postsLoading ? (
            Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />)
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

      {/* Right column — widgets */}
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
            Quick actions
          </h2>
          <QuickActions
            onCreateProject={onCreateProject}
            onCreatePost={onCreatePost}
            onInviteMember={onInviteMember}
          />
        </div>

        {/* Hacker News widget */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Newspaper size={13} className="text-gray-400 dark:text-gray-500" />
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              Hacker News
            </h3>
            <button
              onClick={onFetchNews}
              className="ml-auto text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={11} />
            </button>
          </div>
          <div className="flex flex-col gap-0">
            {newsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="py-2.5 flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2.5 w-1/3" />
                </div>
              ))
            ) : news.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 py-2">
                Could not load news
              </p>
            ) : (
              news.slice(0, 6).map((item, i) => (
                <div
                  key={item.id}
                  className={`py-3 ${
                    i < Math.min(news.length, 6) - 1
                      ? 'border-b border-gray-50 dark:border-gray-800/60'
                      : ''
                  }`}
                >
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-2"
                  >
                    {item.title}
                  </a>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {item.source} · {timeSince(item.publishedAt)}
                  </p>
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-gray-300 dark:text-gray-600 pt-3 border-t border-gray-50 dark:border-gray-800/60">
            Refreshes every 5 minutes
          </p>
        </div>

        {/* Model costs */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={13} className="text-gray-400 dark:text-gray-500" />
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              Model Costs
            </h3>
          </div>
          <div className="flex flex-col gap-0">
            {modelCosts.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2.5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
              ))
            ) : (
              modelCosts.map((item, i) => (
                <div
                  key={item.model}
                  className={`flex items-center justify-between py-2.5 ${
                    i < modelCosts.length - 1
                      ? 'border-b border-gray-50 dark:border-gray-800/60'
                      : ''
                  }`}
                >
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                    {item.model}
                  </span>
                  <span
                    className={`text-xs font-semibold rounded-md px-2 py-0.5 ${TIER_COLORS[item.tier]}`}
                  >
                    {item.cost}
                  </span>
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-gray-300 dark:text-gray-600 pt-3 border-t border-gray-50 dark:border-gray-800/60">
            Input tokens · edit lib/model-costs.json to update
          </p>
        </div>
      </div>
    </div>
  )
}
