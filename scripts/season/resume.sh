#!/usr/bin/env bash
# SEASON-HANDOFF-SCRIPTS-1A — resume preflight entrypoint.
#
#   scripts/season/resume.sh --from <handoff-receipt-hash> [--json]
#       [--audits-dir <dir>] [--worktrees a:b] [--port <n>] [--dema-home <path>]
#
# Re-verifies the pinned PRE0 + PROD01_2B sealed receipts from bytes, checks
# worktree cleanliness and loopback port freedom, and reports
# READY_FOR_HUMAN_GO (exit 0) or NOT_READY_FOR_HUMAN_GO with blocked_by
# (exit 1). Readiness grants nothing — authority enters only via the exact
# H1 consent block. All logic lives in scripts/season/resume-check.mjs.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

exec node "$REPO_ROOT/scripts/season/resume-check.mjs" "$@"
