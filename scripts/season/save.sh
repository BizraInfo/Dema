#!/usr/bin/env bash
# SEASON-HANDOFF-SCRIPTS-1A — close the current season into a durable handoff.
#
# Thin operator wrapper over `dema season save` (NODE0-MINIMUM-SEASON-SAVE-
# RESUME-1A). It derives exactly two facts the operator should never type by
# hand — this repository's HEAD commit and tree — and resolves the season id
# when DEMA_HOME holds exactly one season. Everything else passes through to
# the CLI untouched. This script never invents state and never grants consent.
#
# Usage:
#   scripts/season/save.sh --season <id> --mission <id> --phase <PHASE> \
#       (--next <ACTION> | --reason "<text>") [--step s]... \
#       [--must-not-repeat s]... [--pending-consent none|phrase::scope]...
#       [other dema season save flags pass through]
#
# Handled here:
#   --repo-commit / --repo-tree  derived from git HEAD unless given explicitly
#   --season                     optional when DEMA_HOME holds exactly one season;
#                                required to OPEN a new season (never guessed)
#   --reason "<text>"            convenience alias for --next (one truth per
#                                checkpoint); the kernel's exact-token law
#                                applies: UPPER_SNAKE or ACTION:<ID>
#
# Exit codes: 0 saved · 1 refused (nothing written).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLI="$REPO_ROOT/apps/cli/src/index.js"

usage() {
  sed -n '3,26p' "${BASH_SOURCE[0]}" | sed 's/^#\{1,\} \{0,1\}//'
}

case "${1:-}" in
  -h|--help) usage; exit 0 ;;
esac

COMMIT="" TREE="" SEASON="" NEXT="" REASON=""
PASS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-commit) COMMIT="${2:?--repo-commit needs a value}"; shift 2 ;;
    --repo-tree)   TREE="${2:?--repo-tree needs a value}"; shift 2 ;;
    --season)      SEASON="${2:?--season needs an id}"; shift 2 ;;
    --next)        NEXT="${2:?--next needs a value}"; shift 2 ;;
    --reason)      REASON="${2:?--reason needs a value}"; shift 2 ;;
    *)             PASS+=("$1"); shift ;;
  esac
done

if [[ -n "$REASON" && -n "$NEXT" ]]; then
  echo "save.sh refused: pass either --next or --reason, not both (one truth per checkpoint)" >&2
  exit 1
fi
if [[ -z "$NEXT" && -n "$REASON" ]]; then
  NEXT="$REASON"
fi

if [[ -z "$COMMIT" ]]; then COMMIT="$(git -C "$REPO_ROOT" rev-parse HEAD)"; fi
if [[ -z "$TREE" ]];   then TREE="$(git -C "$REPO_ROOT" rev-parse 'HEAD^{tree}')"; fi

if [[ -z "$SEASON" ]]; then
  IDS_RAW="$(DEMA_SEASON_REPO_ROOT="$REPO_ROOT" node --input-type=module -e '
    const store = await import(process.env.DEMA_SEASON_REPO_ROOT + "/packages/receipts/src/season-state-store.js");
    const listed = await store.listSeasons({});
    for (const id of listed.season_ids) console.log(id);
  ')"
  if [[ -z "$IDS_RAW" ]]; then
    echo "save.sh refused: no season exists under DEMA_HOME yet — open one explicitly with --season <new-id>" >&2
    exit 1
  fi
  mapfile -t IDS <<<"$IDS_RAW"
  if [[ ${#IDS[@]} -eq 1 ]]; then
    SEASON="${IDS[0]}"
    echo "save.sh: using the only existing season: $SEASON" >&2
  else
    echo "save.sh refused: season_ambiguous — pass --season explicitly. Existing seasons:" >&2
    for id in "${IDS[@]}"; do echo "  $id" >&2; done
    exit 1
  fi
fi

ARGS=(--season "$SEASON" --repo-commit "$COMMIT" --repo-tree "$TREE")
if [[ -n "$NEXT" ]]; then ARGS+=(--next "$NEXT"); fi
ARGS+=("${PASS[@]}")

set +e
node "$CLI" season save "${ARGS[@]}"
RC=$?
set -e

if [[ $RC -eq 0 ]]; then
  HANDOFF="$(HANDOFF_HEAD="${DEMA_HOME:-$HOME/.dema}/seasons/$SEASON/HEAD.json" node --input-type=module -e '
    const { readFile } = await import("node:fs/promises");
    try {
      const head = JSON.parse(await readFile(process.env.HANDOFF_HEAD, "utf8"));
      console.log(head.receipt_hash ?? "");
    } catch { console.log(""); }
  ')"
  if [[ -n "$HANDOFF" ]]; then
    echo "handoff: resume elsewhere with: scripts/season/resume.sh --from $HANDOFF"
  fi
fi

exit $RC
