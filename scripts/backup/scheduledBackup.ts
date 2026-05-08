// scripts/backup/scheduledBackup.ts
//
// This script is designed to be run by a scheduler (cron on Linux/Mac,
// Task Scheduler on Windows). It runs a backup, verifies it, runs a
// restore test, and logs everything to a persistent file.
//
// ── Linux/Mac cron setup ──────────────────────────────────────────────────────
// Run: crontab -e
// Add this line for daily backup at 2:00 AM:
//   0 2 * * * cd /path/to/labtrack && npx tsx scripts/backup/scheduledBackup.ts >> logs/backup.log 2>&1
//
// ── Windows Task Scheduler setup ─────────────────────────────────────────────
// 1. Open Task Scheduler
// 2. Create Basic Task → name it "LabTrack Daily Backup"
// 3. Trigger: Daily at 2:00 AM
// 4. Action: Start a program
//    Program:   node
//    Arguments: node_modules/.bin/tsx scripts/backup/scheduledBackup.ts
//    Start in:  C:\path\to\labtrack
// 5. Conditions: uncheck "Start only if on AC power"
//
// ── Docker / container setup ─────────────────────────────────────────────────
// Add to your docker-compose.yml:
//   labtrack-backup:
//     image: node:20-alpine
//     working_dir: /app
//     volumes: ['./:/app', './backups:/app/backups']
//     command: sh -c "while true; do sleep 86400 && npx tsx scripts/backup/scheduledBackup.ts; done"
//     environment: [DATABASE_URL, BACKUP_DIR=/app/backups]

import fs   from 'fs'
import path from 'path'
import { runBackup, verifyBackup, runRestoreTest } from './backupEngine'

const LOG_DIR  = process.env.LOG_DIR  || path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'backup.log')

function log(message: string) {
  const line = `[${new Date().toISOString()}] ${message}`
  console.log(line)
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true })
    fs.appendFileSync(LOG_FILE, line + '\n')
  } catch {
    // If log file isn't writable, just continue — console output is still captured
  }
}

async function runScheduledBackup() {
  log('=== LabTrack Scheduled Backup Started ===')

  let exitCode = 0

  try {
    // ── Step 1: Create backup ───────────────────────────────────────────────
    log('Step 1/3: Creating backup...')
    const entry = await runBackup()
    log(`✓ Backup created: ${entry.filename} (${(entry.sizeBytes/1024).toFixed(1)} KB)`)
    log(`  SHA-256: ${entry.sha256}`)
    log(`  Expires: ${new Date(entry.expiresAt).toLocaleDateString()}`)

    // ── Step 2: Verify integrity ────────────────────────────────────────────
    log('Step 2/3: Verifying backup integrity...')
    const verifyResult = verifyBackup(entry.id)
    if (!verifyResult.ok) {
      log(`✗ INTEGRITY CHECK FAILED: ${verifyResult.message}`)
      log('  ⚠ ACTION REQUIRED: Backup file may be corrupted. Investigate immediately.')
      exitCode = 1
    } else {
      log('✓ Integrity check passed')
    }

    // ── Step 3: Restore test ────────────────────────────────────────────────
    log('Step 3/3: Running restore test...')
    const testResult = await runRestoreTest(entry.id)
    if (!testResult.ok) {
      log(`✗ RESTORE TEST FAILED: ${testResult.message}`)
      log('  ⚠ ACTION REQUIRED: Backup cannot be restored. Check database integrity.')
      exitCode = 1
    } else {
      log(`✓ Restore test passed`)
      if (testResult.rowCounts) {
        log(`  Data counts: ${JSON.stringify(testResult.rowCounts)}`)
      }
    }

    if (exitCode === 0) {
      log('=== Backup job SUCCEEDED ===')
    } else {
      log('=== Backup job COMPLETED WITH ERRORS — review above ===')
    }

  } catch (err) {
    log(`✗ BACKUP JOB FAILED: ${(err as Error).message}`)
    log('  ⚠ ACTION REQUIRED: Backup did not complete. Investigate immediately.')
    exitCode = 1
  }

  log(`Exit code: ${exitCode}`)
  process.exit(exitCode)
}

runScheduledBackup()
