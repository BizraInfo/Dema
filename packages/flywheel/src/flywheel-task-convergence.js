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

// A canonical-chain failure. verifyCanonicalChain checks structure (prev_hash /
// receipt_id / body_hash / truth_label) BEFORE signatures, so on a structural
// failure the signatures were never verified — cryptographic must NOT be claimed
// true (that would be an unproven convergence claim). Only a signature failure
// means the structure passed.
function layersFromChain(reason) {
  const isSig = reason === "signature_invalid";
  return {
    formal: isSig, // structure passed iff we got as far as the signature check
    cryptographic: false, // never verified on a failed chain
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

/**
 * Verify that the persisted canonical task chain converges across all four
 * Proof-of-Truth layers. Returns a frozen verdict.
 *
 * The canonical ledger is append-only and RECEIPT-CHAIN-1C binds each task as a
 * contiguous 3-entry segment [flywheel action, IMPACT, SAT]. Convergence is
 * proven for EVERY segment — a later incoherent (Frankenstein) task must not be
 * masked by an earlier coherent one.
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

  // Formal + cryptographic hold for the chain at this point.
  const chainLayers = { formal: true, cryptographic: true };
  const extractFail = (reason) =>
    fail("extract", reason, {
      ...chainLayers,
      empirical: false,
      economic: false,
    });

  // ── Verify each 3-entry task segment ──────────────────────────────
  const tasks = [];
  for (let i = 0; i < entries.length; i += 3) {
    const a = entries[i] && entries[i].canonical_body;
    const b = entries[i + 1] && entries[i + 1].canonical_body;
    const c = entries[i + 2] && entries[i + 2].canonical_body;
    if (!a || a.schema !== FLYWHEEL_SCHEMA) {
      return extractFail("missing_task_artifact_flywheel");
    }
    if (!b || b.schema !== DUAL_TOKEN_LEDGER_ENTRY_SCHEMA) {
      return extractFail("missing_task_artifact_impact");
    }
    if (!c || c.schema !== SAT_VALIDATION_RECEIPT_SCHEMA) {
      return extractFail("missing_task_artifact_sat");
    }
    // ── Empirical + Economic: cross-reference coherence ─────────────
    const coherence = verifyTaskCoherence({
      flywheelReceipt: a,
      impactEntry: b,
      satReceipt: c,
      operatorPubkeyPem: pubkeyPem,
    });
    if (!coherence.coherent) {
      return fail(
        "coherence",
        coherence.reason,
        layersFromCoherence(coherence),
        { coherence, segment_index: i / 3 },
      );
    }
    tasks.push(coherence.task);
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
    // The chain head, taken from the SAME loaded snapshot — callers (e.g. the
    // convergence attestation) use this instead of re-reading the ledger, so the
    // verdict and the recorded root can never come from two different reads.
    canonical_chain_root: entries[entries.length - 1].receipt_id,
    task_count: tasks.length,
    tasks: Object.freeze(tasks),
    task: tasks[tasks.length - 1],
  });
}
