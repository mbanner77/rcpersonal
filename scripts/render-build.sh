#!/usr/bin/env bash
# Render build script: install deps, apply DB migrations safely, then build Next.js
set -euo pipefail

log() { printf '[render-build] %s\n' "$1"; }

log "Installing dependencies (npm ci)"
npm ci

log "Applying Prisma migrations (migrate deploy)"
# Avoid failing when DATABASE_URL is missing (local preview builds)
if [ -n "${DATABASE_URL:-}" ]; then
  npx prisma migrate deploy
else
  log "DATABASE_URL not set; skipping migrate deploy in build."
fi

log "Generating Prisma client"
npx prisma generate

log "Building Next.js"
npm run build
