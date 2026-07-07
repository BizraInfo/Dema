import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  planPublicMetricClaimGatePreview,
  buildPublicMetricClaimGatePreviewPayload,
  verifyPublicMetricClaimGatePreview,
  runPublicMetricClaimGatePreview,
  bindClaim,
  exampleClaimSet,
  PUBLIC_DISPLAYABLE_LABELS,
  PUBLIC_METRIC_CLAIM_GATE_PREVIEW_SCHEMA,
  PUBLIC_METRIC_CLAIM_GATE_PREVIEW_TRUTH_LABEL,
  PUBLIC_METRIC_CLAIM_GATE_PREVIEW_GO_PHRASE,
} from "../packages/core/src/public-metric-claim-gate-preview.js";
import { runPublicMetricClaimGatePreviewCheck } from "../scripts/review/public-metric-claim-gate-preview-check.mjs";

const GO = PUBLIC_METRIC_CLAIM_GATE_PREVIEW_GO_PHRASE;
const labelOf = (metric, asserted, kind, evidence = {}) =>
  bindClaim({ id: "x", metric, asserted_value: asserted, kind }, evidence).label;

// --- scaffold contract ---------------------------------------------------------------------------

test("plan is fail-closed without the exact consent phrase", () => {
  const p = planPublicMetricClaimGatePreview({ consent: "no", input: { claims: [] } });
  assert.equal(p.eligible, false);
  assert.ok(p.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan requires a claims array", () => {
  assert.equal(planPublicMetricClaimGatePreview({ consent: GO, input: {} }).eligible, false);
  assert.equal(planPublicMetricClaimGatePreview({ consent: GO, input: { claims: [] } }).eligible, true);
});

test("payload is content-addressed with an all-false boundary", () => {
  const p = buildPublicMetricClaimGatePreviewPayload(exampleClaimSet());
  assert.match(p.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(p.boundary.model_invocation_performed, false);
});

test("verify accepts a fresh payload and rejects tamper", () => {
  const p = buildPublicMetricClaimGatePreviewPayload(exampleClaimSet());
  assert.equal(verifyPublicMetricClaimGatePreview(p).ok, true, verifyPublicMetricClaimGatePreview(p).blocked_by.join(","));
  assert.equal(verifyPublicMetricClaimGatePreview({ ...p, truth_label: "X" }).ok, false);
  assert.equal(verifyPublicMetricClaimGatePreview({ ...p, content_hash: `sha256:${"0".repeat(64)}` }).ok, false);
});

test("review gate reproduces every acceptance label", () => {
  const r = runPublicMetricClaimGatePreviewCheck();
  assert.equal(r.ok, true, r.blocked_by?.join(","));
});

// --- the operator's acceptance tests (verbatim) --------------------------------------------------

const CI = (v) => ({ value: v, source_class: "ci_attestation", pointer: "npm test @ e80ccce" });

test("12,680 tests is REJECTED when evidence says 6,993", () => {
  assert.equal(labelOf("test_count", 12680, "measured", { test_count: CI(6993) }), "REJECTED");
});

test("6,993 Dema-core tests is VERIFIED only when an evidence pointer exists", () => {
  assert.equal(labelOf("test_count", 6993, "measured", { test_count: CI(6993) }), "VERIFIED");
  // no evidence → cannot be VERIFIED
  assert.equal(labelOf("test_count", 6993, "measured", {}), "UNKNOWN");
});

test("VERIFIED requires an evidence pointer to be public-displayable", () => {
  const withPtr = bindClaim({ id: "a", metric: "m", asserted_value: 5, kind: "measured" }, { m: CI(5) });
  assert.equal(withPtr.label, "VERIFIED");
  assert.equal(withPtr.public_displayable, true);
  assert.ok(withPtr.evidence_pointer);
});

test("~15,000 hours is DECLARED / founder testimony, not VERIFIED", () => {
  assert.equal(labelOf("founder_hours", 15000, "testimony"), "DECLARED");
});

test("Live URP is REJECTED (no live proof)", () => {
  assert.equal(labelOf("urp_status", "live", "capability_liveness", { urp_status: { value: "preview", source_class: "current_limits", pointer: "CL" } }), "REJECTED");
});

test("URP Preview is PREVIEW", () => {
  assert.equal(labelOf("urp_status", "preview", "preview_surface"), "PREVIEW");
});

test("SEED minted is REJECTED unless settlement proof exists", () => {
  assert.equal(labelOf("seed_settlement", "minted", "capability_liveness", {}), "REJECTED");
  // with a signed settlement proof it can verify
  assert.equal(labelOf("seed_settlement", "minted", "capability_liveness", { seed_settlement: { value: "minted", source_class: "signed_receipt", pointer: "settlement.json" } }), "VERIFIED");
});

test("a valid shape with a wrong value fails (REJECTED)", () => {
  assert.equal(labelOf("test_count", 9000, "measured", { test_count: CI(6993) }), "REJECTED");
});

test("a claim with no evidence becomes UNKNOWN and cannot appear as public truth", () => {
  const b = bindClaim({ id: "z", metric: "rust_crates", asserted_value: 42, kind: "measured" }, {});
  assert.equal(b.label, "UNKNOWN");
  assert.equal(b.public_displayable, false);
});

test("AI-generated text is never authoritative evidence (→ UNKNOWN)", () => {
  assert.equal(labelOf("test_count", 12680, "measured", { test_count: { value: 12680, source_class: "ai_text", pointer: "chatgpt" } }), "UNKNOWN");
});

test("every remaining claim is reported, none hidden", () => {
  const r = runPublicMetricClaimGatePreview({ consent: GO, input: exampleClaimSet() });
  assert.equal(r.bindings.length, r.claim_count);
  assert.equal(r.claim_count, 8);
});

test("only VERIFIED/DERIVED/DECLARED/PREVIEW are public-displayable", () => {
  const r = runPublicMetricClaimGatePreview({ consent: GO, input: exampleClaimSet() });
  for (const b of r.bindings) {
    assert.equal(b.public_displayable, PUBLIC_DISPLAYABLE_LABELS.includes(b.label) && (b.label === "DECLARED" || b.label === "PREVIEW" || !!b.evidence_pointer));
  }
});

test("verify rejects a forged label (REJECTED laundered to VERIFIED)", () => {
  const p = buildPublicMetricClaimGatePreviewPayload({
    claims: [{ id: "c", metric: "test_count", asserted_value: 12680, kind: "measured" }],
    evidence: { test_count: CI(6993) },
  });
  assert.equal(p.bindings[0].label, "REJECTED");
  const forged = {
    ...p,
    bindings: [{ ...p.bindings[0], label: "VERIFIED", public_displayable: true }],
  };
  assert.equal(verifyPublicMetricClaimGatePreview(forged).ok, false);
});

test("the gate emits does_not_prove", () => {
  const p = buildPublicMetricClaimGatePreviewPayload(exampleClaimSet());
  assert.ok(typeof p.what_this_does_not_prove === "string" && p.what_this_does_not_prove.length > 0);
});

// --- purity --------------------------------------------------------------------------------------

test("kernel remains pure: no fs / network / process / clock / random", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../packages/core/src/public-metric-claim-gate-preview.js", import.meta.url)),
    "utf8",
  );
  assert.doesNotMatch(src, /node:fs|node:net|node:child_process|node:http|node:dns/);
  assert.doesNotMatch(src, /Math\.random|Date\.now|new Date\(/);
  assert.doesNotMatch(src, /process\.(env|argv|exit)/);
});
