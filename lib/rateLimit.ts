// lib/rateLimit.ts
// In-memory sliding window rate limiter.
// For multi-instance production deployments, swap the Map for Redis
// (e.g. @upstash/ratelimit). This implementation is correct and safe
// for single-instance deployments and local development.

interface RateLimitWindow {
  timestamps: number[]
}

const store = new Map<string, RateLimitWindow>()

// Clean up expired entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, window] of store.entries()) {
    // Remove entries where all timestamps are older than 1 hour
    if (window.timestamps.every(ts => now - ts > 3600_000)) {
      store.delete(key)
    }
  }
}, 5 * 60_000)

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number // Unix ms timestamp when the window resets
}

/**
 * Check if a key (typically IP + endpoint) is within rate limits.
 * Returns { success: false } when the limit is exceeded.
 */
export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const windowStart = now - config.windowMs

  if (!store.has(key)) {
    store.set(key, { timestamps: [] })
  }

  const window = store.get(key)!

  // Remove timestamps outside the current window
  window.timestamps = window.timestamps.filter(ts => ts > windowStart)

  const remaining = config.limit - window.timestamps.length

  if (remaining <= 0) {
    const oldestInWindow = window.timestamps[0] || now
    return {
      success:   false,
      remaining: 0,
      resetAt:   oldestInWindow + config.windowMs,
    }
  }

  window.timestamps.push(now)
  return {
    success:   true,
    remaining: remaining - 1,
    resetAt:   now + config.windowMs,
  }
}

// ── Pre-configured limiters ────────────────────────────────────────────────────

/** Login endpoint: 5 attempts per 15 minutes per IP */
export function loginRateLimit(ip: string) {
  return rateLimit(`login:${ip}`, { limit: 5, windowMs: 15 * 60_000 })
}

/** General API: 120 requests per minute per IP */
export function apiRateLimit(ip: string) {
  return rateLimit(`api:${ip}`, { limit: 120, windowMs: 60_000 })
}

/** MFA verification: 5 attempts per 10 minutes per user */
export function mfaRateLimit(userId: string) {
  return rateLimit(`mfa:${userId}`, { limit: 5, windowMs: 10 * 60_000 })
}

/** Password reset: 3 attempts per hour per email */
export function passwordResetRateLimit(email: string) {
  return rateLimit(`pwreset:${email}`, { limit: 3, windowMs: 60 * 60_000 })
}

/** Helper: get real IP from Next.js request headers */
export function getClientIp(req: Request | { headers: { get: (k: string) => string | null } }): string {
  const forwarded = (req.headers as { get: (k: string) => string | null }).get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIp = (req.headers as { get: (k: string) => string | null }).get('x-real-ip')
  return realIp || 'unknown'
}
