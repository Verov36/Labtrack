// lib/mfa.ts
// TOTP-based Multi-Factor Authentication using RFC 6238.
// Compatible with Google Authenticator, Microsoft Authenticator, Authy, etc.

import { authenticator } from 'otplib'
import QRCode from 'qrcode'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

const APP_NAME = 'LabTrack'

// Configure TOTP: 30-second window, allow ±1 step for clock drift
authenticator.options = {
  window: 1,  // Accept codes from 1 step before/after current (handles clock skew)
  step: 30,   // 30-second time step (standard)
}

/**
 * Generate a new TOTP secret for a user.
 * Returns the secret (to be stored encrypted) and the QR code data URL.
 */
export async function generateMfaSetup(userEmail: string): Promise<{
  secret:    string
  qrCodeUrl: string
  manualKey: string  // formatted for manual entry in authenticator apps
}> {
  const secret = authenticator.generateSecret(20)

  const otpAuthUrl = authenticator.keyuri(userEmail, APP_NAME, secret)
  const qrCodeUrl  = await QRCode.toDataURL(otpAuthUrl)

  // Format the key in groups of 4 for readability (for manual entry)
  const manualKey = secret.replace(/(.{4})/g, '$1 ').trim()

  return { secret, qrCodeUrl, manualKey }
}

/**
 * Verify a TOTP code against the stored secret.
 */
export function verifyTotpCode(code: string, secret: string): boolean {
  try {
    return authenticator.verify({ token: code.replace(/\s/g, ''), secret })
  } catch {
    return false
  }
}

/**
 * Generate one-time backup codes for account recovery.
 * Returns an array of plaintext codes (shown to the user once)
 * and an array of bcrypt hashes (stored in the database).
 */
export async function generateBackupCodes(count = 8): Promise<{
  plainCodes:  string[]
  hashedCodes: string[]
}> {
  const plainCodes: string[] = []
  for (let i = 0; i < count; i++) {
    // Format: XXXX-XXXX (easy to read and type)
    const code = crypto.randomBytes(4).toString('hex').toUpperCase()
    const formatted = `${code.slice(0, 4)}-${code.slice(4)}`
    plainCodes.push(formatted)
  }
  const hashedCodes = await Promise.all(
    plainCodes.map(code => bcrypt.hash(code.replace('-', ''), 10))
  )
  return { plainCodes, hashedCodes }
}

/**
 * Verify and consume a backup code.
 * Returns the index of the used code (to remove it) or -1 if invalid.
 */
export async function verifyAndConsumeBackupCode(
  inputCode: string,
  hashedCodesJson: string,
): Promise<number> {
  try {
    const hashedCodes: string[] = JSON.parse(hashedCodesJson)
    const normalised = inputCode.replace(/[-\s]/g, '').toUpperCase()
    const checks = hashedCodes.map(hash => bcrypt.compare(normalised, hash))
    const results = await Promise.all(checks)
    return results.findIndex(Boolean)
  } catch {
    return -1
  }
}

/**
 * Remove a used backup code from the list.
 */
export function removeBackupCode(hashedCodesJson: string, index: number): string {
  const codes: string[] = JSON.parse(hashedCodesJson)
  codes.splice(index, 1)
  return JSON.stringify(codes)
}
