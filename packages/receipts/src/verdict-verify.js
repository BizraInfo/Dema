// Verdict Receipt · Permissionless trustless verifier.
//
// Given a portable bundle + an EXTERNALLY-supplied public key + the public
// rule code in this repo, recompute everything from scratch and either
// VERIFIED (sig + input_hash + rule re-derivation all hold) or
// REJECTED:<first-failing-reason>.
//
// Crucial invariant: the verifier IGNORES bundle.signer_public_key_pem for
// trust purposes. It uses ONLY pubkeyPem (the externally-supplied key).
// REJECT-4 test proves this: even if the verifier is given the bundle's own
// embedded key as --pubkey, a re-signed body still fails — because the
// actual signing key was different.
//
// Reuses (no duplication):
// - verifyPayload                packages/receipts/src/authorship-signature.js
// - sha256, stableStringify      packages/consent/src/consent-common.js
// - evaluate(canonical-shape)    packages/rules/src/rule-canonical-shape.v0.1.js

import { verifyPayload } from "./authorship-signature.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import {
  evaluate as canonicalShapeEvaluate,
  RULE_ID as CANONICAL_SHAPE_RULE_ID,
} from "../../rules/src/rule-canonical-shape.v0.1.js";

const RULES = Object.freeze({
  [CANONICAL_SHAPE_RULE_ID]: canonicalShapeEvaluate,
});

function reject(reason) {
  return Object.freeze({
    verified: false,
    rejected: true,
    reason,
  });
}

export function verifyVerdictBundle({ bundle, pubkeyPem, ruleId }) {
  // ── Structural validation ────────────────────────────────────────────
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    return reject("bundle_missing_or_malformed");
  }
  if (!bundle.body || typeof bundle.body !== "object") {
    return reject("bundle_body_missing");
  }
  if (
    typeof bundle.signature_b64 !== "string" ||
    bundle.signature_b64.length === 0
  ) {
    return reject("bundle_signature_missing");
  }
  if (
    typeof pubkeyPem !== "string" ||
    !pubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return reject("external_pubkey_required");
  }
  if (bundle.body.rule_id !== ruleId) {
    return reject("rule_id_mismatch");
  }

  const evaluator = RULES[ruleId];
  if (!evaluator) {
    return reject("unknown_rule");
  }

  // ── (a) Signature check ──────────────────────────────────────────────
  // CRUCIAL: use ONLY pubkeyPem; explicitly IGNORE bundle.signer_public_key_pem.
  let signatureValid;
  try {
    signatureValid = verifyPayload(
      bundle.body,
      bundle.signature_b64,
      pubkeyPem,
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    return reject("signature_invalid");
  }

  // ── (b) input_hash check ─────────────────────────────────────────────
  if (bundle.input === undefined) {
    return reject("input_missing");
  }
  const recomputedInputHash = sha256(stableStringify(bundle.input));
  if (recomputedInputHash !== bundle.body.input_hash) {
    return reject("input_hash_mismatch");
  }

  // ── (c) Re-run the rule and compare ──────────────────────────────────
  const rederived = evaluator(bundle.input);
  if (rederived.verdict !== bundle.body.verdict) {
    return reject("verdict_rederivation_mismatch");
  }
  if (
    stableStringify(rederived.computed) !==
    stableStringify(bundle.body.computed)
  ) {
    return reject("verdict_rederivation_mismatch");
  }

  // ── (d) prev_hash hook — chain-walk deferred this slice ──────────────
  // Surface presence so callers can branch on it without us walking yet.
  const prevHashPresent =
    bundle.body.prev_hash !== null && bundle.body.prev_hash !== undefined;

  return Object.freeze({
    verified: true,
    rule_id: ruleId,
    verdict: bundle.body.verdict,
    body_hash: sha256(stableStringify(bundle.body)),
    prev_hash_present: prevHashPresent,
  });
}
