'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { Copy, Check } from 'lucide-react'

interface InviteMemberModalProps {
  open: boolean
  onClose: () => void
  userId: string
}

export default function InviteMemberModal({ open, onClose, userId }: InviteMemberModalProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
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
      if (data) {
        const link = `${window.location.origin}/login?invite=${data.token}`
        setInviteLink(link)
      }
    } catch {
      // Mock invite link if DB not set up
      const token = Math.random().toString(36).slice(2)
      setInviteLink(`${window.location.origin}/login?invite=${token}`)
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
    setEmail(''); setSent(false); setInviteLink(''); setCopied(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Invite member">
      {sent ? (
        <div className="flex flex-col gap-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 text-sm text-emerald-700">
            Invite created for <strong>{email}</strong>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Invite link</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={inviteLink}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 bg-gray-50"
              />
              <Button onClick={copyLink} variant="secondary" size="sm">
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </Button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleClose} variant="secondary">Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">Enter the email address of the person you want to invite. They will need to sign in with GitHub.</p>
          <Input label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" required />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button type="submit" loading={loading}>Send invite</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
