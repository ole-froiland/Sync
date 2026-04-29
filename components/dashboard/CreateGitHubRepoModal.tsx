'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import { GitBranch, CheckCircle, ExternalLink } from 'lucide-react'
import { useGitHub } from '@/context/GitHubContext'
import type { Project } from '@/types'

interface CreateGitHubRepoModalProps {
  open: boolean
  onClose: () => void
  onCreated: (project: Project | null) => void
}

export default function CreateGitHubRepoModal({
  open,
  onClose,
  onCreated,
}: CreateGitHubRepoModalProps) {
  const github = useGitHub()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ name: string; url: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/github/create-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          private: visibility === 'private',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to create repository')
        setLoading(false)
        return
      }

      setCreated({ name: data.repo.full_name, url: data.repo.html_url })
      onCreated(data.project)
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  function reset() {
    setName('')
    setDescription('')
    setVisibility('public')
    setError(null)
    setCreated(null)
    setLoading(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create GitHub Repository">
      {/* Success state */}
      {created ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <CheckCircle size={40} className="text-green-500" />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Repository created!
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Also added to your Projects list.
            </p>
          </div>
          <a
            href={created.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {created.name}
            <ExternalLink size={13} />
          </a>
          <Button variant="secondary" size="sm" onClick={handleClose}>
            Close
          </Button>
        </div>
      ) : !github.connected ? (
        /* GitHub not connected */
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <GitBranch size={22} className="text-gray-400 dark:text-gray-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Connect your GitHub account
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs">
              Link your GitHub to create repositories directly from Sync. Your token is stored
              securely and never exposed to the browser.
            </p>
          </div>
          <a href="/api/github/connect">
            <Button>
              <GitBranch size={14} />
              Connect GitHub
            </Button>
          </a>
        </div>
      ) : (
        /* Form */
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2.5">
            <GitBranch size={13} />
            <span>
              Creating as{' '}
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {github.login}
              </span>{' '}
              via GitHub OAuth
            </span>
          </div>

          <Input
            label="Repository name"
            value={name}
            onChange={(e) => setName(e.target.value.replace(/\s+/g, '-'))}
            placeholder="my-awesome-project"
            required
          />
          <Textarea
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project for?"
            rows={2}
          />
          <Select
            label="Visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
            options={[
              { value: 'public', label: 'Public — anyone can see this' },
              { value: 'private', label: 'Private — only you can see this' },
            ]}
          />

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Create repository
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
