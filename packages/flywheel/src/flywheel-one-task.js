// FLYWHEEL-1A · minimal one-task flywheel (slice 1 of §19)
//
// Composes REAL kernels into the beating heart of the §19 acceptance loop:
//
//   enforced action (ASSUMPTION-GATE-1C mintGuardedClaim)
//     → deterministic grounding score (re-derivable from recorded claim_state)
//     → chained flywheel receipt (content-addressed)
//     → replay re-derives the score from recorded fact, zero trust in producer
//
// Covers §19 steps 6–9 + 17 (verified action → receipt → score → replay) for
// ONE task. NOT covered (later slices): mission select, PAT/SAT proposal+audit,
// token ledger settlement, agent XP, Teacher lesson, performance delta, next
// mission. No synthetic data — every receipt on disk is real.
//
// The score is a deterministic PROOF-QUALITY measure over the action's declared
// V/D/A/U label — Level-B re-derivable, NOT model-scored. A stranger holding
// {action receipt + flywheel receipt + this rule} re-derives it with zero trust.
//
// Reuses (no new crypto, no new gate):
// - mintGuardedClaim        ../../receipts/src/assumption-guarded-claim.js
// - sha256, stableStringify ../../consent/src/consent-common.js
//
// SCOPE: localhost only, fail-closed, no token mint, no federation, no key.

import { mkdir, writeFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { mintGuardedClaim } from "../../receipts/src/assumption-guarded-claim.js";

export const FLYWHEEL_SCHEMA = "bizra.dema.flywheel_one_task.v0.1";
export const GROUNDING_SCORE_RULE_ID = "epistemic_grounding_score.v0.1";

// Deterministic proof-quality score over the declared claim-state. More-grounded
// claims score higher: Verified > Derived > Assumed-with-Iḥsān > Unknown.
const GROUNDING_SCORES = Object.freeze({ V: 1.0, D: 0.8, A: 0.6, U: 0.2 });

export function scoreEpistemicGrounding(claimState) {
  return Object.prototype.hasOwnProperty.call(GROUNDING_SCORES, claimState)
    ? GROUNDING_SCORES[claimState]
    : 0;
}

function resolveHome(override) {
  if (typeof override === "string" && override.length > 0) return override;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

/**
 * Run one task through the minimal flywheel. Fail-closed: if the enforced
 * action gate rejects, nothing downstream runs and nothing is written.
 *
 * @returns {{completed:true, action_receipt_id, claim_state, score,
 *            flywheel_receipt, flywheel_receipt_path}
 *          | {completed:false, stage, error}}
 */
export async function runOneTaskFlywheel({
  task,
  envelope,
  consent,
  demaHome,
  now,
} = {}) {
  // ── Step 6 · enforced action (ASSUMPTION-GATE-1C) ────────────────
  const action = await mintGuardedClaim({
    claim: typeof task === "string" ? task : "",
    envelope,
    consent,
    demaHome,
    now,
  });
  if (!action.minted) {
    return Object.freeze({
      completed: false,
      stage: "action",
      error: action.error,
    });
  }

  // ── Step 9 · deterministic proof-quality score (re-derivable) ────
  const score = scoreEpistemicGrounding(action.claim_state);

  // ── Step 7 · chained flywheel receipt (prev_hash → action) ───────
  const body = {
    schema: FLYWHEEL_SCHEMA,
    task,
    prev_hash: action.receipt_id,
    action_receipt_id: action.receipt_id,
    claim_state: action.claim_state,
    score,
    score_rule_id: GROUNDING_SCORE_RULE_ID,
    created_at_iso: now,
  };
  const receiptId = sha256(stableStringify(body));
  const flywheelReceipt = Object.freeze({ ...body, receipt_id: receiptId });

  const receiptsDir = join(resolveHome(demaHome), "receipts");
  await mkdir(receiptsDir, { recursive: true, mode: 0o700 });
  const finalPath = join(receiptsDir, `flywheel-${receiptId}.json`);
  const tmpPath = `${finalPath}.tmp`;
  try {
    await writeFile(tmpPath, JSON.stringify(flywheelReceipt, null, 2) + "\n", {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(tmpPath, finalPath);
  } catch (err) {
    try {
      await unlink(tmpPath);
    } catch {
      /* tmp already gone */
    }
    throw err;
  }

  return Object.freeze({
    completed: true,
    action_receipt_id: action.receipt_id,
    claim_state: action.claim_state,
    score,
    flywheel_receipt: flywheelReceipt,
    flywheel_receipt_path: finalPath,
  });
}

/**
 * Step 17 · replay verification — PURE, no I/O. Given only the recorded flywheel
 * receipt (+ the action receipt id), re-derive the score from the recorded
 * claim_state and confirm the chain, with zero trust in the producer.
 *
 * Order matters: chain → score → hash, so a forged score surfaces as
 * score_rederivation_mismatch (not merely a hash mismatch).
 *
 * @returns {{replayed:true, score} | {replayed:false, reason}}
 */
export function replayOneTaskFlywheel({
  flywheelReceipt,
  actionReceiptId,
} = {}) {
  if (
    !flywheelReceipt ||
    typeof flywheelReceipt !== "object" ||
    Array.isArray(flywheelReceipt)
  ) {
    return Object.freeze({
      replayed: false,
      reason: "flywheel_receipt_invalid",
    });
  }
  // Require the action receipt id — replaying without it would falsely verify
  // an orphaned receipt by skipping the chain check (PR #112 review).
  if (typeof actionReceiptId !== "string" || actionReceiptId.length === 0) {
    return Object.freeze({
      replayed: false,
      reason: "action_receipt_id_required",
    });
  }
  if (flywheelReceipt.prev_hash !== actionReceiptId) {
    return Object.freeze({ replayed: false, reason: "chain_link_mismatch" });
  }

  // A self-consistent hash is not enough — fail closed on any out-of-spec
  // contract (schema / rule / claim_state) before trusting it (PR #112 review).
  if (flywheelReceipt.schema !== FLYWHEEL_SCHEMA) {
    return Object.freeze({ replayed: false, reason: "schema_mismatch" });
  }
  if (flywheelReceipt.score_rule_id !== GROUNDING_SCORE_RULE_ID) {
    return Object.freeze({ replayed: false, reason: "score_rule_mismatch" });
  }
  if (
    !Object.prototype.hasOwnProperty.call(
      GROUNDING_SCORES,
      flywheelReceipt.claim_state,
    )
  ) {
    return Object.freeze({ replayed: false, reason: "claim_state_invalid" });
  }

  const rederivedScore = scoreEpistemicGrounding(flywheelReceipt.claim_state);
  if (rederivedScore !== flywheelReceipt.score) {
    return Object.freeze({
      replayed: false,
      reason: "score_rederivation_mismatch",
    });
  }

  const { receipt_id, ...bodyOnly } = flywheelReceipt;
  if (sha256(stableStringify(bodyOnly)) !== receipt_id) {
    return Object.freeze({ replayed: false, reason: "flywheel_hash_mismatch" });
  }

  return Object.freeze({ replayed: true, score: rederivedScore });
}
