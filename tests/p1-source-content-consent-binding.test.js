// P1-SOURCE-CONTENT-CONSENT-BINDING-1A — CB-01…CB-09.
//
// WHAT CONSENT MEANT, AND WHAT A HUMAN THINKS IT MEANT. Determined mechanically
// in the previous slice: an atom is {from,to,reversible,sanitizer_verdict,
// executable}, `content_hash` hashes the PREVIEW BODY, and the original
// Mission-001 packet carried no source-content field. So p1 consent authorized
//
//     "move whatever occupies a.json when execution happens"
//
// while the sovereign approving it was looking at particular bytes. p5 was
// already content-bound, because p1's receipt supplies the expectation. p1 had
// nothing to bind to.
//
// WHY THIS IS IMPLEMENTED RATHER THAN ASKED. The change is STRICTLY NARROWING:
// binding content can only ever cause MORE refusals, never one additional
// effect. And PATHNAME_ONLY was never anyone's decision — it fell out of the
// implementation and was invisible until it was measured, so preserving it
// would preserve an accident, not a sovereign choice. The narrower reading is
// also the one the human demonstrably holds. Reverting is one field.
//
// The estate's own law decides it:
//
//     WHEN THE OBJECT CAN BE MEASURED, DO NOT ASSUME ITS IDENTITY.
//
// PURITY IS PRESERVED. The capsule builder reads no disk. The caller OBSERVES
// the source and supplies the commitment, exactly as `fs` is injected
// everywhere else in this tier.
//
// AUTHORITY MUST PRECEDE EFFECT. The prior slice's post-move check is
// detect-and-refuse AFTER a rename has moved something. This refuses BEFORE the
// rename is ever invoked. Both are kept: defence in depth, and CB-08 proves the
// pre-effect guard is what fires first.

import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

import {
  buildMissionEffectCapsule,
  nextCapsulePhase,
  MISSION_EFFECT_CAPSULE_SCHEMA,
  CAPSULE_PHASE_GRAPH,
} from "../packages/core/src/dema-reversible-file-steward.js";
import {
  planReversibleRename,
  executeReversibleRename,
  NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
  NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
} from "../packages/core/src/node0-reversible-execute-gate.js";

const FROM = "a.json";
const TO = "b.json";
const APPROVED = "the bytes the sovereign looked at\n";
const SUBSTITUTE = "bytes nobody approved\n";
const NOW = "2026-08-14T01:00:00Z";
const h = (s) => `sha256:${createHash("sha256").update(s).digest("hex")}`;

const roots = [];
function sandbox(body = APPROVED) {
  const root = mkdtempSync(join(tmpdir(), "cb-"));
  roots.push(root);
  writeFileSync(join(root, FROM), body);
  return root;
}
test.after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

/** Observe the source the way a preview would, then commit it into the capsule. */
const observeSource = (root, name = FROM) => ({ [name]: h(readFileSync(join(root, name))) });

function capsule(root, { sourceContent, nonce = "gm001-cb-0000000000000001" } = {}) {
  const built = buildMissionEffectCapsule({
    effect: { sandbox_root: root, atoms: [{ from: FROM, to: TO }] },
    mission_id: "genesis-mission-001",
    contract_hash: `sha256:${"c".repeat(64)}`,
    purpose_id: "normalize",
    repository_commit: "1".repeat(40),
    repository_tree: "2".repeat(40),
    nonce,
    expires_at: "2026-08-15T01:00:00Z",
    sourceContent,
  });
  assert.equal(built.ok, true, built.reason);
  return built.capsule;
}

const applyP1 = (root, cap, expectedBeforeHash) =>
  executeReversibleRename({
    plan: planReversibleRename({
      sandboxRoot: root,
      fileName: FROM,
      newName: TO,
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
      actionId: cap.action_id,
      phase: CAPSULE_PHASE_GRAPH[0],
      expectedBeforeHash,
    }),
    fs,
    now: NOW,
  });

// ── CB-01 · the capsule commits the approved bytes and says so ──────────────
test("CB-01: a capsule given the observed source is CONTENT_BOUND and commits the hash", () => {
  const root = sandbox();
  const cap = capsule(root, { sourceContent: observeSource(root) });
  assert.equal(cap.source_content_binding, "CONTENT_BOUND");
  assert.equal(cap.source_content[FROM], h(APPROVED));
  assert.equal(cap.schema, MISSION_EFFECT_CAPSULE_SCHEMA);
});

// ── CB-02 · p1 now carries an expectation, where before it carried none ─────
test("CB-02: the capsule hands p1 the approved content hash", () => {
  const root = sandbox();
  const cap = capsule(root, { sourceContent: observeSource(root) });
  const step = nextCapsulePhase(cap, [], fs);
  assert.equal(step.phase, CAPSULE_PHASE_GRAPH[0]);
  assert.equal(step.expected_before_hash, h(APPROVED), "p1 must inherit the approved identity");
});

// ── CB-03 · THE KILLER CONTROL — refuse BEFORE the rename ───────────────────
test("CB-03: source replaced after consent is refused before any mutation", () => {
  const root = sandbox();
  const cap = capsule(root, { sourceContent: observeSource(root) });
  const step = nextCapsulePhase(cap, [], fs);

  // Between consent and execution, something else replaces the file.
  writeFileSync(join(root, FROM), SUBSTITUTE);

  const r = applyP1(root, cap, step.expected_before_hash);
  assert.equal(r.executed, false, "bytes nobody approved were moved under this consent");
  assert.ok(r.blocked_by.includes("before_hash_drifted"), JSON.stringify(r.blocked_by));

  // AUTHORITY BEFORE EFFECT: nothing moved, and no backup FILE was taken.
  assert.equal(existsSync(join(root, TO)), false, "the target was created");
  assert.equal(readFileSync(join(root, FROM), "utf8"), SUBSTITUTE, "the source was disturbed");

  // MEASURED, and narrower than first asserted: the empty `.node0-backups`
  // DIRECTORY does exist. The gate creates it during its containment checks,
  // before it ever reads the source, so a refused effect still touches the
  // control plane. That is disclosed footprint (CR-01) and not user-visible
  // state, but the first version of this assertion claimed the directory was
  // absent and was simply wrong — pinning what is true beats pinning what
  // sounded stronger.
  assert.equal(existsSync(join(root, ".node0-backups")), true, "control: the disclosed dir is created early");
  const backupFiles = fs
    .readdirSync(join(root, ".node0-backups"), { recursive: true })
    .filter((p) => String(p).endsWith(".bak"));
  assert.deepEqual(backupFiles, [], "a backup file was written for an effect that never ran");
});

// ── CB-04 · NON-VACUITY — the approved bytes still execute ──────────────────
test("CB-04: the exact approved bytes execute normally", () => {
  const root = sandbox();
  const cap = capsule(root, { sourceContent: observeSource(root) });
  const step = nextCapsulePhase(cap, [], fs);
  const r = applyP1(root, cap, step.expected_before_hash);
  assert.equal(r.executed, true, `the approved effect was blocked: ${r.blocked_by}`);
  assert.equal(readFileSync(join(root, TO), "utf8"), APPROVED);
});

// ── CB-05 · restored bytes are accepted; equality is by content, not history ──
test("CB-05: changed then restored to the exact approved bytes is accepted", () => {
  const root = sandbox();
  const cap = capsule(root, { sourceContent: observeSource(root) });
  const step = nextCapsulePhase(cap, [], fs);
  writeFileSync(join(root, FROM), SUBSTITUTE);
  assert.equal(applyP1(root, cap, step.expected_before_hash).executed, false);
  writeFileSync(join(root, FROM), APPROVED);
  assert.equal(applyP1(root, cap, step.expected_before_hash).executed, true, "identical bytes were refused");
});

// ── CB-06 · the commitment is inside the hashed body ────────────────────────
test("CB-06: two capsules differing only in approved content have different hashes", () => {
  const a = sandbox(APPROVED);
  const b = sandbox(SUBSTITUTE);
  const ca = capsule(a, { sourceContent: { [FROM]: h(APPROVED) } });
  const cb = capsule(b, { sourceContent: { [FROM]: h(SUBSTITUTE) } });
  // Different sandbox roots also differ, so compare the commitment directly too.
  assert.notEqual(ca.source_content[FROM], cb.source_content[FROM]);
  assert.notEqual(ca.capsule_hash, cb.capsule_hash, "the commitment is not bound by the capsule hash");
});

// ── CB-07 · an unusable commitment is refused, never silently dropped ───────
test("CB-07: a malformed source commitment refuses the capsule", () => {
  const root = sandbox();
  for (const bad of [{ [FROM]: "not-a-hash" }, { [FROM]: null }, { "../escape": h(APPROVED) }]) {
    const built = buildMissionEffectCapsule({
      effect: { sandbox_root: root, atoms: [{ from: FROM, to: TO }] },
      mission_id: "m",
      contract_hash: `sha256:${"c".repeat(64)}`,
      purpose_id: "p",
      repository_commit: "1".repeat(40),
      repository_tree: "2".repeat(40),
      nonce: "gm001-cb-0000000000000007",
      expires_at: "2026-08-15T01:00:00Z",
      sourceContent: bad,
    });
    assert.equal(built.ok, false, `accepted a malformed commitment: ${JSON.stringify(bad)}`);
    assert.match(built.reason, /source_content/, built.reason);
  }
});

// ── CB-08 · authority precedes effect: the PRE-effect guard fires first ─────
test("CB-08: the refusal happens before the rename, not after it", () => {
  const root = sandbox();
  const cap = capsule(root, { sourceContent: observeSource(root) });
  const step = nextCapsulePhase(cap, [], fs);
  writeFileSync(join(root, FROM), SUBSTITUTE);

  let renameCalled = false;
  const watched = new Proxy(fs, {
    get(t, k) {
      if (k !== "renameSync") return t[k];
      return (...a) => {
        renameCalled = true;
        return t.renameSync(...a);
      };
    },
  });
  const r = executeReversibleRename({
    plan: planReversibleRename({
      sandboxRoot: root,
      fileName: FROM,
      newName: TO,
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
      actionId: cap.action_id,
      phase: CAPSULE_PHASE_GRAPH[0],
      expectedBeforeHash: step.expected_before_hash,
    }),
    fs: watched,
    now: NOW,
  });
  assert.equal(r.executed, false);
  assert.equal(renameCalled, false, "the rename ran and was undone — detect-and-refuse, not authority-before-effect");
});

// ── CB-09 · the older mode still exists, declared, and cannot masquerade ────
test("CB-09: omitting the commitment yields PATHNAME_ONLY, and it is visibly weaker", () => {
  const root = sandbox();
  const legacy = capsule(root, { nonce: "gm001-cb-0000000000000009" });
  assert.equal(legacy.source_content_binding, "PATHNAME_ONLY");
  assert.equal(legacy.source_content ?? null, null, "a pathname-only capsule must not appear content-bound");
  // And it must be distinguishable in the hashed body, so a weaker capsule can
  // never be mistaken for a stronger one after the fact.
  const bound = capsule(root, { sourceContent: observeSource(root), nonce: "gm001-cb-0000000000000009" });
  assert.notEqual(legacy.capsule_hash, bound.capsule_hash);
  assert.equal(nextCapsulePhase(legacy, [], fs).expected_before_hash ?? null, null);
});
