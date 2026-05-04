import { NextResponse } from 'next/server'

type SummaryMode = 'short' | 'medium' | 'long'

type SummaryRequest = {
  mode?: SummaryMode
  article?: {
    title?: string
    source?: string
    preview?: string
    url?: string
  }
}

const VALID_MODES = new Set<SummaryMode>(['short', 'medium', 'long'])

function summarize(mode: SummaryMode, title: string, source: string, preview: string) {
  if (mode === 'short') {
    return `${title} ${preview}`.trim()
  }

  if (mode === 'medium') {
    return `${source} is highlighting "${title}". ${preview} Open the story for the full context before acting on it.`
  }

  return `${source} is surfacing "${title}". ${preview} The useful next step is to inspect the original article, validate the claims against primary context, and decide whether it affects your current work or roadmap.`
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SummaryRequest
    const mode = VALID_MODES.has(body.mode as SummaryMode) ? (body.mode as SummaryMode) : 'short'
    const title = body.article?.title?.trim()

    if (!title) {
      return NextResponse.json({ error: 'Missing article title' }, { status: 400 })
    }

    return NextResponse.json({
      summary: summarize(
        mode,
        title,
        body.article?.source?.trim() || 'This source',
        body.article?.preview?.trim() || 'No preview is available.'
      ),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to summarize article' }, { status: 500 })
  }
}
