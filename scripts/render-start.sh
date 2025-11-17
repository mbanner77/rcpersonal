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
  exec next start
fi

if printf '%s' "$OUTPUT" | grep -q 'P3005'; then
  log "Existing schema detected without migration history. Applying baseline..."
  if [ -d prisma/migrations ]; then
    for path in prisma/migrations/*/; do
      [ -d "$path" ] || continue
      dir=$(basename "$path")
      log "Marking migration $dir as applied."
      npx prisma migrate resolve --applied "$dir"
    done
  fi
  log "Re-running migrate deploy after baseline."
  npx prisma migrate deploy || {
    log "Migrate deploy failed after baseline recovery."
    exit 1
  }
  run_seed || {
    log "Prisma seed failed after baseline recovery."
    exit 1
  }
  log "Migrations applied after baseline. Starting Next.js."
  exec next start
fi

log "Prisma migrate deploy failed (exit $STATUS) without baseline recovery."
exit "$STATUS"
