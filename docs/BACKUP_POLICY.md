# LabTrack — Backup, Recovery & Business Continuity Policy

**Document Number:** LT-BCP-001  
**Version:** 1.0  
**Classification:** Internal — Healthcare Compliance  
**Review Cycle:** Annual  

---

## 1. Purpose

This document defines the backup, recovery, and business continuity procedures for the LabTrack Expiry Management System. It is intended to satisfy the requirements of healthcare IT security reviews, vendor assessments, and applicable regulatory frameworks including HIPAA Administrative Safeguards (45 CFR § 164.308(a)(7)) Contingency Plan requirements.

---

## 2. Scope

This policy applies to all LabTrack database instances containing inventory, usage, team, and audit log data. It covers both SQLite (local/development deployments) and PostgreSQL (production deployments).

---

## 3. Backup Architecture

### 3.1 Backup Types

| Type | Frequency | Method | Retention |
|------|-----------|--------|-----------|
| Daily snapshot | Every 24 hours | Full database dump | 30 days |
| Pre-restore safety | On every restore | Full database copy | 7 days |
| Manual on-demand | Administrator triggered | Full database dump | 30 days |

### 3.2 What Is Backed Up

Every backup contains a complete point-in-time copy of:
- All product records (including soft-deleted items)
- All team member records
- All usage logs
- All activity logs
- All authentication audit events
- All user accounts (passwords stored as bcrypt hashes — never plain text)

### 3.3 Backup Storage

Backups are stored in the `/backups` directory relative to the application root by default. This location is configurable via the `BACKUP_DIR` environment variable.

**Production requirement:** The backup directory MUST be on a separate physical volume or network storage from the application database. Backups on the same disk as the database do not satisfy disaster recovery requirements.

Recommended configurations:
- **On-premises:** Map `BACKUP_DIR` to a NAS share or separate RAID array
- **Cloud (AWS):** Mount an EBS volume or S3 bucket (using s3fs or aws-cli in the backup script)
- **Cloud (Azure):** Azure Files share or Blob Storage
- **Hosted PostgreSQL** (Supabase/Neon/RDS): Use the provider's built-in PITR (Point-in-Time Recovery) in addition to application-level backups

---

## 4. Backup Procedures

### 4.1 Automated Daily Backup

The LabTrack backup engine (`scripts/backup/scheduledBackup.ts`) performs the following steps automatically:

1. **Create backup** — full database dump with timestamp in filename
2. **Compute SHA-256 checksum** — recorded in the backup manifest
3. **Verify integrity** — recomputes checksum and compares to stored value
4. **Run restore test** — restores backup to an isolated test environment and verifies data is readable
5. **Record result** — all steps logged to `logs/backup.log`
6. **Prune expired backups** — removes backups older than the retention period

**Scheduling:**

*Linux/Mac (cron):*
```bash
# Edit crontab: crontab -e
# Daily at 2:00 AM:
0 2 * * * cd /path/to/labtrack && npx tsx scripts/backup/scheduledBackup.ts >> logs/backup.log 2>&1
```

*Windows (Task Scheduler):*
- Trigger: Daily at 02:00
- Program: `node`
- Arguments: `node_modules/.bin/tsx scripts/backup/scheduledBackup.ts`
- Start In: `C:\path\to\labtrack`

### 4.2 Manual Backup Commands

```bash
npm run backup           # Create a backup immediately
npm run backup:verify    # Verify integrity of most recent backup
npm run backup:test      # Run restore test on most recent backup
npm run backup:list      # List all stored backups
npm run backup:prune     # Remove expired backups
npm run restore          # Interactive restore (with confirmation)
```

### 4.3 Backup Manifest

Every backup operation updates `backups/manifest.json`. This file records:
- Unique backup ID
- Filename and file path
- File size in bytes
- SHA-256 checksum
- Creation and expiry timestamps
- Verification status and date
- Restore test status and date

The manifest provides the complete backup history required for compliance audits.

---

## 5. Integrity Verification

### 5.1 Checksum Verification

Every backup file has a SHA-256 checksum computed at creation time and stored in the manifest. Verification re-computes the checksum and compares it to the stored value. A mismatch indicates the file has been modified or corrupted.

### 5.2 Automated Verification

The scheduled backup job automatically verifies each backup immediately after creation. Results are logged to `logs/backup.log`.

### 5.3 Manual Verification

```bash
# Verify the most recent backup:
npm run backup:verify

# Verify a specific backup by ID:
npx tsx scripts/backup/backupEngine.ts verify <backup-id>
```

---

## 6. Restore Procedures

### 6.1 Restore Test (Non-Destructive)

A restore test validates that a backup can be successfully restored **without touching the live database**. The backup is extracted into an isolated temporary environment and data is verified to be readable.

```bash
npm run backup:test
```

Healthcare requirement: Restore tests MUST be performed on every backup as part of the automated daily job, and results MUST be recorded in the backup manifest.

### 6.2 Production Restore (Destructive)

To restore the live database from a backup:

```bash
# Interactive restore — shows safety warnings and requires confirmation
npm run restore

# Or specify a backup:
npx tsx scripts/backup/restore.ts --id=<backup-id>
npx tsx scripts/backup/restore.ts --latest
npx tsx scripts/backup/restore.ts --list
```

**Safety features of the restore process:**
1. Integrity is verified before restore begins
2. The current live database is automatically saved as a pre-restore safety backup
3. Explicit confirmation (`RESTORE`) is required before proceeding
4. If restore fails, the system automatically reverts to the pre-restore safety backup

**After restoring:**
1. Restart the LabTrack application
2. Verify the application is functioning correctly
3. Document the restore in the incident log
4. Notify affected staff of the recovery window

### 6.3 Recovery Time Objectives

| Scenario | RTO Target | RPO Target |
|----------|-----------|-----------|
| Accidental data deletion | < 2 hours | < 24 hours (last backup) |
| Database corruption | < 4 hours | < 24 hours (last backup) |
| Server failure | < 8 hours | < 24 hours (last backup) |
| Disaster (full site loss) | < 24 hours | < 24 hours (off-site backup) |

*These are targets for a standard deployment. Actual recovery times depend on infrastructure and staffing.*

---

## 7. Off-Site Backup (Production Requirement)

Local backups alone do not satisfy disaster recovery requirements. Production deployments MUST implement off-site backup replication.

### 7.1 Recommended Options

**AWS S3 (simplest):**
```bash
# Add to scheduledBackup.ts after backup creation:
aws s3 cp backups/labtrack_*.db s3://your-bucket/labtrack-backups/ --sse aws:kms
```

**Azure Blob Storage:**
```bash
az storage blob upload-batch --destination labtrack-backups \
  --source ./backups --account-name yourstorageaccount
```

**Rsync to a remote server:**
```bash
rsync -avz --delete backups/ backup-user@backup-server:/labtrack/backups/
```

### 7.2 Encryption of Off-Site Backups

All backups stored off-site or in cloud storage MUST be encrypted. Use:
- **AWS S3:** Server-side encryption with KMS (`--sse aws:kms`)
- **Azure:** Storage service encryption (enabled by default on all Azure Storage)
- **Manual:** `gpg --symmetric --cipher-algo AES256 backup.db` before upload

---

## 8. Backup Monitoring and Alerting

### 8.1 Log Monitoring

Backup logs are written to `logs/backup.log`. Production systems should monitor this file for error lines:

```bash
# Check for failures (run after each scheduled backup):
grep "✗\|FAILED\|ERROR\|ACTION REQUIRED" logs/backup.log | tail -20
```

### 8.2 Alerting Setup

For production, configure alerting when a backup fails. Options:

- **Simple:** Add an email notification to the cron job on non-zero exit code
- **Advanced:** Integrate with your hospital's monitoring system (Nagios, Zabbix, PagerDuty)

Example cron with email alert:
```bash
0 2 * * * cd /path/to/labtrack && npx tsx scripts/backup/scheduledBackup.ts >> logs/backup.log 2>&1 || echo "LabTrack backup failed - check logs/backup.log" | mail -s "ALERT: LabTrack Backup Failure" it-alerts@hospital.org
```

### 8.3 In-App Dashboard

The Backup & Recovery dashboard (accessible at `/admin` to admin users) shows:
- Current backup health status
- List of all backups with integrity and restore test status
- Healthcare compliance checklist
- One-click backup, verify, and restore test actions

---

## 9. Data Retention

| Data Type | Retention Period | Basis |
|-----------|-----------------|-------|
| Daily backups | 30 days | Operational requirement |
| Pre-restore safety backups | 7 days | Operational requirement |
| Backup manifest | Indefinite | Compliance audit trail |
| Backup logs | 1 year | Audit requirement |

Backups are automatically pruned after their retention period by the scheduled backup job.

---

## 10. Roles and Responsibilities

| Role | Responsibility |
|------|----------------|
| System Administrator | Schedule automated backups; monitor backup logs; perform restore tests quarterly |
| Lab Coordinator (Admin user) | Review backup health dashboard weekly; escalate failures to IT |
| IT Security | Annual review of this policy; verify off-site backup replication |
| Department Head | Approve this policy; ensure IT resources for backup storage |

---

## 11. Compliance Evidence

For healthcare IT audits, the following evidence is available:

| Requirement | Evidence |
|-------------|----------|
| Backup policy exists | This document (LT-BCP-001) |
| Backups are automated | Cron/Task Scheduler configuration + `scheduledBackup.ts` |
| Backup integrity verified | SHA-256 checksums in `backups/manifest.json` |
| Restore procedures documented | Section 6 of this document |
| Restore tests performed | `restoreTestOk` and `restoreTestAt` fields in manifest |
| Retention policy enforced | `expiresAt` field in manifest + automated pruning |
| Audit trail of backup operations | `logs/backup.log` + manifest history |
| Off-site backups | Cloud storage integration (Section 7) |

---

## 12. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025 | System | Initial version |

---

*This document is reviewed annually or following any significant change to the LabTrack infrastructure.*
