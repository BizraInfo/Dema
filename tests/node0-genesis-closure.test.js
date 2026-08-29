import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { __resetInvocationFreshness } from "../packages/core/src/llm-adapter.js";
import { recoverGenesisMission, runGenesisMission } from "../scripts/node0-genesis-closure.mjs";

test("durable harness carries PAT -> deterministic SAT -> governed Node0 without adding authority", async () => {
  __resetInvocationFreshness();
  const observation = {
    commit: "1".repeat(40),
    tree: "2".repeat(40),
    worktree_state: "CLEAN",
  };
  const proposal = {
    kind: "plan_proposed",
    stage: "PLAN",
    hash: "sha256:pat",
    output: {
      ...observation,
      explanation: "The exact checkout is clean and bound to one commit and tree.",
    },
  };
  const modelFetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    json: async () => ({ response: JSON.stringify(proposal), done: true }),
  });
  let posted;
  const gatewayFetch = async (url, init) => {
    posted = { url, body: JSON.parse(init.body) };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        schema: "bizra.node0.genesis_execution.v0.1",
        status: "COMMITTED",
        truthStatus: "MEASURED_LOCAL_GENESIS_LIVENESS",
        effectCount: 1,
        duplicateEffects: 0,
        authorityDelta: 0,
      }),
    };
  };

  const result = await runGenesisMission({
    missionKind: "checkout_identity",
    observation,
    demaRepo: "/tmp/dema-test",
    leaseSha256: "a".repeat(64),
    modelId: "qwen2.5:7b",
    modelFetch,
    gatewayFetch,
  });
  assert.equal(result.ok, true);
  assert.equal(result.pat.status, "PROPOSAL_ACCEPTED");
  assert.equal(result.sat.verdict, "ACCEPT");
  assert.equal(result.runtime.body.status, "COMMITTED");
  assert.equal(result.authority_delta, 0);
  assert.equal(posted.url, "http://127.0.0.1:7421/genesis/execute");
  assert.deepEqual(posted.body.result, proposal.output);
});

test("Dema checkpoint replays the exact governed request without invoking PAT again", async () => {
  __resetInvocationFreshness();
  const root = await mkdtemp(join(tmpdir(), "dema-genesis-client-"));
  const checkpointPath = join(root, "mission.json");
  let modelCalls = 0;
  let posted;
  const gatewayFetch = async (_url, init) => {
    posted = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: "COMMITTED", recovered: modelCalls === 0, effectCount: 1, duplicateEffects: 0 }),
    };
  };
  try {
    const first = await runGenesisMission({
      missionKind: "checkout_identity",
      observation: { commit: "1".repeat(40), tree: "2".repeat(40), worktree_state: "CLEAN" },
      demaRepo: "/tmp/dema-test",
      leaseSha256: "a".repeat(64),
      modelId: "qwen2.5:7b",
      checkpointPath,
      modelFetch: async () => {
        modelCalls += 1;
        return {
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          json: async () => ({ response: JSON.stringify({
            kind: "plan_proposed",
            stage: "PLAN",
            hash: "sha256:pat",
            output: {
              commit: "1".repeat(40),
              tree: "2".repeat(40),
              worktree_state: "CLEAN",
              explanation: "The checkout identity is bounded by exact Git facts.",
            },
          }), done: true }),
        };
      },
      gatewayFetch,
    });
    assert.equal(first.ok, true);
    const exactRequest = JSON.parse(await readFile(checkpointPath, "utf8")).request;
    modelCalls = 0;
    const recovered = await recoverGenesisMission({ checkpointPath, gatewayFetch });
    assert.equal(recovered.ok, true);
    assert.equal(modelCalls, 0);
    assert.deepEqual(posted, exactRequest);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
