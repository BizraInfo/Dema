import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const nodeMajor = Number.parseInt(process.versions.node, 10);
const founderModule = nodeMajor >= 22
  ? await import("../packages/core/src/founder-useful-system.js")
  : null;
const {
  groundPatOutput,
  projectSituationForCommitment,
  readFounderSituation,
  renderFounderNow,
  resumeFounderEffect,
  runFounderMission,
  runFounderEffect,
  SITUATION_COMMITMENT_SCHEMA,
  situationCommitment,
  synthesizeGroundedPatProposals,
} = founderModule ?? {};

// Node 20 is a supported root-test runtime but cannot load this cross-package
// TypeScript dependency graph without a loader. Node 22 runs this suite;
// the UI package's native test surface covers its validators independently.
let validateSituationState;
if (founderModule) {
  ({ validateSituationState } = await import("../packages/dema-ui/src/lib/situation/situation-state.ts"));
}

const founderTest = (name, fn) => test(name, {
  skip: founderModule ? false : "requires Node 22 for the UI TypeScript dependency graph",
}, fn);

founderTest("Situation commitment ignores read timestamps but changes with semantics", () => {
  const base = { schema: "s", observation: { observedAt: "2026-01-01T00:00:00.000Z", status: "CURRENT" }, mission: { state: "OPEN" } };
  assert.equal(situationCommitment(base), situationCommitment({ ...base, observation: { ...base.observation, observedAt: "2026-01-01T00:01:00.000Z" } }));
  assert.notEqual(situationCommitment(base), situationCommitment({ ...base, mission: { state: "CLOSED" } }));
});

function situationFixture() {
  const freshness = { observedAt: "2026-01-01T00:00:00.000Z", validUntil: "2026-01-01T00:05:00.000Z", status: "CURRENT", source: "fixture" };
  return {
    schema: "envelope",
    situation: {
      schema: "bizra.dema.situation_state.v0.1",
      renderedAt: "2026-01-01T00:00:00.000Z",
      observation: freshness,
      mission: { missionId: "m-1", currentState: "OPEN", truth: "OBSERVED", freshness },
      frontier: { frontierId: "f-1", status: "OPEN", truth: "OBSERVED", freshness },
      authority: { current: { status: "BOUNDED", leaseId: "lease-1", freshness }, predictedAuthorityDelta: { status: "UNKNOWN", value: null, scope: "none" }, actualAuthorityDelta: { status: "NONE", value: 0, scope: "fixture" } },
      actors: [{ actorId: "pat-scout", kind: "PAT", reality: { existence: "DECLARED", availability: "UNKNOWN", activity: "IDLE", evidenceState: "UNOBSERVED" }, observation: freshness, evidenceRefs: [] }],
      resources: {
        "system.memory": { value: { totalGB: 128, freeGB: 90, usedGB: 38, usedPct: 29 }, freshness },
        "system.load": { value: { "1m": 0.1, "5m": 0.2, "15m": 0.3 }, freshness },
        "node.gpu": { value: { name: "fixture-gpu", memTotalMB: 16000, memUsedMB: 3000, utilPct: 4 }, freshness },
        "node.models": { value: [{ name: "b", size: "2 GB" }, { name: "a", size: "1 GB" }], freshness },
      },
      evidence: { receipts: [{ receiptId: "r-1", truth: "MEASURED", hash: "sha256:r1", freshness }], proofCeiling: ["fixture"], notEstablished: [], bindings: [], observations: [], claims: [], provenance: [] },
    },
  };
}

founderTest("canonical Situation commitment is live on semantics, not read churn", () => {
  assert.equal(SITUATION_COMMITMENT_SCHEMA, "bizra.dema.situation_commitment.v0.2");
  const base = situationFixture();
  const readAgain = structuredClone(base);
  readAgain.situation.observation.observedAt = "2026-01-01T00:01:00.000Z";
  readAgain.situation.observation.validUntil = "2026-01-01T00:06:00.000Z";
  readAgain.situation.renderedAt = "2026-01-01T00:01:00.000Z";
  readAgain.situation.resources["system.memory"].value.freeGB = 80;
  readAgain.situation.resources["system.memory"].value.usedGB = 48;
  readAgain.situation.resources["system.memory"].value.usedPct = 38;
  readAgain.situation.resources["system.load"].value["1m"] = 4;
  readAgain.situation.resources["node.gpu"].value.memUsedMB = 9000;
  readAgain.situation.resources["node.gpu"].value.utilPct = 80;
  readAgain.situation.resources["node.models"].value.reverse();
  assert.equal(situationCommitment(base), situationCommitment(readAgain));
  assert.deepEqual(projectSituationForCommitment(base).situation.resources["node.models"].value, [
    { name: "a", size: "1 GB" },
    { name: "b", size: "2 GB" },
  ]);

  for (const [label, mutate] of [
    ["mission", (value) => { value.situation.mission.currentState = "CLOSED"; }],
    ["frontier", (value) => { value.situation.frontier.status = "BLOCKED"; }],
    ["authority", (value) => { value.situation.authority.current.status = "EXPIRED"; }],
    ["PAT", (value) => { value.situation.actors[0].reality.availability = "AVAILABLE"; }],
    ["evidence", (value) => { value.situation.evidence.receipts[0].hash = "sha256:r2"; }],
  ]) {
    const changed = structuredClone(base);
    mutate(changed);
    assert.notEqual(situationCommitment(base), situationCommitment(changed), `${label} change must invalidate commitment`);
  }
  const authorityExpired = structuredClone(base);
  authorityExpired.situation.authority.current.freshness.status = "STALE";
  assert.notEqual(situationCommitment(base), situationCommitment(authorityExpired));
  const keyOrderChanged = structuredClone(base);
  keyOrderChanged.situation.mission = { currentState: "OPEN", truth: "OBSERVED", missionId: "m-1", freshness: base.situation.mission.freshness };
  assert.equal(situationCommitment(base), situationCommitment(keyOrderChanged));
  if (validateSituationState) {
    assert.equal(validateSituationState(null).ok, false);
    assert.equal(validateSituationState({ schema: "bizra.dema.situation_state.v0.1", mission: null }).ok, false);
  }
});

founderTest("five no-mutation canonical reads converge on one commitment", () => {
  const commitments = Array.from({ length: 5 }, () => readFounderSituation().commitment);
  assert.equal(new Set(commitments).size, 1, commitments.join("\n"));
});

founderTest("isolated candidate mission and authority projections render both founder views", () => {
  const root = mkdtempSync(path.join(tmpdir(), "dema-founder-situation-"));
  const previous = {
    closure: process.env.DEMA_FOUNDER_CLOSURE,
    sandbox: process.env.DEMA_FOUNDER_SANDBOX,
    runtime: process.env.DEMA_RUNTIME_MISSION_ROOT,
  };
  process.env.DEMA_FOUNDER_CLOSURE = "1";
  process.env.DEMA_FOUNDER_SANDBOX = root;
  delete process.env.DEMA_RUNTIME_MISSION_ROOT;
  try {
    const mission = runFounderMission({ missionId: "founder-situation-test" });
    writeFileSync(path.join(root, "authority.json"), `${JSON.stringify({
      authority_delta: 0,
      lease_id: "founder-situation-lease",
      scope: ["candidate_sandbox_effect"],
      permissions: ["candidate_local_model_calls"],
      forbidden: ["network", "production_mutation"],
      observed_at: mission.updated_at,
    })}\n`, "utf8");

    const envelope = readFounderSituation();
    assert.equal(envelope.situation.mission.missionId, "founder-situation-test");
    assert.equal(envelope.situation.mission.truth, "OBSERVED");
    assert.equal(envelope.situation.authority.current.leaseId, "founder-situation-lease");
    assert.equal(envelope.situation.authority.current.status, "BOUNDED");

    const json = JSON.parse(renderFounderNow({ json: true }));
    assert.equal(json.state_commitment, json.commitment);
    assert.match(renderFounderNow({ json: false }), /PAT TEAM/);
  } finally {
    if (previous.closure === undefined) delete process.env.DEMA_FOUNDER_CLOSURE; else process.env.DEMA_FOUNDER_CLOSURE = previous.closure;
    if (previous.sandbox === undefined) delete process.env.DEMA_FOUNDER_SANDBOX; else process.env.DEMA_FOUNDER_SANDBOX = previous.sandbox;
    if (previous.runtime === undefined) delete process.env.DEMA_RUNTIME_MISSION_ROOT; else process.env.DEMA_RUNTIME_MISSION_ROOT = previous.runtime;
  }
});

founderTest("founder situation stays truthful when runtime probes are unavailable", () => {
  const root = mkdtempSync(path.join(tmpdir(), "dema-founder-probes-"));
  const previousPath = process.env.PATH;
  try {
    process.env.PATH = root;
    const missing = readFounderSituation();
    assert.equal(missing.situation.resources["node0_boundary.daemon_started"].truth, "UNKNOWN");
    assert.equal(missing.situation.resources["node0_boundary.daemon_started"].reason, "command_not_found");
    assert.equal(missing.situation.resources["node.models"].truth, "OFFLINE");

    const failingDema = path.join(root, "dema");
    writeFileSync(failingDema, "#!/bin/sh\nexit 1\n", "utf8");
    chmodSync(failingDema, 0o755);
    const nonzero = readFounderSituation();
    assert.equal(nonzero.situation.resources["node0_boundary.daemon_started"].reason, "command_nonzero_exit");
  } finally {
    if (previousPath === undefined) delete process.env.PATH; else process.env.PATH = previousPath;
  }
});

founderTest("candidate FATE effect commits once and resume is idempotent", () => {
  const root = mkdtempSync(path.join(tmpdir(), "dema-founder-effect-"));
  const previous = { campaign: process.env.DEMA_FOUNDER_CAMPAIGN_ROOT, sandbox: process.env.DEMA_FOUNDER_SANDBOX };
  process.env.DEMA_FOUNDER_SANDBOX = root;
  try {
    const first = runFounderEffect({ name: "test" });
    assert.equal(first.fate.phase, "COMMITTED");
    assert.equal(first.verified.ok, true);
    assert.equal(first.fate.envelope.effect_execution_count, 1);
    const replay = resumeFounderEffect({ name: "test" });
    assert.equal(replay.idempotent, true);
    assert.equal(replay.effect_execution_count, 1);
    assert.match(readFileSync(path.join(root, "effects", "test", "test.after.txt"), "utf8"), /candidate bounded effect/);
  } finally {
    if (previous.campaign === undefined) delete process.env.DEMA_FOUNDER_CAMPAIGN_ROOT; else process.env.DEMA_FOUNDER_CAMPAIGN_ROOT = previous.campaign;
    if (previous.sandbox === undefined) delete process.env.DEMA_FOUNDER_SANDBOX; else process.env.DEMA_FOUNDER_SANDBOX = previous.sandbox;
  }
});

founderTest("candidate effect replay stays idempotent across process restart", () => {
  const root = mkdtempSync(path.join(tmpdir(), "dema-founder-restart-"));
  const modulePath = path.resolve("packages/core/src/founder-useful-system.js");
  const env = { ...process.env, DEMA_FOUNDER_SANDBOX: root };
  const run = execFileSync(process.execPath, ["--input-type=module", "-e", `
    import { runFounderEffect } from ${JSON.stringify(modulePath)};
    console.log(JSON.stringify(runFounderEffect({ name: "restart" })));
  `], { env, encoding: "utf8" });
  const replay = execFileSync(process.execPath, ["--input-type=module", "-e", `
    import { resumeFounderEffect } from ${JSON.stringify(modulePath)};
    console.log(JSON.stringify(resumeFounderEffect({ name: "restart" })));
  `], { env, encoding: "utf8" });
  const first = JSON.parse(run.trim().split("\n").at(-1));
  const second = JSON.parse(replay.trim().split("\n").at(-1));
  assert.equal(first.fate.envelope.effect_execution_count, 1);
  assert.equal(second.idempotent, true);
  assert.equal(second.effect_execution_count, 1);
});

founderTest("PAT grounding admits mission-shaped proposals and quarantines unrelated entities", () => {
  const admitted = groundPatOutput({
    role: "Scout",
    missionId: "founder-useful-local-closure",
    text: "FINDING: DEMA founder-useful-local-closure has one bounded seam.\nUNCERTAINTY: evidence is incomplete.\nNEXT: inspect the receipt.\nEVIDENCE: mission:founder-useful-local-closure",
  });
  assert.equal(admitted.verdict, "ADMITTED_PROPOSAL");
  assert.deepEqual(admitted.groundedRefs, ["mission:founder-useful-local-closure"]);
  const quarantined = groundPatOutput({
    role: "Scribe",
    missionId: "founder-useful-local-closure",
    text: "FINDING: John Smith founded Demaroot Foundation.\nUNCERTAINTY: unknown.\nNEXT: research it.\nEVIDENCE: mission:founder-useful-local-closure",
  });
  assert.equal(quarantined.verdict, "QUARANTINED_PROPOSAL");
  assert.equal(quarantined.unsupportedEntityDetected, true);
});

founderTest("PAT grounding quarantines a plausible claim without a permitted evidence reference", () => {
  const result = groundPatOutput({
    role: "Engineer",
    missionId: "founder-useful-local-closure",
    text: "FINDING: DEMA founder-useful-local-closure should inspect the candidate.\nUNCERTAINTY: medium.\nNEXT: compare the receipt.",
  });
  assert.equal(result.verdict, "QUARANTINED_PROPOSAL");
  assert.equal(result.reason, "permitted_evidence_ref_missing");
});

founderTest("PAT synthesis preserves only admitted evidence references", () => {
  const text = synthesizeGroundedPatProposals([
    { evidenceRef: "pat:Scout:invocation", grounding: { groundedRefs: ["mission:founder-useful-local-closure"] } },
    { evidenceRef: "pat:Engineer:invocation", grounding: { groundedRefs: ["mission:founder-useful-local-closure"] } },
  ]);
  assert.match(text, /2 mission-grounded proposals/);
  assert.equal((text.match(/mission:founder-useful-local-closure/g) ?? []).length, 2);
  assert.match(text, /pat:Scout:invocation/);
  assert.match(text, /pat:Engineer:invocation/);
});

founderTest("PAT grounding and synthesis fail closed when identity or evidence is absent", () => {
  const empty = groundPatOutput({ role: "Scribe", missionId: "founder-useful-local-closure", text: "" });
  assert.equal(empty.verdict, "QUARANTINED_PROPOSAL");
  assert.equal(empty.reason, "permitted_evidence_ref_missing");
  assert.deepEqual(empty.groundedRefs, []);

  const unrelated = groundPatOutput({
    role: "Scribe",
    missionId: "founder-useful-local-closure",
    permittedEvidenceRefs: ["receipt:source"],
    text: "FINDING: the bounded task has a candidate result.\nUNCERTAINTY: evidence is incomplete.\nNEXT: inspect the source.\nEVIDENCE: receipt:source",
  });
  assert.equal(unrelated.verdict, "QUARANTINED_PROPOSAL");
  assert.equal(unrelated.reason, "mission_grounding_failed");
  assert.deepEqual(unrelated.groundedRefs, ["receipt:source"]);

  assert.match(synthesizeGroundedPatProposals([]), /no mission-grounded PAT claims admitted/);
});
