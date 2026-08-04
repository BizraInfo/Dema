import test from "node:test";
import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  prepareFirstLightMission,
  executeFirstLightMission,
  resumeFirstLightMission,
} from "../apps/cli/src/commands/first-light.js";
import {
  verifyFirstLightIndex,
  verifyFirstLightReceipt,
  verifyFirstLightProofCard,
} from "../packages/core/src/node0-first-light.js";
import { buildRuntimeEmissionBoundary } from "../packages/core/src/preview-boundary.js";

const QUESTION = "What are PAT and SAT, and how do they work together?";
const NOW = "2026-07-30T08:00:00.000Z";
const EXPIRES = "2026-07-30T08:15:00.000Z";
const CONSENT = "GO: invoke local LLM via ollama at qwen3:4b";

async function makeFixture() {
  const base = await mkdtemp(join(tmpdir(), "first-light-io-"));
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

async function prepare(fixture, overrides = {}) {
  return prepareFirstLightMission({
    root_path: fixture.root,
    question: QUESTION,
    provider: "ollama",
    model: "qwen3:4b",
    nonce: "fixture-nonce-001",
    now_iso: NOW,
    expires_at_iso: EXPIRES,
    dema_home: fixture.demaHome,
    ...overrides,
  });
}

test("prepare discloses metadata without reading content and skips symlinks", async () => {
  const fixture = await makeFixture();
  try {
    await symlink(
      join(fixture.root, "canon", "pat.md"),
      join(fixture.root, "canon", "pat-link.md"),
    );
    await chmod(join(fixture.root, "canon", "pat.md"), 0o000);
    await chmod(join(fixture.root, "canon", "sat.md"), 0o000);

    const prepared = await prepare(fixture);

    assert.equal(prepared.ok, true);
    assert.equal(prepared.scope.file_count, 2);
    assert.equal(prepared.scope.content_read, false);
    assert.deepEqual(prepared.scope.skipped_symlinks, ["canon/pat-link.md"]);
    for (const file of prepared.scope.files) {
      assert.match(file.device_id, /^[0-9]+$/);
      assert.match(file.inode, /^[0-9]+$/);
      assert.match(file.mtime_ns, /^[0-9]+$/);
      assert.match(file.ctime_ns, /^[0-9]+$/);
    }
    assert.equal(prepared.required_phrase, CONSENT);
    assert.equal(prepared.envelope.action_class, "C3_LOCAL_WRITE");
    assert.match(prepared.envelope.root_set_hash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(prepared.dema_home, fixture.demaHome);
  } finally {
    await chmod(join(fixture.root, "canon", "pat.md"), 0o600).catch(() => {});
    await chmod(join(fixture.root, "canon", "sat.md"), 0o600).catch(() => {});
    await fixture.cleanup();
  }
});

test("a symlinked state root is refused before model invocation", async () => {
  const fixture = await makeFixture();
  try {
    const realState = join(fixture.base, "real-state");
    await mkdir(realState);
    await symlink(realState, fixture.demaHome);
    const prepared = await prepare(fixture);
    let modelCalls = 0;
    const result = await executeFirstLightMission({
      prepared,
      presented_phrase: CONSENT,
      now_iso: "2026-07-30T08:01:00.000Z",
      dema_home: fixture.demaHome,
      model_invoker: async () => {
        modelCalls += 1;
        return fakeModelInvoker();
      },
    });

    assert.equal(result.ok, false);
    assert.ok(result.blocked_by.includes("state_root_symlink"));
    assert.equal(modelCalls, 0);
  } finally {
    await fixture.cleanup();
  }
});

test("a same-size source rewrite cannot cross the consent boundary", async () => {
  const fixture = await makeFixture();
  try {
    const prepared = await prepare(fixture);
    const source = join(fixture.root, "canon", "pat.md");
    const before = await stat(source);
    const original = await readFile(source, "utf8");
    const changed = original.replace("Proposal", "Altered!");
    assert.equal(Buffer.byteLength(changed), Buffer.byteLength(original));
    await writeFile(source, changed);
    await utimes(source, before.atime, before.mtime);
    let modelCalls = 0;
    const result = await executeFirstLightMission({
      prepared,
      presented_phrase: CONSENT,
      now_iso: "2026-07-30T08:01:00.000Z",
      dema_home: fixture.demaHome,
      model_invoker: async () => {
        modelCalls += 1;
        return fakeModelInvoker();
      },
    });

    assert.equal(result.ok, false);
    assert.ok(result.blocked_by.includes("root_set_changed_after_consent"));
    assert.equal(modelCalls, 0);
  } finally {
    await fixture.cleanup();
  }
});

test("wrong exact phrase refuses before content read, model call, or local write", async () => {
  const fixture = await makeFixture();
  try {
    const prepared = await prepare(fixture);
    const result = await executeFirstLightMission({
      prepared,
      presented_phrase: "yes",
      now_iso: "2026-07-30T08:01:00.000Z",
      dema_home: fixture.demaHome,
      model_invoker: async () => {
        throw new Error("model must not be called");
      },
    });

    assert.equal(result.ok, false);
    assert.ok(result.blocked_by.includes("phrase_mismatch"));
    await assert.rejects(
      readFile(join(fixture.demaHome, "first-light", "latest.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await fixture.cleanup();
  }
});

test("the disclosed state root cannot be replayed against another DEMA_HOME", async () => {
  const fixture = await makeFixture();
  try {
    const prepared = await prepare(fixture);
    const otherHome = join(fixture.base, "other-home");
    let modelCalls = 0;
    const result = await executeFirstLightMission({
      prepared,
      presented_phrase: CONSENT,
      now_iso: "2026-07-30T08:01:00.000Z",
      dema_home: otherHome,
      model_invoker: async () => {
        modelCalls += 1;
        return fakeModelInvoker();
      },
    });

    assert.equal(result.ok, false);
    assert.ok(result.blocked_by.includes("state_root_context_mismatch"));
    assert.equal(modelCalls, 0);
    await assert.rejects(
      readFile(join(otherHome, "first-light", "latest.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await fixture.cleanup();
  }
});

test("the state root cannot overlap the selected corpus", async () => {
  const fixture = await makeFixture();
  try {
    const prepared = await prepare(fixture, {
      dema_home: join(fixture.root, ".first-light-state"),
    });
    assert.equal(prepared.ok, false);
    assert.ok(prepared.blocked_by.includes("state_root_overlaps_corpus"));
  } finally {
    await fixture.cleanup();
  }
});

test("a changed prepared question is refused before model invocation or write", async () => {
  const fixture = await makeFixture();
  try {
    const prepared = structuredClone(await prepare(fixture));
    prepared.question = `${prepared.question} Include unrelated private details.`;
    let modelCalls = 0;
    const result = await executeFirstLightMission({
      prepared,
      presented_phrase: CONSENT,
      now_iso: "2026-07-30T08:01:00.000Z",
      dema_home: fixture.demaHome,
      model_invoker: async () => {
        modelCalls += 1;
        return fakeModelInvoker();
      },
    });

    assert.equal(result.ok, false);
    assert.ok(result.blocked_by.includes("prepared_context_mismatch"));
    assert.equal(modelCalls, 0);
    await assert.rejects(
      readFile(join(fixture.demaHome, "first-light", "latest.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await fixture.cleanup();
  }
});

test("a changed prepared file set is refused before content read, model, or write", async () => {
  const fixture = await makeFixture();
  try {
    const prepared = structuredClone(await prepare(fixture));
    prepared.scope.files = prepared.scope.files.slice(0, 1);
    prepared.scope.file_count = 1;
    prepared.scope.total_bytes = prepared.scope.files[0].size_bytes;
    let modelCalls = 0;
    const result = await executeFirstLightMission({
      prepared,
      presented_phrase: CONSENT,
      now_iso: "2026-07-30T08:01:00.000Z",
      dema_home: fixture.demaHome,
      model_invoker: async () => {
        modelCalls += 1;
        return fakeModelInvoker();
      },
    });

    assert.equal(result.ok, false);
    assert.ok(result.blocked_by.includes("prepared_scope_hash_mismatch"));
    assert.equal(modelCalls, 0);
    await assert.rejects(
      readFile(join(fixture.demaHome, "first-light", "latest.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await fixture.cleanup();
  }
});

for (const [label, forged, reason] of [
  [
    "remote endpoint",
    { target_endpoint: "https://remote.example/v1" },
    "model_result_endpoint_mismatch",
  ],
  ["wrong provider", { provider: "lmstudio" }, "model_result_provider_mismatch"],
  [
    "unverified consent",
    { consent_phrase_verified: false },
    "model_result_consent_unverified",
  ],
]) {
  test(`forged local-model provenance (${label}) is refused before persistence`, async () => {
    const fixture = await makeFixture();
    try {
      const prepared = await prepare(fixture);
      const result = await executeFirstLightMission({
        prepared,
        presented_phrase: CONSENT,
        now_iso: "2026-07-30T08:01:00.000Z",
        dema_home: fixture.demaHome,
        model_invoker: async () => ({
          ...(await fakeModelInvoker()),
          ...forged,
        }),
      });
      assert.equal(result.ok, false);
      assert.ok(result.blocked_by.includes(reason));
      await assert.rejects(
        readFile(join(fixture.demaHome, "first-light", "latest.json"), "utf8"),
        /ENOENT/,
      );
    } finally {
      await fixture.cleanup();
    }
  });
}

test("exact consent persists index, receipt, Proof Card, and fresh-process verification", async () => {
  const fixture = await makeFixture();
  try {
    const prepared = await prepare(fixture);
    const result = await executeFirstLightMission({
      prepared,
      presented_phrase: CONSENT,
      now_iso: "2026-07-30T08:01:00.000Z",
      dema_home: fixture.demaHome,
      model_invoker: fakeModelInvoker,
    });

    assert.equal(result.ok, true, result.blocked_by?.join(", "));
    assert.equal(verifyFirstLightIndex(result.index).verified, true);
    assert.equal(verifyFirstLightReceipt(result.receipt).verified, true);
    assert.equal(
      verifyFirstLightProofCard({
        card: result.proof_card,
        receipt: result.receipt,
      }).verified,
      true,
    );
    assert.match(result.answer_text, /canon\/pat\.md#L/);
    assert.match(result.answer_text, /canon\/sat\.md#L/);

    const persistedReceipt = JSON.parse(
      await readFile(result.paths.receipt, "utf8"),
    );
    const persistedCard = JSON.parse(
      await readFile(result.paths.proof_card, "utf8"),
    );
    assert.equal(persistedReceipt.receipt_id, result.receipt.receipt_id);
    assert.equal(persistedCard.proof_card_hash, result.proof_card.proof_card_hash);

    const resumed = await resumeFirstLightMission({
      dema_home: fixture.demaHome,
      mission_id: result.mission_id,
    });
    assert.equal(resumed.ok, true, resumed.blocked_by?.join(", "));
    assert.equal(resumed.verification_state, "VERIFIED_LOCAL");
    assert.equal(resumed.receipt.receipt_id, result.receipt.receipt_id);
    assert.equal(resumed.proof_card.proof_card_hash, result.proof_card.proof_card_hash);
    assert.ok(resumed.source_verification.every((source) => source.verified));
  } finally {
    await fixture.cleanup();
  }
});

test("source drift during the model call leaves only provisional state and no latest", async () => {
  const fixture = await makeFixture();
  try {
    const prepared = await prepare(fixture);
    const result = await executeFirstLightMission({
      prepared,
      presented_phrase: CONSENT,
      now_iso: "2026-07-30T08:01:00.000Z",
      dema_home: fixture.demaHome,
      model_invoker: async () => {
        await writeFile(
          join(fixture.root, "canon", "pat.md"),
          "# PAT\nThe cited source changed while the model was answering.\n",
        );
        return fakeModelInvoker();
      },
    });

    assert.equal(result.ok, false);
    assert.ok(result.blocked_by.includes("persisted_verification_failed"));
    const state = JSON.parse(
      await readFile(
        join(
          fixture.demaHome,
          "first-light",
          prepared.mission_id,
          "state.json",
        ),
        "utf8",
      ),
    );
    assert.equal(state.status, "PROVISIONAL");
    await assert.rejects(
      readFile(join(fixture.demaHome, "first-light", "latest.json"), "utf8"),
      /ENOENT/,
    );
    const resumed = await resumeFirstLightMission({
      dema_home: fixture.demaHome,
      mission_id: prepared.mission_id,
    });
    assert.equal(resumed.ok, false);
    assert.ok(resumed.blocked_by.includes("mission_not_complete"));
  } finally {
    await fixture.cleanup();
  }
});

test("a predictable latest symlink cannot overwrite another file", async () => {
  const fixture = await makeFixture();
  try {
    const firstLightRoot = join(fixture.demaHome, "first-light");
    const victim = join(fixture.base, "victim.txt");
    await mkdir(firstLightRoot, { recursive: true });
    await writeFile(victim, "SAFE\n");
    await symlink(victim, join(firstLightRoot, `.latest-${process.pid}.tmp`));
    const prepared = await prepare(fixture);
    const result = await executeFirstLightMission({
      prepared,
      presented_phrase: CONSENT,
      now_iso: "2026-07-30T08:01:00.000Z",
      dema_home: fixture.demaHome,
      model_invoker: fakeModelInvoker,
    });

    assert.equal(result.ok, true, result.blocked_by?.join(", "));
    assert.equal(await readFile(victim, "utf8"), "SAFE\n");
  } finally {
    await fixture.cleanup();
  }
});
