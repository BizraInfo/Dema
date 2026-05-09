#!/usr/bin/env sh
set -eu

DEMA_HOME="${DEMA_HOME:-$HOME/.dema}"
MODE="apply"

for arg in "$@"; do
  case "$arg" in
    --dry-run) MODE="dry-run" ;;
    --check) MODE="check" ;;
    -h|--help) MODE="help" ;;
    *)
      echo "Unknown flag: $arg" >&2
      echo "Use --help for usage." >&2
      exit 2
      ;;
  esac
done

if [ "$MODE" = "help" ]; then
  cat <<EOF
Usage: install-unix.sh [--dry-run | --check]

  --dry-run  Show what would be created; write nothing.
  --check    Report current state of \$DEMA_HOME; write nothing.
  (no flag)  Apply: create missing dirs/files; preserve existing.

DEMA_HOME defaults to \$HOME/.dema (currently: $DEMA_HOME).
EOF
  exit 0
fi

do_dir() {
  d="$DEMA_HOME/$1"
  if [ -d "$d" ]; then
    if [ "$MODE" = "apply" ]; then echo "Preserved: $d"; else echo "Existing: $d"; fi
  else
    case "$MODE" in
      apply) mkdir -p "$d"; echo "Created: $d" ;;
      dry-run) echo "Would create: $d" ;;
      check) echo "Missing: $d" ;;
    esac
  fi
}

do_file() {
  f="$1"
  body="$2"
  if [ -f "$f" ]; then
    if [ "$MODE" = "apply" ]; then echo "Preserved: $f"; else echo "Existing: $f"; fi
  else
    case "$MODE" in
      apply) printf "%s\n" "$body" > "$f"; echo "Created: $f" ;;
      dry-run) echo "Would create: $f" ;;
      check) echo "Missing: $f" ;;
    esac
  fi
}

[ "$MODE" = "apply" ] && mkdir -p "$DEMA_HOME"

echo "Mode: $MODE"
echo "DEMA_HOME: $DEMA_HOME"
echo "---"
do_dir receipts
do_dir memory
do_dir logs
do_dir skills

PROFILE_BODY='{
  "schema": "bizra.dema.profile.v0.1",
  "preferred_name": null,
  "memory_consent": "local",
  "hidden_autonomy": false
}'

CONFIG_BODY='{
  "schema": "bizra.dema.local_config.v0.1",
  "mode": "local",
  "noHiddenDaemon": true,
  "requireExplicitConsent": true,
  "nextArtifact": "ARTIFACT-011"
}'

do_file "$DEMA_HOME/profile.json" "$PROFILE_BODY"
do_file "$DEMA_HOME/config.local.json" "$CONFIG_BODY"

echo "---"
case "$MODE" in
  apply) echo "Dema local setup complete at $DEMA_HOME" ;;
  dry-run) echo "Dry-run complete: no files written." ;;
  check) echo "Check complete: state above is current." ;;
esac

if [ "$MODE" = "apply" ]; then
  echo "Not touched: daemon state, mission runtime, runtime pulse, receipt history, external provider settings."
  echo "No daemon was started. No mission was executed. ARTIFACT-011 was not issued."
  echo "Next: run 'dema status'."
fi
