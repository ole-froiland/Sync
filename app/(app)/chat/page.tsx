'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import TopBar from '@/components/layout/TopBar'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useUser } from '@/context/UserContext'
import { mockProjects, mockMessages } from '@/lib/mock-data'
import { formatDate, cn } from '@/lib/utils'
import { Hash, Send } from 'lucide-react'
import type { Message, Project } from '@/types'

const SUPABASE_CONFIGURED = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http')

export default function ChatPage() {
  const profile = useUser()

  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [activeProjectId, setActiveProjectId] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load projects
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setProjects(mockProjects)
      setActiveProjectId(mockProjects[0]?.id ?? '')
      setProjectsLoading(false)
      return
    }
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : mockProjects
        setProjects(list)
        setActiveProjectId(list[0]?.id ?? '')
      })
      .catch(() => {
        setProjects(mockProjects)
        setActiveProjectId(mockProjects[0]?.id ?? '')
      })
      .finally(() => setProjectsLoading(false))
  }, [])

  // Fetch messages for active project
  const fetchMessages = useCallback((projectId: string) => {
    if (!projectId) return
    if (!SUPABASE_CONFIGURED) {
      setMessages(mockMessages.filter((m) => m.project_id === projectId))
      return
    }
    setMessagesLoading(true)
    fetch(`/api/messages?project_id=${projectId}`)
      .then((r) => r.json())
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .catch(() => setMessages([]))
      .finally(() => setMessagesLoading(false))
  }, [])

  useEffect(() => {
    fetchMessages(activeProjectId)
  }, [activeProjectId, fetchMessages])

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Supabase Realtime subscription for new messages
  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !activeProjectId) return
    let cleanup: (() => void) | undefined

    async function subscribe() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const channel = supabase
        .channel(`messages:${activeProjectId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `project_id=eq.${activeProjectId}`,
          },
          (payload) => {
            const incoming = payload.new as Message
            // Skip if already added optimistically (same sender as current user)
            setMessages((prev) => {
              if (prev.some((m) => m.id === incoming.id)) return prev
              // Re-fetch to get sender profile
              fetchMessages(activeProjectId)
              return prev
            })
          }
        )
        .subscribe()

      cleanup = () => { supabase.removeChannel(channel) }
    }

    subscribe()
    return () => { cleanup?.() }
  }, [activeProjectId, fetchMessages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || !activeProjectId || !profile) return

    // Optimistic update
    const optimisticMsg: Message = {
      id: `opt-${Date.now()}`,
      project_id: activeProjectId,
      sender_id: profile.id,
      body: input,
      created_at: new Date().toISOString(),
      sender: profile,
    }
    setMessages((prev) => [...prev, optimisticMsg])
    const sent = input
    setInput('')

    try {
      if (SUPABASE_CONFIGURED) {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: activeProjectId, body: sent }),
        })
        if (res.ok) {
          const saved = await res.json()
          // Replace optimistic message with persisted one
          setMessages((prev) =>
            prev.map((m) => (m.id === optimisticMsg.id ? { ...saved, sender: profile } : m))
          )
        }
      }
    } catch {
      // optimistic message stays visible; silently fail
    }
  }

  const activeProject = projects.find((p) => p.id === activeProjectId)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Channel list */}
      <div className="w-56 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Channels
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {projectsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                <Skeleton className="w-3 h-3 rounded" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setActiveProjectId(project.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                  activeProjectId === project.id
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                )}
              >
                <Hash size={14} className="flex-shrink-0" />
                <span className="truncate flex-1">{project.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Messages panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeProject && (
          <div className="h-14 border-b border-gray-100 dark:border-gray-800 px-5 flex items-center gap-2 flex-shrink-0 bg-white dark:bg-gray-900">
            <Hash size={16} className="text-gray-400 dark:text-gray-500" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {activeProject.name}
            </span>
            {activeProject.description && (
              <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                — {activeProject.description.slice(0, 60)}
              </span>
            )}
          </div>
        )}

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {messagesLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="flex flex-col gap-1.5 flex-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-16 gap-2">
              <Hash size={32} className="text-gray-200 dark:text-gray-700" />
              <p className="text-sm text-gray-400 dark:text-gray-500">
                No messages yet in #{activeProject?.name}
              </p>
              <p className="text-xs text-gray-300 dark:text-gray-600">Be the first to send one.</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const prevMsg = messages[i - 1]
              const sameAuthor =
                prevMsg?.sender_id === msg.sender_id &&
                new Date(msg.created_at).getTime() -
                  new Date(prevMsg.created_at).getTime() <
                  300000

              return (
                <div key={msg.id} className={cn('flex items-start gap-3', sameAuthor && 'mt-0.5')}>
                  {sameAuthor ? (
                    <div className="w-8 flex-shrink-0" />
                  ) : (
                    <Avatar
                      name={msg.sender?.name ?? 'User'}
                      src={msg.sender?.avatar_url}
                      size="sm"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    {!sameAuthor && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {msg.sender?.name ?? 'User'}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                    )}
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {msg.body}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={sendMessage}
          className="border-t border-gray-100 dark:border-gray-800 p-4 flex gap-3 bg-white dark:bg-gray-900"
        >
          <Avatar name={profile?.name ?? 'You'} src={profile?.avatar_url} size="sm" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={activeProject ? `Message #${activeProject.name}...` : 'Select a channel'}
            disabled={!activeProject}
            className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:bg-white dark:focus:bg-gray-900 transition-colors"
          />
          <Button type="submit" size="md" disabled={!input.trim() || !activeProject}>
            <Send size={15} />
          </Button>
        </form>
      </div>
    </div>
  )
}
