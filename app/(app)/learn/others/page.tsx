'use client'

import Link from 'next/link'
import { Award, BookOpenCheck, ExternalLink, GraduationCap, Sparkles } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import { useLanguage } from '@/context/LanguageContext'
import { LEARNING_COURSES, type CourseCredential, type CourseLevel } from '@/lib/learning-courses'

const copy = {
  en: {
    eyebrow: 'Learn with trusted sources',
    title: 'Official courses from the tools you use',
    intro: 'Every course links directly to the provider. Credential labels distinguish certificates from platform achievements and courses without a formal credential.',
    syncTitle: 'New to Sync?',
    syncBody: 'Start with the short interactive guide before exploring external courses.',
    syncLink: 'Open the Sync guide',
    official: 'Official course',
    free: 'Free',
    open: 'Open course',
    credential: {
      certificate: 'Completion certificate',
      achievement: 'Platform achievement',
      course: 'No formal certificate',
    } satisfies Record<CourseCredential, string>,
    level: {
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      'all-levels': 'All levels',
    } satisfies Record<CourseLevel, string>,
  },
  no: {
    eyebrow: 'Lær fra pålitelige kilder',
    title: 'Offisielle kurs fra verktøyene du bruker',
    intro: 'Alle kurs åpnes direkte hos leverandøren. Merkingen skiller sertifikater fra plattformutmerkelser og kurs uten formell attest.',
    syncTitle: 'Ny i Sync?',
    syncBody: 'Start med den korte, interaktive guiden før du utforsker eksterne kurs.',
    syncLink: 'Åpne Sync-guiden',
    official: 'Offisielt kurs',
    free: 'Gratis',
    open: 'Åpne kurset',
    credential: {
      certificate: 'Fullføringssertifikat',
      achievement: 'Plattformutmerkelse',
      course: 'Ingen formell attest',
    } satisfies Record<CourseCredential, string>,
    level: {
      beginner: 'Nybegynner',
      intermediate: 'Viderekommen',
      'all-levels': 'Alle nivåer',
    } satisfies Record<CourseLevel, string>,
  },
}

const credentialIcon = {
  certificate: Award,
  achievement: GraduationCap,
  course: BookOpenCheck,
} satisfies Record<CourseCredential, typeof Award>

export default function OtherCoursesPage() {
  const { locale } = useLanguage()
  const text = copy[locale]

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-no-translate>
      <TopBar title={locale === 'no' ? 'Lære' : 'Learn'} noTranslateTitle />

      <main className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-4 py-8 dark:bg-gray-950 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-sm font-semibold text-fuchsia-600 dark:text-fuchsia-400">
              <Sparkles size={16} />
              {text.eyebrow}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-4xl">
              {text.title}
            </h2>
            <p className="mt-3 text-base leading-7 text-gray-600 dark:text-gray-400">{text.intro}</p>
          </div>

          <section className="mt-8 flex flex-col gap-4 rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-5 dark:border-fuchsia-900/70 dark:bg-fuchsia-950/20 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-gray-950 dark:text-white">{text.syncTitle}</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{text.syncBody}</p>
            </div>
            <Link
              href="/learn/sync"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-fuchsia-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
            >
              <GraduationCap size={17} />
              {text.syncLink}
            </Link>
          </section>

          <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={text.title}>
            {LEARNING_COURSES.map((course) => {
              const CredentialIcon = credentialIcon[course.credential]

              return (
                <article
                  key={course.id}
                  className="flex min-h-72 flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      {course.provider}
                    </span>
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{text.official}</span>
                  </div>

                  <h3 className="mt-5 text-lg font-semibold leading-6 text-gray-950 dark:text-white">{course.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                    {course.description[locale]}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                    <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">{text.free}</span>
                    <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800">{text.level[course.level]}</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-fuchsia-50 px-2 py-1 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300">
                      <CredentialIcon size={13} />
                      {text.credential[course.credential]}
                    </span>
                  </div>

                  <a
                    href={course.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-fuchsia-700 hover:text-fuchsia-800 dark:text-fuchsia-300 dark:hover:text-fuchsia-200"
                  >
                    {text.open}
                    <ExternalLink size={15} />
                  </a>
                </article>
              )
            })}
          </section>
        </div>
      </main>
    </div>
  )
}
