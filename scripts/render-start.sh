#!/bin/sh
# Helper start script for Render: run Prisma migrations, baseline if needed, then start Next.js.

set -u

log() {
  printf '[render-start] %s\n' "$1"
}

run_migrate_deploy() {
  npx prisma migrate deploy 2>&1
}

OUTPUT=$(run_migrate_deploy)
STATUS=$?

printf '%s\n' "$OUTPUT"

run_seed() {
  log "Running Prisma seed"
  npx prisma db seed
}

if [ "$STATUS" -eq 0 ]; then
  log "Migrations applied successfully."
  run_seed || {
    log "Prisma seed failed. Aborting startup."
    exit 1
  }
  log "Starting Next.js."
  (
    # Lightweight cron: call reminders sender hourly (endpoint de-duplicates per day)
    while true; do
      if [ -n "${CRON_SECRET:-}" ]; then
        curl -sS -X POST -H "x-cron-secret: $CRON_SECRET" "http://localhost:${PORT:-3000}/api/cron/reminders/send" >/dev/null 2>&1 || true
      fi
      sleep 3600
    done
  ) &
  exec next start
fi

if printf '%s' "$OUTPUT" | grep -q 'P3005'; then
  log "Existing schema detected without migration history. Applying baseline..."
  if [ ! -d prisma/migrations ]; then
    mkdir -p prisma/migrations
  fi

  # If there are no migration subfolders, create a baseline one on-the-fly
  has_migrations=false
  for path in prisma/migrations/*/; do
    if [ -d "$path" ]; then
      has_migrations=true
      break
    fi
  done

  if [ "$has_migrations" = false ]; then
    base_dir="prisma/migrations/00000000000000_baseline"
    log "No migrations present in repo. Creating on-the-fly baseline at $base_dir."
    mkdir -p "$base_dir"
    cat > "$base_dir/migration.sql" <<'SQL'
-- Baseline created at runtime on Render. The production database already has schema.
-- This marks the initial state as applied to establish migration history.
SQL
  fi

  # Mark all present migrations as applied
  for path in prisma/migrations/*/; do
    [ -d "$path" ] || continue
    dir=$(basename "$path")
    log "Marking migration $dir as applied."
    npx prisma migrate resolve --applied "$dir"
  done
  log "Re-running migrate deploy after baseline."
  npx prisma migrate deploy || {
    log "Migrate deploy failed after baseline recovery."
    # As a Render-only fallback, generate a runtime migration from current DB to schema and apply it.
    log "Attempting runtime migration via prisma migrate diff (Render-only fallback)."
    ts=$(date +%Y%m%d%H%M%S)
    rt_dir="prisma/migrations/${ts}_render_runtime"
    mkdir -p "$rt_dir"
    npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script > "$rt_dir/migration.sql" || {
      log "Runtime diff failed. Aborting."
      exit 1
    }
    if [ ! -s "$rt_dir/migration.sql" ]; then
      log "No diff produced; nothing to migrate."
    else
      log "Applying runtime migration and marking as applied."
      npx prisma migrate resolve --applied "$(basename "$rt_dir")" || true
      npx prisma migrate deploy || {
        log "Migrate deploy failed after runtime diff."
        exit 1
      }
    fi
  }
  run_seed || {
    log "Prisma seed failed after baseline recovery."
    exit 1
  }
  log "Migrations applied after baseline. Starting Next.js."
  (
    while true; do
      if [ -n "${CRON_SECRET:-}" ]; then
        curl -sS -X POST -H "x-cron-secret: $CRON_SECRET" "http://localhost:${PORT:-3000}/api/cron/reminders/send" >/dev/null 2>&1 || true
      fi
      sleep 3600
    done
  ) &
  exec next start
fi

log "Prisma migrate deploy failed (exit $STATUS) without baseline recovery."
exit "$STATUS"
