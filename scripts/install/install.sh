#!/usr/bin/env bash
# install.sh — Unified Dema installer · v1.0
#
# One installer for every node in BIZRA. Honors the seed-pattern invariant
# (`docs/canon/BIZRA_TOPOLOGY_CANON.md` §"Seed-pattern invariant"): every node
# carries the full system DNA · the installer is the same for every node,
# only the identity parameters differ.
#
# Replaces:
#   scripts/install/install-unix.sh    (Node0-only · was operator-implicit)
#   scripts/install/samy-bootstrap.sh  (Samy-only · was identity-baked)
#
# DEFAULT BEHAVIOR (no identity flags):
#   Bootstraps Node0 for the operator running the script. Creates ~/.dema/
#   skeleton (memory, receipts, logs, skills) + profile.json + config.local.json.
#   Idempotent · preserves existing files · never overwrites.
#
# CANDIDATE BEHAVIOR (with --ordinal N >= 1):
#   Bootstraps a Node-N candidate device, paired with the Node0 receipt the
#   candidate's typed consent created at the host's terminal. Writes profile
#   with operator name + ordinal + paired-receipt anchors + generates a
#   self-witness file at ~/.dema/memory/node{N}-self-witness.json the
#   candidate sends back to Node0.
#
# Usage:
#   ./install.sh                                         # Node0 default
#   ./install.sh --dry-run                               # preview · no writes
#   ./install.sh --check                                 # report state · no writes
#   ./install.sh --uninstall                             # remove ~/.dema/ (with confirm)
#   ./install.sh --help                                  # show this usage
#
#   ./install.sh \                                       # candidate Node-N
#     --operator "Samy" \
#     --ordinal 1 \
#     --paired-receipt-id "2026-05-18_082658" \
#     --paired-receipt-hash "8ac3d72699be44df51e79733a944036ab296b5698884ab3a47cf77eb64ad323c" \
#     --paired-receipt-date "2026-05-18"
#
# Optional candidate flags:
#   --device-label "<label>"  # device name (e.g., "Asus VivoBook")
#   --language <iso-639-1>    # preferred language code (e.g., "ar", "en")
#
# Honor: ADR-005 exact-string consent · Node ordinal law · seed-pattern
# invariant · Daughter Test. The candidate's prior typed consent at the
# host's Node0 terminal is binding · this script does NOT re-collect consent.
#
# Boundary discipline (always honored):
#   filesystem_write_performed : true (writes profile)
#   network_used                : false
#   federation_invoked          : false
#   runtime_execution_performed : false
#   receipt_mint_performed      : false
#   chain_advance_performed     : false
#   consent_collected           : false (consent already collected at Node0)
#   all other 9 keys            : false

set -eu

# ─── Defaults ──────────────────────────────────────────────────────────────

DEMA_HOME="${DEMA_HOME:-$HOME/.dema}"
MODE="apply"
OPERATOR=""
ORDINAL="0"
PAIRED_RECEIPT_ID=""
PAIRED_RECEIPT_HASH=""
PAIRED_RECEIPT_DATE=""
DEVICE_LABEL=""
LANGUAGE=""

# ─── Parse args ────────────────────────────────────────────────────────────

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)              MODE="dry-run"; shift ;;
    --check)                MODE="check"; shift ;;
    --uninstall)            MODE="uninstall"; shift ;;
    -h|--help)              MODE="help"; shift ;;
    --operator)             OPERATOR="${2:-}"; shift 2 ;;
    --ordinal)              ORDINAL="${2:-0}"; shift 2 ;;
    --paired-receipt-id)    PAIRED_RECEIPT_ID="${2:-}"; shift 2 ;;
    --paired-receipt-hash)  PAIRED_RECEIPT_HASH="${2:-}"; shift 2 ;;
    --paired-receipt-date)  PAIRED_RECEIPT_DATE="${2:-}"; shift 2 ;;
    --device-label)         DEVICE_LABEL="${2:-}"; shift 2 ;;
    --language)             LANGUAGE="${2:-}"; shift 2 ;;
    *) echo "Unknown flag: $1" >&2; echo "Use --help for usage." >&2; exit 2 ;;
  esac
done

# ─── Help ──────────────────────────────────────────────────────────────────

if [ "$MODE" = "help" ]; then
  sed -n '2,55p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

# ─── Validate ordinal ──────────────────────────────────────────────────────

if ! echo "$ORDINAL" | grep -qE '^[0-9]+$'; then
  echo "ERROR: --ordinal must be a non-negative integer (got: $ORDINAL)" >&2
  exit 2
fi

if [ "$ORDINAL" = "3" ] || [ "$ORDINAL" = "4" ]; then
  echo "ERROR: ordinal $ORDINAL is currently in forbidden_topology_phrases" >&2
  echo "per docs/canon/canon_registry.json. Canon must be amended before" >&2
  echo "ordinals 3 or 4 can be assigned." >&2
  exit 2
fi

IS_CANDIDATE="false"
if [ "$ORDINAL" -ge 1 ]; then
  IS_CANDIDATE="true"
  if [ -z "$OPERATOR" ]; then
    echo "ERROR: --operator NAME required when --ordinal >= 1" >&2
    exit 2
  fi
  if [ -z "$PAIRED_RECEIPT_ID" ] || [ -z "$PAIRED_RECEIPT_HASH" ]; then
    echo "ERROR: --paired-receipt-id and --paired-receipt-hash required for" >&2
    echo "candidate bootstrap (ordinal >= 1)" >&2
    exit 2
  fi
fi

# Default operator for Node0 when omitted
if [ -z "$OPERATOR" ]; then
  OPERATOR="MoMo"
fi

# ─── Uninstall mode ────────────────────────────────────────────────────────

if [ "$MODE" = "uninstall" ]; then
  echo "install.sh · uninstall mode"
  if [ ! -d "$DEMA_HOME" ]; then
    echo "  No \$DEMA_HOME at $DEMA_HOME · nothing to remove"
    exit 0
  fi
  echo "  This will REMOVE: $DEMA_HOME"
  echo "  Type the exact phrase to confirm:"
  echo "    REMOVE DEMA LOCAL DATA"
  read -r CONFIRM
  if [ "$CONFIRM" != "REMOVE DEMA LOCAL DATA" ]; then
    echo "  Confirmation phrase did not match · uninstall aborted"
    exit 1
  fi
  rm -rf "$DEMA_HOME"
  echo "  Removed: $DEMA_HOME"
  echo "  Dema source itself (this directory) was NOT touched · remove manually if desired"
  exit 0
fi

# ─── Header banner ─────────────────────────────────────────────────────────

echo "install.sh · $MODE mode"
echo "  DEMA_HOME : $DEMA_HOME"
echo "  operator  : $OPERATOR"
echo "  ordinal   : $ORDINAL"
echo "  node      : Node$ORDINAL"
if [ "$IS_CANDIDATE" = "true" ]; then
  echo "  paired_receipt_id   : $PAIRED_RECEIPT_ID"
  echo "  paired_receipt_hash : ${PAIRED_RECEIPT_HASH:0:16}... (truncated)"
  [ -n "$PAIRED_RECEIPT_DATE" ] && echo "  paired_receipt_date : $PAIRED_RECEIPT_DATE"
  [ -n "$DEVICE_LABEL" ] && echo "  device_label        : $DEVICE_LABEL"
  [ -n "$LANGUAGE" ] && echo "  language            : $LANGUAGE"
fi
echo "  boundary  : no network · no federation · no runtime · no mint"
echo ""

# ─── Check mode · report only ──────────────────────────────────────────────

if [ "$MODE" = "check" ]; then
  if [ -d "$DEMA_HOME" ]; then
    echo "  \$DEMA_HOME exists"
    for sub in memory receipts logs skills; do
      if [ -d "$DEMA_HOME/$sub" ]; then echo "  $sub/    : exists"; else echo "  $sub/    : MISSING"; fi
    done
    for f in profile.json config.local.json; do
      if [ -f "$DEMA_HOME/$f" ]; then echo "  $f : exists"; else echo "  $f : MISSING"; fi
    done
  else
    echo "  \$DEMA_HOME does not exist · install.sh apply would create it"
  fi
  exit 0
fi

# ─── do_dir / do_file helpers (shared by apply + dry-run) ──────────────────

do_dir() {
  d="$DEMA_HOME/$1"
  if [ -d "$d" ]; then
    [ "$MODE" = "apply" ] && echo "  Preserved : $d" || echo "  Existing  : $d"
  else
    case "$MODE" in
      apply)    mkdir -p "$d"; echo "  Created   : $d" ;;
      dry-run)  echo "  Would create : $d" ;;
    esac
  fi
}

do_file() {
  f="$1"
  body="$2"
  if [ -f "$f" ]; then
    [ "$MODE" = "apply" ] && echo "  Preserved : $f" || echo "  Existing  : $f"
  else
    case "$MODE" in
      apply)    printf "%s\n" "$body" > "$f"; echo "  Created   : $f" ;;
      dry-run)  echo "  Would create : $f" ;;
    esac
  fi
}

# ─── Ensure parent dir + standard subdirs ──────────────────────────────────

[ "$MODE" = "apply" ] && mkdir -p "$DEMA_HOME"

do_dir memory
do_dir receipts
do_dir logs
do_dir skills

# ─── Profile body · Node0 vs candidate paths ───────────────────────────────

ISO_NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
LANGUAGE_JSON="null"
[ -n "$LANGUAGE" ] && LANGUAGE_JSON="\"$LANGUAGE\""
DEVICE_LABEL_JSON="null"
[ -n "$DEVICE_LABEL" ] && DEVICE_LABEL_JSON="\"$DEVICE_LABEL\""

if [ "$IS_CANDIDATE" = "true" ]; then
  PROFILE_BODY=$(cat <<PROFILE_EOF
{
  "schema": "bizra.dema.profile.v0.1",
  "preferred_name": "$OPERATOR",
  "name": "$OPERATOR",
  "node": "Node$ORDINAL",
  "node_ordinal": $ORDINAL,
  "language": $LANGUAGE_JSON,
  "device_label": $DEVICE_LABEL_JSON,
  "companion_of": null,
  "created_at": "$ISO_NOW",
  "memory_consent": "local",
  "hidden_autonomy": false,
  "paired_with_node0_receipt_id": "$PAIRED_RECEIPT_ID",
  "paired_with_node0_receipt_evidence_hash": "$PAIRED_RECEIPT_HASH",
  "paired_with_node0_receipt_date": "$PAIRED_RECEIPT_DATE",
  "phase_c_bootstrap_version": "v1.0"
}
PROFILE_EOF
)
else
  PROFILE_BODY=$(cat <<PROFILE_EOF
{
  "schema": "bizra.dema.profile.v0.1",
  "preferred_name": null,
  "name": "$OPERATOR",
  "node": "Node0",
  "node_ordinal": 0,
  "language": $LANGUAGE_JSON,
  "device_label": $DEVICE_LABEL_JSON,
  "companion_of": null,
  "created_at": "$ISO_NOW",
  "memory_consent": "local",
  "hidden_autonomy": false
}
PROFILE_EOF
)
fi

CONFIG_BODY=$(cat <<CONFIG_EOF
{
  "schema": "bizra.dema.local_config.v0.1",
  "mode": "local",
  "noHiddenDaemon": true,
  "requireExplicitConsent": true,
  "nextArtifact": "ARTIFACT-011"
}
CONFIG_EOF
)

do_file "$DEMA_HOME/profile.json" "$PROFILE_BODY"
do_file "$DEMA_HOME/config.local.json" "$CONFIG_BODY"

# ─── Candidate self-witness ────────────────────────────────────────────────

if [ "$IS_CANDIDATE" = "true" ]; then
  WITNESS_FILE="$DEMA_HOME/memory/node${ORDINAL}-self-witness.json"
  WITNESS_BODY=$(cat <<WITNESS_EOF
{
  "schema": "bizra.dema.node${ORDINAL}_self_witness.v0.1",
  "truth_label": "NODE0_LOCAL_SEED",
  "mode": "ceremony_record_on_candidate_device",
  "ceremony": "node${ORDINAL}_self_bootstrap_v1.0",
  "candidate_name": "$OPERATOR",
  "node_ordinal": $ORDINAL,
  "bootstrap_completed_utc": "$ISO_NOW",
  "paired_with_node0_receipt_id": "$PAIRED_RECEIPT_ID",
  "paired_with_node0_receipt_evidence_hash": "$PAIRED_RECEIPT_HASH",
  "paired_with_node0_ceremony_date_gst": "$PAIRED_RECEIPT_DATE",
  "phase_c_status": "device_profile_written_no_pat7_runtime",
  "next_steps_for_candidate": [
    "Send the contents of this file back to Node0 operator",
    "Run: node apps/cli/src/index.js status",
    "Run: node apps/cli/src/index.js receipts"
  ],
  "boundary": {
    "filesystem_write_performed": true,
    "network_used": false,
    "runtime_execution_performed": false,
    "model_loaded": false,
    "model_invocation_performed": false,
    "prompt_executed": false,
    "external_call_performed": false,
    "raw_corpus_scan_performed": false,
    "raw_data_included": false,
    "tool_executed": false,
    "chain_advance_performed": false,
    "receipt_mint_performed": false,
    "federation_invoked": false,
    "node_connection_performed": false,
    "public_network_used": false,
    "consent_collected": false
  },
  "boundary_note": "consent_collected: false because this device bootstrap honors prior typed consent at Node0 receipt $PAIRED_RECEIPT_ID · the in-person ceremony there is the binding consent record"
}
WITNESS_EOF
)
  do_file "$WITNESS_FILE" "$WITNESS_BODY"
fi

# ─── Footer ────────────────────────────────────────────────────────────────

echo ""
case "$MODE" in
  apply)
    if [ "$IS_CANDIDATE" = "true" ]; then
      echo "  Node$ORDINAL candidate bootstrap complete at $DEMA_HOME"
      echo ""
      echo "  Send the contents of:"
      echo "    $DEMA_HOME/memory/node${ORDINAL}-self-witness.json"
      echo "  back to Node0 operator. Until then, your status on Node0 remains"
      echo "  'ghost_accepted_pending_device_install'."
      echo ""
      echo "  You can disengage at any time: rm -rf $DEMA_HOME"
    else
      echo "  Node0 setup complete at $DEMA_HOME"
      echo ""
      echo "  Not touched: daemon state, mission runtime, receipt history,"
      echo "  external provider settings. No daemon was started."
      echo "  No mission was executed. ARTIFACT-011 was not issued."
      echo "  Next: run 'dema status'."
    fi
    ;;
  dry-run)
    echo "  Dry-run complete · no files written."
    ;;
esac
