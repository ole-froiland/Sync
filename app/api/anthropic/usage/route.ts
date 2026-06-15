import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type UsageResult = {
  model?: string | null
  uncached_input_tokens?: number
  cache_read_input_tokens?: number
  cache_creation?: {
    ephemeral_1h_input_tokens?: number
    ephemeral_5m_input_tokens?: number
  }
  output_tokens?: number
}

type UsageBucket = {
  starting_at: string
  ending_at: string
  results?: UsageResult[]
}

type UsageResponse = {
  data?: UsageBucket[]
}

function inputTokensOf(result: UsageResult): number {
  return (
    (result.uncached_input_tokens ?? 0) +
    (result.cache_read_input_tokens ?? 0) +
    (result.cache_creation?.ephemeral_1h_input_tokens ?? 0) +
    (result.cache_creation?.ephemeral_5m_input_tokens ?? 0)
  )
}

export async function GET() {
  const apiKey = process.env.ANTHROPIC_ADMIN_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'Anthropic admin key is not configured' }, { status: 501 })
  }

  const end = new Date()
  end.setUTCHours(0, 0, 0, 0)
  end.setUTCDate(end.getUTCDate() + 1)

  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 7)

  const params = new URLSearchParams({
    starting_at: start.toISOString(),
    ending_at: end.toISOString(),
    bucket_width: '1d',
    limit: '7',
  })
  params.append('group_by[]', 'model')

  const response = await fetch(
    `https://api.anthropic.com/v1/organizations/usage_report/messages?${params.toString()}`,
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    return NextResponse.json({ error: 'Anthropic usage API request failed' }, { status: response.status })
  }

  const body = (await response.json()) as UsageResponse
  const buckets = body.data ?? []
  const modelTotals = new Map<string, number>()

  const daily = buckets.slice(-7).map((bucket) => {
    const results = bucket.results ?? []
    const inputTokens = results.reduce((sum, item) => sum + inputTokensOf(item), 0)
    const outputTokens = results.reduce((sum, item) => sum + (item.output_tokens ?? 0), 0)

    for (const item of results) {
      if (!item.model) continue
      const tokens = inputTokensOf(item) + (item.output_tokens ?? 0)
      modelTotals.set(item.model, (modelTotals.get(item.model) ?? 0) + tokens)
    }

    const date = new Date(bucket.starting_at)
    const tokens = inputTokens + outputTokens
    const limitTokens = Math.max(tokens, 1_000_000)
    const percent = tokens / limitTokens

    return {
      label: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date),
      dateLabel: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date),
      tokens,
      inputTokens,
      outputTokens,
      status: percent >= 0.96 ? 'used_up' : percent >= 0.72 ? 'heavy' : 'normal',
    }
  })

  const totalTokens = daily.reduce((sum, day) => sum + day.tokens, 0)
  const inputTokens = daily.reduce((sum, day) => sum + day.inputTokens, 0)
  const outputTokens = daily.reduce((sum, day) => sum + day.outputTokens, 0)
  const mostUsedModel = [...modelTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'No usage yet'

  return NextResponse.json({
    source: 'live',
    totalTokens,
    inputTokens,
    outputTokens,
    mostUsedModel,
    lastActiveLabel: daily.some((day) => day.tokens > 0) ? 'Today' : 'No recent API usage',
    daily,
  })
}
