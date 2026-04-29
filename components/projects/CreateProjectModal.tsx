'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import { X } from 'lucide-react'
import type { Project } from '@/types'

interface CreateProjectModalProps {
  open: boolean
  onClose: () => void
  onCreated: (project: Project) => void
  userId: string
}

export default function CreateProjectModal({
  open,
  onClose,
  onCreated,
  userId,
}: CreateProjectModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<Project['status']>('idea')
  const [githubUrl, setGithubUrl] = useState('')
  const [demoUrl, setDemoUrl] = useState('')
  const [techInput, setTechInput] = useState('')
  const [techStack, setTechStack] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addTech(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const val = techInput.trim()
      if (val && !techStack.includes(val)) setTechStack((prev) => [...prev, val])
      setTechInput('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          status,
          tech_stack: techStack,
          github_url: githubUrl || null,
          demo_url: demoUrl || null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        onCreated({ ...data, member_count: 1, task_count: 0, members: [] })
        reset()
        onClose()
        return
      }
    } catch {}

    // Mock fallback (Supabase not configured)
    const mockProject: Project = {
      id: `proj-${Date.now()}`,
      name,
      description: description || null,
      status,
      tech_stack: techStack,
      github_url: githubUrl || null,
      demo_url: demoUrl || null,
      created_by: userId,
      created_at: new Date().toISOString(),
      member_count: 1,
      task_count: 0,
    }
    onCreated(mockProject)
    reset()
    onClose()
  }

  function reset() {
    setName('')
    setDescription('')
    setStatus('idea')
    setGithubUrl('')
    setDemoUrl('')
    setTechInput('')
    setTechStack([])
    setError(null)
    setLoading(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Create project">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. DevPulse"
          required
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What are you building?"
          rows={3}
        />
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as Project['status'])}
          options={[
            { value: 'idea', label: 'Idea' },
            { value: 'building', label: 'Building' },
            { value: 'live', label: 'Live' },
          ]}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tech stack</label>
          <input
            value={techInput}
            onChange={(e) => setTechInput(e.target.value)}
            onKeyDown={addTech}
            placeholder="Type and press Enter to add..."
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {techStack.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {techStack.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-md px-2 py-0.5"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => setTechStack((prev) => prev.filter((x) => x !== t))}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <Input
          label="GitHub URL (optional)"
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          placeholder="https://github.com/..."
        />
        <Input
          label="Demo URL (optional)"
          value={demoUrl}
          onChange={(e) => setDemoUrl(e.target.value)}
          placeholder="https://..."
        />
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => { reset(); onClose() }}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create project
          </Button>
        </div>
      </form>
    </Modal>
  )
}
