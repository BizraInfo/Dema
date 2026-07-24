import test from "node:test";
import assert from "node:assert/strict";

import {
  DEMA_RECOVERY_MISSION_GATHERER_SCHEMA,
  DEMA_RECOVERY_MISSION_GATHERER_TRUTH_LABEL,
  DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE,
  DEMA_RECOVERY_MISSION_GATHERER_CANONICAL_FIXTURE,
  DEMA_RECOVERY_MISSION_GATHERER_MALICIOUS_FIXTURE,
  demaRecoveryMissionGathererBoundary,
  planDemaRecoveryMissionGatherer,
  buildDemaRecoveryMissionGathererPayload,
  verifyDemaRecoveryMissionGatherer,
  runDemaRecoveryMissionGatherer,
} from "../packages/core/src/dema-recovery-mission-gatherer.js";
import { runDemaRecoveryMissionGathererCheck } from "../scripts/review/dema-recovery-mission-gatherer-check.mjs";

const ROOT = "/fixture/corpus";
const OTHER_ROOT = "/fixture/other-corpus";

function baseInput(overrides = {}) {
  return {
    objective_text: "Recover the 2019 family photo set",
    source_boundary: { roots: [ROOT], exclusions: [] },
    now_iso: "2026-07-18T00:00:00.000Z",
    files: [
      { root: ROOT, relative_path: "photos/img1.jpg", extension: ".jpg", size_bytes: 100, mtime_iso: "2019-05-01T00:00:00.000Z" },
    ],
    ...overrides,
  };
}

// --- plan() fail-closed validation -----------------------------------------

test("plan: consent phrase mismatch is blocked", () => {
  const plan = planDemaRecoveryMissionGatherer({ consent: "wrong", input: baseInput() });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan: non-object input is blocked", () => {
  const plan = planDemaRecoveryMissionGatherer({ consent: DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE, input: null });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("input_not_object"));
});

test("plan: missing objective_text is blocked", () => {
  const plan = planDemaRecoveryMissionGatherer({
    consent: DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE,
    input: baseInput({ objective_text: "" }),
  });
  assert.ok(plan.blocked_by.includes("objective_text_missing"));
});

test("plan: invalid source_boundary is blocked", () => {
  const plan = planDemaRecoveryMissionGatherer({
    consent: DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE,
    input: baseInput({ source_boundary: { roots: [], exclusions: [] } }),
  });
  assert.ok(plan.blocked_by.includes("source_boundary_invalid"));
});

test("plan: invalid now_iso is blocked", () => {
  const plan = planDemaRecoveryMissionGatherer({
    consent: DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE,
    input: baseInput({ now_iso: "not-a-date" }),
  });
  assert.ok(plan.blocked_by.includes("now_iso_invalid"));
});

test("plan: files not an array is blocked", () => {
  const plan = planDemaRecoveryMissionGatherer({
    consent: DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE,
    input: baseInput({ files: "nope" }),
  });
  assert.ok(plan.blocked_by.includes("files_not_array"));
});

test("plan: an invalid file row is named by index", () => {
  const plan = planDemaRecoveryMissionGatherer({
    consent: DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE,
    input: baseInput({ files: [{ root: ROOT }] }),
  });
  assert.ok(plan.blocked_by.includes("file_row_invalid:0"));
});

test("plan: metadata-only — a row claiming content_read:true is refused (whole request, not silently dropped)", () => {
  const plan = planDemaRecoveryMissionGatherer({
    consent: DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE,
    input: baseInput({
      files: [{ ...baseInput().files[0], content_read: true }],
    }),
  });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("content_read_claimed"));
});

test("plan: caps-exceeded fails closed (max_files below actual row count)", () => {
  const plan = planDemaRecoveryMissionGatherer({
    consent: DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE,
    input: baseInput({ max_files: 0 }),
  });
  assert.ok(plan.blocked_by.includes("max_files_invalid"));

  const plan2 = planDemaRecoveryMissionGatherer({
    consent: DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE,
    input: baseInput({ max_files: 1, files: [...baseInput().files, { root: ROOT, relative_path: "photos/img2.jpg", extension: ".jpg", size_bytes: 1, mtime_iso: null }] }),
  });
  assert.ok(plan2.blocked_by.includes("max_files_exceeded"));
});

test("plan: a well-formed request is eligible", () => {
  const plan = planDemaRecoveryMissionGatherer({
    consent: DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE,
    input: baseInput(),
  });
  assert.equal(plan.eligible, true);
  assert.deepEqual(plan.blocked_by, []);
});

// --- boundary enforcement ----------------------------------------------------

test("boundary poison: a row whose root is not declared is excluded, never a candidate", () => {
  const input = baseInput({
    files: [
      ...baseInput().files,
      { root: OTHER_ROOT, relative_path: "secret.txt", extension: ".txt", size_bytes: 5, mtime_iso: "2024-01-01T00:00:00.000Z" },
    ],
  });
  const payload = buildDemaRecoveryMissionGathererPayload(input);
  assert.equal(payload.candidates.length, 1);
  assert.ok(payload.candidates.every((c) => !c.asset_id.includes(OTHER_ROOT)));
  const excluded = payload.not_accessed_report.find((r) => r.root === OTHER_ROOT);
  assert.ok(excluded, "excluded row named in not_accessed_report");
  assert.equal(excluded.reason, "out_of_source_boundary");
});

test("boundary poison: a path-escaping relative_path under a declared root is excluded", () => {
  const input = baseInput({
    files: [
      ...baseInput().files,
      { root: ROOT, relative_path: "../../etc/passwd", extension: "", size_bytes: 5, mtime_iso: "2024-01-01T00:00:00.000Z" },
    ],
  });
  const payload = buildDemaRecoveryMissionGathererPayload(input);
  assert.equal(payload.candidates.length, 1);
  const excluded = payload.not_accessed_report.find((r) => r.ref === "../../etc/passwd");
  assert.ok(excluded, "path-escaping row excluded");
  assert.equal(excluded.reason, "out_of_source_boundary");
});

test("boundary poison: a row under a declared exclusion is excluded", () => {
  const excludedRoot = `${ROOT}/private`;
  const input = baseInput({
    source_boundary: { roots: [ROOT], exclusions: [excludedRoot] },
    files: [
      ...baseInput().files,
      { root: ROOT, relative_path: "private/wallet.key", extension: ".key", size_bytes: 5, mtime_iso: "2024-01-01T00:00:00.000Z" },
    ],
  });
  const payload = buildDemaRecoveryMissionGathererPayload(input);
  assert.equal(payload.candidates.length, 1);
  const excluded = payload.not_accessed_report.find((r) => r.ref === "private/wallet.key");
  assert.ok(excluded, "excluded-root row excluded");
  assert.equal(excluded.reason, "out_of_source_boundary");
});

// --- unknown-time bucketing ---------------------------------------------------

test("unknown mtime buckets under the literal UNKNOWN chronology sentinel", () => {
  const input = baseInput({
    files: [
      ...baseInput().files,
      { root: ROOT, relative_path: "photos/img2.jpg", extension: ".jpg", size_bytes: 1, mtime_iso: null },
    ],
  });
  const payload = buildDemaRecoveryMissionGathererPayload(input);
  const unknownEntry = payload.chronology.find((c) => c.ref === "photos/img2.jpg");
  assert.equal(unknownEntry.best_evidence_time, "UNKNOWN");
});

// --- candidate cap -----------------------------------------------------------

test("candidate cap: at most 7 candidates, overflow named exceeds_candidate_cap", () => {
  const files = Array.from({ length: 9 }, (_, i) => ({
    root: ROOT,
    relative_path: `photos/img${i}.jpg`,
    extension: ".jpg",
    size_bytes: 1,
    mtime_iso: `2019-01-0${(i % 9) + 1}T00:00:00.000Z`,
  }));
  const payload = buildDemaRecoveryMissionGathererPayload(baseInput({ files }));
  assert.equal(payload.candidates.length, 7);
  const overflow = payload.not_accessed_report.filter((r) => r.reason === "exceeds_candidate_cap");
  assert.equal(overflow.length, 2);
});

// --- determinism ---------------------------------------------------------------

test("content-addressed determinism: identical input yields identical content_hash", () => {
  const p1 = buildDemaRecoveryMissionGathererPayload(baseInput());
  const p2 = buildDemaRecoveryMissionGathererPayload(baseInput());
  assert.equal(p1.content_hash, p2.content_hash);
  assert.match(p1.content_hash, /^sha256:[0-9a-f]{64}$/);
});

// --- verify + forge-and-rehash --------------------------------------------------

test("verify: a clean payload verifies ok", () => {
  const payload = buildDemaRecoveryMissionGathererPayload(baseInput());
  const verdict = verifyDemaRecoveryMissionGatherer(payload);
  assert.equal(verdict.ok, true);
});

test("verify: content_hash tamper alone is rejected", () => {
  const payload = buildDemaRecoveryMissionGathererPayload(baseInput());
  const tampered = { ...payload, content_hash: "sha256:" + "0".repeat(64) };
  const verdict = verifyDemaRecoveryMissionGatherer(tampered);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("content_hash_mismatch"));
});

test("verify: forged-and-rehashed truth_label is rejected (recomputed hash still fails)", () => {
  const payload = buildDemaRecoveryMissionGathererPayload(baseInput());
  const forged = { ...payload, truth_label: "FORGED" };
  const verdict = verifyDemaRecoveryMissionGatherer(forged);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("truth_label_mismatch"));
});

test("verify: forged-and-rehashed boundary flip is rejected even with a recomputed hash", () => {
  const payload = buildDemaRecoveryMissionGathererPayload(baseInput());
  const forgedBoundary = { ...payload.boundary, execution_allowed: true };
  const { content_hash: _drop, ...bodyWithoutHash } = { ...payload, boundary: forgedBoundary };
  const forged = { ...bodyWithoutHash, content_hash: undefined };
  // Recompute the hash over the tampered body to simulate a forger who also rehashes.
  const rehash = buildDemaRecoveryMissionGathererPayload(baseInput());
  const forgedRehashed = { ...forged, content_hash: rehash.content_hash };
  const verdict = verifyDemaRecoveryMissionGatherer(forgedRehashed);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("boundary_not_all_false") || verdict.blocked_by.includes("content_hash_mismatch"));
});

// --- all-false boundary (canonical key set, not vacuous) -----------------------

test("boundary is all-false with the exact declared key set", () => {
  const boundary = demaRecoveryMissionGathererBoundary();
  assert.deepEqual(
    Object.keys(boundary).sort(),
    [
      "content_read_performed",
      "daemon_started",
      "execution_allowed",
      "file_mutation_performed",
      "live_execution_performed",
      "model_invocation_performed",
      "network_used",
      "token_minted",
      "wallet_accessed",
    ],
  );
  assert.ok(Object.values(boundary).every((v) => v === false));
});

test("verify: a boundary missing a declared key is rejected (not vacuously all-false)", () => {
  const payload = buildDemaRecoveryMissionGathererPayload(baseInput());
  const { execution_allowed: _drop, ...strippedBoundary } = payload.boundary;
  const tampered = { ...payload, boundary: strippedBoundary };
  const verdict = verifyDemaRecoveryMissionGatherer(tampered);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("boundary_not_all_false"));
});

// --- metadata-only: no content field is ever emitted ----------------------------

test("metadata-only: no row-level content is ever emitted anywhere in the payload", () => {
  const input = baseInput({
    files: [{ ...baseInput().files[0], content: "smuggled bytes" }],
  });
  const payload = buildDemaRecoveryMissionGathererPayload(input);
  const serialized = JSON.stringify(payload);
  assert.ok(!serialized.includes("smuggled bytes"));
  assert.equal(payload.content_read_allowed, false);
});

// --- immutability -----------------------------------------------------------

test("payload is deep-frozen", () => {
  const payload = buildDemaRecoveryMissionGathererPayload(baseInput());
  assert.ok(Object.isFrozen(payload));
  assert.ok(Object.isFrozen(payload.candidates));
  assert.throws(() => {
    "use strict";
    payload.candidates.push({});
  });
});

// --- run() end-to-end ---------------------------------------------------------

test("run(): end-to-end PASS on the canonical fixture", () => {
  const result = runDemaRecoveryMissionGatherer({
    consent: DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE,
    input: DEMA_RECOVERY_MISSION_GATHERER_CANONICAL_FIXTURE,
  });
  assert.equal(result.ok, true);
  assert.equal(result.schema, DEMA_RECOVERY_MISSION_GATHERER_SCHEMA);
  assert.equal(result.truth_label, DEMA_RECOVERY_MISSION_GATHERER_TRUTH_LABEL);
  assert.match(result.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.ok(Object.values(result.boundary).every((v) => v === false));
  assert.ok(result.candidates.length > 0 && result.candidates.length <= 7);
});

test("run(): consent mismatch is rejected end-to-end", () => {
  const result = runDemaRecoveryMissionGatherer({
    consent: "nope",
    input: DEMA_RECOVERY_MISSION_GATHERER_CANONICAL_FIXTURE,
  });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("consent_phrase_mismatch"));
});

test("run(): the malicious (content_read:true) fixture is rejected end-to-end", () => {
  const result = runDemaRecoveryMissionGatherer({
    consent: DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE,
    input: DEMA_RECOVERY_MISSION_GATHERER_MALICIOUS_FIXTURE,
  });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("content_read_claimed"));
});

// --- review gate --------------------------------------------------------------

test("review gate: clean fixture PASS, malicious fixture rejected", () => {
  const result = runDemaRecoveryMissionGathererCheck();
  assert.equal(result.ok, true, JSON.stringify(result.blocked_by));
  assert.ok(result.candidate_count > 0);
});
