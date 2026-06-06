import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  buildSkillManifestPreview,
  SKILL_MANIFEST_PREVIEW_SCHEMA,
  SKILL_RISK_LEVELS,
  SKILL_RECEIPT_POLICIES,
  PAT_ROLE_IDS,
  SAT_ROLE_IDS,
} from "../packages/core/src/skill-manifest-preview.js";

const modulePath = fileURLToPath(
  new URL("../packages/core/src/skill-manifest-preview.js", import.meta.url),
);

const FIXED_NOW = "2026-05-16T00:00:00.000Z";

function validInput(overrides = {}) {
  return {
    skill_id: "verify_before_act",
    risk_level: "low",
    declared_effects: ["read"],
    denied_effects: ["write", "execute", "call"],
    required_pat: ["intent_extractor"],
    required_sat: ["consent_verifier"],
    tests: ["tests/verify-before-act.test.js"],
    receipt_policy: "no_receipt",
    now: FIXED_NOW,
    ...overrides,
  };
}

test("T-01 emits the canonical schema constant", () => {
  assert.equal(
    SKILL_MANIFEST_PREVIEW_SCHEMA,
    "bizra.dema.skill_manifest_preview.v0.1",
  );
  const m = buildSkillManifestPreview(validInput());
  assert.equal(m.schema, SKILL_MANIFEST_PREVIEW_SCHEMA);
});

test("T-02 valid envelope is PREVIEW_ONLY and DECLARED with valid=true", () => {
  const m = buildSkillManifestPreview(validInput());
  assert.equal(m.mode, "PREVIEW_ONLY");
  assert.equal(m.truth_label, "DECLARED");
  assert.equal(m.valid, true);
});

test("T-03 exports the four canonical frozen enum arrays", () => {
  assert.deepEqual(
    [...SKILL_RISK_LEVELS],
    ["low", "medium", "high", "step_seven_tier"],
  );
  assert.deepEqual(
    [...SKILL_RECEIPT_POLICIES],
    ["no_receipt", "preview_receipt", "step_seven_receipt"],
  );
  assert.deepEqual(
    [...PAT_ROLE_IDS],
    [
      "intent_extractor",
      "permission_planner",
      "evidence_collector",
      "consent_drafter",
      "mission_proposer",
      "receipt_renderer",
      "memory_steward",
    ],
  );
  assert.deepEqual(
    [...SAT_ROLE_IDS],
    [
      "consent_verifier",
      "boundary_auditor",
      "ihsan_floor_checker",
      "evidence_chain_validator",
      "step7_gate_keeper",
    ],
  );
  assert.ok(Object.isFrozen(SKILL_RISK_LEVELS));
  assert.ok(Object.isFrozen(SKILL_RECEIPT_POLICIES));
  assert.ok(Object.isFrozen(PAT_ROLE_IDS));
  assert.ok(Object.isFrozen(SAT_ROLE_IDS));
});

test("T-04 rejects invalid skill_id (empty, leading digit, uppercase, hyphen)", () => {
  for (const bad of [
    "",
    "1abc",
    "Abc",
    "with-hyphen",
    "with space",
    null,
    42,
  ]) {
    const m = buildSkillManifestPreview(validInput({ skill_id: bad }));
    assert.equal(
      m.valid,
      false,
      `skill_id=${JSON.stringify(bad)} should be invalid`,
    );
    assert.ok(Array.isArray(m.errors) && m.errors.length > 0);
  }
  const good = buildSkillManifestPreview(
    validInput({ skill_id: "a_valid_id_42" }),
  );
  assert.equal(good.valid, true);
});

test("T-05 rejects risk_level not in SKILL_RISK_LEVELS", () => {
  const m = buildSkillManifestPreview(validInput({ risk_level: "extreme" }));
  assert.equal(m.valid, false);
  assert.ok(m.errors.some((e) => /risk_level/.test(e)));
});

test("T-06 rejects overlap between declared_effects and denied_effects", () => {
  const m = buildSkillManifestPreview(
    validInput({
      declared_effects: ["read", "write"],
      denied_effects: ["write"],
    }),
  );
  assert.equal(m.valid, false);
  assert.ok(
    m.errors.some((e) => /declared_effects.*denied_effects|overlap/i.test(e)),
  );
});

test("T-07 rejects effects outside the OPERATIONS set", () => {
  const m = buildSkillManifestPreview(
    validInput({ declared_effects: ["read", "shout"] }),
  );
  assert.equal(m.valid, false);
  const m2 = buildSkillManifestPreview(
    validInput({ denied_effects: ["read", "blast"] }),
  );
  assert.equal(m2.valid, false);
});

test("T-08 rejects empty or non-subset required_pat", () => {
  const empty = buildSkillManifestPreview(validInput({ required_pat: [] }));
  assert.equal(empty.valid, false);
  const bogus = buildSkillManifestPreview(
    validInput({ required_pat: ["intent_extractor", "ghost"] }),
  );
  assert.equal(bogus.valid, false);
});

test("T-09 rejects empty or non-subset required_sat", () => {
  const empty = buildSkillManifestPreview(validInput({ required_sat: [] }));
  assert.equal(empty.valid, false);
  const bogus = buildSkillManifestPreview(
    validInput({ required_sat: ["consent_verifier", "phantom"] }),
  );
  assert.equal(bogus.valid, false);
});

test("T-10 rejects empty tests array", () => {
  const m = buildSkillManifestPreview(validInput({ tests: [] }));
  assert.equal(m.valid, false);
  assert.ok(m.errors.some((e) => /tests/.test(e)));
});

test("T-11 rejects receipt_policy not in SKILL_RECEIPT_POLICIES", () => {
  const m = buildSkillManifestPreview(
    validInput({ receipt_policy: "free_pass" }),
  );
  assert.equal(m.valid, false);
});

test("T-12 step_seven_tier requires step_seven_receipt AND step7_gate_keeper in required_sat", () => {
  // missing receipt_policy
  const m1 = buildSkillManifestPreview(
    validInput({
      risk_level: "step_seven_tier",
      receipt_policy: "preview_receipt",
      required_sat: ["consent_verifier", "step7_gate_keeper"],
      declared_effects: ["read", "execute"],
    }),
  );
  assert.equal(m1.valid, false);

  // missing step7_gate_keeper
  const m2 = buildSkillManifestPreview(
    validInput({
      risk_level: "step_seven_tier",
      receipt_policy: "step_seven_receipt",
      required_sat: ["consent_verifier"],
      declared_effects: ["read", "execute"],
    }),
  );
  assert.equal(m2.valid, false);

  // both satisfied
  const m3 = buildSkillManifestPreview(
    validInput({
      risk_level: "step_seven_tier",
      receipt_policy: "step_seven_receipt",
      required_sat: ["consent_verifier", "step7_gate_keeper"],
      declared_effects: ["read", "execute"],
      denied_effects: ["write", "call"],
    }),
  );
  assert.equal(m3.valid, true, JSON.stringify(m3.errors));
});

test("T-13 declared_effects containing 'execute' requires risk_level 'high' or 'step_seven_tier'", () => {
  const low = buildSkillManifestPreview(
    validInput({
      risk_level: "low",
      declared_effects: ["read", "execute"],
      denied_effects: [],
    }),
  );
  assert.equal(low.valid, false);
  const med = buildSkillManifestPreview(
    validInput({
      risk_level: "medium",
      declared_effects: ["read", "execute"],
      denied_effects: [],
    }),
  );
  assert.equal(med.valid, false);
  const high = buildSkillManifestPreview(
    validInput({
      risk_level: "high",
      declared_effects: ["read", "execute"],
      denied_effects: [],
    }),
  );
  assert.equal(high.valid, true);
});

test("T-14 boundary has the 7 spec'd keys, all false", () => {
  const m = buildSkillManifestPreview(validInput());
  const keys = [
    "runtime",
    "federation",
    "mint",
    "skill_activated",
    "skill_invoked",
    "receipt_minted",
    "authority_imported",
  ];
  for (const k of keys) {
    assert.ok(k in m.boundary, `boundary missing key ${k}`);
    assert.equal(m.boundary[k], false, `boundary.${k} must be false`);
  }
});

test("T-15 active_now is always false (invariant) even for valid inputs", () => {
  const m1 = buildSkillManifestPreview(validInput());
  assert.equal(m1.active_now, false);
  const m2 = buildSkillManifestPreview(
    validInput({
      risk_level: "step_seven_tier",
      receipt_policy: "step_seven_receipt",
      required_sat: ["consent_verifier", "step7_gate_keeper"],
      declared_effects: ["read", "execute"],
    }),
  );
  assert.equal(m2.active_now, false);
});

test("T-16 deterministic: same inputs produce deeply equal frozen output", () => {
  const a = buildSkillManifestPreview(validInput());
  const b = buildSkillManifestPreview(validInput());
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(a.boundary));
});

test("T-17 returns fresh objects on each call (no shared references)", () => {
  const a = buildSkillManifestPreview(validInput());
  const b = buildSkillManifestPreview(validInput());
  assert.notEqual(a, b);
  assert.notEqual(a.boundary, b.boundary);
  assert.notEqual(a.declared_effects, b.declared_effects);
});

test("T-18 module is pure (no fs/http/net/child_process imports or shellouts)", async () => {
  const body = await readFile(modulePath, "utf8");
  assert.ok(!/from ['"]node:fs/.test(body), "must not import node:fs");
  assert.ok(!/from ['"]node:http/.test(body), "must not import node:http");
  assert.ok(!/from ['"]node:net/.test(body), "must not import node:net");
  assert.ok(
    !/from ['"]node:child_process/.test(body),
    "must not import node:child_process",
  );
  assert.ok(!/spawn\(|execSync\(|execFile\(|spawnSync\(/.test(body));
});

test("T-19 envelope carries all declared inputs through to typed fields", () => {
  const input = validInput({
    skill_id: "verify_before_act",
    declared_effects: ["read"],
    denied_effects: ["write", "execute", "call"],
    required_pat: ["intent_extractor", "evidence_collector"],
    required_sat: ["consent_verifier", "boundary_auditor"],
    tests: ["tests/a.test.js", "tests/b.test.js"],
    receipt_policy: "preview_receipt",
    risk_level: "medium",
  });
  const m = buildSkillManifestPreview(input);
  assert.equal(m.valid, true);
  assert.equal(m.skill_id, "verify_before_act");
  assert.equal(m.risk_level, "medium");
  assert.deepEqual([...m.declared_effects], ["read"]);
  assert.deepEqual([...m.denied_effects], ["write", "execute", "call"]);
  assert.deepEqual(
    [...m.required_pat],
    ["intent_extractor", "evidence_collector"],
  );
  assert.deepEqual(
    [...m.required_sat],
    ["consent_verifier", "boundary_auditor"],
  );
  assert.deepEqual([...m.tests], ["tests/a.test.js", "tests/b.test.js"]);
  assert.equal(m.receipt_policy, "preview_receipt");
  assert.equal(m.generated_at, FIXED_NOW);
});
