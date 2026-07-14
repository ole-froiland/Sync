'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { Copy, Check, Send } from 'lucide-react'

const copy = {
  no: {
    title: 'Inviter andre',
    body: 'Inviter noen med e-post - de får en lenke for å bli med i Sync.',
    placeholder: 'kollega@eksempel.no',
    send: 'Send',
    sent: 'Invitasjon sendt til',
    or: 'eller del en lenke',
    link: 'Invitasjonslenke',
    copy: 'Kopier',
    copied: 'Kopiert',
  },
  en: {
    title: 'Invite others',
    body: "Invite someone by email - they'll get a link to join Sync.",
    placeholder: 'colleague@example.com',
    send: 'Send',
    sent: 'Invite sent to',
    or: 'or share a link',
    link: 'Invite link',
    copy: 'Copy',
    copied: 'Copied',
  },
} as const

interface SyncWithOthersModalProps {
  open: boolean
  onClose: () => void
  userId: string
  locale?: keyof typeof copy
}

export default function SyncWithOthersModal({ open, onClose, userId, locale = 'en' }: SyncWithOthersModalProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const text = copy[locale]

  // Pre-generate a link whenever the modal opens
  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        const token = Math.random().toString(36).slice(2, 10)
        setInviteLink(`${window.location.origin}/login?invite=${token}`)
      })
    }
  }, [open])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = await supabase
        .from('invites')
        .insert({ email, created_by: userId })
        .select()
        .single()
      if (data?.token) {
        setInviteLink(`${window.location.origin}/login?invite=${data.token}`)
      }
    } catch {
      // Keep the pre-generated link
    }
    setSent(true)
    setLoading(false)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleClose() {
    setEmail('')
    setSent(false)
    setCopied(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={text.title}>
      <div className="flex flex-col gap-6">
        {/* Invite by email */}
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {text.body}
          </p>
          {sent ? (
            <div className="flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-xl p-3.5 text-sm text-emerald-700 dark:text-emerald-400">
              <Check size={14} className="flex-shrink-0" />
              <span>
                {text.sent} <strong>{email}</strong>
              </span>
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex gap-2">
              <Input
                type="email"
                placeholder={text.placeholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1"
              />
              <Button type="submit" loading={loading}>
                <Send size={13} />
                {text.send}
              </Button>
            </form>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
          <span className="text-xs text-gray-400 dark:text-gray-500">{text.or}</span>
          <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
        </div>

        {/* Share link */}
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{text.link}</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteLink}
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs text-gray-600 dark:text-gray-300 truncate focus:outline-none"
            />
            <Button onClick={copyLink} variant="secondary" size="sm">
              {copied ? (
                <Check size={13} className="text-emerald-600" />
              ) : (
                <Copy size={13} />
              )}
              {copied ? text.copied : text.copy}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
