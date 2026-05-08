// app/api/auth/auth-events/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/apiAuth'
import { apiRateLimit, getClientIp } from '@/lib/rateLimit'

/** GET: Return authentication audit log (admin only) */
export async function GET(req: NextRequest) {
  const rl = apiRateLimit(getClientIp(req))
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  // Auth events are sensitive — admin only
  const { error } = await requireRole('admin')
  if (error) return error

  const url    = new URL(req.url)
  const limit  = Math.min(parseInt(url.searchParams.get('limit') || '200'), 500)
  const userId = url.searchParams.get('userId')

  const events = await prisma.authEvent.findMany({
    where:   userId ? { userId: parseInt(userId) } : undefined,
    orderBy: { createdAt: 'desc' },
    take:    limit,
  })

  return NextResponse.json(events)
}
