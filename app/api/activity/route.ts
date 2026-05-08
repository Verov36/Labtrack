// app/api/activity/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/apiAuth'
import { apiRateLimit, getClientIp } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  const rl = apiRateLimit(getClientIp(req))
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const { error } = await requireAuth()
  if (error) return error
  const logs = await prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 500 })
  return NextResponse.json(logs)
}
