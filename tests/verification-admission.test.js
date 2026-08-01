import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  evaluateVerificationAdmission,
  buildPeakVerificationAdmissionDefault,
  ADMISSIBLE_VERIFIERS,
  INADMISSIBLE_VERIFIERS,
  VERIFIER_BINDINGS,
  VERIFICATION_ADMISSION_SCHEMA,
  VERIFICATION_ADMISSION_TRUTH_LABEL,
} from "../packages/core/src/verification-admission.js";
import { buildPeakSelfLoopPreview } from "../packages/core/src/peak-self-loop-preview.js";

const SRC = fileURLToPath(
  new URL("../packages/core/src/verification-admission.js", import.meta.url),
);

// Minimum honest bindings per verifier class (v0.2 F1). Tests remove pieces
// one at a time to prove fail-closed.
const BOUND = {
  hash_equality: { expected_post_sha256: "sha256:abc123" },
  restore_test: { backup_ref: "backup/0001", target_ref: "sandbox/file.txt" },
  suite_exit_0: {
    suite: "npm test",
    command: "node --test",
    tree_sha: "7f658d7",
  },
  schema_validate: { schema: "bizra.dema.receipt.v0.1" },
  content_address_rederive: { content_address: "blake3:def456" },
};

function bound(verifier, extra = {}) {
  return {
    proposed_act: "sandbox_rename",
    verifier,
    proposer: "actor:model",
    certifier: "habitat:kernel",
    bindings: { ...BOUND[verifier] },
    ...extra,
  };
}

test("VA-01: schema and truth label", () => {
  const out = evaluateVerificationAdmission(bound("hash_equality"));
  assert.equal(out.schema, VERIFICATION_ADMISSION_SCHEMA);
  assert.equal(out.truth_label, VERIFICATION_ADMISSION_TRUTH_LABEL);
});

test("VA-02: each admissible verifier admits when fully bound and certified", () => {
  for (const verifier of ADMISSIBLE_VERIFIERS) {
    const out = evaluateVerificationAdmission(bound(verifier));
    assert.equal(out.self_verifiable, true, verifier);
    assert.equal(out.reinsert_eligible, true, verifier);
    assert.equal(out.refusal_reason, null, verifier);
    assert.equal(out.named_verifier, verifier);
    assert.equal(out.certifier, "habitat:kernel");
  }
});

test("VA-03: each inadmissible verifier refuses even fully bound and certified", () => {
  for (const verifier of INADMISSIBLE_VERIFIERS) {
    const out = evaluateVerificationAdmission({
      ...bound("hash_equality"),
      verifier,
      // over-bound on purpose: bindings must not rescue a judgment verifier
      bindings: { ...BOUND.hash_equality, ...BOUND.suite_exit_0 },
    });
    assert.equal(out.self_verifiable, false, verifier);
    assert.equal(out.reinsert_eligible, false, verifier);
    assert.equal(out.refusal_reason, `inadmissible_verifier:${verifier}`);
  }
});

test("VA-04: missing act / verifier / unknown fail closed", () => {
  assert.equal(
    evaluateVerificationAdmission({}).refusal_reason,
    "proposed_act_required",
  );
  assert.equal(
    evaluateVerificationAdmission({ proposed_act: "x" }).refusal_reason,
    "verifier_required",
  );
  assert.equal(
    evaluateVerificationAdmission({
      proposed_act: "x",
      verifier: "opinion_poll",
    }).refusal_reason,
    "unknown_verifier",
  );
});

test("VA-05: boundary all-false including reinsert flag", () => {
  const out = evaluateVerificationAdmission(bound("suite_exit_0"));
  assert.equal(out.self_verifiable, true);
  assert.equal(out.boundary.reinsert_as_next_input_performed, false);
  assert.equal(out.boundary.runtime_execution_performed, false);
  assert.equal(out.boundary.autonomous_loop_started, false);
});

test("VA-06: deterministic content_hash + deep freeze", () => {
  const a = evaluateVerificationAdmission(bound("restore_test"));
  const b = evaluateVerificationAdmission(bound("restore_test"));
  assert.equal(a.content_hash, b.content_hash);
  assert.equal(Object.isFrozen(a), true);
  assert.equal(Object.isFrozen(a.admissible_verifiers), true);
  assert.equal(Object.isFrozen(VERIFIER_BINDINGS), true);
});

test("VA-07: Peak default is fail-closed (no act)", () => {
  const d = buildPeakVerificationAdmissionDefault();
  assert.equal(d.self_verifiable, false);
  assert.equal(d.reinsert_eligible, false);
  assert.equal(d.refusal_reason, "proposed_act_required");
});

test("VA-08: kernel purity — no node:fs / node:net", () => {
  const src = readFileSync(SRC, "utf8");
  assert.equal(/from ["']node:fs["']/.test(src), false);
  assert.equal(/from ["']node:net["']/.test(src), false);
  assert.equal(/require\(["']fs["']\)/.test(src), false);
});

test("VA-09: peak-self-loop wires verification_admission fail-closed by default", () => {
  const out = buildPeakSelfLoopPreview();
  assert.ok(out.proactive_self.verification_admission);
  assert.equal(out.proactive_self.verification_admission.self_verifiable, false);
  assert.equal(out.proactive_self.compliance.reinsert_eligible, false);
  assert.equal(out.proactive_self.compliance.reinsert_requires_judge_free_admission, true);
  assert.equal(out.proactive_self.consent.auto_applied, false);
  assert.equal(out.proactive_self.harness.self_proactive_posture, "preview_only");
  assert.ok(
    out.proactive_self.harness.active_gates.includes("peak-verify-admission"),
  );
  assert.ok(
    out.ultra_micro_compose.subsystems.includes(
      "proactive_self.verification_admission",
    ),
  );
  assert.ok(
    out.proactive_self.critique.gaps.some((g) =>
      g.includes("VERIFY admission refused"),
    ),
  );
});

test("VA-10: peak admits with bound hash_equality + independent certifier", () => {
  const out = buildPeakSelfLoopPreview({
    proposed_act: "sandbox_rename",
    verifier: "hash_equality",
    proposer: "actor:model",
    certifier: "habitat:kernel",
    verifier_bindings: { ...BOUND.hash_equality },
  });
  assert.equal(out.proactive_self.verification_admission.self_verifiable, true);
  assert.equal(out.proactive_self.compliance.reinsert_eligible, true);
  assert.equal(
    out.proactive_self.critique.gaps.some((g) =>
      g.includes("VERIFY admission refused"),
    ),
    false,
  );
});

test("VA-11: F1 — a verifier named without its exact bindings is refused, per key", () => {
  for (const verifier of ADMISSIBLE_VERIFIERS) {
    const contract = VERIFIER_BINDINGS[verifier];
    // no bindings at all
    const bare = evaluateVerificationAdmission({ ...bound(verifier), bindings: {} });
    assert.equal(bare.self_verifiable, false, `${verifier} bare`);
    assert.match(bare.refusal_reason, /^unbound_verifier:/, `${verifier} bare`);
    // each required key removed one at a time
    for (const key of contract.requires) {
      const p = bound(verifier);
      delete p.bindings[key];
      const out = evaluateVerificationAdmission(p);
      assert.equal(
        out.refusal_reason,
        `unbound_verifier:${verifier}:${key}`,
        `${verifier}.${key}`,
      );
    }
    // present-but-empty must not count as bound
    for (const key of [...contract.requires, ...contract.requiresOneOf]) {
      const p = bound(verifier);
      p.bindings[key] = "   ";
      if (contract.requiresOneOf.includes(key)) {
        for (const other of contract.requiresOneOf) {
          if (other !== key) delete p.bindings[other];
        }
      }
      const out = evaluateVerificationAdmission(p);
      assert.equal(out.self_verifiable, false, `${verifier}.${key} empty`);
    }
  }
});

test("VA-11b: hash_equality admits with either exact hash alone", () => {
  const pre = evaluateVerificationAdmission({
    ...bound("hash_equality"),
    bindings: { expected_pre_sha256: "sha256:pre" },
  });
  assert.equal(pre.self_verifiable, true);
  const post = evaluateVerificationAdmission({
    ...bound("hash_equality"),
    bindings: { expected_post_sha256: "sha256:post" },
  });
  assert.equal(post.self_verifiable, true);
});

test("VA-12: F2 — a verifier with no certifier is refused", () => {
  for (const certifier of ["", "   ", undefined]) {
    const out = evaluateVerificationAdmission({
      ...bound("hash_equality"),
      certifier,
    });
    assert.equal(out.self_verifiable, false);
    assert.equal(out.refusal_reason, "certifier_required");
  }
});

test("VA-13: F2 — self-certification is structurally refused", () => {
  const out = evaluateVerificationAdmission({
    ...bound("hash_equality"),
    proposer: "actor:model",
    certifier: "actor:model",
  });
  assert.equal(out.self_verifiable, false);
  assert.equal(out.refusal_reason, "self_certification");
});

test("VA-14: verdict echoes proposer, certifier, bindings for the receipt chain", () => {
  const out = evaluateVerificationAdmission(bound("suite_exit_0"));
  assert.equal(out.proposer, "actor:model");
  assert.equal(out.certifier, "habitat:kernel");
  assert.deepEqual(out.bindings, BOUND.suite_exit_0);
  // refusals carry the same evidence
  const refused = evaluateVerificationAdmission({
    ...bound("suite_exit_0"),
    certifier: "actor:model",
  });
  assert.equal(refused.refusal_reason, "self_certification");
  assert.equal(refused.proposer, "actor:model");
  assert.equal(refused.certifier, "actor:model");
});
