'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import SyncWithOthersModal from '@/components/how-to-sync/SyncWithOthersModal'
import Button from '@/components/ui/Button'
import { useUser } from '@/context/UserContext'
import {
  GitBranch,
  FolderKanban,
  Users,
  MessageSquare,
  ArrowRight,
  Copy,
  Check,
  Handshake,
} from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: GitBranch,
    title: 'Connect GitHub',
    description: 'Link your repositories so your code, projects, and team stay in one place.',
  },
  {
    number: '02',
    icon: FolderKanban,
    title: 'Create a project',
    description: 'Organize your work into projects. Add tasks, track progress, and set goals.',
  },
  {
    number: '03',
    icon: Users,
    title: 'Sync with others',
    description: 'Invite your team. Share updates, ask questions, and build things together.',
  },
]

const flowNodes = [
  { icon: GitBranch, label: 'Repository' },
  { icon: FolderKanban, label: 'Project' },
  { icon: Users, label: 'Collaborate' },
  { icon: MessageSquare, label: 'Chat' },
]

export default function HowToSyncPage() {
  const profile = useUser()
  const [modalOpen, setModalOpen] = useState(false)
  const [activeFlow, setActiveFlow] = useState(0)
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)

  // Cycle through the flow animation
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFlow((prev) => (prev + 1) % flowNodes.length)
    }, 900)
    return () => clearInterval(interval)
  }, [])

  // Generate a share link on mount
  useEffect(() => {
    queueMicrotask(() => {
      const token = Math.random().toString(36).slice(2, 10)
      setInviteLink(`${window.location.origin}/login?invite=${token}`)
    })
  }, [])

  async function copyInviteLink() {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <TopBar title="How to Sync" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-16">

          {/* ── Hero ── */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl mb-6">
              <Handshake size={22} className="text-indigo-500" />
            </div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-3">
              How to Sync
            </h1>
            <p className="text-base text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
              Work better together by syncing projects, repositories and conversations.
            </p>
          </div>

          {/* ── 3-step guide ── */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            {steps.map((step) => (
              <div
                key={step.number}
                className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 flex flex-col gap-4 hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm transition-all"
              >
                <span className="text-3xl font-bold text-gray-100 dark:text-gray-800 leading-none select-none">
                  {step.number}
                </span>
                <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl flex items-center justify-center">
                  <step.icon size={17} className="text-indigo-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {step.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Primary CTA ── */}
          <div className="flex justify-center mb-16">
            <Button size="lg" onClick={() => setModalOpen(true)}>
              <Users size={16} />
              Sync with others
            </Button>
          </div>

          {/* ── Divider ── */}
          <div className="border-t border-gray-100 dark:border-gray-800 mb-12" />

          {/* ── Invite section ── */}
          <div className="mb-16">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Invite others to Sync
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Share this link to bring your team into Sync.
            </p>
            <div className="flex gap-2 max-w-md">
              <input
                readOnly
                value={inviteLink}
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs text-gray-600 dark:text-gray-300 truncate focus:outline-none"
              />
              <Button onClick={copyInviteLink} variant="secondary" size="sm">
                {copied ? (
                  <Check size={13} className="text-emerald-600" />
                ) : (
                  <Copy size={13} />
                )}
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
          </div>

          {/* ── Visual flow ── */}
          <div className="border-t border-gray-100 dark:border-gray-800 pt-12">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center mb-8">
              The Sync flow
            </p>
            <div className="flex items-center justify-center gap-0">
              {flowNodes.map((node, i) => (
                <div key={node.label} className="flex items-center">
                  <div className="flex flex-col items-center gap-3 px-4">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                        activeFlow === i
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 scale-110 shadow-sm'
                          : 'bg-gray-50 dark:bg-gray-800/60 scale-100'
                      }`}
                    >
                      <node.icon
                        size={19}
                        className={`transition-colors duration-500 ${
                          activeFlow === i
                            ? 'text-indigo-500'
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      />
                    </div>
                    <span
                      className={`text-xs font-medium transition-colors duration-500 ${
                        activeFlow === i
                          ? 'text-gray-700 dark:text-gray-300'
                          : 'text-gray-300 dark:text-gray-600'
                      }`}
                    >
                      {node.label}
                    </span>
                  </div>

                  {i < flowNodes.length - 1 && (
                    <ArrowRight
                      size={14}
                      className={`flex-shrink-0 transition-colors duration-500 ${
                        activeFlow === i
                          ? 'text-indigo-300 dark:text-indigo-700'
                          : 'text-gray-200 dark:text-gray-800'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      <SyncWithOthersModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        userId={profile?.id ?? ''}
      />
    </>
  )
}
