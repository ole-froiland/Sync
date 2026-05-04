import { NextResponse } from 'next/server'

type PodcastRequest = {
  articles?: Array<{
    title?: string
    source?: string
    preview?: string
    url?: string
  }>
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PodcastRequest
    const articles = body.articles?.filter((article) => article.title?.trim()) ?? []

    if (articles.length === 0) {
      return NextResponse.json({ error: 'No articles provided' }, { status: 400 })
    }

    return NextResponse.json({
      status: 'generating',
      message: `Generating podcast from ${articles.length} stories.`,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to create podcast' }, { status: 500 })
  }
}
