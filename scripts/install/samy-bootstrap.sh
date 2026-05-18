#!/usr/bin/env bash
# samy-bootstrap.sh — Phase C · Node1 device bootstrap
#
# Bootstraps a Node1 candidate's local Dema state on THEIR device, paired with
# Mumu's Node0 receipt #21 (2026-05-18_082658 · evidence_hash
# 8ac3d72699be44df51e79733a944036ab296b5698884ab3a47cf77eb64ad323c).
#
# What this script DOES:
#   - Verifies Node.js is installed (>= v20)
#   - Verifies the Dema source is present in the current directory
#   - Creates ~/.dema/ (or $DEMA_HOME if set)
#   - Writes a Node1 profile.json with the candidate's name + ordinal: 1
#   - Runs `node apps/cli/src/index.js onboard --json` so the candidate sees
#     their schema-tagged onboarding state
#   - Generates a Node1-side witness file at ~/.dema/memory/node1-self-witness.json
#
# What this script does NOT do:
#   - Does NOT mint PAT-7 runtime (the runtime lives upstream of this repo
#     per ADR-001; this script is preview-only on the candidate's device)
#   - Does NOT connect to any network · no federation · no public_network_used
#   - Does NOT modify any file outside $DEMA_HOME and the current directory
#   - Does NOT validate consent for the candidate — the candidate must re-type
#     their consent phrase verbatim AT THIS terminal as a separate step
#   - Does NOT push, pull, or fetch anything
#
# Operator pairing: this script is sent by Mumu (Node0) to Samy (Node1 candidate)
# who already accepted Node1 in person at Mumu's home on 2026-05-18 12:25 GST.
# This is the on-device confirmation of that in-person ceremony.
#
# Usage:
#   ./samy-bootstrap.sh                       # apply: full bootstrap
#   ./samy-bootstrap.sh --dry-run             # show what would happen · write nothing
#   ./samy-bootstrap.sh --check               # report current state of $DEMA_HOME
#   ./samy-bootstrap.sh --name "Samy"         # override the candidate name
#   ./samy-bootstrap.sh --help                # show this usage
#
# Honor: ADR-005 exact-string consent · Node ordinal law · seed-pattern
# invariant (every node carries the full system DNA) · Daughter Test.

set -eu

# ─── Defaults ──────────────────────────────────────────────────────────────

DEMA_HOME="${DEMA_HOME:-$HOME/.dema}"
CANDIDATE_NAME="Samy"
NODE_ORDINAL=1
MODE="apply"

PAIRED_RECEIPT_ID="2026-05-18_082658"
PAIRED_RECEIPT_EVIDENCE_HASH="8ac3d72699be44df51e79733a944036ab296b5698884ab3a47cf77eb64ad323c"
CEREMONY_DATE_GST="2026-05-18"

# ─── Parse args ────────────────────────────────────────────────────────────

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) MODE="dry-run"; shift ;;
    --check) MODE="check"; shift ;;
    --name) CANDIDATE_NAME="${2:-Samy}"; shift 2 ;;
    -h|--help) MODE="help"; shift ;;
    *) echo "Unknown flag: $1" >&2; echo "Use --help for usage." >&2; exit 2 ;;
  esac
done

# ─── Help ──────────────────────────────────────────────────────────────────

if [ "$MODE" = "help" ]; then
  sed -n '2,44p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

# ─── Check Node.js ─────────────────────────────────────────────────────────

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js not found in PATH." >&2
  echo "Please install Node.js v20 or later from https://nodejs.org/" >&2
  echo "Then re-run this script." >&2
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "ERROR: Node.js v20 or later required (found v$(node -v))." >&2
  exit 1
fi

# ─── Verify Dema source present ────────────────────────────────────────────

if [ ! -f "apps/cli/src/index.js" ]; then
  echo "ERROR: Dema source not found in current directory." >&2
  echo "Run this script from the root of the Dema repository (the dir that" >&2
  echo "contains apps/cli/src/index.js)." >&2
  exit 1
fi

# ─── --check mode ──────────────────────────────────────────────────────────

if [ "$MODE" = "check" ]; then
  echo "samy-bootstrap.sh · check mode"
  echo "  DEMA_HOME : $DEMA_HOME"
  if [ -d "$DEMA_HOME" ]; then
    echo "  status    : exists"
    if [ -f "$DEMA_HOME/profile.json" ]; then
      echo "  profile   : present"
    else
      echo "  profile   : absent · bootstrap would create"
    fi
  else
    echo "  status    : absent · bootstrap would create"
  fi
  exit 0
fi

# ─── --dry-run mode ────────────────────────────────────────────────────────

if [ "$MODE" = "dry-run" ]; then
  echo "samy-bootstrap.sh · dry-run mode (no writes)"
  echo "  Would create directory : $DEMA_HOME"
  echo "  Would create directory : $DEMA_HOME/memory"
  echo "  Would create directory : $DEMA_HOME/receipts"
  echo "  Would write file       : $DEMA_HOME/profile.json"
  echo "    operator             : $CANDIDATE_NAME"
  echo "    node                 : Node$NODE_ORDINAL"
  echo "    node_ordinal         : $NODE_ORDINAL"
  echo "    paired_node0_receipt : $PAIRED_RECEIPT_ID"
  echo "  Would write file       : $DEMA_HOME/memory/node1-self-witness.json"
  echo "  Would run command      : node apps/cli/src/index.js onboard --json"
  echo "  Network used           : false"
  echo "  Federation invoked     : false"
  echo "  Runtime executed       : false"
  exit 0
fi

# ─── Apply mode (default) ──────────────────────────────────────────────────

echo "samy-bootstrap.sh · apply mode"
echo "  DEMA_HOME : $DEMA_HOME"
echo ""

# Create directories (idempotent)
mkdir -p "$DEMA_HOME/memory" "$DEMA_HOME/receipts"
echo "  Created (or preserved) : $DEMA_HOME/memory/"
echo "  Created (or preserved) : $DEMA_HOME/receipts/"

# Check if profile.json already exists · do NOT overwrite
if [ -f "$DEMA_HOME/profile.json" ]; then
  echo ""
  echo "  WARNING: $DEMA_HOME/profile.json already exists."
  echo "  This script will NOT overwrite an existing profile."
  echo "  If you want to re-bootstrap, remove the file manually first:"
  echo "    rm $DEMA_HOME/profile.json"
  echo ""
  echo "  Continuing with onboard preview using existing profile..."
else
  # Write Node1 profile
  ISO_NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  cat > "$DEMA_HOME/profile.json" <<PROFILE_EOF
{
  "name": "$CANDIDATE_NAME",
  "node": "Node$NODE_ORDINAL",
  "node_ordinal": $NODE_ORDINAL,
  "language": null,
  "device_label": null,
  "companion_of": null,
  "created_at": "$ISO_NOW",
  "phase_c_bootstrap_version": "v0.1",
  "paired_with_node0_receipt_id": "$PAIRED_RECEIPT_ID",
  "paired_with_node0_receipt_evidence_hash": "$PAIRED_RECEIPT_EVIDENCE_HASH",
  "ceremony_date_gst": "$CEREMONY_DATE_GST",
  "in_person_ceremony_at_node0": true,
  "boundary_note": "profile is local · no federation · no network · no runtime · no mint"
}
PROFILE_EOF
  echo "  Wrote                  : $DEMA_HOME/profile.json"
fi

# Run onboard preview · candidate sees their schema-tagged state
echo ""
echo "  Running onboard preview ..."
echo "  ────────────────────────────────────────────────────────────────"
node apps/cli/src/index.js onboard --json
echo "  ────────────────────────────────────────────────────────────────"

# Generate self-witness file
ISO_NOW_2=$(date -u +%Y-%m-%dT%H:%M:%SZ)
cat > "$DEMA_HOME/memory/node1-self-witness.json" <<WITNESS_EOF
{
  "schema": "bizra.dema.node1_self_witness.v0.1",
  "truth_label": "NODE0_LOCAL_SEED",
  "mode": "ceremony_record_on_candidate_device",
  "ceremony": "node1_self_bootstrap_v0.1",
  "candidate_name": "$CANDIDATE_NAME",
  "node_ordinal": $NODE_ORDINAL,
  "bootstrap_completed_utc": "$ISO_NOW_2",
  "paired_with_node0_receipt_id": "$PAIRED_RECEIPT_ID",
  "paired_with_node0_receipt_evidence_hash": "$PAIRED_RECEIPT_EVIDENCE_HASH",
  "in_person_ceremony_at_node0_date_gst": "$CEREMONY_DATE_GST",
  "phase_c_status": "device_profile_written_no_pat7_runtime",
  "next_steps_for_candidate": [
    "Run: node apps/cli/src/index.js status",
    "Run: node apps/cli/src/index.js receipts",
    "Optionally re-type consent verbatim on this device:",
    "  echo 'GO accept Node1 ordinal'",
    "Send the contents of ~/.dema/memory/node1-self-witness.json back to Mumu",
    "Mumu records this on Node0's registry as Phase C completion"
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
  "boundary_note": "consent_collected: false because this device bootstrap is NOT itself a consent ceremony · the candidate's typed consent at Mumu's Node0 terminal on $CEREMONY_DATE_GST (receipt $PAIRED_RECEIPT_ID) is the binding consent record · this device bootstrap is the technical confirmation of that prior in-person consent"
}
WITNESS_EOF
echo ""
echo "  Wrote                  : $DEMA_HOME/memory/node1-self-witness.json"
echo ""

# Final report
echo "  ────────────────────────────────────────────────────────────────"
echo "  Phase C bootstrap complete."
echo ""
echo "  Your Node1 state is now local on this device."
echo "  Send the contents of:"
echo "    $DEMA_HOME/memory/node1-self-witness.json"
echo "  back to Mumu (any channel: paste in WhatsApp, email, etc.)."
echo ""
echo "  Mumu will record this on Node0's registry as Phase C completion."
echo "  Until then, your Node1 status remains 'ghost_accepted_pending_device_install'"
echo "  on Mumu's Node0."
echo ""
echo "  You can disengage at any time. Just delete $DEMA_HOME."
echo "  ────────────────────────────────────────────────────────────────"
