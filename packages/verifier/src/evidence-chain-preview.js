import {
  EVIDENCE_RECEIPT_PREVIEW_SCHEMA,
  PREVIEW_CHAIN_ID,
  canonicalJson,
  sha256Canonical,
  verifyEvidenceReceiptPreview
} from "./evidence-receipt-preview.js";

export const EVIDENCE_CHAIN_PREVIEW_SCHEMA = "bizra.dema.evidence_chain_preview.v0.1";
export const EVIDENCE_CHAIN_VERIFICATION_PREVIEW_SCHEMA =
  "bizra.dema.evidence_chain_verification_preview.v0.1";
export const EVIDENCE_CHAIN_PREVIEW_CHAIN_ID = "preview-no-chain";

const MODE = "PREVIEW_ONLY";
const TRUTH_LABEL = "DECLARED";
const GENESIS_SENTINEL = "preview-chain-genesis";
const DEFAULT_PURPOSE = "review local evidence receipt previews";

const RECEIPT_BOUNDARY_FALSE_FIELDS = Object.freeze([
  "filesystem_write_performed",
  "chain_head_advanced",
  "receipt_minted",
  "identity_bound",
  "signature_emitted",
  "runtime_gate_executed",
  "network_connection_attempted",
  "external_posting_performed"
]);

const CHAIN_BOUNDARY_FALSE_FIELDS = Object.freeze([
  ...RECEIPT_BOUNDARY_FALSE_FIELDS,
  "proof_forge_chain_written",
  "canonical_node0_chain_written",
  "federation_initiated",
  "step7_mint_performed"
]);

const SIGNATURE_AND_IDENTITY_FIELDS = Object.freeze([
  "signature",
  "pubkey",
  "key_id",
  "session_id",
  "producer_id"
]);

const POSITION_FIELDS = Object.freeze(["position", "chain_position", "chainPosition"]);
const BARE_SHA256_RE = /^[0-9a-f]{64}$/;
const PREFIXED_SHA256_RE = /^sha256:[0-9a-f]{64}$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value, field) {
  return isObject(value) && Object.prototype.hasOwnProperty.call(value, field);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function denial(code, detail, index = null) {
  return { code, detail, index };
}

function chainPolicy() {
  return {
    input_order_is_canonical: true,
    requires_dema_evidence_receipt_preview: true,
    requires_receipt_preview_verification: true,
    rejects_canonical_receipts: true,
    rejects_proof_forge_receipts: true,
    rejects_duplicate_entry_digests: true,
    does_not_advance_chain_head: true
  };
}

function chainBoundary() {
  return {
    scope: "in-memory-review-preview",
    filesystem_write_performed: false,
    chain_head_advanced: false,
    receipt_minted: false,
    identity_bound: false,
    signature_emitted: false,
    runtime_gate_executed: false,
    network_connection_attempted: false,
    external_posting_performed: false,
    federation_initiated: false,
    step7_mint_performed: false,
    proof_forge_chain_written: false,
    canonical_node0_chain_written: false
  };
}

function digest(value) {
  canonicalJson(value);
  return `sha256:${sha256Canonical(value)}`;
}

function safeDigest(value) {
  try {
    return { ok: true, value: digest(value), error: null };
  } catch (error) {
    return {
      ok: false,
      value: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function linkPayloadFromReceipt(receipt, index, previousEntryDigest) {
  return {
    index,
    previous_entry_digest: previousEntryDigest,
    entry_schema: receipt.schema,
    entry_digest: receipt.self_digest,
    entry_input_hash: receipt.input_hash,
    entry_output_hash: receipt.output_hash,
    entry_policy_hash: receipt.policy_hash,
    entry_tool_calls_hash: receipt.tool_calls_hash
  };
}

function linkPayloadFromLink(link) {
  return {
    index: Number.isInteger(link?.index) ? link.index : null,
    previous_entry_digest: typeof link?.previous_entry_digest === "string" ? link.previous_entry_digest : null,
    entry_schema: typeof link?.entry_schema === "string" ? link.entry_schema : null,
    entry_digest: typeof link?.entry_digest === "string" ? link.entry_digest : null,
    entry_input_hash: typeof link?.entry_input_hash === "string" ? link.entry_input_hash : null,
    entry_output_hash: typeof link?.entry_output_hash === "string" ? link.entry_output_hash : null,
    entry_policy_hash: typeof link?.entry_policy_hash === "string" ? link.entry_policy_hash : null,
    entry_tool_calls_hash: typeof link?.entry_tool_calls_hash === "string" ? link.entry_tool_calls_hash : null
  };
}

function linkDigestFor(payload) {
  return digest({
    domain: EVIDENCE_CHAIN_PREVIEW_SCHEMA,
    link: payload
  });
}

function safeLinkDigestFor(payload) {
  return safeDigest({
    domain: EVIDENCE_CHAIN_PREVIEW_SCHEMA,
    link: payload
  });
}

function chainDigestFor({ chain_id: chainId, links, policy }) {
  return digest({
    domain: EVIDENCE_CHAIN_PREVIEW_SCHEMA,
    chain_id: chainId,
    links,
    policy
  });
}

function safeChainDigestFor({ chain_id: chainId, links, policy }) {
  return safeDigest({
    domain: EVIDENCE_CHAIN_PREVIEW_SCHEMA,
    chain_id: chainId,
    links,
    policy
  });
}

function buildLinks(receipts) {
  const links = [];
  let previousEntryDigest = GENESIS_SENTINEL;

  receipts.forEach((receipt, index) => {
    const payload = linkPayloadFromReceipt(receipt, index, previousEntryDigest);
    const link = {
      ...payload,
      link_digest: linkDigestFor(payload)
    };
    links.push(link);
    previousEntryDigest = link.link_digest;
  });

  return links;
}

function hasAnyTopLevelField(value, fields) {
  return fields.some((field) => hasOwn(value, field));
}

function containsAnyField(value, fields, seen = new Set()) {
  if (!isObject(value) && !Array.isArray(value)) return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (isObject(value) && fields.some((field) => hasOwn(value, field))) return true;
  const entries = Array.isArray(value) ? value : Object.values(value);
  return entries.some((item) => containsAnyField(item, fields, seen));
}

function isProofForgeReceiptLike(receipt) {
  return isObject(receipt) && (
    receipt.anchor_type === "proof_forge_evidence" ||
    receipt.schema === "bizra.proof-forge.receipt.v0.1" ||
    hasOwn(receipt, "forge_tool") ||
    hasOwn(receipt?.chain, "previous_hash") ||
    hasOwn(receipt?.chain, "evidence_hash")
  );
}

function isCanonicalReceiptLike(receipt) {
  if (!isObject(receipt) || receipt.schema === EVIDENCE_RECEIPT_PREVIEW_SCHEMA) return false;
  return (
    hasOwn(receipt, "receipt_id") ||
    hasOwn(receipt, "chain_head") ||
    hasOwn(receipt?.gateway, "chain_head") ||
    hasOwn(receipt, "prev_digest") ||
    hasOwn(receipt, "producer_identity") ||
    hasOwn(receipt, "chain_id") ||
    hasAnyTopLevelField(receipt, SIGNATURE_AND_IDENTITY_FIELDS)
  );
}

function boundaryDeclaresNoEffects(boundary, fields) {
  return isObject(boundary) && fields.every((field) => boundary[field] === false);
}

function policyMatchesPreviewContract(policy) {
  const expected = chainPolicy();
  return isObject(policy) &&
    Object.keys(expected).every((field) => policy[field] === expected[field]) &&
    Object.keys(policy).every((field) => hasOwn(expected, field));
}

function receiptVerificationVerdict(receipt) {
  try {
    return { ok: true, value: verifyEvidenceReceiptPreview(receipt), error: null };
  } catch (error) {
    return {
      ok: false,
      value: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function validateReceipt(receipt, index) {
  const denials = [];

  if (!isObject(receipt)) {
    return [denial("invalid_receipts", "receipt entry must be an object", index)];
  }
  if (isProofForgeReceiptLike(receipt)) {
    return [denial("proof_forge_receipt_rejected", "Proof Forge receipts are outside this preview domain", index)];
  }
  if (isCanonicalReceiptLike(receipt)) {
    return [denial("canonical_receipt_rejected", "canonical receipt-like shapes are outside this preview domain", index)];
  }

  if (receipt.schema !== EVIDENCE_RECEIPT_PREVIEW_SCHEMA) {
    denials.push(denial("invalid_receipt_schema", `expected ${EVIDENCE_RECEIPT_PREVIEW_SCHEMA}`, index));
  }
  if (receipt.mode !== MODE) {
    denials.push(denial("invalid_receipt_mode", "receipt mode must be PREVIEW_ONLY", index));
  }
  if (receipt.certifies !== false) {
    denials.push(denial("receipt_certifies", "receipt preview must not certify", index));
  }
  if (receipt.chain_id !== PREVIEW_CHAIN_ID) {
    denials.push(denial("receipt_has_chain_identity", "receipt preview chain_id must be preview-no-chain", index));
  }
  if (receipt.prev_digest !== null) {
    denials.push(denial("receipt_has_prev_digest", "receipt preview prev_digest must be null", index));
  }
  if (receipt.producer_identity !== null) {
    denials.push(denial("receipt_has_producer_identity", "receipt preview must not bind producer identity", index));
  }
  if (hasAnyTopLevelField(receipt, SIGNATURE_AND_IDENTITY_FIELDS)) {
    denials.push(denial("receipt_has_signature_fields", "signature, key, session, and producer id fields are forbidden", index));
  }
  if (containsAnyField(receipt, POSITION_FIELDS)) {
    denials.push(denial("entry_contains_position_claim", "position-like fields are forbidden", index));
  }
  if (!boundaryDeclaresNoEffects(receipt.boundary, RECEIPT_BOUNDARY_FALSE_FIELDS)) {
    denials.push(denial("receipt_boundary_has_effects", "receipt boundary must declare every preview effect as false", index));
  }

  const verification = receiptVerificationVerdict(receipt);
  if (!verification.ok) {
    denials.push(denial("receipt_verification_failed", verification.error, index));
  } else if (verification.value?.verdict !== "PARTIAL_PLACEHOLDER") {
    denials.push(denial("receipt_verification_failed", "receipt preview verifier did not return PARTIAL_PLACEHOLDER", index));
  }

  return denials;
}

function baseChain({ timestamp, purpose, links, denials, policy }) {
  const chain = {
    schema: EVIDENCE_CHAIN_PREVIEW_SCHEMA,
    mode: MODE,
    truth_label: TRUTH_LABEL,
    certifies: false,
    valid: false,
    chain_id: EVIDENCE_CHAIN_PREVIEW_CHAIN_ID,
    producer_identity: null,
    timestamp,
    purpose,
    policy,
    links,
    denials,
    preview_chain_digest: null,
    boundary: chainBoundary(),
    note:
      "This is an in-memory deterministic Dema preview over evidence receipt previews only. " +
      "It is not a canonical Node0 chain, not a Proof Forge chain, not a receipt mint, " +
      "not a signature, and not runtime admissibility."
  };
  chain.preview_chain_digest = chainDigestFor(chain);
  chain.valid = verifyEvidenceChainPreview(chain).ok && denials.length === 0;
  return chain;
}

export function buildEvidenceChainPreview({
  receipts,
  purpose,
  now = new Date()
} = {}) {
  const denials = [];
  const timestamp = isValidDate(now) ? now.toISOString() : null;
  const normalizedPurpose = purpose === undefined ? DEFAULT_PURPOSE : purpose;

  if (!isValidDate(now)) {
    denials.push(denial("invalid_now", "now must be a valid Date"));
  }
  if (!nonEmptyString(normalizedPurpose)) {
    denials.push(denial("invalid_purpose", "purpose must be a non-empty string when provided"));
  }
  if (!Array.isArray(receipts)) {
    denials.push(denial("invalid_receipts", "receipts must be a non-empty array"));
  } else if (receipts.length === 0) {
    denials.push(denial("empty_chain", "receipts must contain at least one evidence receipt preview"));
  }

  const seenDigests = new Set();
  if (Array.isArray(receipts)) {
    receipts.forEach((receipt, index) => {
      const before = denials.length;
      denials.push(...validateReceipt(receipt, index));
      if (denials.length === before && seenDigests.has(receipt.self_digest)) {
        denials.push(denial("duplicate_entry_digest", "receipt self_digest values must be unique", index));
      }
      if (denials.length === before && typeof receipt.self_digest === "string") {
        seenDigests.add(receipt.self_digest);
      }
    });
  }

  const links = denials.length === 0 ? buildLinks(receipts) : [];
  return baseChain({
    timestamp,
    purpose: nonEmptyString(normalizedPurpose) ? normalizedPurpose : null,
    links,
    denials,
    policy: chainPolicy()
  });
}

function check(name, pass, detail) {
  return { check: name, pass, detail };
}

function verifyLink(link, index, links) {
  const payload = linkPayloadFromLink(link);
  const expectedPrevious = index === 0 ? GENESIS_SENTINEL : links[index - 1]?.link_digest;
  const expectedDigest = safeLinkDigestFor(payload);
  const entryHashesOk =
    BARE_SHA256_RE.test(payload.entry_digest ?? "") &&
    BARE_SHA256_RE.test(payload.entry_input_hash ?? "") &&
    BARE_SHA256_RE.test(payload.entry_output_hash ?? "") &&
    BARE_SHA256_RE.test(payload.entry_policy_hash ?? "") &&
    BARE_SHA256_RE.test(payload.entry_tool_calls_hash ?? "");

  return {
    index,
    entry_digest: payload.entry_digest,
    entry_schema_ok: payload.entry_schema === EVIDENCE_RECEIPT_PREVIEW_SCHEMA,
    entry_preview_verifies: payload.entry_schema === EVIDENCE_RECEIPT_PREVIEW_SCHEMA && entryHashesOk,
    previous_entry_digest_ok: payload.previous_entry_digest === expectedPrevious,
    link_digest_ok: expectedDigest.ok && link?.link_digest === expectedDigest.value,
    signature_ok: null,
    expected_link_digest: expectedDigest.value,
    actual_link_digest: typeof link?.link_digest === "string" ? link.link_digest : null
  };
}

export function verifyEvidenceChainPreview(chain) {
  const links = Array.isArray(chain?.links) ? chain.links : [];
  const policy = isObject(chain?.policy) ? chain.policy : chainPolicy();
  const expectedDigest = safeChainDigestFor({
    chain_id: chain?.chain_id,
    links,
    policy
  });
  const actualDigest = typeof chain?.preview_chain_digest === "string" ? chain.preview_chain_digest : null;
  const entries = links.map((link, index) => verifyLink(link, index, links));
  const entryDigests = entries.map((entry) => entry.entry_digest).filter((value) => typeof value === "string");
  const uniqueEntryDigests = new Set(entryDigests);
  const duplicateEntryDigestsOk = uniqueEntryDigests.size === entryDigests.length;

  const checks = [
    check("schema_declared_as_evidence_chain_preview", chain?.schema === EVIDENCE_CHAIN_PREVIEW_SCHEMA, `expected ${EVIDENCE_CHAIN_PREVIEW_SCHEMA}`),
    check("mode_is_preview_only", chain?.mode === MODE, "mode must be PREVIEW_ONLY"),
    check("truth_label_declared", chain?.truth_label === TRUTH_LABEL, "truth_label must be DECLARED"),
    check("certifies_false", chain?.certifies === false, "preview chain must not certify"),
    check("chain_id_preview_no_chain", chain?.chain_id === EVIDENCE_CHAIN_PREVIEW_CHAIN_ID, "chain_id must be preview-no-chain"),
    check("producer_identity_absent", chain?.producer_identity === null, "producer_identity must be null"),
    check("signature_fields_absent", !hasAnyTopLevelField(chain ?? {}, SIGNATURE_AND_IDENTITY_FIELDS), "signature-like fields are forbidden"),
    check("canonical_chain_fields_absent", !hasAnyTopLevelField(chain ?? {}, ["prev_digest", "chain_head"]), "canonical chain field names are forbidden"),
    check("policy_matches_preview_contract", policyMatchesPreviewContract(chain?.policy), "policy must preserve the preview-only contract"),
    check("boundary_declares_no_effects", boundaryDeclaresNoEffects(chain?.boundary, CHAIN_BOUNDARY_FALSE_FIELDS), "all preview boundary effects must be false"),
    check("links_array", Array.isArray(chain?.links), "links must be an array"),
    check("denials_empty", Array.isArray(chain?.denials) && chain.denials.length === 0, "valid preview chains must have no denials"),
    check("duplicate_entry_digests_absent", duplicateEntryDigestsOk, "entry_digest values must be unique"),
    check("preview_chain_digest_well_formed", PREFIXED_SHA256_RE.test(actualDigest ?? ""), "preview_chain_digest must be sha256:<64 hex>"),
    check(
      "preview_chain_digest_recomputes",
      expectedDigest.ok && actualDigest === expectedDigest.value,
      expectedDigest.ok ? "preview_chain_digest matches canonical preview payload" : expectedDigest.error
    )
  ];

  for (const entry of entries) {
    checks.push(check(`entry_${entry.index}_schema_ok`, entry.entry_schema_ok, "entry_schema must be evidence receipt preview"));
    checks.push(check(`entry_${entry.index}_preview_hashes_ok`, entry.entry_preview_verifies, "entry digest and hash fields must be bare sha256 hex"));
    checks.push(check(`entry_${entry.index}_previous_entry_digest_ok`, entry.previous_entry_digest_ok, "previous_entry_digest must link to prior preview link digest"));
    checks.push(check(`entry_${entry.index}_link_digest_ok`, entry.link_digest_ok, "link_digest must recompute from canonical preview link payload"));
  }

  const ok = checks.every((item) => item.pass);

  return {
    schema: EVIDENCE_CHAIN_VERIFICATION_PREVIEW_SCHEMA,
    mode: MODE,
    truth_label: TRUTH_LABEL,
    ok,
    certifies: false,
    expected_preview_chain_digest: expectedDigest.value,
    actual_preview_chain_digest: actualDigest,
    checks,
    entries,
    boundary: chainBoundary()
  };
}

export function formatEvidenceChainPreview(chain) {
  const verification = verifyEvidenceChainPreview(chain);
  const denials = Array.isArray(chain?.denials) ? chain.denials : [];
  const links = Array.isArray(chain?.links) ? chain.links : [];
  const denialLines = denials.length === 0
    ? ["  - none"]
    : denials.map((item) => `  - ${item.code}${item.index === null || item.index === undefined ? "" : ` at entry ${item.index}`}`);

  return [
    "DEMA EvidenceChain Preview",
    "",
    `Schema: ${chain?.schema ?? EVIDENCE_CHAIN_PREVIEW_SCHEMA}`,
    `Mode: ${chain?.mode ?? MODE}`,
    `Truth label: ${chain?.truth_label ?? TRUTH_LABEL}`,
    `Valid: ${chain?.valid === true}`,
    `Verification ok: ${verification.ok}`,
    `Certifies: ${chain?.certifies === false ? "false" : String(chain?.certifies)}`,
    `Link count: ${links.length}`,
    `Preview chain digest: ${chain?.preview_chain_digest ?? "missing"}`,
    `Denial count: ${denials.length}`,
    "",
    "Denials:",
    ...denialLines,
    "",
    "Boundary: preview-only in-memory review; no filesystem write; no chain advance; no receipt mint; no identity binding; no signature; no runtime gate; no network; no external posting; no federation; no Step 7.",
    "Authority: not a canonical chain, not a receipt mint, not a signature, and not Step 7."
  ].join("\n");
}
