// NODE0-FOUNDER-IMPACT-LOOP-0A — PURE candidate founder-impact loop kernel.
//
// Composes shipped rails into ONE deterministic, content-addressed CANDIDATE receipt that serves the
// founder: it (1) requires the exact consent phrase, (2) runs the shipped untrusted-corpus sanitizer over
// each declared source and ABORTS before any digest if one is BLOCKED, (3) builds the OKF-conformant
// founder-impact digest, (4) runs the shipped public-metric claim-gate and refuses a receipt if any claim
// is REJECTED, and (5) runs the shipped FDE dual diagnostic as ADVISORY-ONLY (a missing local model is an
// OUTWARD environment gap, never an inward code failure and never a reason to grant authority).
//
// truth_label NODE0_FOUNDER_IMPACT_CANDIDATE_LOCAL_ONLY. This proves ONLY a local candidate loop — NOT
// live PoI, verified impact, mint, federation, autonomy, or RSI. The receipt is content-addressed
// (sha256), NOT Ed25519-signed; it binds SOURCE HASHES, never raw bytes; mint_allowed is always false;
// impact_class is always "candidate"; served_to is always "founder".
//
// CORE INVARIANT (binding): a failure classification cannot increase system authority. mint_allowed,
// continue_allowed, and scope_expansion_allowed are derived from GATES ONLY — never from the FDE
// classification. `verifyFounderImpactReceipt` and the review gate assert this monotonicity.
//
// Pure kernel: no fs / net / clock / random. createHash is a deterministic digest only. All file reads +
// the receipt write live ONLY in the CLI/adapter (consent-gated, atomic, under DEMA_HOME).

import { createHash } from "node:crypto";

import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "./boundary-schema.js";
import { scanUntrustedText } from "./untrusted-corpus-sanitizer-preview.js";
import {
  buildPublicMetricClaimGatePreviewPayload,
  verifyPublicMetricClaimGatePreview,
} from "./public-metric-claim-gate-preview.js";
import {
  buildDemaFdeDualDiagnostic,
  verifyDemaFdeDualDiagnostic,
} from "./dema-fde-dual-diagnostic.js";
import {
  buildFounderImpactDigest,
  verifyFounderImpactDigest,
} from "./node0-founder-impact-digest.js";

export const NODE0_FOUNDER_IMPACT_LOOP_SCHEMA = "bizra.dema.founder_impact_receipt.v0.1";
export const NODE0_FOUNDER_IMPACT_LOOP_TRUTH_LABEL = "NODE0_FOUNDER_IMPACT_CANDIDATE_LOCAL_ONLY";
export const NODE0_FOUNDER_IMPACT_LOOP_GO_PHRASE = "GO: dema founder impact loop 0a";

// The receipt boundary uses the canonical preview vocabulary (17 keys). It is an HONEST boundary, not an
// all-false one: content was read, the receipt file is written by the adapter, and consent was collected —
// everything else (runtime/model/network/mint/federation) is false. Verify deep-equals the full key set
// with the expected per-key value; it never uses a vacuous `.every(f => f === false)`.
export const FOUNDER_IMPACT_BOUNDARY_KEYS = PREVIEW_BOUNDARY_CANONICAL_KEYS;
const FOUNDER_IMPACT_BOUNDARY_TRUE_KEYS = Object.freeze([
  "content_read",
  "filesystem_write_performed",
  "consent_collected",
]);

// Exact-key raw-content-leak scan over the receipt body (corpus bytes must never be stored).
const RAW_CONTENT_KEYS = Object.freeze([
  "text",
  "raw_content",
  "source_content",
  "file_content",
  "raw_text",
  "plaintext",
]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function contentAddress(body) {
  return Object.freeze({ ...body, content_hash: `sha256:${sha256(stableStringify(body))}` });
}

export function founderImpactBoundary() {
  return Object.freeze(
    Object.fromEntries(
      FOUNDER_IMPACT_BOUNDARY_KEYS.map((k) => [k, FOUNDER_IMPACT_BOUNDARY_TRUE_KEYS.includes(k)]),
    ),
  );
}

// Deep-equal the full canonical key set AND every expected per-key value. Never vacuous.
function boundaryMatchesExpected(b) {
  if (!b || typeof b !== "object" || Array.isArray(b)) return false;
  const keys = Object.keys(b).sort();
  const canonical = [...FOUNDER_IMPACT_BOUNDARY_KEYS].sort();
  if (keys.length !== canonical.length) return false;
  for (let i = 0; i < keys.length; i += 1) if (keys[i] !== canonical[i]) return false;
  for (const k of FOUNDER_IMPACT_BOUNDARY_KEYS) {
    const expected = FOUNDER_IMPACT_BOUNDARY_TRUE_KEYS.includes(k);
    if (b[k] !== expected) return false;
  }
  return true;
}

function scanRawContentLeak(node) {
  const hits = [];
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v)) {
        if (RAW_CONTENT_KEYS.includes(k) && typeof val === "string" && val.trim() !== "") hits.push(k);
        walk(val);
      }
    }
  };
  walk(node);
  return hits;
}

// The lens (outward/inward) that the FDE primary failure class came from. Advisory display only.
function fdeLens(report) {
  if (report.failure_class === report.outward_diagnosis?.failure_class && report.failure_class !== report.inward_diagnosis?.failure_class) {
    return "outward";
  }
  if (report.failure_class === report.inward_diagnosis?.failure_class) return "inward";
  return "outward";
}

export function planFounderImpactLoop({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_FOUNDER_IMPACT_LOOP_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  if (!input || typeof input !== "object") blocked_by.push("input_not_object");
  else if (!Array.isArray(input.sources) || input.sources.length === 0) blocked_by.push("sources_missing");
  return Object.freeze({
    schema: NODE0_FOUNDER_IMPACT_LOOP_SCHEMA,
    truth_label: NODE0_FOUNDER_IMPACT_LOOP_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

function blockedResult(status, blocked_by, digest = null) {
  return Object.freeze({
    ok: false,
    status,
    receipt: null,
    digest,
    // Authority stays fail-closed on every non-happy path.
    mint_allowed: false,
    continue_allowed: false,
    scope_expansion_allowed: false,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}

// Build the candidate founder-impact receipt. Composes the shipped rails; fails closed. Returns
// { ok, status, receipt|null, digest|null, continue_allowed, ... }. The pure kernel never reads a file
// or writes — `input.sources[i].text` is supplied by the read-only gatherer for hashing/sanitizing/digest
// only, and is NEVER stored in the receipt.
export function buildFounderImpactReceipt({ consent, input } = {}) {
  const plan = planFounderImpactLoop({ consent, input });
  if (!plan.eligible) return blockedResult("refused", plan.blocked_by);

  const sources = input.sources;

  // Stage 1 — sanitize each declared source. A single BLOCKED source aborts BEFORE any digest.
  const sourceRefs = [];
  const blockedSources = [];
  for (const s of sources) {
    const text = typeof s?.text === "string" ? s.text : "";
    const scan = scanUntrustedText(text);
    if (scan.verdict === "BLOCKED") blockedSources.push(`sanitizer_blocked:${s?.source ?? "unknown"}`);
    sourceRefs.push({
      source: typeof s?.source === "string" ? s.source : null,
      type: typeof s?.type === "string" ? s.type : "",
      source_sha256: sha256(text),
      size_bytes: Buffer.byteLength(text, "utf8"),
      sanitizer_verdict: scan.verdict,
    });
  }
  const no_blocked_sources = blockedSources.length === 0;
  if (!no_blocked_sources) return blockedResult("aborted", blockedSources, null);

  // Stage 2 — build the OKF-conformant, content-addressed digest.
  const digest = buildFounderImpactDigest(
    sources.map((s, i) => ({
      source: sourceRefs[i].source,
      type: sourceRefs[i].type,
      size_bytes: sourceRefs[i].size_bytes,
      source_sha256: sourceRefs[i].source_sha256,
      sanitizer_verdict: sourceRefs[i].sanitizer_verdict,
      text: typeof s?.text === "string" ? s.text : "",
    })),
  );
  const digest_conformant = digest.conformant === true;
  if (!digest_conformant) {
    return blockedResult("blocked", ["digest_nonconformant", ...digest.blocked_by], digest);
  }

  // Stage 3 — claim-gate. A REJECTED claim refuses a receipt (output-side truth guard).
  const claimsInput = input.claims && typeof input.claims === "object" ? input.claims : { claims: [], evidence: {} };
  const claim_gate = buildPublicMetricClaimGatePreviewPayload(claimsInput);
  const claim_gate_ok = claim_gate.rejected_count === 0;
  if (!claim_gate_ok) {
    return blockedResult("blocked", [`claim_gate_rejected:${claim_gate.rejected_count}`], digest);
  }

  // Stage 4 — FDE dual diagnostic (ADVISORY ONLY). Its classification never grants authority.
  const fde = buildDemaFdeDualDiagnostic(input.fde_input && typeof input.fde_input === "object" ? input.fde_input : {});
  const fde_summary = Object.freeze({
    failure_class: fde.failure_class,
    lens: fdeLens(fde),
    inward_confidence: fde.inward_diagnosis?.confidence ?? "low",
    outward_confidence: fde.outward_diagnosis?.confidence ?? "low",
    diagnostic_hash: fde.diagnostic_hash,
    eligible_for_autopatch: fde.eligible_for_autopatch,
  });

  // GATES summary — the ONLY inputs to authority. FDE is deliberately absent here.
  const gates = Object.freeze({
    consent_ok: true,
    no_blocked_sources,
    digest_conformant,
    claim_gate_ok,
  });
  const continue_allowed = gates.consent_ok && gates.no_blocked_sources && gates.digest_conformant && gates.claim_gate_ok;

  const body = {
    schema: NODE0_FOUNDER_IMPACT_LOOP_SCHEMA,
    truth_label: NODE0_FOUNDER_IMPACT_LOOP_TRUTH_LABEL,
    impact_class: "candidate",
    served_to: "founder",
    sources: Object.freeze(sourceRefs.map((r) => Object.freeze(r))),
    source_count: sourceRefs.length,
    digest,
    digest_content_hash: digest.content_hash,
    claim_gate,
    fde,
    fde_summary,
    gates,
    mint_allowed: false,
    continue_allowed,
    scope_expansion_allowed: false,
    authority_delta: 0,
    boundary: founderImpactBoundary(),
    what_this_proves:
      "A local candidate founder-impact loop: the exact consent phrase was collected, each declared source passed the shipped untrusted-corpus sanitizer (a BLOCKED source aborts before any digest), an OKF-conformant content-addressed digest was built binding source hashes (never raw bytes), the shipped public-metric claim-gate accepted every claim (a REJECTED claim refuses the receipt), and the shipped FDE dual diagnostic ran ADVISORY-ONLY. The receipt is content-addressed and re-derivable; impact_class is candidate, served_to is founder, mint_allowed is false.",
    what_this_does_not_prove:
      "It does NOT prove live PoI, verified impact, token mint, federation, autonomous PAT/SAT, or RSI. It runs no model, opens no network, starts no daemon, and includes no raw source bytes. The receipt is content-addressed, not Ed25519-signed. The FDE classification is advisory: no failure classification can flip mint_allowed, continue_allowed, or scope_expansion_allowed from false to true.",
  };
  const receipt = contentAddress(body);
  return Object.freeze({
    ok: true,
    status: "candidate_receipt",
    receipt,
    digest,
    mint_allowed: false,
    continue_allowed,
    scope_expansion_allowed: false,
    blocked_by: Object.freeze([]),
  });
}

// Body-bound re-derivation verifier. Recomputes the whole-body content hash, re-runs every embedded rail's
// own verifier (digest, claim-gate, FDE), enforces the honest boundary, refuses raw-content leakage, and
// asserts the authority monotonicity invariant.
export function verifyFounderImpactReceipt(receipt) {
  if (!receipt || typeof receipt !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["receipt_not_object"]) });
  }
  const blocked_by = [];
  const { content_hash, ...body } = receipt;
  if (content_hash !== `sha256:${sha256(stableStringify(body))}`) blocked_by.push("content_hash_mismatch");
  if (receipt.schema !== NODE0_FOUNDER_IMPACT_LOOP_SCHEMA) blocked_by.push("schema_mismatch");
  if (receipt.truth_label !== NODE0_FOUNDER_IMPACT_LOOP_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (receipt.impact_class !== "candidate") blocked_by.push("impact_class_not_candidate");
  if (receipt.served_to !== "founder") blocked_by.push("served_to_not_founder");
  if (receipt.mint_allowed !== false) blocked_by.push("mint_allowed_true");
  if (receipt.scope_expansion_allowed !== false) blocked_by.push("scope_expansion_allowed_true");
  if (receipt.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (!boundaryMatchesExpected(receipt.boundary)) blocked_by.push("boundary_not_canonical_expected");

  // Raw-content leak: corpus bytes must never be stored, and each source ref binds a sha256, not text.
  if (receipt.boundary?.raw_data_included !== false) blocked_by.push("raw_data_included_true");
  for (const k of scanRawContentLeak({ sources: receipt.sources, digest: receipt.digest })) {
    blocked_by.push(`raw_content_leaked:${k}`);
  }
  if (Array.isArray(receipt.sources)) {
    for (const s of receipt.sources) {
      if (!/^[0-9a-f]{64}$/.test(s?.source_sha256 ?? "")) blocked_by.push(`source_sha256_malformed:${s?.source ?? "unknown"}`);
      if (s?.text !== undefined) blocked_by.push(`source_carries_text:${s?.source ?? "unknown"}`);
    }
  } else {
    blocked_by.push("sources_not_array");
  }

  // Re-run every embedded rail's own verifier — a tampered sub-artifact fails closed.
  const dv = verifyFounderImpactDigest(receipt.digest);
  if (!dv.ok) blocked_by.push("digest_invalid");
  if (receipt.digest_content_hash !== receipt.digest?.content_hash) blocked_by.push("digest_content_hash_mismatch");
  const cv = verifyPublicMetricClaimGatePreview(receipt.claim_gate);
  if (!cv.ok) blocked_by.push("claim_gate_invalid");
  if (receipt.claim_gate?.rejected_count !== 0) blocked_by.push("claim_gate_has_rejections");
  const fv = verifyDemaFdeDualDiagnostic(receipt.fde);
  if (!fv.ok) blocked_by.push("fde_report_invalid");

  // AUTHORITY MONOTONICITY: continue_allowed must equal the gate-only derivation; FDE cannot lift it.
  const gates = receipt.gates ?? {};
  const gateContinue =
    gates.consent_ok === true &&
    gates.no_blocked_sources === true &&
    gates.digest_conformant === true &&
    gates.claim_gate_ok === true;
  if (receipt.continue_allowed !== gateContinue) blocked_by.push("continue_allowed_not_gate_derived");
  if (!founderImpactAuthorityInvariantHolds(receipt)) blocked_by.push("authority_invariant_violated");

  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze([...new Set(blocked_by)]) });
}

// The binding monotonicity witness: authority is a pure function of GATES, never of the FDE class.
// mint_allowed and scope_expansion_allowed are always false; continue_allowed re-derives from gates alone.
export function founderImpactAuthorityInvariantHolds(receipt) {
  if (!receipt || typeof receipt !== "object") return false;
  if (receipt.mint_allowed !== false) return false;
  if (receipt.scope_expansion_allowed !== false) return false;
  const gates = receipt.gates ?? {};
  const gateContinue =
    gates.consent_ok === true &&
    gates.no_blocked_sources === true &&
    gates.digest_conformant === true &&
    gates.claim_gate_ok === true;
  if (receipt.continue_allowed !== gateContinue) return false;
  // A failure classification is present but structurally severed from authority: swapping it for any
  // other class changes nothing above. (Authority never reads receipt.fde / receipt.fde_summary.)
  return true;
}

// Canonical fixture used by the review gate + tests: two clean declared sources (the raw text is present
// for hashing/sanitizing but never stored), one accepted testimony claim, and an FDE probe for a missing
// local Ollama runtime (an OUTWARD environment gap).
export function defaultFounderImpactLoopFixture() {
  return Object.freeze({
    consent: NODE0_FOUNDER_IMPACT_LOOP_GO_PHRASE,
    input: {
      sources: [
        { source: "corpus/genesis.md", type: "chat_export", text: "hello founder — three years of daily R&D notes, sorted not asserted." },
        { source: "corpus/kernel.js", type: "code", text: "export const answer = 42; // deterministic, no model" },
      ],
      claims: {
        claims: [{ id: "hours", text: "~15,000 hours", metric: "founder_hours", asserted_value: 15000, kind: "testimony" }],
        evidence: {},
      },
      fde_input: {
        failed_command: "ollama run whiterabbitneo-v3:7b",
        exit_code: 1,
        stderr_excerpt: "Error: could not connect to ollama app, connect ECONNREFUSED 127.0.0.1:11434",
        stdout_excerpt: "",
        environment: { node_version: "22.x", os: "linux", branch: "feat/node0-founder-impact-loop-0a" },
      },
    },
  });
}
