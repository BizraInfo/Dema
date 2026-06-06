import { createHash } from "node:crypto";

export const EVIDENCE_RECEIPT_PREVIEW_SCHEMA =
  "bizra.dema.evidence_receipt_preview.v0.1";
export const EVIDENCE_RECEIPT_PREVIEW_DIGEST_ALGO = "sha256";
export const PREVIEW_CHAIN_ID = "preview-no-chain";
export const PREVIEW_VERDICTS = Object.freeze([
  "PARTIAL_PLACEHOLDER",
  "PREVIEW_REJECT",
  "PREVIEW_REVIEW",
]);

function assertSupportedJson(value, path = "$") {
  if (value === null) return;
  const type = typeof value;
  if (type === "string" || type === "boolean") return;
  if (type === "number") {
    if (!Number.isFinite(value))
      throw new TypeError(`${path} must be a finite number`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertSupportedJson(item, `${path}[${index}]`),
    );
    return;
  }
  if (type === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) {
        throw new TypeError(`${path}.${key} must not be undefined`);
      }
      assertSupportedJson(item, `${path}.${key}`);
    }
    return;
  }
  throw new TypeError(`${path} has unsupported JSON type ${type}`);
}

export function canonicalJson(value) {
  assertSupportedJson(value);

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  const entries = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
  return `{${entries.join(",")}}`;
}

export function sha256Canonical(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function withoutSelfDigest(receipt) {
  const { self_digest: _selfDigest, ...payload } = receipt;
  return payload;
}

function requirePreviewVerdict(verdict) {
  if (!PREVIEW_VERDICTS.includes(verdict)) {
    throw new Error(`Unsupported preview verdict: ${JSON.stringify(verdict)}`);
  }
}

export function buildEvidenceReceiptPreview({
  input,
  output,
  policy,
  toolCalls = [],
  decision,
  now = new Date(),
} = {}) {
  const verdict = decision?.verdict ?? "PREVIEW_REVIEW";
  requirePreviewVerdict(verdict);

  const receipt = {
    schema: EVIDENCE_RECEIPT_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    certifies: false,
    digest_algo: EVIDENCE_RECEIPT_PREVIEW_DIGEST_ALGO,
    prev_digest: null,
    self_digest: null,
    producer_identity: null,
    chain_id: PREVIEW_CHAIN_ID,
    timestamp: now.toISOString(),
    input_hash: sha256Canonical(input ?? null),
    output_hash: sha256Canonical(output ?? null),
    policy_hash: sha256Canonical(policy ?? null),
    tool_calls_hash: sha256Canonical(toolCalls),
    decision: {
      verdict,
      ihsan_floor_preview: decision?.ihsan_floor_preview ?? null,
    },
    boundary: {
      filesystem_write_performed: false,
      chain_head_advanced: false,
      receipt_minted: false,
      identity_bound: false,
      signature_emitted: false,
      runtime_gate_executed: false,
      network_connection_attempted: false,
      external_posting_performed: false,
    },
    note:
      "This is a deterministic Dema preview artifact, not a canonical Node0 receipt. " +
      "It does not extend a chain, bind an identity, sign a payload, or certify runtime admissibility.",
  };

  receipt.self_digest = sha256Canonical(withoutSelfDigest(receipt));
  return receipt;
}

export function verifyEvidenceReceiptPreview(receipt) {
  const checks = [];
  const schemaOk = receipt?.schema === EVIDENCE_RECEIPT_PREVIEW_SCHEMA;
  checks.push({
    check: "schema_declared_as_evidence_receipt_preview",
    pass: schemaOk,
    detail: schemaOk
      ? `schema=${EVIDENCE_RECEIPT_PREVIEW_SCHEMA}`
      : `expected ${EVIDENCE_RECEIPT_PREVIEW_SCHEMA}`,
  });

  const chainOk =
    receipt?.chain_id === PREVIEW_CHAIN_ID && receipt?.prev_digest === null;
  checks.push({
    check: "preview_has_no_chain_link",
    pass: chainOk,
    detail: chainOk
      ? "chain_id=preview-no-chain; prev_digest=null"
      : "preview must not link to a chain",
  });

  const noIdentityOk = receipt?.producer_identity === null;
  checks.push({
    check: "preview_has_no_producer_identity",
    pass: noIdentityOk,
    detail: noIdentityOk
      ? "producer_identity=null"
      : "preview must not bind producer identity",
  });

  const noSignatureOk =
    !("signature" in (receipt ?? {})) &&
    !("pubkey" in (receipt ?? {})) &&
    !("key_id" in (receipt ?? {}));
  checks.push({
    check: "preview_has_no_signature_fields",
    pass: noSignatureOk,
    detail: noSignatureOk
      ? "no signature/pubkey/key_id fields"
      : "signature-like fields are forbidden",
  });

  const boundaryOk =
    receipt?.boundary?.filesystem_write_performed === false &&
    receipt?.boundary?.chain_head_advanced === false &&
    receipt?.boundary?.receipt_minted === false &&
    receipt?.boundary?.identity_bound === false &&
    receipt?.boundary?.signature_emitted === false &&
    receipt?.boundary?.runtime_gate_executed === false &&
    receipt?.boundary?.network_connection_attempted === false &&
    receipt?.boundary?.external_posting_performed === false;
  checks.push({
    check: "preview_boundary_declares_no_effects",
    pass: boundaryOk,
    detail: boundaryOk
      ? "no effects declared"
      : "preview boundary must declare no effects",
  });

  let digestOk = false;
  let digestDetail = "self_digest missing or malformed";
  if (
    typeof receipt?.self_digest === "string" &&
    /^[0-9a-f]{64}$/.test(receipt.self_digest)
  ) {
    const recomputed = sha256Canonical(withoutSelfDigest(receipt));
    digestOk = recomputed === receipt.self_digest;
    digestDetail = digestOk
      ? `self_digest=${receipt.self_digest.slice(0, 16)}...`
      : `self_digest mismatch: expected ${recomputed}, got ${receipt.self_digest}`;
  }
  checks.push({
    check: "self_digest_recomputes",
    pass: digestOk,
    detail: digestDetail,
  });

  return {
    schema: "bizra.dema.evidence_receipt_preview_verdict.v0.1",
    truth_label: "DECLARED",
    verdict: checks.every((check) => check.pass)
      ? "PARTIAL_PLACEHOLDER"
      : "PREVIEW_REJECT",
    checked_at: new Date().toISOString(),
    checks,
    certifies: false,
  };
}

export function formatEvidenceReceiptPreview(receipt) {
  const verification = verifyEvidenceReceiptPreview(receipt);
  const lines = [
    "DEMA Evidence Receipt Preview",
    "",
    `Mode: ${receipt.mode}`,
    `Schema: ${receipt.schema}`,
    `Truth label: ${receipt.truth_label}`,
    `Preview verdict: ${receipt.decision.verdict}`,
    `Certifies: ${receipt.certifies}`,
    `Chain: ${receipt.chain_id}`,
    `Self digest: ${receipt.self_digest}`,
    "",
    "Hashes:",
    `  input: ${receipt.input_hash}`,
    `  output: ${receipt.output_hash}`,
    `  policy: ${receipt.policy_hash}`,
    `  tool calls: ${receipt.tool_calls_hash}`,
    "",
    "Verification checks:",
    ...verification.checks.map(
      (check) =>
        `  - ${check.pass ? "pass" : "fail"} ${check.check}: ${check.detail}`,
    ),
    "",
    "Boundary: preview-only; no filesystem write; no chain advance; no receipt mint; no identity binding; no signature; no runtime gate; no network; no external posting.",
  ];

  return lines.join("\n");
}
