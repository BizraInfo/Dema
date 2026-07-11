import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCapsule,
  replayCapsule,
  verifyCapsule,
  sealCapsuleBody,
  deriveCapsuleRoute,
  runFdeIsnadReplayCapsulePreview,
  fdeIsnadReplayCapsuleBoundary,
  FDE_ISNAD_REPLAY_CAPSULE_SCHEMA,
  FDE_ISNAD_REPLAY_CAPSULE_EVAL_SCHEMA,
  FDE_ISNAD_REPLAY_CAPSULE_TRUTH_LABEL,
  EXPECTED_CAPSULE_KEYS,
  DIAGNOSIS_CLASSES,
} from "../packages/core/src/fde-isnad-replay-capsule-preview.js";
import { runFdeIsnadReplayCapsulePreviewCheck } from "../scripts/review/fde-isnad-replay-capsule-preview-check.mjs";
import {
  buildPreviewBoundary,
  isCanonicalBoundary,
} from "../packages/core/src/boundary-schema.js";

// One well-formed capsule input: a mission stopped because of an implementation
// defect. The lineage is an Isnād chain (origin → first appearance → author →
// evidence → verifier → status); the caller has already hashed every referenced
// artifact — the capsule only ever binds hashes + enum labels, never raw text.
const EVENT_HASH = `sha256:${"a".repeat(64)}`;
const EVIDENCE_STEP = { step: 3, ref_hash: `sha256:${"e".repeat(64)}`, role: "evidence" };

function lineage(overrides = []) {
  return [
    { step: 0, ref_hash: `sha256:${"1".repeat(64)}`, role: "origin" },
    { step: 1, ref_hash: `sha256:${"2".repeat(64)}`, role: "first_appearance" },
    { step: 2, ref_hash: `sha256:${"3".repeat(64)}`, role: "author_or_model" },
    EVIDENCE_STEP,
    { step: 4, ref_hash: `sha256:${"5".repeat(64)}`, role: "verifier" },
    { step: 5, ref_hash: `sha256:${"6".repeat(64)}`, role: "status" },
    ...overrides,
  ];
}

function inputWith(overrides = {}) {
  return {
    event_hash: EVENT_HASH,
    source_lineage: lineage(),
    diagnosis: "implementation_defect",
    ...overrides,
  };
}

// A lineage with NO role="evidence" step (origin/status only).
function lineageNoEvidence() {
  return [
    { step: 0, ref_hash: `sha256:${"1".repeat(64)}`, role: "origin" },
    { step: 1, ref_hash: `sha256:${"6".repeat(64)}`, role: "status" },
  ];
}

// --- invariants ---

test("boundary is the canonical all-false object (deep-equal, not vacuous)", () => {
  const boundary = fdeIsnadReplayCapsuleBoundary();
  assert.deepEqual(boundary, buildPreviewBoundary());
  assert.ok(isCanonicalBoundary(boundary));
  for (const value of Object.values(boundary)) assert.equal(value, false);
});

test("every verify verdict carries authority_delta 0 and the canonical boundary", () => {
  const capsule = buildCapsule(inputWith());
  const permit = verifyCapsule({ capsule });
  const block = verifyCapsule({ capsule: { ...capsule, mint_allowed: true } });
  for (const verdict of [permit, block]) {
    assert.equal(verdict.authority_delta, 0);
    assert.deepEqual(verdict.boundary, buildPreviewBoundary());
    assert.equal(verdict.schema, FDE_ISNAD_REPLAY_CAPSULE_EVAL_SCHEMA);
  }
});

test("capsule body carries only whitelisted keys, all effect guards off", () => {
  const capsule = buildCapsule(inputWith());
  assert.equal(capsule.schema, FDE_ISNAD_REPLAY_CAPSULE_SCHEMA);
  assert.equal(capsule.truth_label, FDE_ISNAD_REPLAY_CAPSULE_TRUTH_LABEL);
  assert.equal(capsule.authority_delta, 0);
  assert.equal(capsule.execution_allowed, false);
  assert.equal(capsule.mint_allowed, false);
  assert.deepEqual(Object.keys(capsule).sort(), [...EXPECTED_CAPSULE_KEYS].sort());
});

// --- positive ---

test("well-formed capsule (implementation_defect + evidence) → patch_proposal, PERMIT, replay exact", () => {
  const capsule = buildCapsule(inputWith());
  assert.equal(capsule.route, "patch_proposal");
  assert.match(capsule.capsule_hash, /^sha256:[0-9a-f]{64}$/);
  assert.match(capsule.source_lineage_hash, /^sha256:[0-9a-f]{64}$/);

  const verdict = verifyCapsule({ capsule });
  assert.equal(verdict.accepted, true, verdict.reason);
  assert.equal(verdict.verdict, "PERMIT_PREVIEW");
  assert.deepEqual(verdict.blocked_by, []);

  const replay = replayCapsule(capsule);
  assert.equal(replay.replay_exact, true);
  assert.equal(replay.model_used, false);
});

// --- fail-closed contract (one per charter item) ---

test("1: a changed source ref_hash makes source_lineage_hash no longer re-derive → BLOCK", () => {
  const capsule = buildCapsule(inputWith());
  const tampered = {
    ...capsule,
    source_lineage: capsule.source_lineage.map((s, i) =>
      i === 0 ? { ...s, ref_hash: `sha256:${"f".repeat(64)}` } : s,
    ),
  };
  const verdict = verifyCapsule({ capsule: tampered });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("source_lineage_hash_mismatch"));
});

test("2: no lineage evidence step → insufficient_evidence_stop route AND BLOCK", () => {
  const capsule = buildCapsule(inputWith({ source_lineage: lineageNoEvidence() }));
  assert.equal(capsule.route, "insufficient_evidence_stop");
  const verdict = verifyCapsule({ capsule });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("missing_evidence"));
});

test("3: outward classes route to operator_or_environment_repair, NEVER patch_proposal", () => {
  for (const outward of ["environment_gap", "dependency_gap", "permission_gap"]) {
    assert.equal(deriveCapsuleRoute(outward, true), "operator_or_environment_repair");
    assert.notEqual(deriveCapsuleRoute(outward, true), "patch_proposal");
    const capsule = buildCapsule(inputWith({ diagnosis: outward }));
    assert.equal(capsule.route, "operator_or_environment_repair");
    assert.equal(verifyCapsule({ capsule }).accepted, true);
    // forging a code-patch route onto an outward failure is rejected
    const forged = sealCapsuleBody({ ...capsule, route: "patch_proposal" });
    const verdict = verifyCapsule({ capsule: forged });
    assert.equal(verdict.accepted, false);
    assert.ok(verdict.blocked_by.includes("forged_route"));
  }
});

test("4: implementation_defect with no evidence step → insufficient_evidence_stop + BLOCK (code defect needs code evidence)", () => {
  const capsule = buildCapsule(inputWith({ source_lineage: lineageNoEvidence() }));
  assert.equal(capsule.diagnosis, "implementation_defect");
  assert.equal(capsule.route, "insufficient_evidence_stop");
  assert.notEqual(capsule.route, "patch_proposal");
  const verdict = verifyCapsule({ capsule });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("missing_evidence"));
});

test("5: boundary_violation has HIGHEST precedence → route == stop, wins over any other class", () => {
  assert.equal(deriveCapsuleRoute("boundary_violation", true), "stop");
  // even though the same evidence would make an implementation_defect a patch_proposal
  assert.equal(deriveCapsuleRoute("implementation_defect", true), "patch_proposal");
  const capsule = buildCapsule(inputWith({ diagnosis: "boundary_violation" }));
  assert.equal(capsule.route, "stop");
  assert.equal(verifyCapsule({ capsule }).accepted, true);
});

test("6: authority monotonicity — authority_delta > 0 is REJECTED at build and verify", () => {
  assert.throws(() => buildCapsule(inputWith({ authority_delta: 1 })));
  const forged = sealCapsuleBody({ ...buildCapsule(inputWith()), authority_delta: 1 });
  const verdict = verifyCapsule({ capsule: forged });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("authority_delta_not_zero"));
});

test("7: execution_allowed / mint_allowed can never be true", () => {
  assert.throws(() => buildCapsule(inputWith({ execution_allowed: true })));
  assert.throws(() => buildCapsule(inputWith({ mint_allowed: true })));
  const capsule = buildCapsule(inputWith());
  const execForged = sealCapsuleBody({ ...capsule, execution_allowed: true });
  const mintForged = sealCapsuleBody({ ...capsule, mint_allowed: true });
  assert.ok(
    verifyCapsule({ capsule: execForged }).blocked_by.includes("execution_allowed_not_false"),
  );
  assert.ok(
    verifyCapsule({ capsule: mintForged }).blocked_by.includes("mint_allowed_not_false"),
  );
});

test("8: a forged route (route != the route the diagnosis derives) BLOCKS even with recomputed hashes", () => {
  const capsule = buildCapsule(inputWith()); // route patch_proposal
  const forged = sealCapsuleBody({ ...capsule, route: "operator_or_environment_repair" });
  // all sub-hashes + capsule_hash re-derive for the forged route — only forged_route catches it
  assert.equal(forged.route_hash, `sha256:${sha256Hex("operator_or_environment_repair")}`);
  const verdict = verifyCapsule({ capsule: forged });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("forged_route"));
  assert.equal(replayCapsule(forged).replay_exact, false);
});

test("9: any capsule body field mutated after capsule_hash sealed BLOCKS (whole-body re-derivation)", () => {
  const capsule = buildCapsule(inputWith());
  const mutated = { ...capsule, diagnosis: "doc_drift" };
  const verdict = verifyCapsule({ capsule: mutated });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("capsule_hash_mismatch"));
  assert.equal(replayCapsule(mutated).replay_exact, false);
});

test("10: exact replay WITHOUT the model — replayCapsule reproduces route + verdict from the capsule alone", () => {
  const capsule = buildCapsule(inputWith());
  const replay = replayCapsule(capsule);
  assert.equal(replay.replay_exact, true);
  assert.equal(replay.model_used, false);
  assert.equal(replay.re_derived_route, capsule.route);
  assert.equal(replay.stored_route, capsule.route);
  assert.equal(replay.verdict, "REPLAY_EXACT");
  // model-independence: replay derives from the body's own hashes, no external input
  assert.equal(replay.re_derived_capsule_hash, capsule.capsule_hash);
});

test("11: private contents / secrets are excluded — capsule carries only hashes + enum labels", () => {
  const capsule = buildCapsule(
    inputWith({
      private_key: "-----BEGIN PRIVATE KEY-----leak-----END PRIVATE KEY-----",
      raw_text: "SECRET_RAW_EVIDENCE_BODY",
      source_lineage: lineage([
        {
          step: 6,
          ref_hash: `sha256:${"7".repeat(64)}`,
          role: "counterevidence",
          raw_text: "SECRET_RAW_EVIDENCE_BODY",
          private_key: "-----BEGIN PRIVATE KEY-----leak2-----END PRIVATE KEY-----",
        },
      ]),
    }),
  );
  const blob = JSON.stringify(capsule);
  assert.ok(!blob.includes("SECRET_RAW_EVIDENCE_BODY"));
  assert.ok(!blob.includes("BEGIN PRIVATE KEY"));
  assert.ok(!("private_key" in capsule));
  assert.ok(!("raw_text" in capsule));
  for (const step of capsule.source_lineage) {
    assert.deepEqual(Object.keys(step).sort(), ["ref_hash", "role", "step"]);
  }
});

// --- determinism + vocabulary ---

test("buildCapsule is deterministic (identical input → deep-equal capsule + hash)", () => {
  const a = buildCapsule(inputWith());
  const b = buildCapsule(inputWith());
  assert.deepEqual(a, b);
  assert.equal(a.capsule_hash, b.capsule_hash);
});

test("diagnosis must be a known FDE class — an invalid class BLOCKS", () => {
  const capsule = buildCapsule(inputWith());
  const forged = sealCapsuleBody({ ...capsule, diagnosis: "not_a_real_class" });
  const verdict = verifyCapsule({ capsule: forged });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("invalid_diagnosis_class"));
  // the diagnosis vocabulary is the FDE dual-diagnostic vocabulary (mirrored, not reinvented)
  for (const cls of ["implementation_defect", "boundary_violation", "unknown"]) {
    assert.ok(DIAGNOSIS_CLASSES.includes(cls));
  }
});

test("unknown diagnosis routes to insufficient_evidence_stop (fail closed)", () => {
  assert.equal(deriveCapsuleRoute("unknown", true), "insufficient_evidence_stop");
  const capsule = buildCapsule(inputWith({ diagnosis: "unknown" }));
  assert.equal(capsule.route, "insufficient_evidence_stop");
  assert.equal(verifyCapsule({ capsule }).accepted, true);
});

// --- orchestrator + review gate ---

test("orchestrator: build → verify PERMIT → replay exact → forged-route self-probe blocks", () => {
  const result = runFdeIsnadReplayCapsulePreview({ input: inputWith() });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, FDE_ISNAD_REPLAY_CAPSULE_EVAL_SCHEMA);
  assert.equal(result.authority_delta, 0);
  assert.deepEqual(result.boundary, buildPreviewBoundary());
});

test("review gate closes the loop: build → verify → replay → forged-route block", () => {
  const result = runFdeIsnadReplayCapsulePreviewCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, FDE_ISNAD_REPLAY_CAPSULE_EVAL_SCHEMA);
  assert.equal(result.truth_label, FDE_ISNAD_REPLAY_CAPSULE_TRUTH_LABEL);
});

// local sha256 helper for the forged-route hash assertion (mirrors the kernel's)
import { createHash } from "node:crypto";
function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
