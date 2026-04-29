'use client'

import { useState } from 'react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import { Plus, GripVertical } from 'lucide-react'
import type { Task, Profile } from '@/types'
import { cn } from '@/lib/utils'

const SUPABASE_CONFIGURED = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http')

const COLUMNS: { key: Task['status']; label: string; color: string }[] = [
  { key: 'todo', label: 'To do', color: 'bg-gray-100 text-gray-600' },
  { key: 'in_progress', label: 'In progress', color: 'bg-blue-100 text-blue-700' },
  { key: 'done', label: 'Done', color: 'bg-emerald-100 text-emerald-700' },
]

interface KanbanBoardProps {
  tasks: Task[]
  projectId: string
  userId: string
  members: Profile[]
  onTasksChange?: (tasks: Task[]) => void
}

function TaskCard({
  task,
  onMove,
}: {
  task: Task
  onMove: (id: string, status: Task['status']) => void
}) {
  const nextStatus: Record<Task['status'], Task['status'] | null> = {
    todo: 'in_progress',
    in_progress: 'done',
    done: null,
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow group cursor-grab active:cursor-grabbing">
      <div className="flex items-start gap-2">
        <GripVertical
          size={14}
          className="text-gray-200 dark:text-gray-700 group-hover:text-gray-300 mt-0.5 flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-900 dark:text-gray-100 leading-snug">
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-2">
              {task.description}
            </p>
          )}
          <div className="flex items-center justify-between mt-2">
            {task.assignee ? (
              <div className="flex items-center gap-1.5">
                <Avatar name={task.assignee.name} src={task.assignee.avatar_url} size="xs" />
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {task.assignee.name.split(' ')[0]}
                </span>
              </div>
            ) : (
              <span />
            )}
            {nextStatus[task.status] && (
              <button
                onClick={() => onMove(task.id, nextStatus[task.status]!)}
                className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Move →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function KanbanBoard({
  tasks: initialTasks,
  projectId,
  userId,
  members,
  onTasksChange,
}: KanbanBoardProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newAssignee, setNewAssignee] = useState('')
  const [newStatus, setNewStatus] = useState<Task['status']>('todo')
  const [loading, setLoading] = useState(false)

  function updateTasks(updated: Task[]) {
    setTasks(updated)
    onTasksChange?.(updated)
  }

  async function moveTask(id: string, status: Task['status']) {
    // Optimistic update
    const updated = tasks.map((t) => (t.id === id ? { ...t, status } : t))
    updateTasks(updated)

    if (SUPABASE_CONFIGURED) {
      try {
        await fetch('/api/tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status }),
        })
      } catch {}
    }
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setLoading(true)

    const assignee = members.find((m) => m.id === newAssignee)

    if (SUPABASE_CONFIGURED) {
      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            title: newTitle,
            description: newDesc || null,
            status: newStatus,
            assigned_to: newAssignee || null,
          }),
        })
        if (res.ok) {
          const saved = await res.json()
          const withAssignee = { ...saved, assignee: saved.assignee ?? assignee }
          updateTasks([...tasks, withAssignee])
          resetCreate()
          return
        }
      } catch {}
    }

    // Mock fallback
    const task: Task = {
      id: `t-${Date.now()}`,
      project_id: projectId,
      title: newTitle,
      description: newDesc || null,
      status: newStatus,
      assigned_to: newAssignee || null,
      created_by: userId,
      created_at: new Date().toISOString(),
      assignee,
    }
    updateTasks([...tasks, task])
    resetCreate()
  }

  function resetCreate() {
    setNewTitle('')
    setNewDesc('')
    setNewAssignee('')
    setNewStatus('todo')
    setLoading(false)
    setCreateOpen(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Tasks</h2>
        <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Add task
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {COLUMNS.map(({ key, label, color }) => {
          const col = tasks.filter((t) => t.status === key)
          return (
            <div key={key} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={color}>{label}</Badge>
                <span className="text-xs text-gray-400 dark:text-gray-500">{col.length}</span>
              </div>
              <div
                className={cn(
                  'flex flex-col gap-2 min-h-[120px] rounded-xl p-2',
                  key === 'todo'
                    ? 'bg-gray-50 dark:bg-gray-800/30'
                    : key === 'in_progress'
                    ? 'bg-blue-50/40 dark:bg-blue-950/20'
                    : 'bg-emerald-50/40 dark:bg-emerald-950/20'
                )}
              >
                {col.map((task) => (
                  <TaskCard key={task.id} task={task} onMove={moveTask} />
                ))}
                {col.length === 0 && (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-xs text-gray-300 dark:text-gray-600">No tasks</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Modal open={createOpen} onClose={resetCreate} title="Add task">
        <form onSubmit={createTask} className="flex flex-col gap-4">
          <Input
            label="Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Task title"
            required
          />
          <Textarea
            label="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            rows={3}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as Task['status'])}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
          </div>
          {members.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Assign to
              </label>
              <select
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={resetCreate}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Add task
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
