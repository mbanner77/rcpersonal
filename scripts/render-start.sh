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

if [ "$STATUS" -eq 0 ]; then
  log "Migrations applied successfully. Starting Next.js."
  exec next start
fi

if printf '%s' "$OUTPUT" | grep -q 'P3005'; then
  log "Existing schema detected without migration history. Applying baseline..."
  if [ -d prisma/migrations ]; then
    for dir in $(ls -1 prisma/migrations | sort); do
      log "Marking migration $dir as applied."
      npx prisma migrate resolve --applied "$dir"
    done
  fi
  log "Re-running migrate deploy after baseline."
  npx prisma migrate deploy
  log "Migrations applied after baseline. Starting Next.js."
  exec next start
fi

log "Prisma migrate deploy failed (exit $STATUS) without baseline recovery."
exit "$STATUS"
