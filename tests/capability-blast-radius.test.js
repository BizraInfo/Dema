import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  planCapabilityBlastRadius,
  buildCapabilityBlastRadiusPayload,
  verifyCapabilityBlastRadius,
  runCapabilityBlastRadius,
  CAPABILITY_BLAST_RADIUS_SCHEMA,
  CAPABILITY_BLAST_RADIUS_TRUTH_LABEL,
  CAPABILITY_BLAST_RADIUS_GO_PHRASE,
} from "../packages/core/src/capability-blast-radius.js";
import { runCapabilityBlastRadiusCheck } from "../scripts/review/capability-blast-radius-check.mjs";

// RED-FIRST: each test encodes part of the CAPABILITY-BLAST-RADIUS-1A proof contract. They fail until
// the kernel bodies are implemented. Build to green — do not soften the asserts.

const FLAGS_NONE = Object.freeze({
  mutates_local_files: false,
  mutates_remote_state: false,
  deletes_data: false,
  publishes_external: false,
  binds_identity: false,
  writes_receipt: false,
  network_used: false,
});

// Four real Dema-lane actions spanning the matrix: read, remote merge,
// irreversible delete, identity binding.
const FIXTURE_INPUT = {
  actions: [
    { action: "dema receipts (read/list)", flags: { ...FLAGS_NONE }, recovery: "not_applicable" },
    { action: "gh pr merge --merge", flags: { ...FLAGS_NONE, mutates_remote_state: true }, recovery: "git_revert" },
    { action: "rm untracked file", flags: { ...FLAGS_NONE, mutates_local_files: true, deletes_data: true }, recovery: "none" },
    { action: "generate signing key", flags: { ...FLAGS_NONE, binds_identity: true }, recovery: "none" },
  ],
};

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planCapabilityBlastRadius({ consent: "wrong", input: {} });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planCapabilityBlastRadius({ consent: CAPABILITY_BLAST_RADIUS_GO_PHRASE, input: FIXTURE_INPUT });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildCapabilityBlastRadiusPayload(FIXTURE_INPUT);
  assert.equal(payload.schema, CAPABILITY_BLAST_RADIUS_SCHEMA);
  assert.equal(payload.truth_label, CAPABILITY_BLAST_RADIUS_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildCapabilityBlastRadiusPayload(FIXTURE_INPUT);
  assert.equal(verifyCapabilityBlastRadius(payload).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildCapabilityBlastRadiusPayload(FIXTURE_INPUT);
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyCapabilityBlastRadius(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  // Internal-consistency check: a field changed but the stored hash did not, so
  // recompute-over-body must differ from content_hash.
  //
  // NOTE the harder launder this scaffold does NOT yet defend against: changing a
  // field AND recomputing the hash so the body is self-consistent. Internal
  // consistency alone cannot catch that — you need an INDEPENDENT anchor
  // (a signature over the payload, or an externally measured state hash). When
  // this slice gains one, add a test that forges + recomputes and still expects
  // rejection. Until then, do not claim launder-resistance.
  const payload = buildCapabilityBlastRadiusPayload(FIXTURE_INPUT);
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyCapabilityBlastRadius(forged).ok, false);
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runCapabilityBlastRadiusCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, CAPABILITY_BLAST_RADIUS_SCHEMA);
  assert.equal(result.truth_label, CAPABILITY_BLAST_RADIUS_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runCapabilityBlastRadius({ consent: CAPABILITY_BLAST_RADIUS_GO_PHRASE, input: FIXTURE_INPUT });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

test("decision matrix: read=low, merge=medium+reversible, rm=high+irreversible, keygen=high", () => {
  const payload = buildCapabilityBlastRadiusPayload(FIXTURE_INPUT);
  const byAction = Object.fromEntries(payload.classifications.map((c) => [c.action, c]));
  assert.equal(byAction["dema receipts (read/list)"].blast_radius, "low");
  assert.ok(byAction["dema receipts (read/list)"].reasons.includes("read_only->low"));
  assert.equal(byAction["gh pr merge --merge"].blast_radius, "medium");
  assert.equal(byAction["gh pr merge --merge"].reversible, true);
  assert.equal(byAction["rm untracked file"].blast_radius, "high");
  assert.equal(byAction["rm untracked file"].reversible, false);
  assert.ok(byAction["rm untracked file"].reasons.includes("irreversible_mutation->high"));
  assert.equal(byAction["generate signing key"].blast_radius, "high");
  assert.deepEqual(payload.counts, { low: 1, medium: 1, high: 2 });
  assert.equal(payload.irreversible_count, 2);
});

test("classification is deterministic: same input, same content hash", () => {
  const a = buildCapabilityBlastRadiusPayload(FIXTURE_INPUT);
  const b = buildCapabilityBlastRadiusPayload(FIXTURE_INPUT);
  assert.equal(a.content_hash, b.content_hash);
});

test("verify rejects a laundered downgrade: high edited to low AND hash recomputed", () => {
  // The independent anchor is re-derivation: the matrix is deterministic, so a
  // self-consistent body whose classifications disagree with the derivation fails.
  const payload = buildCapabilityBlastRadiusPayload(FIXTURE_INPUT);
  const downgraded = payload.classifications.map((c) => ({ ...c, blast_radius: "low" }));
  const { content_hash: _drop, ...body } = { ...payload, classifications: downgraded };
  const laundered = verifyCapabilityBlastRadius({ ...body, content_hash: rehash(body) });
  assert.equal(laundered.ok, false);
  assert.ok(laundered.blocked_by.includes("classification_not_rederivable"));
});

test("plan refuses descriptors with missing or non-canonical flag keys", () => {
  const { network_used: _dropped, ...missingOne } = FLAGS_NONE;
  const bad = { actions: [{ action: "mystery act", flags: missingOne, recovery: "none" }] };
  const plan = planCapabilityBlastRadius({ consent: CAPABILITY_BLAST_RADIUS_GO_PHRASE, input: bad });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("action_descriptor_invalid:0"));

  const unknownRecovery = { actions: [{ action: "x", flags: { ...FLAGS_NONE }, recovery: "hope" }] };
  const plan2 = planCapabilityBlastRadius({ consent: CAPABILITY_BLAST_RADIUS_GO_PHRASE, input: unknownRecovery });
  assert.equal(plan2.eligible, false);
});

// Recompute a content hash the same way the kernel does, for launder fixtures.
function rehash(body) {
  const stable = (v) => {
    if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
    if (v && typeof v === "object") {
      return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
    }
    return JSON.stringify(v);
  };
  return `sha256:${createHash("sha256").update(stable(body), "utf8").digest("hex")}`;
}
