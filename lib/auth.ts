// lib/auth.ts
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import { verifyPassword, isPasswordExpired } from './passwordPolicy'
import { logAuthEvent, recordFailedLogin, resetFailedLogins, isAccountLocked } from './apiAuth'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // 8 hours

  pages: {
    signIn: '/login',
    error:  '/login',
  },

  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
        mfaCode:  { label: 'MFA Code', type: 'text'     },
        ip:       { label: 'IP',       type: 'text'     }, // passed from login page
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email.toLowerCase().trim()
        const ip    = credentials.ip || 'unknown'

        const user = await prisma.user.findUnique({ where: { email } })

        // Always take the same amount of time whether user exists or not
        // (prevents user enumeration via timing attacks)
        if (!user) {
          await logAuthEvent({ email, event: 'login_failure', ipAddress: ip, detail: 'User not found' })
          // Run a dummy bcrypt compare to prevent timing attacks
          await verifyPassword('dummy', '$2b$12$dummy.hash.that.never.matches.anything.here')
          return null
        }

        // Check account lockout
        const locked = await isAccountLocked(user.id)
        if (locked) {
          await logAuthEvent({ email, event: 'login_failure', userId: user.id, ipAddress: ip, detail: 'Account locked' })
          return null
        }

        // Check account status
        if (user.status === 'inactive') {
          await logAuthEvent({ email, event: 'login_failure', userId: user.id, ipAddress: ip, detail: 'Account inactive' })
          return null
        }

        // Verify password
        const passwordMatch = await verifyPassword(credentials.password, user.password)
        if (!passwordMatch) {
          const { locked: nowLocked } = await recordFailedLogin(user.id, email, ip)
          await logAuthEvent({
            email, event: 'login_failure', userId: user.id, ipAddress: ip,
            detail: nowLocked ? 'Account locked due to failed attempts' : 'Invalid password',
          })
          return null
        }

        // MFA check — if enabled, require a valid TOTP code
        if (user.mfaEnabled && user.mfaSecret) {
          if (!credentials.mfaCode) {
            // Signal to the login page that MFA is required
            await logAuthEvent({ email, event: 'mfa_failure', userId: user.id, ipAddress: ip, detail: 'MFA code not provided' })
            throw new Error('MFA_REQUIRED')
          }
          const { verifyTotpCode } = await import('./mfa')
          const mfaValid = verifyTotpCode(credentials.mfaCode, user.mfaSecret)

          // Also check backup codes if TOTP fails
          let usedBackup = false
          if (!mfaValid && user.mfaBackupCodes) {
            const { verifyAndConsumeBackupCode, removeBackupCode } = await import('./mfa')
            const idx = await verifyAndConsumeBackupCode(credentials.mfaCode, user.mfaBackupCodes)
            if (idx >= 0) {
              const newCodes = removeBackupCode(user.mfaBackupCodes, idx)
              await prisma.user.update({ where: { id: user.id }, data: { mfaBackupCodes: newCodes } })
              usedBackup = true
              await logAuthEvent({ email, event: 'backup_code_used', userId: user.id, ipAddress: ip })
            }
          }

          if (!mfaValid && !usedBackup) {
            await logAuthEvent({ email, event: 'mfa_failure', userId: user.id, ipAddress: ip, detail: 'Invalid MFA code' })
            return null
          }
          if (mfaValid) {
            await logAuthEvent({ email, event: 'mfa_success', userId: user.id, ipAddress: ip })
          }
        }

        // Success — reset lockout counter and update last login
        await resetFailedLogins(user.id)
        await prisma.user.update({
          where: { id: user.id },
          data:  { lastLoginAt: new Date(), lastLoginIp: ip },
        })
        await logAuthEvent({ email, event: 'login_success', userId: user.id, ipAddress: ip })

        return {
          id:               String(user.id),
          email:            user.email,
          name:             user.name,
          role:             user.role,
          avatar:           user.avatar,
          mfaEnabled:       user.mfaEnabled,
          passwordExpired:  isPasswordExpired(user.passwordChangedAt),
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role             = (user as Record<string, unknown>).role as string
        token.avatar           = (user as Record<string, unknown>).avatar as string
        token.mfaEnabled       = (user as Record<string, unknown>).mfaEnabled as boolean
        token.passwordExpired  = (user as Record<string, unknown>).passwordExpired as boolean
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as Record<string, unknown>
        u.id              = token.sub
        u.role            = token.role
        u.avatar          = token.avatar
        u.mfaEnabled      = token.mfaEnabled
        u.passwordExpired = token.passwordExpired
      }
      return session
    },
  },

  events: {
    async signOut({ token }) {
      if (token?.email) {
        await logAuthEvent({ email: token.email as string, event: 'logout', userId: Number(token.sub) || undefined })
      }
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
}

