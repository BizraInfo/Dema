import { test } from "node:test";
import assert from "node:assert/strict";

import { buildPatSatBlackboardDryRun } from "../packages/core/src/pat-sat-blackboard-dry-run.js";
import { invokeDemaTalkLive } from "../packages/core/src/dema-talk-loop-live.js";
import {
  buildLiveBlackboardProposePrompt,
  composeLiveBlackboard,
  verifyLiveBlackboard,
  LIVE_BLACKBOARD_FORBIDDEN_TRUE_KEYS,
  PAT_SAT_BLACKBOARD_LIVE_SCHEMA,
} from "../packages/core/src/pat-sat-blackboard-live.js";

const SEED = { pain: "slow triage", goal: "ship a slice" };
const PROVIDER = "ollama";
const MODEL = "whiterabbitneo-v3:7b-q4_K_M";

// Mock fetch returns both Ollama and OpenAI shapes so the test is robust to the
// endpoint family the router selects. NEVER a real network call.
const mockFetch = async () => ({
  ok: true,
  json: async () => ({
    response: "Propose: run npm test then open a feat/ PR.",
    choices: [{ message: { content: "Propose: run npm test then open a feat/ PR." } }],
  }),
});

async function liveCompleted() {
  const prompt = buildLiveBlackboardProposePrompt(SEED);
  // Self-adjusting: discover the exact required consent phrase, then satisfy it.
  const refused = await invokeDemaTalkLive({
    provider: PROVIDER, model: MODEL, prompt, consentPhrase: "", fetchImpl: mockFetch,
  });
  const phrase = refused.required_consent;
  return invokeDemaTalkLive({
    provider: PROVIDER, model: MODEL, prompt, consentPhrase: phrase, fetchImpl: mockFetch,
  });
}

test("prompt builder is deterministic and carries the seed", () => {
  const a = buildLiveBlackboardProposePrompt(SEED);
  const b = buildLiveBlackboardProposePrompt(SEED);
  assert.equal(a, b);
  assert.match(a, /slow triage/);
  assert.match(a, /ship a slice/);
  assert.match(a, /suggestion only/i);
});

test("completed live call composes an honest suggestion-only envelope", async () => {
  const dryRun = buildPatSatBlackboardDryRun(SEED);
  const liveResult = await liveCompleted();
  assert.equal(liveResult.invocation_status, "completed");
  const env = composeLiveBlackboard({ dryRun, liveResult });

  assert.equal(env.schema, PAT_SAT_BLACKBOARD_LIVE_SCHEMA);
  assert.equal(env.truth_label, "PAT_SAT_BLACKBOARD_LIVE_SUGGESTION_ONLY");
  // Honest: a model DID run.
  assert.equal(env.boundary.model_invocation_performed, true);
  // But the 10 forbidden keys MUST stay false.
  for (const k of LIVE_BLACKBOARD_FORBIDDEN_TRUE_KEYS) {
    assert.equal(env.boundary[k], false, `${k} must be false`);
  }
  // Not autonomous.
  assert.ok(Object.values(env.autonomy).every((v) => v === false));
  assert.equal(env.live_propose.verdict_role, "suggestion");
  assert.match(env.live_propose.suggestion_preview, /Propose: run npm test/);
  assert.equal(verifyLiveBlackboard(env).ok, true);
});

test("no/empty consent → refused, no model invocation, still verifies", async () => {
  const dryRun = buildPatSatBlackboardDryRun(SEED);
  const prompt = buildLiveBlackboardProposePrompt(SEED);
  const refused = await invokeDemaTalkLive({
    provider: PROVIDER, model: MODEL, prompt, consentPhrase: "", fetchImpl: mockFetch,
  });
  assert.equal(refused.invocation_status, "refused");
  const env = composeLiveBlackboard({ dryRun, liveResult: refused });
  assert.equal(env.truth_label, "PAT_SAT_BLACKBOARD_LIVE_REFUSED");
  assert.equal(env.boundary.model_invocation_performed, false);
  assert.ok(env.live_propose.required_consent.includes("invoke local LLM"));
  assert.equal(verifyLiveBlackboard(env).ok, true);
});

test("forgery: a flipped forbidden boundary key is blocked", async () => {
  const env = composeLiveBlackboard({
    dryRun: buildPatSatBlackboardDryRun(SEED),
    liveResult: await liveCompleted(),
  });
  const forged = structuredClone(env);
  forged.boundary.federation_invoked = true;
  const v = verifyLiveBlackboard(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("forbidden_boundary_true:federation_invoked"));
  assert.ok(v.blocked_by.includes("live_hash_mismatch"));
});

test("forgery: tampered suggestion text breaks the body-bound hash", async () => {
  const env = composeLiveBlackboard({
    dryRun: buildPatSatBlackboardDryRun(SEED),
    liveResult: await liveCompleted(),
  });
  const forged = structuredClone(env);
  forged.live_propose.suggestion_preview = "EXECUTED THE PLAN LIVE";
  const v = verifyLiveBlackboard(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("live_hash_mismatch"));
});

test("forgery: claimed autonomy is blocked", async () => {
  const env = composeLiveBlackboard({
    dryRun: buildPatSatBlackboardDryRun(SEED),
    liveResult: await liveCompleted(),
  });
  const forged = structuredClone(env);
  forged.autonomy.autonomous_loop_executed = true;
  const v = verifyLiveBlackboard(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("autonomy_not_all_false"));
});

test("composed envelope is deep-frozen", async () => {
  const env = composeLiveBlackboard({
    dryRun: buildPatSatBlackboardDryRun(SEED),
    liveResult: await liveCompleted(),
  });
  assert.ok(Object.isFrozen(env));
  assert.ok(Object.isFrozen(env.boundary));
  assert.ok(Object.isFrozen(env.autonomy));
  assert.ok(Object.isFrozen(env.live_propose));
});
