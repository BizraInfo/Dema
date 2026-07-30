import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  prepareFirstLightMission,
  executeFirstLightMission,
  resumeFirstLightMission,
} from "../apps/cli/src/commands/first-light.js";
import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";
import { buildRuntimeEmissionBoundary } from "../packages/core/src/preview-boundary.js";

const QUESTION = "What are PAT and SAT, and how do they work together?";
const CONSENT = "GO: invoke local LLM via ollama at qwen3:4b";
const NOW = "2026-07-30T08:00:00.000Z";
const EXPIRES = "2026-07-30T08:15:00.000Z";

async function makeFixture() {
  const base = await mkdtemp(join(tmpdir(), "first-light-restart-"));
  const root = join(base, "research");
  const demaHome = join(base, "dema-home");
  await mkdir(join(root, "canon"), { recursive: true });
  await writeFile(
    join(root, "canon", "pat.md"),
    "# PAT\nPAT is the Proposal Agent Team.\nPAT proposes bounded work with evidence.\n",
  );
  await writeFile(
    join(root, "canon", "sat.md"),
    "# SAT\nSAT is the Safeguard Agent Team.\nSAT independently verifies and may permit or refuse.\n",
  );
  return {
    base,
    root,
    demaHome,
    cleanup: () => rm(base, { recursive: true, force: true }),
  };
}

function fakeModelInvoker() {
  return Promise.resolve({
    schema: "bizra.dema.talk_loop_live_result.v0.1",
    truth_label: "MEASURED",
    invocation_status: "completed",
    provider: "ollama",
    model: "qwen3:4b",
    target_endpoint: "http://localhost:11434",
    required_consent: CONSENT,
    consent_phrase_verified: true,
    prompt_safety_verdict: "LOCAL_TALK_OK",
    response_safety_verdict: "LOCAL_TALK_OK",
    verdict_role: "suggestion",
    boundary: buildRuntimeEmissionBoundary({
      network_used: true,
      runtime_execution_performed: true,
      model_loaded: true,
      model_invocation_performed: true,
      prompt_executed: true,
      consent_collected: true,
    }),
    response_text:
      "PAT proposes bounded work with evidence [S1]. SAT independently verifies and may permit or refuse [S2].",
  });
}

async function complete(fixture) {
  const prepared = await prepareFirstLightMission({
    root_path: fixture.root,
    question: QUESTION,
    provider: "ollama",
    model: "qwen3:4b",
    nonce: "restart-nonce-001",
    now_iso: NOW,
    expires_at_iso: EXPIRES,
    dema_home: fixture.demaHome,
  });
  return executeFirstLightMission({
    prepared,
    presented_phrase: CONSENT,
    now_iso: "2026-07-30T08:01:00.000Z",
    dema_home: fixture.demaHome,
    model_invoker: fakeModelInvoker,
  });
}

test("restart verification fails closed after a cited source changes", async () => {
  const fixture = await makeFixture();
  try {
    const result = await complete(fixture);
    assert.equal(result.ok, true);
    await writeFile(
      join(fixture.root, "canon", "pat.md"),
      "# PAT\nThis source changed after the receipt.\n",
    );
    const resumed = await resumeFirstLightMission({
      dema_home: fixture.demaHome,
      mission_id: result.mission_id,
    });
    assert.equal(resumed.ok, false);
    assert.ok(
      resumed.blocked_by.some((reason) =>
        reason.startsWith("source_identity_mismatch:canon/pat.md"),
      ),
    );
  } finally {
    await fixture.cleanup();
  }
});

test("restart rejects a valid index detached from the persisted receipt", async () => {
  const fixture = await makeFixture();
  try {
    const result = await complete(fixture);
    assert.equal(result.ok, true);
    const index = JSON.parse(await readFile(result.paths.index, "utf8"));
    const state = JSON.parse(await readFile(result.paths.state, "utf8"));
    const { index_hash: _oldHash, ...indexBody } = index;
    indexBody.files[0].token_count += 1;
    const detachedIndex = {
      ...indexBody,
      index_hash: sha256CanonicalJsonV1(indexBody),
    };
    state.index_hash = detachedIndex.index_hash;
    await writeFile(result.paths.index, `${JSON.stringify(detachedIndex)}\n`);
    await writeFile(result.paths.state, `${JSON.stringify(state)}\n`);
    const resumed = await resumeFirstLightMission({
      dema_home: fixture.demaHome,
      mission_id: result.mission_id,
    });
    assert.equal(resumed.ok, false);
    assert.ok(resumed.blocked_by.includes("receipt_index_mismatch"));
  } finally {
    await fixture.cleanup();
  }
});

test("restart rejects consent-record drift even when the receipt is unchanged", async () => {
  const fixture = await makeFixture();
  try {
    const result = await complete(fixture);
    assert.equal(result.ok, true);
    const scopePath = join(result.paths.mission, "scope.json");
    const scopeRecord = JSON.parse(await readFile(scopePath, "utf8"));
    scopeRecord.consent.consent_context_hash = `sha256:${"f".repeat(64)}`;
    await writeFile(scopePath, `${JSON.stringify(scopeRecord)}\n`);
    const resumed = await resumeFirstLightMission({
      dema_home: fixture.demaHome,
      mission_id: result.mission_id,
    });
    assert.equal(resumed.ok, false);
    assert.ok(resumed.blocked_by.includes("scope_consent_mismatch"));
  } finally {
    await fixture.cleanup();
  }
});

test("implicit restart rejects a latest pointer detached from its receipt", async () => {
  const fixture = await makeFixture();
  try {
    const result = await complete(fixture);
    assert.equal(result.ok, true);
    const latestPath = join(fixture.demaHome, "first-light", "latest.json");
    const latest = JSON.parse(await readFile(latestPath, "utf8"));
    latest.receipt_id = `sha256:${"a".repeat(64)}`;
    await writeFile(latestPath, `${JSON.stringify(latest)}\n`);
    const resumed = await resumeFirstLightMission({
      dema_home: fixture.demaHome,
    });
    assert.equal(resumed.ok, false);
    assert.ok(resumed.blocked_by.includes("latest_receipt_mismatch"));
  } finally {
    await fixture.cleanup();
  }
});
