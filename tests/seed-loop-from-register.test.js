import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  buildSeedLoopFromRegister,
  mapRegisterClaimToConvergence,
  mapRegisterClaimToAssumption,
} from "../packages/core/src/seed-loop-from-register.js";
import { SEED_LOOP_PREVIEW_SCHEMA } from "../packages/core/src/seed-loop-preview.js";

const POSTURES = ["ADVANCE", "HOLD", "REFUSED"];

const MOCK = {
  claims: [
    {
      id: "m1",
      text: "a measured thing",
      scope: "dema",
      source: "README.md",
      evidence_class: "MEASURED",
      status: "MECHANISM_VERIFIED_SYNTHETIC",
      verification_path: "npm test",
      blocked_wording: [],
    },
    {
      id: "d1",
      text: "a designed-not-live thing",
      scope: "economy",
      source: "docs/x.md",
      evidence_class: "DESIGNED_NOT_LIVE",
      status: "DESIGNED",
      verification_path: "",
      blocked_wording: ["token", "production"],
    },
    {
      id: "u1",
      text: "an unknown thing",
      scope: "node0",
      source: "",
      evidence_class: "UNKNOWN",
      status: "DESIGNED",
      verification_path: "",
      blocked_wording: [],
    },
  ],
};

test("every register claim maps to a VALID assumption envelope (the set is admissible)", () => {
  const out = buildSeedLoopFromRegister({ register: MOCK });
  assert.equal(
    out.assumption.admissible,
    true,
    "no mapped claim is naked/invalid",
  );
});

test("a MEASURED claim → V with evidence_refs + spec_plus_test convergence", () => {
  const a = mapRegisterClaimToAssumption(MOCK.claims[0]);
  assert.equal(a.claim_state, "V");
  assert.ok(a.evidence_refs.length > 0);
  const c = mapRegisterClaimToConvergence(MOCK.claims[0]);
  assert.equal(c.rails.formal, "spec_plus_test");
  assert.equal(c.rails.empirical, "passing_tests");
});

test("a DESIGNED_NOT_LIVE claim → a VALID A (declared with Ihsān, not refused)", () => {
  const a = mapRegisterClaimToAssumption(MOCK.claims[1]);
  assert.equal(a.claim_state, "A");
  assert.ok(a.assumption && a.ground && a.boundary);
  assert.equal(a.rejectable, true);
});

test("an UNKNOWN claim → U", () => {
  assert.equal(mapRegisterClaimToAssumption(MOCK.claims[2]).claim_state, "U");
});

test("composed loop: posture in {ADVANCE,HOLD,REFUSED}, source=claim-register", () => {
  const out = buildSeedLoopFromRegister({ register: MOCK });
  assert.equal(out.schema, SEED_LOOP_PREVIEW_SCHEMA);
  assert.ok(POSTURES.includes(out.posture));
  assert.equal(out.source, "claim-register");
  assert.equal(out.claims_graded, 3);
});

test("the REAL claim register produces a valid, non-crashing posture", () => {
  const path = fileURLToPath(
    new URL("../docs/claims/node0-claim-register.v0.1.json", import.meta.url),
  );
  const register = JSON.parse(readFileSync(path, "utf8"));
  const out = buildSeedLoopFromRegister({ register });
  assert.ok(POSTURES.includes(out.posture));
  assert.equal(out.claims_graded, register.claims.length);
  assert.equal(
    out.assumption.admissible,
    true,
    "every real claim maps to a valid envelope",
  );
});

test("pure + deterministic + deeply frozen", () => {
  const a = buildSeedLoopFromRegister({ register: MOCK });
  const b = buildSeedLoopFromRegister({ register: MOCK });
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(a.boundary));
});
