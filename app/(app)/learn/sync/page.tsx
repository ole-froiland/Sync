'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  FileText,
  FolderKanban,
  Image as ImageIcon,
  Link2,
  MessageSquare,
  Plus,
  Share2,
  UserPlus,
  Users,
} from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import SyncWithOthersModal from '@/components/how-to-sync/SyncWithOthersModal'
import { useLanguage } from '@/context/LanguageContext'
import { useUser } from '@/context/UserContext'

const copy = {
  no: {
    eyebrow: 'Kom i gang med Sync',
    title: 'Samle prosjektet. Del det enkelt.',
    intro:
      'Sync er arbeidsflaten for prosjekter, filer, lenker og samtaler. Du samler det teamet trenger på ett sted, uten å lete mellom ulike verktøy.',
    overviewLabel: 'Hva er det?',
    overview: [
      'Lag et prosjekt for arbeidet dere skal gjøre.',
      'Legg inn mapper, dokumenter, bilder, lenker og repoer.',
      'Inviter andre når dere er klare til å dele.',
    ],
    previewLabel: 'Et prosjekt i Sync',
    projectName: 'Nettside',
    projectDescription: 'Alt samlet for teamet',
    images: 'Bilder',
    brief: 'Prosjektbrief',
    chat: 'Prosjektchat',
    howEyebrow: 'Slik bruker du det',
    howTitle: 'Tre små steg for å komme i gang',
    steps: [
      {
        title: '1. Opprett et prosjekt',
        body: 'Start med en mappe for et kundeprosjekt, en idé eller et internt arbeid.',
      },
      {
        title: '2. Samle det som hører sammen',
        body: 'Legg inn dokumenter, bilder, nyttige lenker, repoer og undermapper.',
      },
      {
        title: '3. Del med de rette folkene',
        body: 'Inviter samarbeidspartnere eller send en lenke når noe skal deles.',
      },
    ],
    canEyebrow: 'Dette kan du gjøre',
    canTitle: 'Færre steder å lete',
    capabilities: [
      { title: 'Hold oversikten', body: 'Organiser prosjekter og undermapper på din måte.' },
      { title: 'Samle innhold', body: 'Ha filer, dokumenter, bilder og lenker i samme prosjekt.' },
      { title: 'Snakk sammen', body: 'Bruk chat når det er enklere enn en lang e-posttråd.' },
      { title: 'Jobb sammen', body: 'Del prosjektet med teamet og se hvem som er med.' },
    ],
    shareEyebrow: 'Deling',
    shareTitle: 'Inviter med e-post eller en enkel lenke',
    shareBody:
      'Når prosjektet er klart, inviterer du folk direkte i Sync. De kan få en invitasjon på e-post eller en lenke du kan kopiere og sende.',
    shareNote: 'Du bestemmer selv når et prosjekt skal deles.',
    finalEyebrow: 'Klar til å starte?',
    finalTitle: 'Lag ditt eget prosjekt, eller inviter noen inn.',
    finalBody: 'Begynn med det du jobber med nå. Resten kan vokse frem når dere trenger det.',
    create: 'Lag ditt eget prosjekt',
    invite: 'Inviter andre',
    inviteAria: 'Inviter andre til Sync',
  },
  en: {
    eyebrow: 'Get started with Sync',
    title: 'Keep the project together. Share it simply.',
    intro:
      'Sync is a workspace for projects, files, links, and conversations. Keep what the team needs in one place instead of searching across tools.',
    overviewLabel: 'What is it?',
    overview: [
      'Create a project for the work you are doing.',
      'Add folders, documents, images, links, and repositories.',
      'Invite others when you are ready to share.',
    ],
    previewLabel: 'A project in Sync',
    projectName: 'Website',
    projectDescription: 'Everything the team needs',
    images: 'Images',
    brief: 'Project brief',
    chat: 'Project chat',
    howEyebrow: 'How it works',
    howTitle: 'Three small steps to get started',
    steps: [
      {
        title: '1. Create a project',
        body: 'Start with a folder for a client project, an idea, or internal work.',
      },
      {
        title: '2. Keep related work together',
        body: 'Add documents, images, useful links, repositories, and subfolders.',
      },
      {
        title: '3. Share with the right people',
        body: 'Invite collaborators or send a link when something needs to be shared.',
      },
    ],
    canEyebrow: 'What you can do',
    canTitle: 'Fewer places to look',
    capabilities: [
      { title: 'Stay organised', body: 'Arrange projects and subfolders in the way that works for you.' },
      { title: 'Collect content', body: 'Keep files, documents, images, and links with the project.' },
      { title: 'Talk it through', body: 'Use chat when it is easier than a long email thread.' },
      { title: 'Work together', body: 'Share the project with the team and see who is involved.' },
    ],
    shareEyebrow: 'Sharing',
    shareTitle: 'Invite by email or a simple link',
    shareBody:
      'When a project is ready, invite people directly in Sync. They can receive an email invite or a link you can copy and send.',
    shareNote: 'You decide when a project is ready to share.',
    finalEyebrow: 'Ready to start?',
    finalTitle: 'Create your own project, or invite someone in.',
    finalBody: 'Start with what you are working on now. The rest can grow when you need it.',
    create: 'Create your own project',
    invite: 'Invite others',
    inviteAria: 'Invite others to Sync',
  },
} as const

function WorkspacePreview({ text }: { text: (typeof copy)[keyof typeof copy] }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <figcaption className="flex items-center justify-between border-b border-gray-100 px-5 py-4 text-sm font-medium text-gray-700 dark:border-gray-800 dark:text-gray-200">
        <span>{text.previewLabel}</span>
        <span className="rounded-full bg-fuchsia-50 px-2.5 py-1 text-xs font-semibold text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300">
          Sync
        </span>
      </figcaption>

      <div className="grid gap-3 p-4 sm:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-fuchsia-600 text-white">
              <FolderKanban size={20} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-gray-950 dark:text-white">{text.projectName}</span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{text.projectDescription}</span>
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <PreviewItem icon={ImageIcon} label={text.images} accent="text-amber-600 dark:text-amber-300" />
            <PreviewItem icon={FileText} label={text.brief} accent="text-sky-600 dark:text-sky-300" />
            <PreviewItem icon={Link2} label="GitHub" accent="text-gray-700 dark:text-gray-200" />
            <PreviewItem icon={MessageSquare} label={text.chat} accent="text-fuchsia-600 dark:text-fuchsia-300" />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Team</span>
            <Users size={16} className="text-gray-400 dark:text-gray-500" />
          </div>
          <div className="mt-5 flex -space-x-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-fuchsia-600 text-xs font-semibold text-white dark:border-gray-900">A</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-sky-600 text-xs font-semibold text-white dark:border-gray-900">M</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-xs font-semibold text-white dark:border-gray-900">J</span>
          </div>
          <div className="mt-5 space-y-3">
            <span className="block h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800" />
            <span className="block h-2 w-4/5 rounded-full bg-gray-100 dark:bg-gray-800" />
            <span className="block h-2 w-2/3 rounded-full bg-gray-100 dark:bg-gray-800" />
          </div>
          <div className="mt-5 flex items-center gap-2 text-xs font-medium text-fuchsia-700 dark:text-fuchsia-300">
            <Share2 size={14} />
            <span>{text.shareEyebrow}</span>
          </div>
        </div>
      </div>
    </figure>
  )
}

function PreviewItem({
  icon: Icon,
  label,
  accent,
}: {
  icon: typeof ImageIcon
  label: string
  accent: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-2 dark:border-gray-800 dark:bg-gray-900">
      <Icon size={15} className={`shrink-0 ${accent}`} />
      <span className="truncate text-xs font-medium text-gray-700 dark:text-gray-200">{label}</span>
    </div>
  )
}

export default function SyncLearnPage() {
  const { locale } = useLanguage()
  const profile = useUser()
  const [inviteOpen, setInviteOpen] = useState(false)
  const text = copy[locale]

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-no-translate>
      <TopBar title="Sync" noTranslateTitle />

      <main className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-4 py-8 dark:bg-gray-950 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <section className="grid gap-10 border-b border-gray-200 pb-12 dark:border-gray-800 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
            <div className="max-w-xl">
              <p className="text-sm font-semibold text-fuchsia-700 dark:text-fuchsia-300">{text.eyebrow}</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-5xl">
                {text.title}
              </h2>
              <p className="mt-5 text-base leading-7 text-gray-600 dark:text-gray-400">{text.intro}</p>

              <div className="mt-7">
                <p className="text-sm font-semibold text-gray-950 dark:text-white">{text.overviewLabel}</p>
                <ul className="mt-3 space-y-3">
                  {text.overview.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
                      <Check size={17} className="mt-0.5 shrink-0 text-fuchsia-600 dark:text-fuchsia-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <WorkspacePreview text={text} />
          </section>

          <section className="py-12 sm:py-16">
            <p className="text-sm font-semibold text-fuchsia-700 dark:text-fuchsia-300">{text.howEyebrow}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-3xl">{text.howTitle}</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {text.steps.map((step) => (
                <article key={step.title} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                  <h3 className="font-semibold text-gray-950 dark:text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">{step.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="border-t border-gray-200 py-12 dark:border-gray-800 sm:py-16">
            <p className="text-sm font-semibold text-fuchsia-700 dark:text-fuchsia-300">{text.canEyebrow}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-3xl">{text.canTitle}</h2>
            <div className="mt-8 grid gap-x-8 gap-y-7 sm:grid-cols-2">
              {text.capabilities.map((capability, index) => {
                const Icon = [FolderKanban, FileText, MessageSquare, Users][index]
                return (
                  <article key={capability.title} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-fuchsia-700 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:text-fuchsia-300 dark:ring-gray-800">
                      <Icon size={18} />
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-950 dark:text-white">{capability.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-400">{capability.body}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="border-t border-gray-200 py-12 dark:border-gray-800 sm:py-16">
            <div className="grid gap-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 md:grid-cols-[1fr_auto] md:items-center md:p-8">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold text-fuchsia-700 dark:text-fuchsia-300">{text.shareEyebrow}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">{text.shareTitle}</h2>
                <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">{text.shareBody}</p>
                <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-200">{text.shareNote}</p>
              </div>
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:hover:bg-gray-800 dark:focus-visible:ring-offset-gray-900"
              >
                <UserPlus size={17} />
                {text.invite}
              </button>
            </div>
          </section>

          <section className="border-t border-gray-200 py-12 text-center dark:border-gray-800 sm:py-16">
            <p className="text-sm font-semibold text-fuchsia-700 dark:text-fuchsia-300">{text.finalEyebrow}</p>
            <h2 className="mx-auto mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-4xl">{text.finalTitle}</h2>
            <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-gray-600 dark:text-gray-400">{text.finalBody}</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/projects"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-fuchsia-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-fuchsia-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
              >
                <Plus size={17} />
                {text.create}
                <ArrowRight size={16} />
              </Link>
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                aria-label={text.inviteAria}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800 dark:focus-visible:ring-offset-gray-950"
              >
                <UserPlus size={17} />
                {text.invite}
              </button>
            </div>
          </section>
        </div>
      </main>

      <SyncWithOthersModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        userId={profile?.id ?? ''}
        locale={locale}
      />
    </div>
  )
}
