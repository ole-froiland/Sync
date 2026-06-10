'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/layout/TopBar'
import PostDetailModal from '@/components/dashboard/PostDetailModal'
import FeedView from '@/components/dashboard/views/FeedView'
import DiscoverView from '@/components/dashboard/views/DiscoverView'
import TrendingView from '@/components/dashboard/views/TrendingView'
import type { Post, FeedItem } from '@/types'

const SUPABASE_CONFIGURED = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http')
const NEWS_REFRESH_MS = 5 * 60 * 1000

type Tab = 'feed' | 'discover' | 'trending'

const TABS: { id: Tab; label: string }[] = [
  { id: 'feed', label: 'Feed' },
  { id: 'discover', label: 'Discover' },
  { id: 'trending', label: 'Trending' },
]

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('feed')
  const [tabReady, setTabReady] = useState(false)

  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [postsError, setPostsError] = useState(false)

  const [news, setNews] = useState<FeedItem[]>([])
  const [newsLoading, setNewsLoading] = useState(true)

  const [selectedPost, setSelectedPost] = useState<Post | null>(null)

  // Hydrate tab from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    queueMicrotask(() => {
      const saved = localStorage.getItem('dashboard-tab') as Tab | null
      if (saved && ['feed', 'discover', 'trending'].includes(saved)) {
        setActiveTab(saved)
      }
      setTabReady(true)
    })
  }, [])

  function handleTabChange(tab: Tab) {
    setActiveTab(tab)
    localStorage.setItem('dashboard-tab', tab)
  }

  const fetchPosts = useCallback(() => {
    setPostsLoading(true)
    setPostsError(false)
    fetch('/api/posts')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load posts')
        return r.json()
      })
      .then((data) => setPosts(Array.isArray(data) ? data : []))
      .catch(() => setPostsError(true))
      .finally(() => setPostsLoading(false))
  }, [])

  // Fetch posts
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      queueMicrotask(() => {
        setPosts([])
        setPostsLoading(false)
      })
      return
    }
    queueMicrotask(fetchPosts)
  }, [fetchPosts])

  const fetchNews = useCallback(() => {
    fetch('/api/news')
      .then((r) => r.json())
      .then((data) => {
        setNews(Array.isArray(data) ? (data as FeedItem[]) : [])
      })
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false))
  }, [])

  useEffect(() => {
    fetchNews()
    const interval = setInterval(fetchNews, NEWS_REFRESH_MS)
    return () => clearInterval(interval)
  }, [fetchNews])

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
            fetch('/api/posts')
              .then((r) => r.json())
              .then((data) => {
                if (Array.isArray(data)) setPosts(data)
              })
              .catch(() => {})
          }
        )
        .subscribe()

      cleanup = () => {
        supabase.removeChannel(channel)
      }
    }

    subscribe()
    return () => {
      cleanup?.()
    }
  }, [])

  useEffect(() => {
    function handlePostCreated(event: Event) {
      const createdPost = (event as CustomEvent<Post>).detail
      setPosts((prev) => [createdPost, ...prev.filter((post) => post.id !== createdPost.id)])
      setPostsLoading(false)
    }

    window.addEventListener('sync:post-created', handlePostCreated as EventListener)
    return () => window.removeEventListener('sync:post-created', handlePostCreated as EventListener)
  }, [])

  return (
    <>
      <TopBar title="Dashboard" />

      <div className="flex-1 overflow-y-auto">
        {/* Tab navigation */}
        <div className="px-6 sticky top-0 bg-gray-50 dark:bg-gray-950 z-10">
          <nav className="flex items-center max-w-5xl mx-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`relative px-4 py-3.5 text-sm font-medium transition-colors ${
                  tabReady && activeTab === tab.id
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400'
                }`}
              >
                {tab.label}
                {tabReady && activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 dark:bg-gray-100 rounded-t" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* View content with fade transition */}
        <div key={activeTab} className="view-transition">
          {activeTab === 'feed' && (
            <FeedView
              posts={posts}
              postsLoading={postsLoading}
              postsError={postsError}
              onRetry={fetchPosts}
              onPostClick={setSelectedPost}
            />
          )}
          {activeTab === 'discover' && <DiscoverView news={news} newsLoading={newsLoading} />}
          {activeTab === 'trending' && <TrendingView />}
        </div>
      </div>

      <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />
    </>
  )
}
