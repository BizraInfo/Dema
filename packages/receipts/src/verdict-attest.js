// Verdict Receipt · Mint side (Node1 only · consented · signed).
//
// Builds + signs a bizra.dema.verdict_receipt.v0.1 envelope, writes the
// portable bundle to ~/.dema/receipts/verdict-<bodyHash>.json. The bundle
// shape is { body, signature_b64, signer_public_key_pem, input } so a
// stranger holding only the bundle + an externally-supplied public key
// can verify the verdict was earned (signature + input_hash + rederive).
//
// Reuses (no duplication):
// - signPayload                  packages/receipts/src/authorship-signature.js
// - loadActiveKeyPair packages/receipts/src/authorship-key-store.js
// - sha256, stableStringify      packages/consent/src/consent-common.js
// - evaluate(canonical-shape)    packages/rules/src/rule-canonical-shape.v0.1.js
// - exact-string consent gate    pattern from authorship-key-store.js:43
//
// Per spec: chain-walk hook (prev_hash) is present but unused this slice.

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { signPayload } from "./authorship-signature.js";
import { loadActiveKeyPair } from "./authorship-key-store.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import {
  evaluate as canonicalShapeEvaluate,
  RULE_ID as CANONICAL_SHAPE_RULE_ID,
} from "../../rules/src/rule-canonical-shape.v0.1.js";
import { verifyConsentProof } from "./consent-proof.js";
import { recordConsentNonce } from "./consent-nonce-registry.js";

export const VERDICT_RECEIPT_SCHEMA = "bizra.dema.verdict_receipt.v0.1";

// Reuse the EXISTING fail-closed consent phrase (per spec: do not invent a
// new phrase; attest is a signing operation so it shares the sign gate).
export const ATTEST_CONSENT_PHRASE = "SIGN AUTHORSHIP RECEIPT";

// KEYCONSENT-1B: stable action_type for consent_proof.action_scope. The
// consent proof must declare this exact action_type for the verifier to
// accept it. Cross-action consent reuse → consent_scope_mismatch.
export const ATTEST_ACTION_TYPE = "MINT_VERDICT_RECEIPT";

// Single-rule registry. Spec forbids a general rule registry this slice.
const RULES = Object.freeze({
  [CANONICAL_SHAPE_RULE_ID]: canonicalShapeEvaluate,
});

function resolveHome(demaHome) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

// Verdict-domain boundary vocabulary per per-module-domain-boundary-pattern.
// Coexists with the canonical 16-key shape (preview-boundary.js).
function buildBoundary({ attested }) {
  return Object.freeze({
    local_only: true,
    private_key_loaded: attested,
    receipt_written: attested,
    signature_emitted: attested,
    rule_executed: attested,
    network_used: false,
    federation_used: false,
    token_minted: false,
    share_published: false,
    poi_score_calculated: false,
    economic_claim_made: false,
  });
}

function fail({ error, extra = {} }) {
  return Object.freeze({
    schema: VERDICT_RECEIPT_SCHEMA,
    attested: false,
    error,
    boundary: buildBoundary({ attested: false }),
    ...extra,
  });
}

export async function attestVerdict({
  rule,
  input,
  consent,
  consentProof,
  demaHome,
  prevHash = null,
  createdAtIso,
  now,
}) {
  // (1) Legacy fail-closed phrase gate — UNCHANGED (defense in depth).
  // KEYCONSENT-1B preserves the existing exact-string discipline; the
  // new key-bound check runs AFTER this.
  if (consent !== ATTEST_CONSENT_PHRASE) {
    return fail({
      error: "consent_required",
      extra: { required_phrase: ATTEST_CONSENT_PHRASE },
    });
  }

  // (2) Rule lookup
  const evaluator = RULES[rule];
  if (!evaluator) {
    return fail({ error: "unknown_rule", extra: { rule_id: rule } });
  }

  // (3) Load signing key (private + public)
  const activePair = await loadActiveKeyPair(demaHome);
  const privateKeyPem = activePair.ok ? activePair.private_key_pem : null;
  if (!privateKeyPem) {
    return fail({ error: "no_authorship_key" });
  }
  const publicKeyPem = activePair.ok ? activePair.public_key_pem : null;

  // (4) KEYCONSENT-1B: consent proof MANDATORY (per preflight §9 + Mumu's
  // bar #2). Caller must supply a key-bound consent_proof envelope built
  // via buildConsentProof() with action_scope bound to this specific
  // input via target_hash = sha256(stableStringify(input)).
  if (!consentProof || typeof consentProof !== "object") {
    return fail({ error: "consent_proof_required" });
  }

  // (5) KEYCONSENT-1B: verify consent proof.
  // Critical invariant (same as verdict-receipt REJECT-4): uses ONLY the
  // operator's pubkey loaded from disk as the external authority;
  // consent_proof.operator_public_key_fingerprint is NOT trusted for
  // identity. A consent signed by a different key fails signature_invalid.
  const inputHash = sha256(stableStringify(input));
  const consentVerify = verifyConsentProof({
    consentProof,
    pubkeyPem: publicKeyPem,
    expectedActionScope: {
      action_type: ATTEST_ACTION_TYPE,
      target_hash: inputHash,
    },
    now: now || new Date().toISOString(),
  });
  if (!consentVerify.verified) {
    return fail({ error: `consent_proof_${consentVerify.reason}` });
  }

  // (5b) KEYCONSENT-2B: record the consent proof's nonce as consumed.
  // First call with a given nonce wins; replay → consent_nonce_already_used.
  // Recorded AFTER consent verification succeeds and BEFORE rule
  // execution + receipt persistence, so a rejected replay leaves NO
  // side effect: no receipt, no chain advance, no rule run.
  const nonceResult = await recordConsentNonce({
    nonce: consentProof.nonce,
    actionType: consentProof.action_scope.action_type,
    targetHash: consentProof.action_scope.target_hash,
    consentProofHash: consentProof.consent_proof_hash,
    demaHome,
  });
  if (!nonceResult.recorded) {
    return fail({ error: `consent_${nonceResult.error}` });
  }

  // (6) Run the rule (pure)
  const { verdict, computed } = evaluator(input);

  // (7) Build body — now references consent_proof_hash; input does NOT
  // ship in body (only its hash). Body commits to BOTH the input hash
  // and the consent proof hash; the bundle ships both alongside.
  const body = Object.freeze({
    schema: VERDICT_RECEIPT_SCHEMA,
    rule_id: rule,
    input_hash: inputHash,
    verdict,
    computed,
    prev_hash: prevHash,
    created_at_iso: createdAtIso || new Date().toISOString(),
    consent_proof_hash: consentProof.consent_proof_hash,
  });

  // (8) Sign the body
  const signature = signPayload(body, privateKeyPem);

  // (9) Body hash for filename
  const bodyHash = sha256(stableStringify(body));

  // (10) Persist the bundle to ~/.dema/receipts/verdict-<bodyHash>.json
  const home = resolveHome(demaHome);
  const receiptsDir = join(home, "receipts");
  await mkdir(receiptsDir, { recursive: true });
  const receiptPath = join(receiptsDir, `verdict-${bodyHash}.json`);

  // Bundle now carries consent_proof envelope alongside body+sig+pubkey+input.
  const bundle = {
    body,
    signature_b64: signature,
    signer_public_key_pem: publicKeyPem,
    input,
    consent_proof: consentProof,
  };
  await writeFile(receiptPath, JSON.stringify(bundle, null, 2), {
    mode: 0o600,
    flag: "w",
  });

  return Object.freeze({
    schema: VERDICT_RECEIPT_SCHEMA,
    attested: true,
    body,
    signature_b64: signature,
    signer_public_key_pem: publicKeyPem,
    input,
    consent_proof: consentProof,
    body_hash: bodyHash,
    receipt_path: receiptPath,
    boundary: buildBoundary({ attested: true }),
  });
}
