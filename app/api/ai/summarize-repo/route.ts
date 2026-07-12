import { NextResponse } from 'next/server'

type RepoSummaryRequest = {
  full_name?: string
  description?: string | null
  language?: string | null
  topics?: string[]
  readme?: string | null
  mode?: 'summary' | 'explain'
  locale?: 'en' | 'no'
}

function clean(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstSentences(text: string, count: number) {
  const cleaned = clean(text)
  if (!cleaned) return ''
  const parts = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean)
  return parts.slice(0, count).join(' ')
}

export function buildRepoSummary(body: RepoSummaryRequest) {
  const norwegian = body.locale === 'no'
  const fullName = body.full_name?.trim() || (norwegian ? 'Dette repoet' : 'This repository')
  const description = (body.description ?? '').trim()
  const language = (body.language ?? '').trim()
  const topics = (body.topics ?? []).filter(Boolean)
  const readme = (body.readme ?? '').trim()
  const mode = body.mode === 'explain' ? 'explain' : 'summary'

  if (!description && !readme) {
    return norwegian
      ? `${fullName} har ingen beskrivelse eller README ennå, så det er ikke mulig å forstå hva repoet gjør uten mer kontekst.`
      : `${fullName} has no description or README yet, so it isn't possible to infer what it does without more context.`
  }

  const readmeOpening = firstSentences(readme, mode === 'explain' ? 4 : 2)
  const tagLine = topics.length
    ? norwegian
      ? ` Temaer: ${topics.slice(0, 6).join(', ')}.`
      : ` Topics: ${topics.slice(0, 6).join(', ')}.`
    : ''
  const langLine = language
    ? norwegian
      ? ` Hovedspråk: ${language}.`
      : ` Primary language: ${language}.`
    : ''

  if (mode === 'explain') {
    const opener = description
      ? `${fullName} — ${description}`
      : norwegian
        ? `${fullName} er et ${language ? `${language}-` : 'programvare'}prosjekt`
        : `${fullName} is a ${language || 'software'} project`
    const readmeLine = readmeOpening
      ? norwegian
        ? ` Fra README: ${readmeOpening}`
        : ` From the README: ${readmeOpening}`
      : ''
    return `${opener}.${langLine}${tagLine}${readmeLine}`.trim()
  }

  const opener =
    description ||
    readmeOpening ||
    (norwegian
      ? `${fullName} er et repo skrevet i ${language || 'kode'}.`
      : `${fullName} is a ${language || 'code'} repository.`)
  return `${opener}${langLine}${tagLine}`.trim()
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RepoSummaryRequest
    return NextResponse.json({ summary: buildRepoSummary(body) })
  } catch {
    return NextResponse.json({ error: 'Failed to summarize repository' }, { status: 500 })
  }
}
