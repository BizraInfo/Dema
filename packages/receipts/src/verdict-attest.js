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
// - loadPrivateKey/loadPublicKey packages/receipts/src/authorship-key-store.js
// - sha256, stableStringify      packages/consent/src/consent-common.js
// - evaluate(canonical-shape)    packages/rules/src/rule-canonical-shape.v0.1.js
// - exact-string consent gate    pattern from authorship-key-store.js:43
//
// Per spec: chain-walk hook (prev_hash) is present but unused this slice.

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { signPayload } from "./authorship-signature.js";
import { loadPrivateKey, loadPublicKey } from "./authorship-key-store.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import {
  evaluate as canonicalShapeEvaluate,
  RULE_ID as CANONICAL_SHAPE_RULE_ID,
} from "../../rules/src/rule-canonical-shape.v0.1.js";

export const VERDICT_RECEIPT_SCHEMA = "bizra.dema.verdict_receipt.v0.1";

// Reuse the EXISTING fail-closed consent phrase (per spec: do not invent a
// new phrase; attest is a signing operation so it shares the sign gate).
export const ATTEST_CONSENT_PHRASE = "SIGN AUTHORSHIP RECEIPT";

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
  demaHome,
  prevHash = null,
  createdAtIso,
}) {
  // (1) Fail-closed consent gate — REUSED pattern
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
  const privateKeyPem = await loadPrivateKey(demaHome);
  if (!privateKeyPem) {
    return fail({ error: "no_authorship_key" });
  }
  const publicKeyPem = await loadPublicKey(demaHome);

  // (4) Run the rule (pure)
  const { verdict, computed } = evaluator(input);

  // (5) Build body — input itself does NOT ship in body; only its hash.
  const inputHash = sha256(stableStringify(input));
  const body = Object.freeze({
    schema: VERDICT_RECEIPT_SCHEMA,
    rule_id: rule,
    input_hash: inputHash,
    verdict,
    computed,
    prev_hash: prevHash, // hook for chain-walk; this slice null
    created_at_iso: createdAtIso || new Date().toISOString(),
  });

  // (6) Sign the body
  const signature = signPayload(body, privateKeyPem);

  // (7) Body hash for filename
  const bodyHash = sha256(stableStringify(body));

  // (8) Persist the bundle to ~/.dema/receipts/verdict-<bodyHash>.json
  const home = resolveHome(demaHome);
  const receiptsDir = join(home, "receipts");
  await mkdir(receiptsDir, { recursive: true });
  const receiptPath = join(receiptsDir, `verdict-${bodyHash}.json`);

  // The on-disk artifact IS the bundle (portable proof; input ships alongside).
  const bundle = {
    body,
    signature_b64: signature,
    signer_public_key_pem: publicKeyPem,
    input,
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
    body_hash: bodyHash,
    receipt_path: receiptPath,
    boundary: buildBoundary({ attested: true }),
  });
}
