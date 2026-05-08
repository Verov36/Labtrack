// app/api/admin/backup/route.ts
// Admin-only API for triggering and viewing backups from the UI.
// All operations require admin role.

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs   from 'fs'
import { requireRole } from '@/lib/apiAuth'
import { apiRateLimit, getClientIp } from '@/lib/rateLimit'

const MANIFEST_PATH = process.env.BACKUP_DIR
  ? path.join(process.env.BACKUP_DIR, 'manifest.json')
  : path.join(process.cwd(), 'backups', 'manifest.json')

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return { version: 1, lastBackup: null, entries: [] }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
}

/** GET: Return backup manifest and status */
export async function GET(req: NextRequest) {
  const rl = apiRateLimit(getClientIp(req))
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { error } = await requireRole('admin')
  if (error) return error

  const manifest   = loadManifest()
  const backupDir  = path.dirname(MANIFEST_PATH)
  const diskUsage  = manifest.entries.reduce((sum: number, e: { sizeBytes: number }) => sum + (e.sizeBytes || 0), 0)
  const lastBackup = manifest.lastBackup ? new Date(manifest.lastBackup) : null
  const now        = new Date()
  const hoursSinceBackup = lastBackup
    ? Math.round((now.getTime() - lastBackup.getTime()) / 3600000)
    : null

  // Overall backup health status
  const recentEntries = manifest.entries.slice(-3)
  const allVerified   = recentEntries.every((e: { status: string }) => e.status === 'verified' || e.status === 'ok')
  const allTested     = recentEntries.every((e: { restoreTestOk: boolean }) => e.restoreTestOk === true)
  const backupCurrent = hoursSinceBackup !== null && hoursSinceBackup < 25 // within 25 hours

  let healthStatus: 'healthy' | 'warning' | 'critical' = 'critical'
  if (backupCurrent && allVerified) healthStatus = allTested ? 'healthy' : 'warning'
  else if (backupCurrent) healthStatus = 'warning'

  return NextResponse.json({
    health: {
      status:            healthStatus,
      lastBackup:        manifest.lastBackup,
      hoursSinceBackup,
      backupCurrent,
      allVerified,
      allTested,
      totalBackups:      manifest.entries.length,
      diskUsageBytes:    diskUsage,
      retentionDays:     parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
      backupDir,
    },
    entries: manifest.entries
      .sort((a: { createdAt: string }, b: { createdAt: string }) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 30), // last 30 entries
  })
}

/** POST: Trigger a backup, verify, or restore test */
export async function POST(req: NextRequest) {
  const rl = apiRateLimit(getClientIp(req))
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { user, error } = await requireRole('admin')
  if (error) return error

  const body   = await req.json().catch(() => ({}))
  const action = body.action as string

  // Import backup engine dynamically to keep the API route fast when not in use
  try {
    if (action === 'backup') {
      const { runBackup } = await import('@/scripts/backup/backupEngine')
      const entry = await runBackup()
      return NextResponse.json({ success: true, entry, message: `Backup created: ${entry.filename}` })

    } else if (action === 'verify') {
      const { verifyBackup } = await import('@/scripts/backup/backupEngine')
      const result = verifyBackup(body.entryId)
      return NextResponse.json({ success: result.ok, entry: result.entry, message: result.message })

    } else if (action === 'test') {
      const { runRestoreTest } = await import('@/scripts/backup/backupEngine')
      const result = await runRestoreTest(body.entryId)
      return NextResponse.json({ success: result.ok, message: result.message, rowCounts: result.rowCounts })

    } else if (action === 'prune') {
      const { pruneOldBackups } = await import('@/scripts/backup/backupEngine')
      const pruned = await pruneOldBackups()
      return NextResponse.json({ success: true, message: `Pruned ${pruned} expired backup(s)` })

    } else {
      return NextResponse.json({ error: 'Invalid action. Use: backup | verify | test | prune' }, { status: 400 })
    }
  } catch (err) {
    console.error('[Backup API]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
