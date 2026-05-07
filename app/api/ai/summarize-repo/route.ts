import { NextResponse } from 'next/server'

type RepoSummaryRequest = {
  full_name?: string
  description?: string | null
  language?: string | null
  topics?: string[]
  readme?: string | null
  mode?: 'summary' | 'explain'
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RepoSummaryRequest

    const fullName = body.full_name?.trim() || 'This repository'
    const description = (body.description ?? '').trim()
    const language = (body.language ?? '').trim()
    const topics = (body.topics ?? []).filter(Boolean)
    const readme = (body.readme ?? '').trim()
    const mode = body.mode === 'explain' ? 'explain' : 'summary'

    if (!description && !readme) {
      return NextResponse.json({
        summary: `${fullName} has no description or README yet, so it isn't possible to infer what it does without more context.`,
      })
    }

    const readmeOpening = firstSentences(readme, mode === 'explain' ? 4 : 2)
    const tagLine = topics.length ? ` Topics: ${topics.slice(0, 6).join(', ')}.` : ''
    const langLine = language ? ` Primary language: ${language}.` : ''

    if (mode === 'explain') {
      const opener = description
        ? `${fullName} — ${description}`
        : `${fullName} is a ${language || 'software'} project.`
      const body = readmeOpening
        ? ` From the README: ${readmeOpening}`
        : ''
      return NextResponse.json({
        summary: `${opener}.${langLine}${tagLine}${body}`.trim(),
      })
    }

    const opener = description || readmeOpening || `${fullName} is a ${language || 'code'} repository.`
    return NextResponse.json({
      summary: `${opener}${langLine}${tagLine}`.trim(),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to summarize repository' }, { status: 500 })
  }
}
