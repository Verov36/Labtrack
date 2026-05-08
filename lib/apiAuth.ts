// lib/apiAuth.ts
// Server-side authentication and authorization helpers for API routes.
// Every protected API route MUST call requireAuth() or requireRole() before
// touching the database. The middleware handles page-level protection, but
// API routes need their own checks as defence-in-depth.

import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from './auth'
import { prisma } from './prisma'
import { getClientIp } from './rateLimit'

export interface AuthenticatedUser {
  id:     string
  email:  string
  name:   string
  role:   string
  avatar: string
}

/** Return the current session user or null */
export async function getSessionUser(): Promise<AuthenticatedUser | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  return session.user as AuthenticatedUser
}

/** Require a valid session. Returns user or a 401 NextResponse. */
export async function requireAuth(): Promise<
  { user: AuthenticatedUser; error?: never } |
  { user?: never; error: NextResponse }
> {
  const user = await getSessionUser()
  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
      ),
    }
  }
  return { user }
}

/** Require a session AND a specific role (or one of several roles). */
export async function requireRole(
  allowedRoles: string | string[],
): Promise<
  { user: AuthenticatedUser; error?: never } |
  { user?: never; error: NextResponse }
> {
  const { user, error } = await requireAuth()
  if (error) return { error }

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
  if (!roles.includes(user!.role)) {
    return {
      error: NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      ),
    }
  }
  return { user: user! }
}

// ── Auth event logging ────────────────────────────────────────────────────────

type AuthEventType =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'lockout'
  | 'mfa_success'
  | 'mfa_failure'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'password_changed'
  | 'account_locked'
  | 'account_unlocked'
  | 'session_expired'
  | 'backup_code_used'

export async function logAuthEvent(params: {
  email:      string
  event:      AuthEventType
  userId?:    number
  ipAddress?: string
  userAgent?: string
  detail?:    string
}) {
  try {
    await prisma.authEvent.create({
      data: {
        email:     params.email,
        event:     params.event,
        userId:    params.userId ?? null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ? params.userAgent.slice(0, 500) : null,
        detail:    params.detail ?? null,
      },
    })
  } catch (err) {
    // Auth event logging must never crash the main request
    console.error('[AuthEvent] Failed to log:', err)
  }
}

// ── Account lockout ────────────────────────────────────────────────────────────

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 30 * 60 * 1000 // 30 minutes

/** Record a failed login attempt. Locks the account after MAX_FAILED_ATTEMPTS. */
export async function recordFailedLogin(
  userId: number,
  email:  string,
  ip?:    string,
): Promise<{ locked: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true },
  })
  if (!user) return { locked: false }

  const newAttempts = (user.failedLoginAttempts || 0) + 1
  const shouldLock  = newAttempts >= MAX_FAILED_ATTEMPTS
  const lockedUntil = shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null

  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: newAttempts,
      ...(shouldLock ? { lockedUntil, status: 'locked' } : {}),
    },
  })

  if (shouldLock) {
    await logAuthEvent({
      email, event: 'account_locked', userId, ipAddress: ip,
      detail: `Locked after ${newAttempts} failed attempts. Unlocks at ${lockedUntil?.toISOString()}`,
    })
  }

  return { locked: shouldLock }
}

/** Reset failed login counter after a successful login. */
export async function resetFailedLogins(userId: number) {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  })
}

/** Check if an account is currently locked. */
export async function isAccountLocked(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, lockedUntil: true },
  })
  if (!user) return false
  if (user.status === 'locked' && user.lockedUntil) {
    if (new Date() > user.lockedUntil) {
      // Auto-unlock after lockout duration
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'active', failedLoginAttempts: 0, lockedUntil: null },
      })
      return false
    }
    return true
  }
  return false
}

/** Extract IP and User-Agent from a Next.js request */
export function getRequestMeta(req: Request): { ip: string; ua: string } {
  return {
    ip: getClientIp(req as Parameters<typeof getClientIp>[0]),
    ua: req.headers.get('user-agent') || 'unknown',
  }
}
