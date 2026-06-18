import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertProofBoundary,
  computeDeliveryReadiness,
  scoreEffectBoundary,
  DEFAULT_RENDER_EFFECT_BOUNDARY,
} from "../packages/core/src/delivery-readiness-score.js";
import {
  buildFirstLookHome,
  gatherFirstLookContext,
} from "../packages/core/src/dema-first-look-home.js";
import { evaluateUxFirstLookEnvelope } from "../packages/core/src/ux-quality-gate.js";

test("proof boundary requires does_not_prove", () => {
  const fail = assertProofBoundary({ what_this_proves: "x" });
  assert.equal(fail.pass, false);
  const ok = assertProofBoundary({
    what_this_proves: "x",
    what_this_does_not_prove: "y",
  });
  assert.equal(ok.pass, true);
});

test("delivery readiness passes for first-look home", async () => {
  const ctx = await gatherFirstLookContext();
  const envelope = buildFirstLookHome(ctx);
  const ux = evaluateUxFirstLookEnvelope(envelope);
  const proof = assertProofBoundary(envelope.proof_boundary);
  const security = scoreEffectBoundary(
    envelope.effect_boundary,
    DEFAULT_RENDER_EFFECT_BOUNDARY,
  );
  const report = computeDeliveryReadiness({
    ux,
    proof,
    security,
    performance: { pass: true },
  });
  assert.equal(report.pass, true);
  assert.ok(report.what_this_does_not_prove);
});
