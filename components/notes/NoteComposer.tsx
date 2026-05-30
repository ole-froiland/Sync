'use client'

import { FormEvent, useState } from 'react'
import { Send } from 'lucide-react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

type Props = {
  onAdd: (title: string) => Promise<void>
  placeholder?: string
}

export default function NoteComposer({ onAdd, placeholder = 'Write a note…' }: Props) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      await onAdd(trimmed)
      setValue('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1"
      />
      <Button type="submit" size="sm" disabled={!value.trim() || submitting} aria-label="Add note">
        <Send size={14} />
      </Button>
    </form>
  )
}
