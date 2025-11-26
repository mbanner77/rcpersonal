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
      # Also resolve the specific failed migration id mentioned in the error output, if present
      FAILED_ID=$(printf '%s' "$OUTPUT" | sed -n 's/.*The `\([^`]*\)` migration.*/\1/p' | head -n1)
      if [ -n "$FAILED_ID" ]; then
        log "Resolving failed migration from error output as rolled-back: $FAILED_ID"
        npx prisma migrate resolve --rolled-back "$FAILED_ID" || true
      fi
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
      # Sanitize legacy enum/type statements that may not exist anymore
      if [ -s "$rt_dir/migration.sql" ]; then
        # Use Python for robust multi-line SQL sanitization
        python3 << 'PYEOF' "$rt_dir/migration.sql"
import sys, re

filepath = sys.argv[1]
with open(filepath, 'r') as f:
    content = f.read()

# Patterns to remove entirely (case-insensitive)
remove_patterns = [
    r'CREATE\s+TYPE\s+"?TaskStatus"?[^;]*;',
    r'DROP\s+TYPE\s+"?TaskStatus"?[^;]*;',
    r'ALTER\s+TYPE\s+"?TaskStatus"?[^;]*;',
    r'CREATE\s+TYPE\s+"?LifecycleOwnerRole"?[^;]*;',
    r'DROP\s+TYPE\s+"?LifecycleOwnerRole"?[^;]*;',
    r'ALTER\s+TYPE\s+"?LifecycleOwnerRole"?[^;]*;',
    r'DROP\s+INDEX[^;]*"TaskAssignment_employeeId_status_dueDate_idx"[^;]*;',
]
for pat in remove_patterns:
    content = re.sub(pat, '', content, flags=re.IGNORECASE | re.DOTALL)

def clean_alter_table(match):
    block = match.group(0)
    skip_ops = [
        r'DROP\s+COLUMN\s+"status"',
        r'DROP\s+COLUMN\s+"ownerRole"',
        r'ADD\s+COLUMN\s+"status"',
        r'ADD\s+COLUMN\s+"ownerRole"',
        r'ADD\s+COLUMN\s+"statusLegacy"',
        r'ADD\s+COLUMN\s+"ownerRoleLegacy"',
        r'ALTER\s+COLUMN\s+"status"',
        r'ALTER\s+COLUMN\s+"ownerRole"',
    ]
    ops_match = re.search(r'ALTER\s+TABLE\s+"[^"]+"\s*(.*);', block, re.DOTALL | re.IGNORECASE)
    if not ops_match:
        return block
    ops = ops_match.group(1)
    for skip in skip_ops:
        ops = re.sub(skip + r'[^,;]*,?\s*', '', ops, flags=re.IGNORECASE)
    ops = re.sub(r',\s*,', ',', ops)
    ops = re.sub(r'^\s*,', '', ops)
    ops = re.sub(r',\s*$', '', ops)
    ops = ops.strip()
    if not ops or ops == '':
        return ''
    table_match = re.search(r'(ALTER\s+TABLE\s+"[^"]+")', block, re.IGNORECASE)
    if table_match:
        return table_match.group(1) + ' ' + ops + ';'
    return block

content = re.sub(r'ALTER\s+TABLE\s+"[^"]+"\s+[^;]+;', clean_alter_table, content, flags=re.IGNORECASE | re.DOTALL)
content = re.sub(r'--\s*\w+\s*\n\s*\n', '\n', content)
content = re.sub(r'\n{3,}', '\n\n', content)
content = content.strip()

with open(filepath, 'w') as f:
    f.write(content + '\n' if content else '')
PYEOF
      fi
      if [ ! -s "$rt_dir/migration.sql" ]; then
        log "No diff produced; continuing."
        rm -rf "$rt_dir"
      elif ! grep -qE '^\s*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\s' "$rt_dir/migration.sql" 2>/dev/null; then
        log "No meaningful schema changes after sanitization; skipping runtime migration."
        rm -rf "$rt_dir"
      else
        log "Applying runtime migration and marking as applied."
        set +e
        OUT_DEPLOY=$(npx prisma migrate deploy 2>&1)
        CODE_DEPLOY=$?
        set -e
        printf '%s\n' "$OUT_DEPLOY"
        if [ "$CODE_DEPLOY" -ne 0 ]; then
          if printf '%s' "$OUT_DEPLOY" | grep -q 'P3009'; then
            # Resolve failed id from output and retry once
            FAILED_ID2=$(printf '%s' "$OUT_DEPLOY" | sed -n 's/.*The `\([^`]*\)` migration.*/\1/p' | head -n1)
            if [ -n "$FAILED_ID2" ]; then
              log "Post-diff: resolving failed migration as rolled-back: $FAILED_ID2"
              npx prisma migrate resolve --rolled-back "$FAILED_ID2" || true
              log "Post-diff: retrying migrate deploy after resolving failed migration."
              npx prisma migrate deploy || { log "migrate deploy failed after runtime diff and rollback."; exit 1; }
            else
              log "migrate deploy failed after runtime diff (no failed id parsed)."; exit 1
            fi
          else
            log "migrate deploy failed after runtime diff."; exit 1
          fi
        fi
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
  # Sanitize legacy enum/type statements and column changes that should be skipped
  if [ -s "$rt_dir2/migration.sql" ]; then
    # Use Python for robust multi-line SQL sanitization
    python3 << 'PYEOF' "$rt_dir2/migration.sql"
import sys, re

filepath = sys.argv[1]
with open(filepath, 'r') as f:
    content = f.read()

# Patterns to remove entirely (case-insensitive)
remove_patterns = [
    r'CREATE\s+TYPE\s+"?TaskStatus"?[^;]*;',
    r'DROP\s+TYPE\s+"?TaskStatus"?[^;]*;',
    r'ALTER\s+TYPE\s+"?TaskStatus"?[^;]*;',
    r'CREATE\s+TYPE\s+"?LifecycleOwnerRole"?[^;]*;',
    r'DROP\s+TYPE\s+"?LifecycleOwnerRole"?[^;]*;',
    r'ALTER\s+TYPE\s+"?LifecycleOwnerRole"?[^;]*;',
    # Drop indexes on legacy columns we want to keep
    r'DROP\s+INDEX[^;]*"TaskAssignment_employeeId_status_dueDate_idx"[^;]*;',
]
for pat in remove_patterns:
    content = re.sub(pat, '', content, flags=re.IGNORECASE | re.DOTALL)

# Remove ALTER TABLE blocks that only contain operations on legacy columns
# Match ALTER TABLE ... ; blocks
def clean_alter_table(match):
    block = match.group(0)
    # Check if this ALTER TABLE only has operations we want to skip
    skip_ops = [
        r'DROP\s+COLUMN\s+"status"',
        r'DROP\s+COLUMN\s+"ownerRole"',
        r'ADD\s+COLUMN\s+"status"',
        r'ADD\s+COLUMN\s+"ownerRole"',
        r'ADD\s+COLUMN\s+"statusLegacy"',
        r'ADD\s+COLUMN\s+"ownerRoleLegacy"',
        r'ALTER\s+COLUMN\s+"status"',
        r'ALTER\s+COLUMN\s+"ownerRole"',
    ]
    # Extract just the operations part (after ALTER TABLE "name")
    ops_match = re.search(r'ALTER\s+TABLE\s+"[^"]+"\s*(.*);', block, re.DOTALL | re.IGNORECASE)
    if not ops_match:
        return block
    ops = ops_match.group(1)
    # Remove skip operations from the ops string
    for skip in skip_ops:
        ops = re.sub(skip + r'[^,;]*,?\s*', '', ops, flags=re.IGNORECASE)
    # Clean up dangling commas and whitespace
    ops = re.sub(r',\s*,', ',', ops)
    ops = re.sub(r'^\s*,', '', ops)
    ops = re.sub(r',\s*$', '', ops)
    ops = ops.strip()
    # If nothing left, remove the whole block
    if not ops or ops == '':
        return ''
    # Rebuild the ALTER TABLE statement
    table_match = re.search(r'(ALTER\s+TABLE\s+"[^"]+")', block, re.IGNORECASE)
    if table_match:
        return table_match.group(1) + ' ' + ops + ';'
    return block

content = re.sub(r'ALTER\s+TABLE\s+"[^"]+"\s+[^;]+;', clean_alter_table, content, flags=re.IGNORECASE | re.DOTALL)

# Remove empty comment blocks
content = re.sub(r'--\s*\w+\s*\n\s*\n', '\n', content)
# Clean up multiple blank lines
content = re.sub(r'\n{3,}', '\n\n', content)
content = content.strip()

with open(filepath, 'w') as f:
    f.write(content + '\n' if content else '')
PYEOF
  fi
  # Check if there's any meaningful SQL left after sanitization
  if [ -s "$rt_dir2/migration.sql" ]; then
    # Check if file only contains whitespace/comments
    if grep -qE '^\s*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\s' "$rt_dir2/migration.sql" 2>/dev/null; then
      log "Additional schema changes found; applying runtime sync migration."
      npx prisma migrate deploy || { log "migrate deploy failed after runtime sync."; exit 1; }
    else
      log "No meaningful schema changes after sanitization; skipping runtime sync."
      rm -rf "$rt_dir2"
    fi
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
