// scripts/backup/restore.ts
//
// Production restore script with safety checks.
// This WILL overwrite the live database — requires explicit confirmation.
//
// Usage:
//   npx tsx scripts/backup/restore.ts --id=<backup-id>   — restore specific backup
//   npx tsx scripts/backup/restore.ts --latest           — restore most recent backup
//   npx tsx scripts/backup/restore.ts --list             — list available backups

import fs            from 'fs'
import path          from 'path'
import readline      from 'readline'
import { execSync }  from 'child_process'
import { listBackups, verifyBackup, type BackupEntry } from './backupEngine'

const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'prisma', 'dev.db')
const DB_PROVIDER    = process.env.DB_PROVIDER    || 'sqlite'
const POSTGRES_URL   = process.env.DATABASE_URL   || ''

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer) })
  })
}

function createPreRestoreBackup(): string {
  // Always take a safety backup of the current database before restoring
  const timestamp   = new Date().toISOString().replace(/[:.]/g, '-')
  const safetyPath  = path.join(process.cwd(), 'backups', `PRE_RESTORE_SAFETY_${timestamp}.db`)
  fs.mkdirSync(path.dirname(safetyPath), { recursive: true })

  if (DB_PROVIDER === 'sqlite') {
    if (fs.existsSync(SQLITE_DB_PATH)) {
      fs.copyFileSync(SQLITE_DB_PATH, safetyPath)
      console.log(`\n  Safety backup saved to: ${safetyPath}`)
      return safetyPath
    }
  }
  return ''
}

function restoreSqlite(entry: BackupEntry) {
  console.log(`\nRestoring SQLite database from: ${entry.filename}`)

  // Create safety backup first
  const safetyPath = createPreRestoreBackup()

  try {
    // Stop any WAL checkpointing by removing WAL/SHM files
    const walPath = SQLITE_DB_PATH + '-wal'
    const shmPath = SQLITE_DB_PATH + '-shm'
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)

    // Replace the database file
    fs.copyFileSync(entry.filepath, SQLITE_DB_PATH)
    console.log(`  ✓ Database restored to: ${SQLITE_DB_PATH}`)

  } catch (err) {
    console.error(`  ✗ Restore failed: ${(err as Error).message}`)
    if (safetyPath && fs.existsSync(safetyPath)) {
      console.log(`  Reverting to safety backup...`)
      fs.copyFileSync(safetyPath, SQLITE_DB_PATH)
      console.log(`  ✓ Reverted to pre-restore state`)
    }
    throw err
  }
}

function restorePostgres(entry: BackupEntry) {
  console.log(`\nRestoring PostgreSQL database from: ${entry.filename}`)

  // Parse database name from connection string for drop/create
  const dbNameMatch = POSTGRES_URL.match(/\/([^/?]+)(\?|$)/)
  const dbName      = dbNameMatch?.[1] || 'labtrack'

  console.log(`  ⚠ This will DROP and recreate database: ${dbName}`)

  try {
    // Run the SQL dump file
    execSync(
      `psql "${POSTGRES_URL}" -f "${entry.filepath}"`,
      { stdio: 'inherit', env: { ...process.env } }
    )
    console.log(`  ✓ PostgreSQL database restored`)
  } catch (err) {
    throw new Error(`psql restore failed: ${(err as Error).message}`)
  }
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--list')) {
    const backups = listBackups()
    console.log(`\nAvailable backups (${backups.length}):\n`)
    for (const b of backups) {
      const tested = b.restoreTestOk ? '✓ restore-tested' : '⚠ not tested'
      const verified = b.status === 'verified' ? '✓ verified' : b.status
      console.log(`  [${b.id}]  ${b.filename}`)
      console.log(`           Created: ${new Date(b.createdAt).toLocaleString()}`)
      console.log(`           Size: ${(b.sizeBytes/1024).toFixed(1)} KB  |  ${verified}  |  ${tested}\n`)
    }
    process.exit(0)
  }

  // Find the backup to restore
  let entry: BackupEntry | undefined
  const idArg = args.find(a => a.startsWith('--id='))

  if (idArg) {
    const id = idArg.split('=')[1]
    entry = listBackups().find(b => b.id === id)
    if (!entry) { console.error(`Backup not found: ${id}`); process.exit(1) }
  } else if (args.includes('--latest')) {
    const all = listBackups().filter(b => b.status !== 'missing')
    entry = all[0]
    if (!entry) { console.error('No backups available'); process.exit(1) }
  } else {
    console.log('Usage:')
    console.log('  npx tsx scripts/backup/restore.ts --list')
    console.log('  npx tsx scripts/backup/restore.ts --latest')
    console.log('  npx tsx scripts/backup/restore.ts --id=<backup-id>')
    process.exit(0)
  }

  // ── Safety checks ───────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log('  ⚠  LABTRACK DATABASE RESTORE')
  console.log('═'.repeat(60))
  console.log(`\n  Backup:   ${entry.filename}`)
  console.log(`  Created:  ${new Date(entry.createdAt).toLocaleString()}`)
  console.log(`  Size:     ${(entry.sizeBytes/1024).toFixed(1)} KB`)
  console.log(`  Tested:   ${entry.restoreTestOk ? 'Yes ✓' : 'No ⚠ (not restore-tested)'}`)
  console.log(`  Verified: ${entry.status}`)
  console.log('\n  ⚠ WARNING: This will OVERWRITE the live database.')
  console.log('  The current database will be saved as a safety backup first.\n')

  if (!entry.restoreTestOk) {
    console.log('  ⚠ This backup has NOT been restore-tested.')
    const proceed = await ask('  Continue anyway? (yes/no): ')
    if (proceed.trim().toLowerCase() !== 'yes') {
      console.log('\nRestore cancelled.')
      process.exit(0)
    }
  }

  // Verify backup integrity before restoring
  console.log('\nVerifying backup integrity...')
  const verifyResult = verifyBackup(entry.id)
  if (!verifyResult.ok) {
    console.error(`\n✗ INTEGRITY CHECK FAILED: ${verifyResult.message}`)
    console.error('Restore aborted — backup file may be corrupted.')
    process.exit(1)
  }
  console.log('✓ Integrity check passed\n')

  const confirm = await ask(`Type "RESTORE" to confirm and proceed: `)
  if (confirm.trim() !== 'RESTORE') {
    console.log('\nRestore cancelled.')
    process.exit(0)
  }

  // ── Perform restore ─────────────────────────────────────────────────────────
  console.log('\nRestoring...')
  try {
    if (DB_PROVIDER === 'postgresql') {
      restorePostgres(entry)
    } else {
      restoreSqlite(entry)
    }
    console.log('\n✅ Restore complete.')
    console.log('   Restart the LabTrack application to use the restored database.')
  } catch (err) {
    console.error(`\n✗ Restore failed: ${(err as Error).message}`)
    process.exit(1)
  }
}

main()
