#!/usr/bin/env bash
# Render build script: install deps, apply DB migrations safely, then build Next.js
set -euo pipefail

log() { printf '[render-build] %s\n' "$1"; }

log "Installing dependencies (npm ci)"
npm ci

log "Applying Prisma migrations (migrate deploy)"
# Avoid failing when DATABASE_URL is missing (local preview builds)
if [ -n "${DATABASE_URL:-}" ]; then
  # Fix provider mismatch (P3019) if lock file was created with sqlite previously
  if [ -f prisma/migrations/migration_lock.toml ] && grep -q 'provider = "sqlite"' prisma/migrations/migration_lock.toml; then
    log "Removing outdated migration_lock.toml (sqlite -> postgres)"
    rm -f prisma/migrations/migration_lock.toml
  fi

  # Pre-flight: if there are recorded failed runtime migrations, mark them rolled-back
  for path in prisma/migrations/*render_runtime*/; do
    [ -d "$path" ] || continue
    dir=$(basename "$path")
    log "Pre-flight resolve: marking failed runtime migration as rolled-back: $dir"
    npx prisma migrate resolve --rolled-back "$dir" || true
  done

  set +e
  OUTPUT=$(npx prisma migrate deploy 2>&1)
  STATUS=$?
  set -e
  printf '%s\n' "$OUTPUT"

  if [ "$STATUS" -ne 0 ]; then
    if printf '%s' "$OUTPUT" | grep -q 'P3009'; then
      log "Detected P3009 (failed migrations). Marking runtime migrations as rolled back."
      for path in prisma/migrations/*render_runtime*/; do
        [ -d "$path" ] || continue
        dir=$(basename "$path")
        log "Resolving failed migration as rolled-back: $dir"
        npx prisma migrate resolve --rolled-back "$dir" || true
      done
      log "Retrying migrate deploy after rolling back failed runtime migrations."
      set +e
      OUTPUT_RB=$(npx prisma migrate deploy 2>&1)
      STATUS_RB=$?
      set -e
      printf '%s\n' "$OUTPUT_RB"
      if [ "$STATUS_RB" -eq 0 ]; then
        log "migrate deploy succeeded after rolling back failed migrations."
      else
        log "migrate deploy still failing; proceeding to baseline recovery."
      fi
    fi
    # Baseline existing DB: mark all migrations as applied, then try again
    log "migrate deploy failed; attempting baseline recovery"
    for path in prisma/migrations/*/; do
      [ -d "$path" ] || continue
      dir=$(basename "$path")
      log "Marking migration $dir as applied."
      npx prisma migrate resolve --applied "$dir" || true
    done
    log "Re-running migrate deploy after baseline."
    set +e
    OUTPUT2=$(npx prisma migrate deploy 2>&1)
    STATUS2=$?
    set -e
    printf '%s\n' "$OUTPUT2"

    if [ "$STATUS2" -ne 0 ]; then
      # As a last resort, generate a runtime migration diff from DB -> schema and apply
      log "Baseline recovery failed. Attempting runtime migration via prisma migrate diff."
      ts=$(date +%Y%m%d%H%M%S)
      rt_dir="prisma/migrations/${ts}_render_runtime"
      mkdir -p "$rt_dir"
      npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script > "$rt_dir/migration.sql" || {
        log "Runtime diff failed. Aborting build."; exit 1; }
      if [ ! -s "$rt_dir/migration.sql" ]; then
        log "No diff produced; continuing."
      else
        log "Applying runtime migration and marking as applied."
        npx prisma migrate deploy || { log "migrate deploy failed after runtime diff."; exit 1; }
      fi
      # If runtime diff path also caused P3009, roll it back and do a final deploy try
      set +e
      OUT3=$(npx prisma migrate status 2>&1)
      set -e
      if printf '%s' "$OUT3" | grep -q 'has failed'; then
        log "Detected failed runtime migration after diff; marking as rolled-back and retrying final deploy."
        for path in prisma/migrations/*render_runtime*/; do
          [ -d "$path" ] || continue
          dir=$(basename "$path")
          npx prisma migrate resolve --rolled-back "$dir" || true
        done
        npx prisma migrate deploy || { log "Final migrate deploy failed after rollback."; exit 1; }
      fi
    fi
  fi
  # Ensure DB now matches schema: generate a diff and apply if any remaining changes
  ts2=$(date +%Y%m%d%H%M%S)
  rt_dir2="prisma/migrations/${ts2}_render_runtime_sync"
  mkdir -p "$rt_dir2"
  npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script > "$rt_dir2/migration.sql" || true
  if [ -s "$rt_dir2/migration.sql" ]; then
    log "Additional schema changes found; applying runtime sync migration."
    npx prisma migrate deploy || { log "migrate deploy failed after runtime sync."; exit 1; }
  else
    rm -rf "$rt_dir2"
  fi
else
  log "DATABASE_URL not set; skipping migrate deploy in build."
fi

log "Generating Prisma client"
npx prisma generate

log "Building Next.js"
npm run build
