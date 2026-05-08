'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import SyncWithOthersModal from '@/components/how-to-sync/SyncWithOthersModal'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
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
  Sparkles,
  Plus,
} from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: GitBranch,
    title: 'Connect your GitHub',
    description: 'Bring your repositories into Sync and keep code, context, and activity in one place.',
  },
  {
    number: '02',
    icon: FolderKanban,
    title: 'Create your first project',
    description: 'Set up a focused workspace for tasks, milestones, and the work that matters next.',
  },
  {
    number: '03',
    icon: Users,
    title: 'Invite and sync with your team',
    description: 'Share one link, pull everyone in fast, and start collaborating without setup friction.',
  },
]

const flowNodes = [
  { icon: GitBranch, label: 'Connect' },
  { icon: FolderKanban, label: 'Organize' },
  { icon: Users, label: 'Invite' },
  { icon: MessageSquare, label: 'Collaborate' },
]

export default function HowToSyncPage() {
  const profile = useUser()
  const [modalOpen, setModalOpen] = useState(false)
  const [activeFlow, setActiveFlow] = useState(0)
  const [inviteLink, setInviteLink] = useState('')
  const [inviteTarget, setInviteTarget] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFlow((prev) => (prev + 1) % flowNodes.length)
    }, 1100)
    return () => clearInterval(interval)
  }, [])

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

  function handleInviteSubmit() {
    setModalOpen(true)
    setInviteTarget('')
  }

  return (
    <>
      <TopBar
        title="How to Sync"
        className="border-gray-900 bg-[#060816] text-gray-100"
        titleClassName="text-gray-100"
      />

      <div className="flex-1 overflow-y-auto bg-[#060816] text-gray-100">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-10 md:px-8 md:py-14">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/8 bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.2),_transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(4,6,20,0.98))] px-6 py-10 shadow-[0_20px_80px_rgba(0,0,0,0.45)] sm:px-8 md:px-12 md:py-14">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(217,70,239,0.12),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.14),transparent_22%)]" />
            <div className="pointer-events-none absolute -left-16 top-12 h-44 w-44 rounded-full bg-fuchsia-500/10 blur-3xl" />
            <div className="pointer-events-none absolute right-0 top-0 h-52 w-52 rounded-full bg-purple-500/10 blur-3xl" />

            <div className="relative hero-entrance">
              <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-purple-200/85">
                <Sparkles size={14} className="text-fuchsia-300" />
                Start your workspace in minutes
              </div>

              <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_360px] lg:items-end">
                <div className="max-w-3xl">
                  <div className="relative mb-7 inline-flex h-18 w-18 items-center justify-center">
                    <div className="absolute inset-0 rounded-[1.75rem] bg-gradient-to-br from-fuchsia-500/35 via-purple-500/25 to-transparent blur-xl" />
                    <div className="relative flex h-18 w-18 items-center justify-center rounded-[1.75rem] border border-white/12 bg-white/[0.06] shadow-[0_0_40px_rgba(192,132,252,0.18)] backdrop-blur">
                      <Handshake size={30} className="text-fuchsia-300" />
                    </div>
                  </div>

                  <h1 className="max-w-2xl text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
                    How to Sync
                  </h1>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-gray-300 sm:text-lg">
                    A clean path from repository to team collaboration. Set things up once, invite the right people,
                    and make Sync feel useful from the first minute.
                  </p>

                  <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                    <Button
                      size="lg"
                      onClick={() => setModalOpen(true)}
                      className="min-h-13 rounded-2xl px-6 text-base font-semibold shadow-[0_0_30px_rgba(217,70,239,0.32)]"
                    >
                      <Users size={18} />
                      Sync with others
                    </Button>
                    <p className="text-sm text-gray-400">Takes less than 10 seconds</p>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur">
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-gray-500">The Sync flow</p>
                  <div className="mt-6 flex flex-col gap-3">
                    {flowNodes.map((node, i) => {
                      const active = activeFlow === i
                      return (
                        <div key={node.label} className="flex items-center gap-4">
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all duration-500 ${
                              active
                                ? 'border-fuchsia-400/40 bg-gradient-to-br from-fuchsia-500/18 to-purple-500/18 text-fuchsia-200 shadow-[0_0_24px_rgba(192,132,252,0.18)]'
                                : 'border-white/8 bg-white/[0.03] text-gray-500'
                            }`}
                          >
                            <node.icon size={18} />
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-medium transition-colors ${active ? 'text-white' : 'text-gray-400'}`}>
                              {node.label}
                            </p>
                            <div className="mt-2 h-px w-full bg-white/6">
                              <div
                                className={`h-px transition-all duration-500 ${
                                  active ? 'w-full bg-gradient-to-r from-fuchsia-400/80 to-purple-400/50' : 'w-0 bg-transparent'
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="relative">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-gray-500">Three simple steps</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
                  Build momentum, not setup overhead
                </h2>
              </div>
            </div>

            <div className="relative hidden md:block">
              <div className="pointer-events-none absolute left-[16.5%] right-[16.5%] top-12 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {steps.map((step, index) => (
                <div
                  key={step.number}
                  className={`group relative overflow-hidden rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-[1px] transition-all duration-300 hover:-translate-y-1 hover:border-fuchsia-400/20 hover:shadow-[0_18px_50px_rgba(0,0,0,0.38)] ${
                    index === 1 ? 'md:translate-y-6' : index === 2 ? 'md:translate-y-12' : ''
                  }`}
                >
                  <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(217,70,239,0.18),transparent_32%,transparent_68%,rgba(168,85,247,0.18))]" />
                  </div>
                  <div className="relative flex h-full min-h-[280px] flex-col rounded-[1.7rem] border border-white/6 bg-[#0b1020] px-6 py-7">
                    <span className="pointer-events-none absolute right-5 top-4 text-7xl font-semibold tracking-[-0.08em] text-white/[0.05]">
                      {step.number}
                    </span>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-fuchsia-300 transition-all duration-300 group-hover:border-fuchsia-400/30 group-hover:bg-fuchsia-500/10 group-hover:shadow-[0_0_24px_rgba(192,132,252,0.14)]">
                      <step.icon size={22} />
                    </div>
                    <div className="mt-8 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-gray-500">
                      <span>{step.number}</span>
                      <span className="h-px flex-1 bg-white/8" />
                    </div>
                    <div className="mt-5 space-y-3">
                      <h3 className="max-w-[15rem] text-xl font-semibold tracking-[-0.03em] text-white">
                        {step.title}
                      </h3>
                      <p className="max-w-[18rem] text-sm leading-6 text-gray-400">{step.description}</p>
                    </div>
                    <div className="mt-auto pt-8">
                      <div className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors duration-300 group-hover:text-fuchsia-200">
                        Continue
                        <ArrowRight size={15} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.28)] sm:p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-gray-500">Invite others</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
                    Invite teammates and start collaborating instantly
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-gray-400">
                    Share your invite link or type a username or email to get the team into Sync without a long setup flow.
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-full border border-white/8 bg-white/[0.03] px-3 py-2">
                  {profile ? <Avatar name={profile.name} src={profile.avatar_url} size="sm" /> : null}
                  <span className="text-sm text-gray-400">Workspace owner</span>
                </div>
              </div>

              <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
                <div className="rounded-2xl border border-white/8 bg-[#0a0f1d] p-4">
                  <label className="mb-3 block text-xs font-medium uppercase tracking-[0.22em] text-gray-500">
                    Invite link
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      readOnly
                      value={inviteLink}
                      className="min-h-12 flex-1 rounded-xl border border-white/8 bg-white/[0.03] px-4 text-sm text-gray-300 outline-none"
                    />
                    <Button
                      onClick={copyInviteLink}
                      variant="secondary"
                      className="min-h-12 rounded-xl border-white/10 bg-white/[0.05] px-4 text-gray-100 hover:bg-white/[0.08]"
                    >
                      {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                      {copied ? 'Copied' : 'Copy link'}
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-[#0a0f1d] p-4">
                  <label
                    htmlFor="invite-target"
                    className="mb-3 block text-xs font-medium uppercase tracking-[0.22em] text-gray-500"
                  >
                    Username or email
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      id="invite-target"
                      value={inviteTarget}
                      onChange={(e) => setInviteTarget(e.target.value)}
                      placeholder="@teammate or name@company.com"
                      className="min-h-12 flex-1 rounded-xl border border-white/8 bg-white/[0.03] px-4 text-sm text-gray-200 outline-none placeholder:text-gray-600 focus:border-fuchsia-400/30"
                    />
                    <Button
                      onClick={handleInviteSubmit}
                      className="min-h-12 rounded-xl px-4 text-sm font-semibold shadow-[0_0_24px_rgba(217,70,239,0.22)]"
                    >
                      <Plus size={15} />
                      Send invite
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-gray-500">Ready to go</p>
              <div className="mt-6 rounded-[1.5rem] border border-white/8 bg-[#0a0f1d] p-5">
                <div className="flex items-center gap-3">
                  {profile ? <Avatar name={profile.name} src={profile.avatar_url} size="md" /> : null}
                  <div>
                    <p className="text-sm font-medium text-white">{profile?.name ?? 'Your workspace'}</p>
                    <p className="text-sm text-gray-400">Waiting for your first synced teammate</p>
                  </div>
                </div>

                <div className="mt-6 flex -space-x-2">
                  {profile ? (
                    <Avatar
                      name={profile.name}
                      src={profile.avatar_url}
                      size="sm"
                      className="ring-2 ring-[#0a0f1d]"
                    />
                  ) : null}
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-white/12 bg-white/[0.03] text-xs text-gray-500 ring-2 ring-[#0a0f1d]">
                    +
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-white/12 bg-white/[0.03] text-xs text-gray-500 ring-2 ring-[#0a0f1d]">
                    +
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-fuchsia-400/10 bg-gradient-to-r from-fuchsia-500/10 to-purple-500/10 p-4">
                  <p className="text-sm font-medium text-white">Fastest way to start</p>
                  <p className="mt-2 text-sm leading-6 text-gray-400">
                    Copy the link, drop it in chat, and open the Sync modal when your team is ready.
                  </p>
                </div>
              </div>
            </div>
          </section>
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
