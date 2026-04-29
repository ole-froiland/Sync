import { NextResponse } from 'next/server'

const HN_TOP_STORIES = 'https://hacker-news.firebaseio.com/v0/topstories.json'
const HN_ITEM = (id: number) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`

export const revalidate = 300 // cache 5 minutes

export async function GET() {
  try {
    const idsRes = await fetch(HN_TOP_STORIES, { next: { revalidate: 300 } })
    if (!idsRes.ok) throw new Error('HN stories unavailable')

    const ids: number[] = await idsRes.json()
    const top20 = ids.slice(0, 20)

    const stories = await Promise.all(
      top20.map((id) =>
        fetch(HN_ITEM(id), { next: { revalidate: 300 } })
          .then((r) => r.json())
          .catch(() => null)
      )
    )

    const valid = stories
      .filter((s) => s && s.title && !s.deleted && !s.dead && s.url)
      .slice(0, 8)

    return NextResponse.json(valid)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 })
  }
}
