#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# Skill Era — PostgreSQL WAL Archiving Setup
# ═══════════════════════════════════════════════════════════════════════
#
# Purpose:
#   Enables continuous Write-Ahead Log (WAL) archiving for point-in-time
#   recovery (PITR). This reduces RPO from 24 hours (daily pg_dump)
#   to near-zero (seconds of data loss at worst).
#
# Usage:
#   1. Run this script once to configure WAL archiving on the PostgreSQL server.
#   2. Then restart PostgreSQL for changes to take effect.
#   3. The daily backup.sh continues running for full base backups.
#   4. WAL files are continuously streamed between full backups.
#
# Recovery model:
#   - Restore latest base backup (from backup.sh)
#   - Replay WAL files up to the desired point-in-time
#   - RPO: ~0 seconds | RTO: 15-30 minutes
#
# Requires: PostgreSQL superuser access, writable archive directory
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ─────────────────────────────────────────
WAL_ARCHIVE_DIR="${WAL_ARCHIVE_DIR:-/var/backups/skill-era/wal}"
PG_DATA="${PGDATA:-/var/lib/postgresql/data}"
PG_CONF="${PG_DATA}/postgresql.conf"

echo "=== Skill Era — WAL Archiving Setup ==="
echo "Archive dir: ${WAL_ARCHIVE_DIR}"
echo "PG data dir: ${PG_DATA}"
echo ""

# ── Create archive directory ─────────────────────────────
mkdir -p "${WAL_ARCHIVE_DIR}"
chown postgres:postgres "${WAL_ARCHIVE_DIR}"
chmod 700 "${WAL_ARCHIVE_DIR}"
echo "✅ Archive directory created"

# ── Configure postgresql.conf ────────────────────────────
# Only append if not already configured
if ! grep -q "# APEX_ARENA_WAL_CONFIG" "${PG_CONF}" 2>/dev/null; then
    cat >> "${PG_CONF}" <<-WALEOF

# ── APEX_ARENA_WAL_CONFIG ─────────────────────────────────
# Continuous WAL archiving for point-in-time recovery (PITR)
# Configured by: scripts/setup_wal_archiving.sh

# Enable WAL archiving
wal_level = replica
archive_mode = on

# Archive command: copy WAL segment to archive directory
# %p = path to WAL file, %f = filename
archive_command = 'test ! -f ${WAL_ARCHIVE_DIR}/%f && cp %p ${WAL_ARCHIVE_DIR}/%f'

# Timeout: force WAL switch after 5 minutes of inactivity
# This ensures WAL files are archived even during low-activity periods
archive_timeout = 300

# Keep enough WAL for pg_basebackup to work without interruption
max_wal_senders = 3
wal_keep_size = 1GB
# ── END APEX_ARENA_WAL_CONFIG ─────────────────────────────
WALEOF

    echo "✅ PostgreSQL WAL configuration appended"
else
    echo "⚠️  WAL configuration already present in postgresql.conf"
fi

echo ""
echo "=== Next Steps ==="
echo "1. Restart PostgreSQL:  sudo systemctl restart postgresql"
echo "2. Verify WAL archiving is active:"
echo "   psql -U postgres -c \"SELECT name, setting FROM pg_settings WHERE name IN ('wal_level', 'archive_mode', 'archive_command');\""
echo "3. Monitor WAL archive directory:  ls -la ${WAL_ARCHIVE_DIR}/"
echo ""
echo "=== PITR Recovery Steps ==="
echo "1. Restore base backup:     ./scripts/backup.sh (or restore from S3)"
echo "2. Copy WAL files to pg_wal:"
echo "   restore_command = 'cp ${WAL_ARCHIVE_DIR}/%f %p'"
echo "3. Set recovery target:     recovery_target_time = '2026-02-26 16:30:00+05:30'"
echo "4. Create recovery signal:  touch \${PGDATA}/recovery.signal"
echo "5. Start PostgreSQL — it will replay WAL up to target time"
echo ""
echo "RPO after WAL archiving: ~5 minutes (archive_timeout)"
echo "RTO: 15-30 minutes (restore base + replay WAL)"
