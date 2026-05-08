// app/api/auth/mfa-setup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, logAuthEvent } from '@/lib/apiAuth'
import { generateMfaSetup, generateBackupCodes, verifyTotpCode } from '@/lib/mfa'
import { parseBody, MfaSetupConfirmSchema } from '@/lib/validation'
import { mfaRateLimit, getClientIp } from '@/lib/rateLimit'

/** GET: Generate a new TOTP secret and QR code for setup */
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { secret, qrCodeUrl, manualKey } = await generateMfaSetup(user!.email)

  // Store the secret temporarily (not yet confirmed / enabled)
  // We store it even before confirmation so the verify step can check it
  await prisma.user.update({
    where: { id: parseInt(user!.id) },
    data:  { mfaSecret: secret },
  })

  return NextResponse.json({ qrCodeUrl, manualKey, secret })
}

/** POST: Confirm MFA setup by verifying a TOTP code */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = mfaRateLimit(ip)
  if (!rl.success) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })

  const { user, error } = await requireAuth()
  if (error) return error

  const parsed = await parseBody(req, MfaSetupConfirmSchema)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const { secret, code } = parsed.data!

  // Verify the code against the provided secret
  const valid = verifyTotpCode(code, secret)
  if (!valid) {
    await logAuthEvent({
      email: user!.email, event: 'mfa_failure',
      userId: parseInt(user!.id), ipAddress: ip,
      detail: 'Invalid code during MFA setup',
    })
    return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 })
  }

  // Generate backup codes
  const { plainCodes, hashedCodes } = await generateBackupCodes(8)

  // Enable MFA
  await prisma.user.update({
    where: { id: parseInt(user!.id) },
    data:  {
      mfaEnabled:     true,
      mfaSecret:      secret,
      mfaBackupCodes: JSON.stringify(hashedCodes),
    },
  })

  await logAuthEvent({
    email: user!.email, event: 'mfa_enabled',
    userId: parseInt(user!.id), ipAddress: ip,
  })

  // Return plain backup codes — shown ONCE, never again
  return NextResponse.json({ success: true, backupCodes: plainCodes })
}

/** DELETE: Disable MFA (admin or self) */
export async function DELETE(req: NextRequest) {
  const ip = getClientIp(req)
  const { user, error } = await requireAuth()
  if (error) return error

  await prisma.user.update({
    where: { id: parseInt(user!.id) },
    data:  { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: null },
  })

  await logAuthEvent({
    email: user!.email, event: 'mfa_disabled',
    userId: parseInt(user!.id), ipAddress: ip,
  })

  return NextResponse.json({ success: true })
}
