'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/layout/TopBar'
import OnboardingCard from '@/components/dashboard/OnboardingCard'
import PostCard from '@/components/dashboard/PostCard'
import PostDetailModal from '@/components/dashboard/PostDetailModal'
import QuickActions from '@/components/dashboard/QuickActions'
import CreatePostModal from '@/components/dashboard/CreatePostModal'
import InviteMemberModal from '@/components/dashboard/InviteMemberModal'
import CreateProjectModal from '@/components/projects/CreateProjectModal'
import CreateGitHubRepoModal from '@/components/dashboard/CreateGitHubRepoModal'
import GitHubTrending from '@/components/dashboard/GitHubTrending'
import Button from '@/components/ui/Button'
import { PostSkeleton, Skeleton } from '@/components/ui/Skeleton'
import { useUser } from '@/context/UserContext'
import { mockPosts } from '@/lib/mock-data'
import type { Post, NewsItem, ModelCost, Project } from '@/types'
import { Rss, Newspaper, DollarSign, GitBranch, RefreshCw } from 'lucide-react'

const SUPABASE_CONFIGURED = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http')
const NEWS_REFRESH_MS = 5 * 60 * 1000

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

export default function DashboardPage() {
  const profile = useUser()

  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(true)

  const [news, setNews] = useState<NewsItem[]>([])
  const [newsLoading, setNewsLoading] = useState(true)

  const [modelCosts, setModelCosts] = useState<ModelCost[]>([])

  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [postModalOpen, setPostModalOpen] = useState(false)
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [githubModalOpen, setGithubModalOpen] = useState(false)

  // Fetch posts
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setPosts(mockPosts)
      setPostsLoading(false)
      return
    }
    fetch('/api/posts')
      .then((r) => r.json())
      .then((data) => setPosts(Array.isArray(data) ? data : mockPosts))
      .catch(() => setPosts(mockPosts))
      .finally(() => setPostsLoading(false))
  }, [])

  // Fetch news with auto-refresh
  const fetchNews = useCallback(() => {
    fetch('/api/news')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setNews(data.slice(0, 6)) })
      .catch(() => {})
      .finally(() => setNewsLoading(false))
  }, [])

  useEffect(() => {
    fetchNews()
    const interval = setInterval(fetchNews, NEWS_REFRESH_MS)
    return () => clearInterval(interval)
  }, [fetchNews])

  // Fetch model costs
  useEffect(() => {
    fetch('/api/model-costs')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setModelCosts(data) })
      .catch(() => {})
  }, [])

  // Supabase Realtime: new posts appear without page refresh
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return
    let cleanup: (() => void) | undefined

    async function subscribe() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const channel = supabase
        .channel('public:posts')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'posts' },
          () => {
            // Re-fetch the latest posts when a new one arrives
            fetch('/api/posts')
              .then((r) => r.json())
              .then((data) => { if (Array.isArray(data)) setPosts(data) })
              .catch(() => {})
          }
        )
        .subscribe()

      cleanup = () => { supabase.removeChannel(channel) }
    }

    subscribe()
    return () => { cleanup?.() }
  }, [])

  function handleGitHubRepoCreated(project: Project | null) {
    if (project) {
      // Refresh projects list is handled by the Projects page; here just close modal
    }
  }

  return (
    <>
      <TopBar
        title="Dashboard"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setGithubModalOpen(true)}>
              <GitBranch size={14} />
              New repo
            </Button>
            <Button size="sm" onClick={() => setPostModalOpen(true)}>
              New post
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-3 gap-8">

          {/* Left column — feed */}
          <div className="col-span-2 flex flex-col gap-5">
            <OnboardingCard />

            {/* Feed header */}
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
                  <PostCard key={post.id} post={post} onClick={() => setSelectedPost(post)} />
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
                onCreateProject={() => setProjectModalOpen(true)}
                onCreatePost={() => setPostModalOpen(true)}
                onInviteMember={() => setInviteModalOpen(true)}
              />
            </div>

            {/* AI / Dev News */}
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Newspaper size={13} className="text-gray-400 dark:text-gray-500" />
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                  Hacker News
                </h3>
                <button
                  onClick={fetchNews}
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
                  news.map((item, i) => (
                    <div
                      key={item.id}
                      className={`py-3 ${
                        i < news.length - 1
                          ? 'border-b border-gray-50 dark:border-gray-800/60'
                          : ''
                      }`}
                    >
                      <a
                        href={item.url ?? `https://news.ycombinator.com/item?id=${item.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-2"
                      >
                        {item.title}
                      </a>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {item.score} pts · {timeSince(item.time)}
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
                        className={`text-xs font-semibold rounded-md px-2 py-0.5 ${
                          TIER_COLORS[item.tier]
                        }`}
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
      </div>

      <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />

      <CreatePostModal
        open={postModalOpen}
        onClose={() => setPostModalOpen(false)}
        onCreated={(post) => setPosts((prev) => [post, ...prev])}
        userId={profile?.id ?? ''}
        userProfile={{ name: profile?.name ?? 'User', avatar_url: profile?.avatar_url ?? null }}
      />
      <CreateProjectModal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        onCreated={() => setProjectModalOpen(false)}
        userId={profile?.id ?? ''}
      />
      <InviteMemberModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        userId={profile?.id ?? ''}
      />
      <CreateGitHubRepoModal
        open={githubModalOpen}
        onClose={() => setGithubModalOpen(false)}
        onCreated={handleGitHubRepoCreated}
      />
    </>
  )
}
