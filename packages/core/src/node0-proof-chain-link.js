// NODE0-PROOF-CHAIN-LINK-1A — Hash-chain signed receipts into a verifiable append-only proof log.
//
// Consumes the content_hash anchors of #307 sandbox execute-receipt attestations and
// binds them into an append-only hash chain: each link commits to the previous link's
// hash, so altering or reordering any past receipt breaks every downstream link.
//
// Pure kernel: no fs / network / process / clock / random. It does NOT sign or mint —
// it consumes already-signed #307 attestation anchors and orders them. Boundary all-false.

import { createHash } from "node:crypto";

export const NODE0_PROOF_CHAIN_LINK_SCHEMA = "bizra.dema.node0_proof_chain_link.v0.1";
export const NODE0_PROOF_CHAIN_LINK_TRUTH_LABEL =
  "NODE0_APPEND_ONLY_SIGNED_RECEIPT_CHAIN";
export const NODE0_PROOF_CHAIN_LINK_GO_PHRASE =
  "GO: append signed receipt to proof chain";

// Genesis predecessor sentinel — the prev_link_hash of the index-0 link.
export const NODE0_PROOF_CHAIN_GENESIS_PREV = `sha256:${"0".repeat(64)}`;

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

// All-false boundary invariant. These keys mirror the capability-truth-registry
// row boundary — keep them all false; flipping any one is an execution claim.
export function node0ProofChainLinkBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

// A receipt anchor is the content_hash of an executed #307 attestation: `sha256:<hex>`.
function isReceiptAnchor(value) {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

// Deterministic link hash. Binds index + the prior link hash + this receipt anchor,
// so position, predecessor, and payload are all part of the commitment.
function linkHash({ index, prev_link_hash, receipt_content_hash }) {
  return `sha256:${sha256(
    stableStringify({ index, prev_link_hash, receipt_content_hash }),
  )}`;
}

// Fail-closed plan. Exact GO-phrase byte match; positively validate the receipt
// anchors (absence of a block is never validation).
export function planNode0ProofChainLink({ consent, receiptHashes } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_PROOF_CHAIN_LINK_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!Array.isArray(receiptHashes) || receiptHashes.length === 0) {
    blocked_by.push("receipt_hashes_empty");
  } else if (!receiptHashes.every(isReceiptAnchor)) {
    blocked_by.push("receipt_anchor_malformed");
  }
  return Object.freeze({
    schema: NODE0_PROOF_CHAIN_LINK_SCHEMA,
    truth_label: NODE0_PROOF_CHAIN_LINK_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Build one link committing to the prior link hash.
export function buildProofChainLink({ index, prev_link_hash, receipt_content_hash }) {
  const body = { index, prev_link_hash, receipt_content_hash };
  return Object.freeze({ ...body, link_hash: linkHash(body) });
}

// Build the whole append-only chain from ordered receipt anchors. Content-addressed
// over the full link list + head, so any edit anywhere changes content_hash.
export function buildNode0ProofChainLinkPayload(receiptHashes) {
  const links = [];
  let prev = NODE0_PROOF_CHAIN_GENESIS_PREV;
  (receiptHashes || []).forEach((receipt_content_hash, index) => {
    const link = buildProofChainLink({
      index,
      prev_link_hash: prev,
      receipt_content_hash,
    });
    links.push(link);
    prev = link.link_hash;
  });
  const head_hash = links.length
    ? links[links.length - 1].link_hash
    : NODE0_PROOF_CHAIN_GENESIS_PREV;
  const body = {
    schema: NODE0_PROOF_CHAIN_LINK_SCHEMA,
    truth_label: NODE0_PROOF_CHAIN_LINK_TRUTH_LABEL,
    links: Object.freeze(links),
    head_hash,
    boundary: node0ProofChainLinkBoundary(),
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

// Body-bound re-derivation verifier. Recompute every link, enforce index order,
// genesis anchoring, prev-hash continuity, head, and content_hash. A tampered
// receipt anchor, a reordered/forked chain, or a forged link_hash all fail closed.
export function verifyNode0ProofChainLink(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.links)) {
    return { ok: false, reason: "payload_malformed" };
  }
  let prev = NODE0_PROOF_CHAIN_GENESIS_PREV;
  for (let i = 0; i < payload.links.length; i += 1) {
    const link = payload.links[i];
    if (!link || link.index !== i) {
      return { ok: false, reason: `link_index_mismatch:${i}` };
    }
    if (link.prev_link_hash !== prev) {
      return { ok: false, reason: `prev_link_break:${i}` };
    }
    const expected = linkHash({
      index: link.index,
      prev_link_hash: link.prev_link_hash,
      receipt_content_hash: link.receipt_content_hash,
    });
    if (link.link_hash !== expected) {
      return { ok: false, reason: `link_hash_mismatch:${i}` };
    }
    prev = link.link_hash;
  }
  if (payload.head_hash !== prev) {
    return { ok: false, reason: "head_hash_mismatch" };
  }
  const { content_hash, ...body } = payload;
  if (content_hash !== `sha256:${sha256(stableStringify(body))}`) {
    return { ok: false, reason: "content_hash_mismatch" };
  }
  return { ok: true };
}

// Orchestrator the review gate consumes. plan -> build -> verify -> reorder/tamper
// reject, returning the proof envelope. Fails closed (named block) on any failure.
export function runNode0ProofChainLink({ consent, receiptHashes } = {}) {
  const boundary = node0ProofChainLinkBoundary();
  const base = {
    schema: NODE0_PROOF_CHAIN_LINK_SCHEMA,
    truth_label: NODE0_PROOF_CHAIN_LINK_TRUTH_LABEL,
    boundary,
  };
  const plan = planNode0ProofChainLink({ consent, receiptHashes });
  if (!plan.eligible) {
    return Object.freeze({ ...base, ok: false, blocked_by: plan.blocked_by });
  }
  const payload = buildNode0ProofChainLinkPayload(receiptHashes);
  const blocked_by = [];
  if (!verifyNode0ProofChainLink(payload).ok) {
    blocked_by.push("verify_failed");
  }
  // reorder-reject: swapping the first two links must break verification.
  if (payload.links.length >= 2) {
    const reordered = {
      ...payload,
      links: [payload.links[1], payload.links[0], ...payload.links.slice(2)],
    };
    if (verifyNode0ProofChainLink(reordered).ok) {
      blocked_by.push("reorder_not_rejected");
    }
  }
  // tamper-reject: flipping a receipt anchor in place leaves a stale link_hash.
  const tampered = {
    ...payload,
    links: payload.links.map((l, i) =>
      i === 0 ? { ...l, receipt_content_hash: `sha256:${"f".repeat(64)}` } : l,
    ),
  };
  if (verifyNode0ProofChainLink(tampered).ok) {
    blocked_by.push("tamper_not_rejected");
  }
  return Object.freeze({
    ...base,
    ok: blocked_by.length === 0,
    head_hash: payload.head_hash,
    link_count: payload.links.length,
    content_hash: payload.content_hash,
    blocked_by: Object.freeze(blocked_by),
  });
}
