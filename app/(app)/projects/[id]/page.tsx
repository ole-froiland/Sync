'use client'

import { use, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TopBar from '@/components/layout/TopBar'
import KanbanBoard from '@/components/projects/KanbanBoard'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useUser } from '@/context/UserContext'
import { mockProjects, mockTasks, mockMessages } from '@/lib/mock-data'
import { STATUS_COLORS, STATUS_LABELS, formatDate } from '@/lib/utils'
import { GitBranch, ExternalLink, ArrowLeft, UserPlus, MessageSquare, Send } from 'lucide-react'
import type { Project, Task, Message, Profile } from '@/types'

const SUPABASE_CONFIGURED = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http')

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const profile = useUser()

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [msgInput, setMsgInput] = useState('')
  const [joinRequested, setJoinRequested] = useState(false)

  // Fetch project
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      queueMicrotask(() => {
        const mock = mockProjects.find((p) => p.id === id) ?? mockProjects[0]
        setProject(mock)
        setTasks(mockTasks.filter((t) => t.project_id === mock.id))
        setMessages(mockMessages.filter((m) => m.project_id === mock.id))
        setLoading(false)
      })
      return
    }

    async function load() {
      try {
        const [projRes, tasksRes, msgsRes] = await Promise.all([
          fetch('/api/projects').then((r) => r.json()),
          fetch(`/api/tasks?project_id=${id}`).then((r) => r.json()),
          fetch(`/api/messages?project_id=${id}`).then((r) => r.json()),
        ])

        const projectList = Array.isArray(projRes) ? projRes : []
        const found = projectList.find((p: Project) => p.id === id)
        if (found) {
          const members = (found.members ?? []).map((m: { profile: Profile }) => m.profile).filter(Boolean)
          setProject({ ...found, members, member_count: members.length })
        }

        setTasks(Array.isArray(tasksRes) ? tasksRes : [])
        setMessages(Array.isArray(msgsRes) ? msgsRes : [])
      } catch {
        // fallback to mock
        const mock = mockProjects[0]
        setProject(mock)
        setTasks(mockTasks.filter((t) => t.project_id === mock.id))
        setMessages(mockMessages.filter((m) => m.project_id === mock.id))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // Realtime subscription for project discussion
  const fetchMessages = useCallback(() => {
    if (!SUPABASE_CONFIGURED) return
    fetch(`/api/messages?project_id=${id}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setMessages(data) })
      .catch(() => {})
  }, [id])

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return
    let cleanup: (() => void) | undefined

    async function subscribe() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const channel = supabase
        .channel(`project-messages:${id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `project_id=eq.${id}` },
          () => { fetchMessages() }
        )
        .subscribe()
      cleanup = () => { supabase.removeChannel(channel) }
    }

    subscribe()
    return () => { cleanup?.() }
  }, [id, fetchMessages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!msgInput.trim() || !profile) return

    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      project_id: id,
      sender_id: profile.id,
      body: msgInput,
      created_at: new Date().toISOString(),
      sender: profile,
    }
    setMessages((prev) => [...prev, optimistic])
    const sent = msgInput
    setMsgInput('')

    if (SUPABASE_CONFIGURED) {
      try {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: id, body: sent }),
        })
        if (res.ok) {
          const saved = await res.json()
          setMessages((prev) =>
            prev.map((m) => (m.id === optimistic.id ? { ...saved, sender: profile } : m))
          )
        }
      } catch {}
    }
  }

  if (loading) {
    return (
      <>
        <TopBar title="Project" />
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 flex flex-col gap-6">
              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5 flex flex-col gap-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5 flex flex-col gap-3">
                <Skeleton className="h-4 w-20" />
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!project) {
    return (
      <>
        <TopBar title="Project not found" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 mb-4">This project does not exist.</p>
            <Link href="/projects" className="text-indigo-600 text-sm hover:underline">
              ← Back to projects
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar
        title={project.name}
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setJoinRequested(true)}
            disabled={joinRequested}
          >
            <UserPlus size={14} />
            {joinRequested ? 'Requested' : 'Request to join'}
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> All projects
        </Link>

        <div className="grid grid-cols-3 gap-6">
          {/* Main */}
          <div className="col-span-2 flex flex-col gap-6">
            {/* Header card */}
            <Card>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {project.name}
                    </h2>
                    <Badge className={STATUS_COLORS[project.status]}>
                      {STATUS_LABELS[project.status]}
                    </Badge>
                  </div>
                  {project.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                      {project.description}
                    </p>
                  )}
                </div>
              </div>
              {project.tech_stack && project.tech_stack.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {project.tech_stack.map((t) => (
                    <span
                      key={t}
                      className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-md px-2 py-0.5"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </Card>

            {/* Kanban */}
            <Card>
              <KanbanBoard
                tasks={tasks}
                projectId={project.id}
                userId={profile?.id ?? ''}
                members={project.members ?? []}
                onTasksChange={setTasks}
              />
            </Card>

            {/* Discussion */}
            <Card padding="none" className="overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                <MessageSquare size={15} className="text-gray-400 dark:text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Discussion
                </h3>
              </div>
              <div className="flex flex-col gap-3 p-5 max-h-72 overflow-y-auto">
                {messages.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">
                    No messages yet. Start the conversation.
                  </p>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className="flex items-start gap-3">
                    <Avatar name={msg.sender?.name ?? 'User'} src={msg.sender?.avatar_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                          {msg.sender?.name ?? 'User'}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {msg.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <form
                onSubmit={sendMessage}
                className="border-t border-gray-100 dark:border-gray-800 p-3 flex gap-2"
              >
                <input
                  value={msgInput}
                  onChange={(e) => setMsgInput(e.target.value)}
                  placeholder="Send a message..."
                  className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                />
                <Button type="submit" size="sm">
                  <Send size={14} />
                </Button>
              </form>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
            {/* Members */}
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Members
              </h3>
              <div className="flex flex-col gap-2">
                {(project.members ?? []).length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500">No members yet</p>
                ) : (
                  (project.members ?? []).map((m) => (
                    <div key={m.id} className="flex items-center gap-2.5">
                      <Avatar name={m.name} src={m.avatar_url} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {m.name}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                          {m.role ?? 'Member'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Links */}
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Links</h3>
              <div className="flex flex-col gap-2">
                {project.github_url ? (
                  <a
                    href={project.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  >
                    <GitBranch size={15} className="text-gray-400" /> GitHub
                  </a>
                ) : (
                  <span className="text-sm text-gray-300 dark:text-gray-600 flex items-center gap-2">
                    <GitBranch size={15} /> No GitHub repo
                  </span>
                )}
                {project.demo_url ? (
                  <a
                    href={project.demo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  >
                    <ExternalLink size={15} className="text-gray-400" /> Live demo
                  </a>
                ) : (
                  <span className="text-sm text-gray-300 dark:text-gray-600 flex items-center gap-2">
                    <ExternalLink size={15} /> No demo yet
                  </span>
                )}
              </div>
            </Card>

            {/* Stats */}
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Stats</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Tasks', value: tasks.length },
                  { label: 'Done', value: tasks.filter((t) => t.status === 'done').length },
                  { label: 'Members', value: project.member_count ?? 0 },
                  { label: 'Messages', value: messages.length },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center"
                  >
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
