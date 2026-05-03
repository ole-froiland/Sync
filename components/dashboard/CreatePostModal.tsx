'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import type { Post } from '@/types'

interface CreatePostModalProps {
  open: boolean
  onClose: () => void
  onCreated: (post: Post) => void
  userId: string
  userProfile: { name: string; avatar_url: string | null }
}

export default function CreatePostModal({
  open,
  onClose,
  onCreated,
  userId,
  userProfile,
}: CreatePostModalProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState<Post['type']>('update')
  const [sourceUrl, setSourceUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          type,
          source_url: sourceUrl || null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        onCreated({
          ...data,
          author: data.author ?? {
            id: userId,
            name: userProfile.name,
            avatar_url: userProfile.avatar_url,
            email: '',
            role: null,
            tools_used: null,
            created_at: '',
          },
        })
        reset()
        onClose()
        return
      }
    } catch {}

    // Mock fallback (Supabase not configured)
    const mockIdBase = title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const mockPostId = `post-${mockIdBase || 'draft'}-${body.length}`
    const mockPost: Post = {
      id: mockPostId,
      author_id: userId,
      title,
      body,
      type,
      source_url: sourceUrl || null,
      created_at: new Date().toISOString(),
      author: {
        id: userId,
        name: userProfile.name,
        first_name: null,
        last_name: null,
        username: null,
        selected_avatar: null,
        avatar_url: userProfile.avatar_url,
        email: '',
        role: null,
        tools_used: null,
        onboarding_completed: true,
        created_at: '',
      },
    }
    onCreated(mockPost)
    reset()
    onClose()
  }

  function reset() {
    setTitle('')
    setBody('')
    setType('update')
    setSourceUrl('')
    setError(null)
    setLoading(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Create post">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value as Post['type'])}
          options={[
            { value: 'update', label: 'Update' },
            { value: 'news', label: 'News' },
            { value: 'question', label: 'Question' },
            { value: 'resource', label: 'Resource' },
          ]}
        />
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's on your mind?"
          required
        />
        <Textarea
          label="Body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write something..."
          rows={4}
          required
        />
        <Input
          label="Source URL (optional)"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://..."
        />
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Post
          </Button>
        </div>
      </form>
    </Modal>
  )
}
