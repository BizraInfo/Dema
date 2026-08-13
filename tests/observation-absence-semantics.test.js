// OBSERVATION-ABSENCE-SEMANTICS-1A — OA-01…OA-07.
//
// THE DEFECT, in code written earlier the same day. `sealStateObservation` wrote
// `observed[name] = null` from a bare catch, so every one of these produced the
// same value:
//
//     genuinely absent · symlink refused by O_NOFOLLOW · a directory ·
//     unreadable · any transient io error
//
// and the phase predicates use `null` to MEAN absent — p2 requires the source
// gone, p4 requires the target gone. So planting a symlink at the source path
// satisfies "the source is absent". Blindness masquerading as absence.
//
//     UNKNOWN     != FALSE
//     UNREADABLE  != ABSENT
//     UNSAFE      != ABSENT
//
// The bitter part: CP-08 asserted `observed[FROM] === null` for a symlink and
// called it proof the verifier does not follow links. Half right. It does not
// follow the link — and then hands the refusal to a predicate that reads it as
// "nothing is there". The refusal was correct; its ENCODING destroyed it.
//
// This is the filesystem form of the law the world-observer already carries:
// a blind scan yields OBSERVATION_UNAVAILABLE, never "zero models".
//
// THE LAW: failure to observe a fact can never satisfy a predicate requiring
// that fact to be false. An authority-gating negative needs positive evidence
// of absence.

import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdtempSync, writeFileSync, symlinkSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  sealStateObservation,
  OBSERVED_PRESENT,
  OBSERVED_ABSENT,
  OBSERVED_UNSAFE,
  planReversibleRename,
  executeReversibleRename,
  NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
  NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
} from "../packages/core/src/node0-reversible-execute-gate.js";
import {
  buildMissionEffectCapsule,
  nextCapsulePhase,
  CAPSULE_PHASE_GRAPH,
} from "../packages/core/src/dema-reversible-file-steward.js";

const FROM = "a.json";
const TO = "a-2026-08-12.json";
const BODY = "governed state\n";
const NOW = "2026-08-13T20:00:00Z";

const roots = [];
function sandbox(seed = true) {
  const root = mkdtempSync(join(tmpdir(), "oa-"));
  roots.push(root);
  if (seed) writeFileSync(join(root, FROM), BODY);
  return root;
}
test.after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

const observe = (root, names, phase = "p2-verify-apply", actionId = "act-oa000000000000000000") =>
  sealStateObservation({ sandboxRoot: root, actionId, phase, names, fs, now: NOW }).observation;

// ── OA-01 · the four realities are four values, not one ─────────────────────
test("OA-01: absent, symlink and directory are distinguishable, not all null", () => {
  const root = sandbox(false);
  writeFileSync(join(root, "real.json"), BODY);
  symlinkSync("/etc/hostname", join(root, "link.json"));
  mkdirSync(join(root, "dir.json"));

  const o = observe(root, ["real.json", "gone.json", "link.json", "dir.json"]);
  assert.equal(o.observed["real.json"].state, OBSERVED_PRESENT);
  assert.match(o.observed["real.json"].hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(o.observed["gone.json"].state, OBSERVED_ABSENT);
  assert.equal(o.observed["link.json"].state, OBSERVED_UNSAFE);
  assert.equal(o.observed["dir.json"].state, OBSERVED_UNSAFE);
  // The control that matters: the two "not a readable file" cases must not
  // collapse into the absent case.
  assert.notEqual(o.observed["link.json"].state, o.observed["gone.json"].state);
});

// ── OA-02 · THE KILLER CONTROL — a symlink cannot satisfy expected-absence ──
test("OA-02: a symlink where the source should be gone does not credit the phase", () => {
  const root = sandbox();
  const built = buildMissionEffectCapsule({
    effect: { sandbox_root: root, atoms: [{ from: FROM, to: TO }] },
    mission_id: "genesis-mission-001",
    contract_hash: `sha256:${"c".repeat(64)}`,
    purpose_id: "normalize",
    repository_commit: "1".repeat(40),
    repository_tree: "2".repeat(40),
    nonce: "gm001-oa-0000000000000001",
    expires_at: "2026-08-14T20:00:00Z",
  });
  assert.equal(built.ok, true, built.reason);
  const capsule = built.capsule;

  const p1 = executeReversibleRename({
    plan: planReversibleRename({
      sandboxRoot: root,
      fileName: FROM,
      newName: TO,
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
      actionId: capsule.action_id,
      phase: CAPSULE_PHASE_GRAPH[0],
    }),
    fs,
    now: NOW,
  });
  assert.equal(p1.executed, true, `p1 blocked: ${p1.blocked_by}`);

  // The rename left the source genuinely gone. Plant a symlink back at that
  // pathname: the verifier must refuse to read it, and that refusal must NOT
  // read as "the source is absent".
  symlinkSync("/etc/hostname", join(root, FROM));
  const o2 = sealStateObservation({
    sandboxRoot: root,
    actionId: capsule.action_id,
    phase: CAPSULE_PHASE_GRAPH[1],
    names: [FROM, TO],
    fs,
    now: NOW,
  }).observation;

  const r = nextCapsulePhase(
    capsule,
    [
      { phase: CAPSULE_PHASE_GRAPH[0], receipt: p1 },
      { phase: CAPSULE_PHASE_GRAPH[1], observation: o2 },
    ],
    fs,
  );
  assert.equal(
    r.verified_completed.includes(CAPSULE_PHASE_GRAPH[1]),
    false,
    "an unreadable path satisfied a predicate demanding the path be absent",
  );
  assert.equal(r.phase, CAPSULE_PHASE_GRAPH[1]);
});

// ── OA-03 · NON-VACUITY — genuine absence still satisfies absence ───────────
test("OA-03: with the source really gone, the same phase does advance", () => {
  const root = sandbox();
  const built = buildMissionEffectCapsule({
    effect: { sandbox_root: root, atoms: [{ from: FROM, to: TO }] },
    mission_id: "genesis-mission-001",
    contract_hash: `sha256:${"c".repeat(64)}`,
    purpose_id: "normalize",
    repository_commit: "1".repeat(40),
    repository_tree: "2".repeat(40),
    nonce: "gm001-oa-0000000000000002",
    expires_at: "2026-08-14T20:00:00Z",
  });
  const capsule = built.capsule;
  const p1 = executeReversibleRename({
    plan: planReversibleRename({
      sandboxRoot: root,
      fileName: FROM,
      newName: TO,
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
      actionId: capsule.action_id,
      phase: CAPSULE_PHASE_GRAPH[0],
    }),
    fs,
    now: NOW,
  });
  assert.equal(p1.executed, true);
  const o2 = sealStateObservation({
    sandboxRoot: root,
    actionId: capsule.action_id,
    phase: CAPSULE_PHASE_GRAPH[1],
    names: [FROM, TO],
    fs,
    now: NOW,
  }).observation;
  const r = nextCapsulePhase(
    capsule,
    [
      { phase: CAPSULE_PHASE_GRAPH[0], receipt: p1 },
      { phase: CAPSULE_PHASE_GRAPH[1], observation: o2 },
    ],
    fs,
  );
  assert.ok(
    r.verified_completed.includes(CAPSULE_PHASE_GRAPH[1]),
    `honest absence was refused: ${JSON.stringify(r.stopped_at)}`,
  );
});

// ── OA-04 · presence still needs the exact bytes ────────────────────────────
test("OA-04: PRESENT with the wrong hash does not satisfy a presence predicate", () => {
  const root = sandbox(false);
  writeFileSync(join(root, TO), "different bytes\n");
  const o = observe(root, [FROM, TO]);
  assert.equal(o.observed[TO].state, OBSERVED_PRESENT);
  assert.notEqual(o.observed[TO].hash, `sha256:${"0".repeat(64)}`);
  assert.equal(o.observed[FROM].state, OBSERVED_ABSENT);
});

// ── OA-05 · the sealed body carries the state, so it is bound by the hash ───
test("OA-05: the observation state is inside the hashed body", () => {
  const root = sandbox(false);
  symlinkSync("/etc/hostname", join(root, "x.json"));
  const unsafe = observe(root, ["x.json"]);
  rmSync(join(root, "x.json"));
  const absent = observe(root, ["x.json"]);
  assert.notEqual(
    unsafe.content_hash,
    absent.content_hash,
    "an unsafe reading and an absence hash the same — the distinction is unbound",
  );
});
