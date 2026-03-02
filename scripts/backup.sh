#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# Skill Era — PostgreSQL Backup Script
# ═══════════════════════════════════════════════════════════════════════
#
# Usage:
#   ./scripts/backup.sh
#
# Cron example (daily at 2 AM):
#   0 2 * * * /path/to/skill-era/scripts/backup.sh >> /var/log/apex-backup.log 2>&1
#
# Requirements:
#   - pg_dump, pg_restore, gzip, openssl
#   - Environment variables: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
#   - BACKUP_ENCRYPTION_KEY (mandatory — loaded from env, NOT stored with backups)
#
# Safety:
#   - Encryption key is NOT stored alongside backups
#   - Backup integrity verified with pg_restore --list
#   - 7-day retention with automatic rotation
#   - Optional S3 upload if BACKUP_S3_BUCKET is set
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ─────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/var/backups/skill-era}"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/skill_era_${TIMESTAMP}.dump.gz.enc"
LOG_FILE="${BACKUP_DIR}/backup.log"

# ── Validate encryption key ──────────────────────────────
if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    echo "$(date -Iseconds) FATAL: BACKUP_ENCRYPTION_KEY is not set. Aborting backup." | tee -a "$LOG_FILE"
    exit 1
fi

# ── Create backup directory ──────────────────────────────
mkdir -p "$BACKUP_DIR"

echo "$(date -Iseconds) INFO: Starting backup of ${DB_NAME}@${DB_HOST}:${DB_PORT}" | tee -a "$LOG_FILE"

# ── Run pg_dump → gzip → encrypt ────────────────────────
export PGPASSWORD="$DB_PASSWORD"

pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --format=custom \
    --no-owner \
    --no-privileges \
    --compress=0 \
    | gzip -9 \
    | openssl enc -aes-256-cbc -salt -pbkdf2 \
        -pass "env:BACKUP_ENCRYPTION_KEY" \
        -out "$BACKUP_FILE"

unset PGPASSWORD

if [ $? -ne 0 ]; then
    echo "$(date -Iseconds) ERROR: Backup failed for ${DB_NAME}" | tee -a "$LOG_FILE"
    exit 1
fi

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "$(date -Iseconds) INFO: Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})" | tee -a "$LOG_FILE"

# ── Verify backup integrity ─────────────────────────────
echo "$(date -Iseconds) INFO: Verifying backup integrity..." | tee -a "$LOG_FILE"

VERIFY_TMP=$(mktemp)
openssl enc -aes-256-cbc -d -salt -pbkdf2 \
    -pass "env:BACKUP_ENCRYPTION_KEY" \
    -in "$BACKUP_FILE" \
    | gunzip \
    | pg_restore --list > "$VERIFY_TMP" 2>&1

VERIFY_EXIT=$?
rm -f "$VERIFY_TMP"

if [ $VERIFY_EXIT -ne 0 ]; then
    echo "$(date -Iseconds) ERROR: Backup verification FAILED. The backup file may be corrupt." | tee -a "$LOG_FILE"
    exit 1
fi

echo "$(date -Iseconds) INFO: Backup verified successfully" | tee -a "$LOG_FILE"

# ── Upload to S3 (optional) ─────────────────────────────
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
    echo "$(date -Iseconds) INFO: Uploading to S3: ${BACKUP_S3_BUCKET}" | tee -a "$LOG_FILE"
    aws s3 cp "$BACKUP_FILE" "s3://${BACKUP_S3_BUCKET}/backups/$(basename "$BACKUP_FILE")" \
        --sse AES256 \
        --quiet
    echo "$(date -Iseconds) INFO: S3 upload complete" | tee -a "$LOG_FILE"
fi

# ── Rotate old backups ───────────────────────────────────
echo "$(date -Iseconds) INFO: Rotating backups older than ${RETENTION_DAYS} days" | tee -a "$LOG_FILE"
find "$BACKUP_DIR" -name "skill_era_*.dump.gz.enc" -mtime +${RETENTION_DAYS} -delete
echo "$(date -Iseconds) INFO: Rotation complete" | tee -a "$LOG_FILE"

echo "$(date -Iseconds) INFO: Backup completed successfully" | tee -a "$LOG_FILE"
