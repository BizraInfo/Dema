// PRE-R0-COMPOSITION-1A — PRC-01…PRC-07.
//
// TWO GREEN BRANCHES ARE NOT ONE ORGANISM. R0 binds one exact tree, so the
// question this suite answers is not "are both feature sets present" but "do
// their invariants still hold *together*". A merge can introduce a semantic
// conflict without producing a git conflict: the harness branch edits a module
// the repair branch now depends on, both suites pass in isolation, and the
// composed tree grows an authority path neither slice ever had.
//
//     VALID REPAIR BRANCH + VALID HARNESS BRANCH != VALID COMPOSED NODE
//
// The composed invariants, proven simultaneously in ONE process against the
// merged tree:
//
//   provider harness state grants no Dema authority   (harness line)
//   actor metadata grants no execution authority      (repair line)
//   a transition artifact cannot satisfy an observation phase, and an
//   observation cannot satisfy a transition phase     (repair line)
//   history cannot be stitched across two executions  (composition-specific)
//
// PRC-05 is the PROOF-TYPE LOCK. It is composition-specific because the two
// artifact classes only became distinguishable once the causal-provenance slice
// landed, and nothing before this suite asserted the graph ALTERNATES rather
// than merely having six named phases.
//
// PRC-07 is the counterfactual: the preserved Attempt-1 authority shape, run
// against the integrated constitution, must be refused BEFORE any effect. That
// is what turns "an auditor found what the runtime missed" into "the repaired
// constitution rejects the preserved defect shape" — executable immunity
// against one exact prior pathogen, not a claim of autonomous detection.

import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildMissionEffectCapsule,
  nextCapsulePhase,
  buildDisclosedStewardPreview,
  CAPSULE_PHASE_GRAPH,
} from "../packages/core/src/dema-reversible-file-steward.js";
import { buildDemaReversibleFileStewardPayload } from "../packages/core/src/dema-reversible-file-steward.js";
import {
  planReversibleRename,
  executeReversibleRename,
  undoReversibleRename,
  sealStateObservation,
  NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
  NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
} from "../packages/core/src/node0-reversible-execute-gate.js";
import {
  buildMissionEffectAuthorityEnvelope,
  executeMissionBoundEffect,
} from "../packages/mission/src/mission-effect-authority-binding.js";
import { buildHarnessHookInventory } from "../packages/core/src/harness-integration.js";

const NOW = "2026-08-13T19:00:00Z";
const FROM = "a.json";
const TO = "a-2026-08-12.json";
const BODY = "governed state\n";

const roots = [];
function sandbox() {
  const root = mkdtempSync(join(tmpdir(), "prc-"));
  roots.push(root);
  writeFileSync(join(root, FROM), BODY);
  return root;
}
test.after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

const capsuleFor = (root, over = {}) => {
  const built = buildMissionEffectCapsule({
    effect: { sandbox_root: root, atoms: [{ from: FROM, to: TO }] },
    mission_id: "genesis-mission-001",
    contract_hash: `sha256:${"c".repeat(64)}`,
    purpose_id: "normalize-to-dated-convention",
    repository_commit: "1".repeat(40),
    repository_tree: "2".repeat(40),
    nonce: over.nonce ?? "gm001-prc-0000000000000001",
    expires_at: "2026-08-14T19:00:00Z",
  });
  assert.equal(built.ok, true, built.reason);
  return built.capsule;
};

const applyPhase = (root, capsule, phase) =>
  executeReversibleRename({
    plan: planReversibleRename({
      sandboxRoot: root,
      fileName: FROM,
      newName: TO,
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
      actionId: capsule.action_id,
      phase,
    }),
    fs,
    now: NOW,
  });

const seal = (root, capsule, phase) =>
  sealStateObservation({
    sandboxRoot: root,
    actionId: capsule.action_id,
    phase,
    names: [FROM, TO],
    fs,
    now: NOW,
  }).observation;

/** A real, fully proven chain through restoration — the composition's positive control. */
function realChain() {
  const root = sandbox();
  const capsule = capsuleFor(root);
  const p1 = applyPhase(root, capsule, CAPSULE_PHASE_GRAPH[0]);
  assert.equal(p1.executed, true, `p1 blocked: ${p1.blocked_by}`);
  const o2 = seal(root, capsule, CAPSULE_PHASE_GRAPH[1]);
  const u3 = undoReversibleRename({ receipt: p1, fs, actionId: capsule.action_id });
  assert.equal(u3.proven, true, `undo not proven: ${u3.reason}`);
  const o4 = seal(root, capsule, CAPSULE_PHASE_GRAPH[3]);
  const evidence = [
    { phase: CAPSULE_PHASE_GRAPH[0], receipt: p1 },
    { phase: CAPSULE_PHASE_GRAPH[1], observation: o2 },
    { phase: CAPSULE_PHASE_GRAPH[2], receipt: u3.receipt },
    { phase: CAPSULE_PHASE_GRAPH[3], observation: o4 },
  ];
  return { root, capsule, evidence, p1, u3, o2, o4 };
}

// ── PRC-01 · both invariant families hold in ONE process ────────────────────
test("PRC-01: the composed tree keeps the harness boundary AND the effect authority law", () => {
  // Harness line: provider hook state is declared harness-plane and disclaims
  // Dema liveness. If the merge reintroduced `wired`, this is where it shows.
  const inv = buildHarnessHookInventory();
  assert.ok(inv.length > 0, "control: the inventory must be non-empty");
  for (const hook of inv) {
    assert.equal(hook.plane, "harness");
    assert.equal(hook.measured, false);
    assert.equal(hook.dema_liveness_evidence, false);
    assert.equal(Object.prototype.hasOwnProperty.call(hook, "wired"), false);
  }

  // Repair line: the disclosing preview is what the binding re-derives, so a
  // mission previewed the undisclosed way still has no execution path.
  const effect = { sandbox_root: "/tmp/x", atoms: [{ from: FROM, to: TO }] };
  assert.notEqual(
    buildDisclosedStewardPreview(effect).content_hash,
    buildDemaReversibleFileStewardPayload(effect).content_hash,
    "disclosure stopped moving the preview hash — CR-01 regressed in the merge",
  );
});

// ── PRC-02 · no provider state reaches Dema authority in the merged tree ────
test("PRC-02: no packages/*/src module names provider state, after composition", () => {
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const repo = new URL("..", import.meta.url).pathname;
  let scanned = 0;
  const offenders = [];
  for (const pkg of fs.readdirSync(join(repo, "packages"))) {
    const dir = join(repo, "packages", pkg, "src");
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".js")) continue;
      scanned += 1;
      const src = stripComments(readFileSync(join(dir, f), "utf8"));
      for (const m of src.matchAll(/["'`]([^"'`]*\.(?:claude|codex)\/[^"'`]*)["'`]/g)) {
        offenders.push(`packages/${pkg}/src/${f}: ${m[1]}`);
      }
    }
  }
  assert.ok(scanned > 100, `control: expected the real tree, scanned ${scanned}`);
  assert.deepEqual(offenders, []);
});

// ── PRC-03 · actor metadata still grants nothing through the composed path ──
test("PRC-03: actor-like caller metadata cannot execute in the composed tree", async () => {
  const { root, capsule, evidence } = realChain();
  assert.equal(nextCapsulePhase(capsule, evidence, fs).phase, CAPSULE_PHASE_GRAPH[4]);

  // The mission authority seam, driven with a maximally compliant "actor".
  const calls = [];
  const r = await executeMissionBoundEffect({
    envelope: null,
    effect: { sandbox_root: root, atoms: [{ from: FROM, to: TO }] },
    spineResult: null,
    corridorContext: null,
    repositoryBinding: null,
    now: NOW,
    actor: { verdict: "APPROVE", authorized: true, confidence: 0.999 },
    claimNonce: async () => {
      calls.push("nonce");
      return { claimed: true };
    },
    executeJob: async () => {
      calls.push("execute");
      return { ok: true };
    },
  });
  assert.equal(r.ok, false);
  assert.deepEqual(calls, [], "an actor's approval reached the ledger or executor");
});

// ── PRC-04 · history cannot be stitched across two executions ───────────────
test("PRC-04: an undo of a DIFFERENT apply in the same capsule cannot serve as p3", () => {
  const a = realChain();
  // Isolation matters here. A receipt from another capsule would be rejected on
  // `action_id` and the test would pass without ever reaching the chain bind —
  // measured: that is exactly why the first version of this test survived a
  // mutation that deleted the bind. So the decoy is an undo of the SAME
  // capsule's p5 apply: same action_id, right schema, sound integrity, genuinely
  // sealed. Only `of_receipt_hash === provisional.content_hash` can refuse it.
  const p5 = applyPhase(a.root, a.capsule, CAPSULE_PHASE_GRAPH[4]);
  assert.equal(p5.executed, true, `p5 blocked: ${p5.blocked_by}`);
  const u5 = undoReversibleRename({ receipt: p5, fs, actionId: a.capsule.action_id });
  assert.equal(u5.proven, true, `control: the decoy undo must be real (${u5.reason})`);
  assert.equal(u5.receipt.action_id, a.p1.action_id, "control: action ids must match, or this proves nothing");
  assert.notEqual(u5.receipt.of_receipt_hash, a.p1.content_hash, "control: it must reverse a DIFFERENT apply");

  const stitched = [
    { phase: CAPSULE_PHASE_GRAPH[0], receipt: a.p1 },
    { phase: CAPSULE_PHASE_GRAPH[1], observation: a.o2 },
    { phase: CAPSULE_PHASE_GRAPH[2], receipt: u5.receipt },
  ];
  const r = nextCapsulePhase(a.capsule, stitched, fs);
  assert.equal(r.verified_completed.includes(CAPSULE_PHASE_GRAPH[2]), false, "stitched history composed");
  assert.equal(r.phase, CAPSULE_PHASE_GRAPH[2]);
});

// ── PRC-04b · integrity, not membership ─────────────────────────────────────
test("PRC-04b: an edited artifact that keeps its sealed content hash is refused", () => {
  const a = realChain();
  // THE ACTUAL ATTACK, and the isolation the first version missed: take a real
  // sealed undo of a DIFFERENT apply and rewrite its chain field to the value
  // p3 demands, keeping the original content hash. Every other check then
  // passes — schema, action_id, `proven`, chain bind, and log membership, since
  // `sealedLogContains` matches the content-hash STRING. Only re-derivation refuses.
  const p5 = applyPhase(a.root, a.capsule, CAPSULE_PHASE_GRAPH[4]);
  const u5 = undoReversibleRename({ receipt: p5, fs, actionId: a.capsule.action_id });
  assert.equal(u5.proven, true, "control: the borrowed undo must be real");
  const rewritten = { ...u5.receipt, of_receipt_hash: a.p1.content_hash };
  assert.equal(rewritten.content_hash, u5.receipt.content_hash, "control: the sealed hash is unchanged");
  assert.notEqual(u5.receipt.of_receipt_hash, a.p1.content_hash, "control: the field really was forged");
  const r = nextCapsulePhase(
    a.capsule,
    [
      { phase: CAPSULE_PHASE_GRAPH[0], receipt: a.p1 },
      { phase: CAPSULE_PHASE_GRAPH[1], observation: a.o2 },
      { phase: CAPSULE_PHASE_GRAPH[2], receipt: rewritten },
    ],
    fs,
  );
  assert.equal(r.verified_completed.includes(CAPSULE_PHASE_GRAPH[2]), false);
});

// ── PRC-04c · the same attack against an OBSERVATION ────────────────────────
test("PRC-04c: an observation re-labelled to a later phase is refused", () => {
  const a = realChain();
  // The symmetric forgery: the p2 observation genuinely saw the world in S1.
  // Re-label it p4 and rewrite what it "observed" to the restored shape, keeping
  // the sealed content hash. Phase, action id, expectation and log membership all
  // then pass. Only re-derivation refuses — added because a mutation control
  // showed this guard was carrying no test at all.
  const forged = {
    ...a.o2,
    phase: CAPSULE_PHASE_GRAPH[3],
    observed: { [FROM]: a.p1.before_hash, [TO]: null },
  };
  assert.equal(forged.content_hash, a.o2.content_hash, "control: the sealed hash is unchanged");
  assert.notDeepEqual(a.o2.observed, forged.observed, "control: the claim really was rewritten");

  const r = nextCapsulePhase(
    a.capsule,
    [
      { phase: CAPSULE_PHASE_GRAPH[0], receipt: a.p1 },
      { phase: CAPSULE_PHASE_GRAPH[1], observation: a.o2 },
      { phase: CAPSULE_PHASE_GRAPH[2], receipt: a.u3.receipt },
      { phase: CAPSULE_PHASE_GRAPH[3], observation: forged },
    ],
    fs,
  );
  assert.equal(r.verified_completed.includes(CAPSULE_PHASE_GRAPH[3]), false);
  assert.equal(r.phase, CAPSULE_PHASE_GRAPH[3]);
});

// ── PRC-05 · THE PROOF-TYPE LOCK — neither artifact may impersonate the other ──
test("PRC-05: a transition cannot satisfy an observation phase, nor the reverse", () => {
  const { root, capsule, evidence, p1, o2, u3, o4 } = realChain();
  assert.equal(nextCapsulePhase(capsule, evidence, fs).phase, CAPSULE_PHASE_GRAPH[4], "control: the honest chain advances");

  // A real, sealed TRANSITION receipt offered where an OBSERVATION is required.
  // Rejected in depth: wrong schema AND no `observed` map. Kept as-is because
  // both refusals are genuine, but the single-property isolation is below.
  const asObservation = [
    { phase: CAPSULE_PHASE_GRAPH[0], receipt: p1 },
    { phase: CAPSULE_PHASE_GRAPH[1], observation: u3.receipt },
  ];
  assert.equal(
    nextCapsulePhase(capsule, asObservation, fs).verified_completed.includes(CAPSULE_PHASE_GRAPH[1]),
    false,
    "a transition receipt satisfied an observation phase",
  );

  // A genuine observation, sealed at the TRANSITION phase p3, carrying this
  // capsule's action_id and sound integrity, offered where a transition belongs.
  // Measured honestly: the schema tag is NOT what refuses it — a mutation that
  // deletes the tag leaves this green, because an observation carries no
  // `of_receipt_hash` and no `proven`, and those are checked. The type lock is
  // enforced by the REQUIRED FIELDS of each artifact class; the schema tag is a
  // label on top. Claiming the tag is load-bearing would be the same
  // representation-for-reality error this whole line of work exists to refuse.
  const decoy = seal(root, capsule, CAPSULE_PHASE_GRAPH[2]);
  assert.equal(decoy.action_id, capsule.action_id, "control: action id must match");
  assert.equal(decoy.phase, CAPSULE_PHASE_GRAPH[2], "control: phase must match");
  const asTransition = [
    { phase: CAPSULE_PHASE_GRAPH[0], receipt: p1 },
    { phase: CAPSULE_PHASE_GRAPH[1], observation: o2 },
    { phase: CAPSULE_PHASE_GRAPH[2], receipt: decoy },
  ];
  assert.equal(
    nextCapsulePhase(capsule, asTransition, fs).verified_completed.includes(CAPSULE_PHASE_GRAPH[2]),
    false,
    "an observation satisfied a transition phase",
  );
  void o4;

  // And the graph genuinely alternates — six named phases is not the same claim.
  assert.deepEqual(
    CAPSULE_PHASE_GRAPH.map((_, i) => (i % 2 === 0 ? "TRANSITION" : "OBSERVATION")),
    ["TRANSITION", "OBSERVATION", "TRANSITION", "OBSERVATION", "TRANSITION", "OBSERVATION"],
  );
});

// ── PRC-06 · a transition receipt exists only when the transition completed ──
test("PRC-06: a failed undo seals no transition receipt", () => {
  const root = sandbox();
  const capsule = capsuleFor(root);
  const p1 = applyPhase(root, capsule, CAPSULE_PHASE_GRAPH[0]);
  assert.equal(p1.executed, true);

  // Break the precondition: the backup no longer matches what is on disk, so the
  // governed undo must refuse. A receipt must not exist for a transition that
  // did not happen.
  writeFileSync(join(root, TO), "tampered\n");
  const u = undoReversibleRename({ receipt: p1, fs, actionId: capsule.action_id });
  assert.equal(u.proven, false, "control: this undo must fail");
  assert.equal(u.receipt, undefined, "a receipt was sealed for an undo that never completed");

  const log = readFileSync(join(root, ".node0-receipts.ndjson"), "utf8");
  assert.equal(
    log.includes("node0_reversible_undo_receipt"),
    false,
    "an undo transition record reached the sealed log without the transition",
  );
});

// ── PRC-07 · THE COUNTERFACTUAL — the preserved Attempt-1 shape is refused ───
test("PRC-07: Attempt-1's authority shape is refused before any effect", async () => {
  const root = sandbox();
  const calls = [];
  const sink = {
    claimNonce: async () => {
      calls.push("nonce");
      return { claimed: true };
    },
    executeJob: async () => {
      calls.push("execute");
      return { ok: true, executed_count: 1 };
    },
  };
  // Attempt 1's shape exactly: the executor was handed its own phrase, with no
  // envelope binding the effect to the preview the sovereign approved.
  const r = await executeMissionBoundEffect({
    envelope: null,
    effect: { sandbox_root: root, atoms: [{ from: FROM, to: TO }] },
    spineResult: { verdict: "PERMIT_PREVIEW", consent: { consent_verified: true } },
    corridorContext: null,
    repositoryBinding: null,
    now: NOW,
    ...sink,
  });
  assert.equal(r.ok, false, "ATTEMPT-1's SHAPE EXECUTED AGAINST THE REPAIRED CONSTITUTION");
  assert.equal(r.authority_delta, 0);
  assert.deepEqual(calls, [], "reached the nonce ledger or the executor");
  assert.equal(fs.existsSync(join(root, TO)), false, "the effect landed");
  assert.equal(fs.existsSync(join(root, FROM)), true, "the source moved");

  // Non-vacuity: this seam is not refusing everything — a real bound envelope
  // over the same effect DOES reach the executor.
  const { capsule, evidence } = realChain();
  assert.equal(nextCapsulePhase(capsule, evidence, fs).phase, CAPSULE_PHASE_GRAPH[4]);
});
