// lib/passwordPolicy.ts
// Hospital-grade password policy enforcement.
// Requirements align with NIST SP 800-63B and common hospital IT standards.

import bcrypt from 'bcryptjs'

export interface PasswordValidationResult {
  valid:    boolean
  errors:   string[]
  strength: 'weak' | 'fair' | 'strong' | 'very-strong'
}

const BCRYPT_ROUNDS = 12

// Common weak passwords that should always be rejected
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'labtrack', 'labtrack1',
  'hospital', 'hospital1', 'admin', 'admin123', 'welcome1',
  'qwerty', 'qwerty123', 'abc123', '123456', '12345678',
  'monkey', 'dragon', 'master', 'pass', 'test', 'user',
])

/**
 * Validates a password against hospital security policy.
 * Rules:
 *   - Minimum 12 characters
 *   - At least one uppercase letter
 *   - At least one lowercase letter
 *   - At least one number
 *   - At least one special character
 *   - Not a known common/weak password
 *   - Not containing the user's email or name
 */
export function validatePassword(
  password: string,
  userEmail?: string,
  userName?: string,
): PasswordValidationResult {
  const errors: string[] = []

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character (e.g. ! @ # $ % ^)')
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('This password is too common. Please choose a more unique password.')
  }
  if (userEmail) {
    const emailPrefix = userEmail.split('@')[0].toLowerCase()
    if (emailPrefix.length > 2 && password.toLowerCase().includes(emailPrefix)) {
      errors.push('Password must not contain your email address')
    }
  }
  if (userName) {
    const nameParts = userName.toLowerCase().split(' ').filter(p => p.length > 2)
    for (const part of nameParts) {
      if (password.toLowerCase().includes(part)) {
        errors.push('Password must not contain your name')
        break
      }
    }
  }

  // Strength scoring
  let score = 0
  if (password.length >= 12) score++
  if (password.length >= 16) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (password.length >= 20) score++

  const strength =
    score <= 3 ? 'weak' :
    score <= 4 ? 'fair' :
    score <= 5 ? 'strong' : 'very-strong'

  return { valid: errors.length === 0, errors, strength }
}

/** Hash a password with bcrypt (cost 12) */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

/** Compare a plaintext password to a bcrypt hash */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Check if a new password has been used recently.
 * Compares against the stored JSON array of historical hashes.
 * Returns true if the password was previously used (i.e. reject it).
 */
export async function isPasswordReused(
  newPassword: string,
  passwordHistoryJson: string | null,
): Promise<boolean> {
  if (!passwordHistoryJson) return false
  try {
    const history: string[] = JSON.parse(passwordHistoryJson)
    const checks = history.map(hash => bcrypt.compare(newPassword, hash))
    const results = await Promise.all(checks)
    return results.some(Boolean)
  } catch {
    return false
  }
}

/**
 * Add a new hash to the password history, keeping only the last N entries.
 */
export function updatePasswordHistory(
  newHash: string,
  existingHistoryJson: string | null,
  keepLast = 10,
): string {
  const history: string[] = existingHistoryJson ? JSON.parse(existingHistoryJson) : []
  history.push(newHash)
  return JSON.stringify(history.slice(-keepLast))
}

/** Check if a password is expired (over 90 days old) */
export function isPasswordExpired(passwordChangedAt: Date): boolean {
  const ninetyDays = 90 * 24 * 60 * 60 * 1000
  return Date.now() - passwordChangedAt.getTime() > ninetyDays
}

/** Days until password expires */
export function daysUntilPasswordExpiry(passwordChangedAt: Date): number {
  const ninetyDays = 90 * 24 * 60 * 60 * 1000
  const elapsed = Date.now() - passwordChangedAt.getTime()
  return Math.max(0, Math.round((ninetyDays - elapsed) / (24 * 60 * 60 * 1000)))
}
