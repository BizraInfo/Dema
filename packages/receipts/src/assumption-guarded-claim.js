// ASSUMPTION-GATE-1C · enforced Law-of-Assumption mutation gate
//
// The step from "invoked" (1B harness preview) to "enforced law": a real
// mutation (a receipt written to $DEMA_HOME/receipts) happens ONLY when the
// claim's assumption envelope passes validateAssumptionBoundary. A rejected
// envelope writes nothing. There is no path to the write that skips the gate,
// so "a legacy path bypasses the validator" is structurally impossible.
//
// Every minted receipt records assumption_gate_result, binding the recorded
// claim to its declared V/D/A/U boundary.
//
// Reuses (no new crypto, no new validator):
// - validateAssumptionBoundary   ./assumption-boundary-validator.js
// - sha256, stableStringify      ../../consent/src/consent-common.js
//
// Canon: docs/canon/LAW_OF_ASSUMPTION.md. Bulletproof law §22:
// "If it cannot be consented, it cannot mutate."
//
// SCOPE (this slice): one enforced mutation primitive. No CLI (1C-bis/1D),
// no PoI, no economy, no XP, no federation, no signing key. Fail-closed on
// BOTH consent and the assumption gate.

import { mkdir, writeFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { validateAssumptionBoundary } from "./assumption-boundary-validator.js";

export const GUARDED_CLAIM_SCHEMA = "bizra.dema.guarded_claim_receipt.v0.1";
export const GUARDED_CLAIM_CONSENT_PHRASE = "RECORD GUARDED CLAIM";

function resolveHome(override) {
  if (typeof override === "string" && override.length > 0) return override;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

function fail(error, extra) {
  return Object.freeze({ minted: false, error, ...(extra || {}) });
}

/**
 * Record a claim as a receipt ONLY if its assumption envelope passes the
 * Law-of-Assumption gate. Fail-closed: wrong consent, missing timestamp,
 * empty claim, or any gate rejection writes nothing.
 *
 * @returns {{minted:true, receipt_id, receipt_path, claim_state, assumption_gate_result}
 *          | {minted:false, error, assumption_gate_result?}}
 */
export async function mintGuardedClaim({
  claim,
  envelope,
  consent,
  demaHome,
  now,
} = {}) {
  // §22: no mutation without exact-string consent (gate never runs otherwise).
  if (consent !== GUARDED_CLAIM_CONSENT_PHRASE) {
    return fail("consent_required");
  }
  // created_at_iso is committed to the content hash; no wall-clock fallback.
  if (typeof now !== "string" || now.length === 0) {
    return fail("created_at_iso_required");
  }
  if (typeof claim !== "string" || claim.length === 0) {
    return fail("claim_required");
  }

  // ── ENFORCEMENT — the gate is the only path to a write ───────────
  const gate = validateAssumptionBoundary(envelope);
  if (!gate.valid) {
    return fail(`assumption_${gate.error}`, {
      assumption_gate_result: Object.freeze({
        valid: false,
        error: gate.error,
      }),
    });
  }

  const assumptionGateResult = Object.freeze({
    valid: true,
    claim_state: gate.claim_state,
  });

  const body = {
    schema: GUARDED_CLAIM_SCHEMA,
    claim,
    claim_state: gate.claim_state,
    assumption_envelope: envelope,
    assumption_gate_result: assumptionGateResult,
    prev_hash: null,
    created_at_iso: now,
  };

  const receiptId = sha256(stableStringify(body));
  const receiptsDir = join(resolveHome(demaHome), "receipts");
  await mkdir(receiptsDir, { recursive: true, mode: 0o700 });

  const finalPath = join(receiptsDir, `guarded-claim-${receiptId}.json`);
  const content =
    JSON.stringify({ ...body, receipt_id: receiptId }, null, 2) + "\n";
  const tmpPath = `${finalPath}.tmp`;
  try {
    await writeFile(tmpPath, content, {
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
    minted: true,
    receipt_id: receiptId,
    receipt_path: finalPath,
    claim_state: gate.claim_state,
    assumption_gate_result: assumptionGateResult,
  });
}
