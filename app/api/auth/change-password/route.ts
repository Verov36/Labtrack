// app/api/auth/change-password/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, logAuthEvent, getRequestMeta } from '@/lib/apiAuth'
import { parseBody, ChangePasswordSchema } from '@/lib/validation'
import {
  validatePassword, hashPassword, verifyPassword,
  isPasswordReused, updatePasswordHistory,
} from '@/lib/passwordPolicy'
import { apiRateLimit, getClientIp } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const rl = apiRateLimit(getClientIp(req))
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { user, error } = await requireAuth()
  if (error) return error
  const { ip } = getRequestMeta(req)
  const userId = parseInt(user!.id)

  const parsed = await parseBody(req, ChangePasswordSchema)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const { currentPassword, newPassword } = parsed.data!

  // Fetch full user record
  const dbUser = await prisma.user.findUnique({ where: { id: userId } })
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Verify current password
  const currentValid = await verifyPassword(currentPassword, dbUser.password)
  if (!currentValid) {
    await logAuthEvent({ email: dbUser.email, event: 'password_changed', userId, ipAddress: ip, detail: 'Failed — incorrect current password' })
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
  }

  // Validate new password against policy
  const validation = validatePassword(newPassword, dbUser.email, dbUser.name)
  if (!validation.valid) {
    return NextResponse.json({ error: 'Password does not meet requirements', details: validation.errors }, { status: 422 })
  }

  // Check password history (cannot reuse last 10 passwords)
  const reused = await isPasswordReused(newPassword, dbUser.passwordHistory)
  if (reused) {
    return NextResponse.json({ error: 'You cannot reuse a recent password. Please choose a different password.' }, { status: 422 })
  }

  // Hash and save
  const newHash = await hashPassword(newPassword)
  const newHistory = updatePasswordHistory(newHash, dbUser.passwordHistory)

  await prisma.user.update({
    where: { id: userId },
    data: {
      password:          newHash,
      passwordHistory:   newHistory,
      passwordChangedAt: new Date(),
    },
  })

  await logAuthEvent({
    email: dbUser.email, event: 'password_changed',
    userId, ipAddress: ip, detail: 'Password changed successfully',
  })

  return NextResponse.json({ success: true })
}
