import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type UsageResult = {
  input_tokens?: number
  output_tokens?: number
  num_model_requests?: number
  model?: string
}

type UsageBucket = {
  start_time: number
  end_time: number
  results?: UsageResult[]
}

type UsageResponse = {
  data?: UsageBucket[]
}

export async function GET(request: Request) {
  // Prefer a per-user key supplied by the client (BYOK); fall back to server env.
  const apiKey =
    request.headers.get('x-openai-key') || process.env.OPENAI_ADMIN_KEY || process.env.OPENAI_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'OpenAI usage API key is not configured' },
      { status: 501 }
    )
  }

  const end = new Date()
  end.setHours(0, 0, 0, 0)
  end.setDate(end.getDate() + 1)

  const start = new Date(end)
  start.setDate(start.getDate() - 7)

  const params = new URLSearchParams({
    start_time: String(Math.floor(start.getTime() / 1000)),
    end_time: String(Math.floor(end.getTime() / 1000)),
    bucket_width: '1d',
    limit: '7',
  })
  params.append('group_by[]', 'model')

  const response = await fetch(
    `https://api.openai.com/v1/organization/usage/completions?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    return NextResponse.json(
      { error: 'OpenAI usage API request failed' },
      { status: response.status }
    )
  }

  const body = (await response.json()) as UsageResponse
  const buckets = body.data ?? []
  const modelTotals = new Map<string, number>()

  const dailyCodex = buckets.slice(-7).map((bucket) => {
    const results = bucket.results ?? []
    const requests = results.reduce((sum, item) => sum + (item.num_model_requests ?? 0), 0)
    const inputTokens = results.reduce((sum, item) => sum + (item.input_tokens ?? 0), 0)
    const outputTokens = results.reduce((sum, item) => sum + (item.output_tokens ?? 0), 0)

    for (const item of results) {
      if (!item.model) continue
      const tokens = (item.input_tokens ?? 0) + (item.output_tokens ?? 0)
      modelTotals.set(item.model, (modelTotals.get(item.model) ?? 0) + tokens)
    }

    const date = new Date(bucket.start_time * 1000)
    const tokens = inputTokens + outputTokens
    const limitTokens = Math.max(tokens, 1_000_000)
    const percent = tokens / limitTokens

    return {
      label: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date),
      dateLabel: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date),
      requests,
      tokens,
      inputTokens,
      outputTokens,
      limitTokens,
      status: percent >= 0.96 ? 'used_up' : percent >= 0.72 ? 'heavy' : 'normal',
    }
  })

  const totalTokens = dailyCodex.reduce((sum, day) => sum + day.tokens, 0)
  const inputTokens = dailyCodex.reduce((sum, day) => sum + day.inputTokens, 0)
  const outputTokens = dailyCodex.reduce((sum, day) => sum + day.outputTokens, 0)
  const requests = dailyCodex.reduce((sum, day) => sum + day.requests, 0)
  const mostUsedModel =
    [...modelTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'No usage yet'

  return NextResponse.json({
    source: 'live',
    codexLimits: buildLimitResets(),
    codex: {
      requests,
      totalTokens,
      inputTokens,
      outputTokens,
      remainingPercent: null,
      resetLabel: 'OpenAI API usage data',
      lastActiveLabel: dailyCodex.some((day) => day.requests > 0) ? 'Today' : 'No recent API usage',
      mostUsedModel,
    },
    dailyCodex,
  })
}

function buildLimitResets() {
  const fiveHourReset = new Date()
  fiveHourReset.setHours(fiveHourReset.getHours() + 5, 0, 0, 0)

  const weeklyReset = new Date()
  weeklyReset.setDate(weeklyReset.getDate() + ((7 - weeklyReset.getDay()) % 7 || 7))

  return [
    {
      label: '5 hour usage limit',
      resetLabel: `Resets ${new Intl.DateTimeFormat('en', {
        hour: 'numeric',
        minute: '2-digit',
      }).format(fiveHourReset)}`,
      percentLeft: null,
    },
    {
      label: 'Weekly usage limit',
      resetLabel: `Resets ${new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
      }).format(weeklyReset)}`,
      percentLeft: null,
    },
  ]
}
