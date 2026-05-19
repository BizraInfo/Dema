#!/usr/bin/env bash
# run-lifecycle-witness.sh
#
# Peak-performance lifecycle test for ONE task · ONE node · ONE human.
# Walks every canonical spine surface in sequence, captures each JSON emission,
# verifies canonical 16-key boundary all-false, computes per-surface timing,
# and emits a `bizra.dema.lifecycle_witness.v0.1` aggregate document.
#
# Reproducible by any operator with SSH access to Node0:
#   ssh bizra-operating-system@bizra-node0
#   cd Downloads/Dema
#   bash scripts/lifecycle/run-lifecycle-witness.sh
#
# Honors all 3 structural laws + ADR-005 + Master Craftsmanship 10-invariant:
#   - Node ordinal law         (canonized 2026-05-18 commit 1831aa9)
#   - Seed-pattern invariant   (canonized 2026-05-18 commit 8b55321)
#   - Skill Growth Law         (canonized 2026-05-18 commit 1899332)
#
# Boundary discipline of this script:
#   filesystem_write_performed : true (writes witness JSON · scoped to /tmp/)
#   network_used                : false
#   federation_invoked          : false
#   runtime_execution_performed : false
#   receipt_mint_performed      : false (separate forge_evidence step)
#   consent_collected           : false (no operator intent captured · read-only walk)

set -eu

INTENT="${1:-Verify Node0 local health and emit a lifecycle witness across all spine surfaces}"
OPERATOR="${OPERATOR:-Mumu}"
NODE="${NODE:-Node0}"
WITNESS_PATH="${WITNESS_PATH:-/tmp/lifecycle-witness-$(date +%Y%m%d-%H%M%S).json}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CLI="${REPO_ROOT}/apps/cli/src/index.js"

# The 13 canonical spine surfaces (in declared order).
# Two-tuple: command-name | expected-schema
SPINE_COMMANDS=(
  "state|bizra.dema.node0_state.v0.1"
  "profiles|bizra.dema.profile_foundation.v0.1"
  "consent-card|bizra.dema.consent_card_preview.v0.1"
  "mission-loop|bizra.dema.mission_loop_preview.v0.1"
  "evidence-event|bizra.dema.evidence_chain_event_preview.v0.1"
  "llm-router|bizra.dema.local_llm_router_preview.v0.1"
  "process-mining|bizra.dema.process_mining_preview.v0.1"
  "key-maker-check|bizra.dema.key_maker_compliance.v0.1"
  "llm-invoke|bizra.dema.llm_invocation_preview.v0.1"
  "node-registry|bizra.dema.node_registry_preview.v0.1"
  "onboarding-lifecycle|bizra.dema.onboarding_lifecycle.v0.1"
  "skill-growth-governor|bizra.dema.skill_growth_governor.v0.1"
  "project-status|bizra.dema.project_status.v0.1"
)

EXPECTED_BOUNDARY_KEYS=(
  filesystem_write_performed
  network_used
  runtime_execution_performed
  model_loaded
  model_invocation_performed
  prompt_executed
  external_call_performed
  raw_corpus_scan_performed
  raw_data_included
  tool_executed
  chain_advance_performed
  receipt_mint_performed
  federation_invoked
  node_connection_performed
  public_network_used
  consent_collected
)

# ─── Header ────────────────────────────────────────────────────────────────

echo "╭──────────────────────────────────────────────────────────────────────────╮"
echo "│  DEMA · LIFECYCLE WITNESS · one task · one node · one human              │"
echo "├──────────────────────────────────────────────────────────────────────────┤"
echo "│  Intent   : ${INTENT}"
echo "│  Operator : ${OPERATOR}"
echo "│  Node     : ${NODE}"
echo "│  Witness  : ${WITNESS_PATH}"
echo "│  Surfaces : ${#SPINE_COMMANDS[@]} canonical"
echo "╰──────────────────────────────────────────────────────────────────────────╯"
echo ""

# ─── Walk each spine surface ──────────────────────────────────────────────

STARTED_UTC=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
TOTAL_DURATION_MS=0
FAILURES=0
ENTRIES_JSON="["
SEP=""

for entry in "${SPINE_COMMANDS[@]}"; do
  CMD="${entry%%|*}"
  EXPECTED_SCHEMA="${entry##*|}"

  printf "  walking %-26s ... " "${CMD}"

  T0=$(date +%s%3N)
  # Capture stdout (JSON) and stderr together · for surfaces that need --json
  # flag (onboarding-lifecycle), pass it explicitly
  if [ "${CMD}" = "onboarding-lifecycle" ]; then
    OUT=$(node "${CLI}" "${CMD}" --json 2>/dev/null) || OUT="{}"
  else
    OUT=$(node "${CLI}" "${CMD}" 2>/dev/null) || OUT="{}"
  fi
  T1=$(date +%s%3N)
  DUR_MS=$((T1 - T0))
  TOTAL_DURATION_MS=$((TOTAL_DURATION_MS + DUR_MS))

  # Parse JSON safely · check schema, truth_label, boundary
  OBSERVED_SCHEMA=$(echo "${OUT}" | python3 -c "import json,sys
try:
  d = json.load(sys.stdin)
  print(d.get('schema',''))
except Exception:
  print('')")
  TRUTH_LABEL=$(echo "${OUT}" | python3 -c "import json,sys
try:
  d = json.load(sys.stdin)
  print(d.get('truth_label',''))
except Exception:
  print('')")
  BOUNDARY_OK=$(echo "${OUT}" | python3 -c "import json,sys
EXPECTED = ${#EXPECTED_BOUNDARY_KEYS[@]}
try:
  d = json.load(sys.stdin)
  b = d.get('boundary', {})
  ok = (len(b) == EXPECTED and all(v is False for v in b.values()))
  print('true' if ok else 'false')
except Exception:
  print('false')")

  STATUS_TAG="ok"
  if [ "${OBSERVED_SCHEMA}" != "${EXPECTED_SCHEMA}" ]; then
    STATUS_TAG="schema_mismatch"
    FAILURES=$((FAILURES + 1))
  elif [ "${TRUTH_LABEL}" != "NODE0_LOCAL_SEED" ]; then
    STATUS_TAG="truth_label_drift"
    FAILURES=$((FAILURES + 1))
  elif [ "${BOUNDARY_OK}" != "true" ]; then
    STATUS_TAG="boundary_drift"
    FAILURES=$((FAILURES + 1))
  fi

  if [ "${STATUS_TAG}" = "ok" ]; then
    printf "✓ %4dms · canonical\n" "${DUR_MS}"
  else
    printf "✗ %4dms · %s\n" "${DUR_MS}" "${STATUS_TAG}"
  fi

  ENTRIES_JSON="${ENTRIES_JSON}${SEP}{\"command\":\"${CMD}\",\"expected_schema\":\"${EXPECTED_SCHEMA}\",\"observed_schema\":\"${OBSERVED_SCHEMA}\",\"truth_label\":\"${TRUTH_LABEL}\",\"boundary_all_false\":${BOUNDARY_OK},\"duration_ms\":${DUR_MS},\"status\":\"${STATUS_TAG}\"}"
  SEP=","
done
ENTRIES_JSON="${ENTRIES_JSON}]"

COMPLETED_UTC=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)

# ─── Final 5-gate state (verify gates still hold after walk) ───────────────

echo ""
echo "  ─── Aggregate ─────────────────────────────────────────────────────────"
echo "  Surfaces walked     : ${#SPINE_COMMANDS[@]}"
echo "  All canonical       : $([ ${FAILURES} -eq 0 ] && echo 'TRUE' || echo "FALSE (${FAILURES} failures)")"
echo "  Total duration      : ${TOTAL_DURATION_MS}ms"
echo "  Avg per surface     : $((TOTAL_DURATION_MS / ${#SPINE_COMMANDS[@]}))ms"
echo ""

# ─── Emit witness JSON ─────────────────────────────────────────────────────

cat > "${WITNESS_PATH}" <<WITNESS_EOF
{
  "schema": "bizra.dema.lifecycle_witness.v0.1",
  "truth_label": "NODE0_LOCAL_SEED",
  "mode": "lifecycle_test_record",
  "task": {
    "intent": "${INTENT}",
    "operator": "${OPERATOR}",
    "node": "${NODE}",
    "started_utc": "${STARTED_UTC}",
    "completed_utc": "${COMPLETED_UTC}"
  },
  "spine_walk": ${ENTRIES_JSON},
  "aggregate": {
    "surfaces_walked": ${#SPINE_COMMANDS[@]},
    "all_canonical_boundary": $([ ${FAILURES} -eq 0 ] && echo 'true' || echo 'false'),
    "failures": ${FAILURES},
    "total_duration_ms": ${TOTAL_DURATION_MS},
    "avg_per_surface_ms": $((TOTAL_DURATION_MS / ${#SPINE_COMMANDS[@]}))
  },
  "doctrine_anchors": {
    "node_ordinal_law": "docs/canon/BIZRA_TOPOLOGY_CANON.md#node-ordinal-law",
    "seed_pattern_invariant": "docs/canon/BIZRA_TOPOLOGY_CANON.md#seed-pattern-invariant-fractality",
    "skill_growth_law": "docs/canon/BIZRA_TOPOLOGY_CANON.md#skill-growth-law"
  },
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
  "boundary_note": "filesystem_write_performed: true (this witness file is itself a write to /tmp/). All 15 other boundary keys remain false. The spine walk itself is fully read-only · no actuator fires · no consent collected · no chain advance · no receipt mint (mint is a separate step downstream)."
}
WITNESS_EOF

echo "  Witness written     : ${WITNESS_PATH}"
echo "  Size                : $(wc -c < "${WITNESS_PATH}") bytes"
echo ""

# ─── Exit code ─────────────────────────────────────────────────────────────

if [ ${FAILURES} -eq 0 ]; then
  echo "  ✓ All 13 spine surfaces emitted canonical 16-key boundary all-false"
  echo "  ✓ Lifecycle witness ready for receipt minting"
  echo ""
  echo "  Next action: pass ${WITNESS_PATH} to scripts/forge_evidence.py as artifact"
  echo "  to mint a Proof-Forge receipt for this lifecycle run."
  exit 0
else
  echo "  ✗ ${FAILURES} surface(s) drifted from canonical state"
  echo "  ✗ Lifecycle witness NOT ready for receipt minting"
  exit 1
fi
