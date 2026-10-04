#!/usr/bin/env bash
# AUTO-SHIP-1A — one-command ship loop: verify green, then commit + push.
#
#   scripts/ship.sh ["commit message"]
#   scripts/ship.sh --dry-run          # verify + show what would ship, no writes
#
# Contract:
#   1. Refuses when the working tree is already clean (nothing to ship).
#   2. Runs the full verification ladder: npm test, npm run check, git diff --check.
#   3. Ships ONLY if every gate exits zero — never commits a red tree.
#   4. Commit message: operator-supplied, or derived from changed paths.
#   5. Pushes to origin/<current-branch> after a successful commit.
#
# This is not a daemon. It runs once per invocation; the operator decides when.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DRY_RUN=0
MSG=""
case "${1:-}" in
  --dry-run) DRY_RUN=1 ;;
  "") ;;
  *) MSG="$1" ;;
esac

fail() { echo "SHIP REFUSED: $*" >&2; exit 1; }

# ── Gate 0: something to ship? ──────────────────────────────────────────────
if [ -z "$(git status --porcelain)" ]; then
  echo "Nothing to ship — working tree clean."
  exit 0
fi

echo "── Changed paths ──"
git status --short
echo ""

# ── Gate 1: whitespace errors ───────────────────────────────────────────────
if ! git diff --check >/dev/null 2>&1 && [ -n "$(git diff --check 2>/dev/null)" ]; then
  fail "git diff --check reported whitespace errors"
fi
echo "[1/3] git diff --check .............. OK"

# ── Gate 2: full test suite ─────────────────────────────────────────────────
if ! npm test > /tmp/opencode/ship-test.log 2>&1; then
  fail "npm test failed — log: /tmp/opencode/ship-test.log"
fi
TESTS_PASS=$(grep -E "^# pass [0-9]+" /tmp/opencode/ship-test.log | awk '{print $3}')
TESTS_FAIL=$(grep -E "^# fail [0-9]+" /tmp/opencode/ship-test.log | awk '{print $3}')
[ "$TESTS_FAIL" != "0" ] && fail "test classifier counted $TESTS_FAIL failures"
echo "[2/3] npm test ..................... OK ($TESTS_PASS pass / $TESTS_FAIL fail)"

# ── Gate 3: review gate aggregate ───────────────────────────────────────────
if ! npm run check > /tmp/opencode/ship-check.log 2>&1; then
  fail "npm run check failed — log: /tmp/opencode/ship-check.log"
fi
echo "[3/3] npm run check ................ OK"

# ── Secret scan: obvious key material in staged content ────────────────────
if git diff HEAD | grep -inE "^\+.*(sk-[a-zA-Z0-9]{20}|ghp_[a-zA-Z0-9]{36}|AKIA[A-Z0-9]{16})" > /dev/null 2>&1; then
  fail "possible API key pattern detected in diff"
fi

if [ "$DRY_RUN" = "1" ]; then
  echo ""
  echo "DRY RUN: all gates green — would stage all changes, commit, push."
  exit 0
fi

# ── Ship ────────────────────────────────────────────────────────────────────
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ -z "$MSG" ]; then
  # Derive a truthful summary from what actually changed.
  MAPFILE=()
  while IFS= read -r p; do MAPFILE+=("$p"); done < <(git status --porcelain | awk '{print $NF}' | head -4)
  case "${MAPFILE[0]:-}" in
    backlog/*)            DEFAULT_MSG="docs(backlog): task updates from operator session" ;;
    docs/*)               DEFAULT_MSG="docs: update architecture/receipt documentation" ;;
    tests/*)              DEFAULT_MSG="test: refresh mirrored test expectations" ;;
    packages/core/src/*)  DEFAULT_MSG="feat(core): kernel updates from operator session" ;;
    scripts/*)            DEFAULT_MSG="chore(scripts): tooling updates from operator session" ;;
    *)                    DEFAULT_MSG="chore: operator session changes" ;;
  esac
  MSG="$DEFAULT_MSG"
fi

git add -A
git commit -m "$MSG"
git push origin "$BRANCH"

echo ""
echo "SHIPPED: $(git rev-parse --short HEAD) -> origin/$BRANCH"
