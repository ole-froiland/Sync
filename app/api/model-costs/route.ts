import { NextResponse } from 'next/server'
import modelCosts from '@/lib/model-costs.json'

export const revalidate = 3600 // cache 1 hour

export async function GET() {
  return NextResponse.json(modelCosts)
}
