# Database Backup & Restore Procedures

## Backup

### Automated Daily Backup

The backup script runs via cron at 2 AM daily:

```bash
# Add to crontab:
0 2 * * * /path/to/skill-era/scripts/backup.sh >> /var/log/apex-backup.log 2>&1
```

### Required Environment Variables

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=skill_era
DB_USER=apex_admin
DB_PASSWORD=<password>
BACKUP_ENCRYPTION_KEY=<min-16-char-key>  # NEVER store alongside backups
BACKUP_DIR=/var/backups/skill-era
BACKUP_S3_BUCKET=                        # Optional: S3 bucket for offsite copy
```

### What the Script Does

1. Validates `BACKUP_ENCRYPTION_KEY` is set (aborts if missing)
2. Runs `pg_dump --format=custom` → `gzip` → `openssl enc -aes-256-cbc`
3. Verifies backup integrity via `pg_restore --list`
4. Optionally uploads to S3 with server-side encryption
5. Rotates backups older than 7 days

---

## Restore

### Step 1: Decrypt the Backup

```bash
export BACKUP_ENCRYPTION_KEY="<your-key>"

openssl enc -aes-256-cbc -d -salt -pbkdf2 \
  -pass "env:BACKUP_ENCRYPTION_KEY" \
  -in /var/backups/skill-era/skill_era_20260226_020000.dump.gz.enc \
  | gunzip > /tmp/skill_era_restore.dump
```

### Step 2: Verify Before Restoring

```bash
pg_restore --list /tmp/skill_era_restore.dump
```

### Step 3: Restore to Database

```bash
# Option A: Restore to EXISTING database (overwrites data)
pg_restore \
  --host=localhost \
  --port=5432 \
  --username=apex_admin \
  --dbname=skill_era \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  /tmp/skill_era_restore.dump

# Option B: Restore to NEW database
createdb -h localhost -U apex_admin skill_era_restored
pg_restore \
  --host=localhost \
  --username=apex_admin \
  --dbname=skill_era_restored \
  --no-owner \
  /tmp/skill_era_restore.dump
```

### Step 4: Verify Restoration

```sql
-- Check record counts against expected
SELECT 'users' AS table_name, COUNT(*) FROM users
UNION ALL SELECT 'wallets', COUNT(*) FROM wallets
UNION ALL SELECT 'deposits', COUNT(*) FROM deposits
UNION ALL SELECT 'withdrawals', COUNT(*) FROM withdrawals
UNION ALL SELECT 'wallet_transactions', COUNT(*) FROM wallet_transactions;
```

### Step 5: Cleanup

```bash
rm /tmp/skill_era_restore.dump
```

---

## Index for Performance

Ensure this index exists for the withdrawal velocity check:

```sql
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_created
ON withdrawals(user_id, created_at);
```
