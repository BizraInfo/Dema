// FLYWHEEL-REPLAY-1B · Proof-of-Truth convergence over the bound canonical chain.
//
// Capstone of RECEIPT-CHAIN-1C (bind) + FLYWHEEL-REPLAY-1A (coherence). Those
// two prove different things at different times; nothing yet proves ALL of it on
// the PERSISTED chain. A Frankenstein bundle binds and `verifyCanonicalLedger`
// passes (the receipts are signed + hash-linked) while being three unrelated
// tasks. This verifier loads the bound canonical chain and returns ONE verdict
// across the four convergence layers:
//
//   Formal        — prev_hash chain structure          (verifyCanonicalLedger)
//   Cryptographic — Ed25519 signatures, external pubkey (verifyCanonicalLedger
//                                                         + inner verifiers)
//   Empirical     — cross-reference coherence           (verifyTaskCoherence:
//                                                         IMPACT-from-action,
//                                                         SAT-bound-to-IMPACT)
//   Economic      — amounts follow the deterministic    (verifyTaskCoherence:
//                   rules (impact<-score, XP<-impact)    amount cross-refs)
//
// Pure-with-disk-read (loads the ledger; no write, no clock, no key load — the
// external pubkey is supplied). Output deep-frozen.

import {
  loadCanonicalLedger,
  verifyCanonicalLedger,
} from "../../receipts/src/canonical-ledger.js";
import { verifyTaskCoherence } from "./flywheel-task-coherence.js";
import { FLYWHEEL_SCHEMA } from "./flywheel-one-task.js";
import { DUAL_TOKEN_LEDGER_ENTRY_SCHEMA } from "../../econ/src/dual-token-ledger.js";
import { SAT_VALIDATION_RECEIPT_SCHEMA } from "./flywheel-sat-validation.js";

export const FLYWHEEL_TASK_CONVERGENCE_SCHEMA =
  "bizra.dema.flywheel_task_convergence.v0.1";

const ALL_FALSE = Object.freeze({
  formal: false,
  cryptographic: false,
  empirical: false,
  economic: false,
});

function fail(stage, reason, layers, extra = {}) {
  return Object.freeze({
    schema: FLYWHEEL_TASK_CONVERGENCE_SCHEMA,
    convergent: false,
    truth_label: "LOCAL_FLYWHEEL_TASK_NOT_CONVERGENT",
    stage,
    reason,
    layers: Object.freeze({ ...layers }),
    ...extra,
  });
}

// A canonical-chain failure: a signature failure is cryptographic; any other
// (hash/prev_hash/genesis/schema) is a formal-structure failure.
function layersFromChain(reason) {
  const isSig = reason === "signature_invalid";
  return {
    formal: isSig,
    cryptographic: !isSig,
    empirical: false,
    economic: false,
  };
}

// A coherence failure on an already-valid chain. Artifact-level verify failures
// are cryptographic; amount mismatches are economic; binding mismatches are
// empirical.
function layersFromCoherence(coh) {
  const layers = {
    formal: true,
    cryptographic: true,
    empirical: true,
    economic: true,
  };
  if (
    coh.stage === "flywheel_replay" ||
    coh.stage === "impact_verify" ||
    coh.stage === "sat_verify"
  ) {
    layers.cryptographic = false;
  } else if (coh.stage === "cross_reference") {
    if (
      coh.reason === "impact_amount_incoherent" ||
      coh.reason === "xp_amount_incoherent"
    ) {
      layers.economic = false;
    } else {
      layers.empirical = false;
    }
  }
  return layers;
}

function findBySchema(entries, schema) {
  for (const e of entries) {
    if (e && e.canonical_body && e.canonical_body.schema === schema) {
      return e.canonical_body;
    }
  }
  return null;
}

/**
 * Verify that the persisted canonical task chain converges across all four
 * Proof-of-Truth layers. Returns a frozen verdict.
 */
export async function verifyConvergentTaskChain({ demaHome, pubkeyPem } = {}) {
  // ── Load the bound chain ──────────────────────────────────────────
  let entries;
  try {
    entries = await loadCanonicalLedger({ demaHome });
  } catch {
    return fail("canonical_chain", "ledger_unreadable", ALL_FALSE);
  }
  if (entries.length === 0) {
    return fail("canonical_chain", "empty_chain", ALL_FALSE);
  }

  // ── Formal + Cryptographic: the canonical chain itself ────────────
  const chain = await verifyCanonicalLedger({ demaHome, pubkeyPem });
  if (!chain.verified) {
    return fail(
      "canonical_chain",
      chain.reason,
      layersFromChain(chain.reason),
      {
        canonical_chain: chain,
      },
    );
  }

  // ── Extract the task's artifacts by schema ────────────────────────
  const flywheelReceipt = findBySchema(entries, FLYWHEEL_SCHEMA);
  const impactEntry = findBySchema(entries, DUAL_TOKEN_LEDGER_ENTRY_SCHEMA);
  const satReceipt = findBySchema(entries, SAT_VALIDATION_RECEIPT_SCHEMA);
  // Formal + cryptographic already hold for the chain at this point.
  const chainLayers = { formal: true, cryptographic: true };
  if (!flywheelReceipt) {
    return fail("extract", "missing_task_artifact_flywheel", {
      ...chainLayers,
      empirical: false,
      economic: false,
    });
  }
  if (!impactEntry) {
    return fail("extract", "missing_task_artifact_impact", {
      ...chainLayers,
      empirical: false,
      economic: false,
    });
  }
  if (!satReceipt) {
    return fail("extract", "missing_task_artifact_sat", {
      ...chainLayers,
      empirical: false,
      economic: false,
    });
  }

  // ── Empirical + Economic: cross-reference coherence ───────────────
  const coherence = verifyTaskCoherence({
    flywheelReceipt,
    impactEntry,
    satReceipt,
    operatorPubkeyPem: pubkeyPem,
  });
  if (!coherence.coherent) {
    return fail("coherence", coherence.reason, layersFromCoherence(coherence), {
      coherence,
    });
  }

  return Object.freeze({
    schema: FLYWHEEL_TASK_CONVERGENCE_SCHEMA,
    convergent: true,
    truth_label: "LOCAL_FLYWHEEL_TASK_CONVERGENT",
    layers: Object.freeze({
      formal: true,
      cryptographic: true,
      empirical: true,
      economic: true,
    }),
    chain_length: entries.length,
    task: coherence.task,
  });
}
