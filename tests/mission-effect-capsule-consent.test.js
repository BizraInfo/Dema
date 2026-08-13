// MISSION-001-CAPSULE-CONSENT-CONTRACT-1A — CC-01…CC-08.
//
// CR-03 made apply → undo → reapply mechanically possible. This makes it
// CONSENTABLE without breaking §5.5. The danger in repairing §5.9 is that the
// human approves "rename once" while the executor performs a three-mutation
// capsule. So the sovereign agrees to the WHOLE reversible experiment.
//
// THE LOAD-BEARING LAW. `action_id` and `phase` are no longer bookkeeping: they
// determine the on-disk footprint `.node0-backups/<action_id>/<phase>/…`. A caller
// able to choose them after consent could move the control plane the human agreed
// to — reopening CR-01 through the door CR-03 just built. CC-02 pins that they are
// DERIVED from the sealed capsule and cannot be supplied.
//
// CALLER_PHASE != AUTHORITY (CC-05): "final" happens because restoration was
// proven, not because a caller passed the string "final".
//
// RECOVERY != REAUTHORIZATION (CC-06): resuming a partial capsule continues its
// state machine; it never restarts the graph under the same consent.
//
// NON-VACUITY (CC-07): a valid untouched capsule must genuinely complete the
// lifecycle on a real filesystem. Without it, identical refusals could masquerade
// as binding — the exact failure this suite exists to prevent.
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
  CAPSULE_PHASE_GRAPH,
  MISSION_EFFECT_CAPSULE_SCHEMA,
} from "../packages/core/src/dema-reversible-file-steward.js";
import {
  planReversibleRename,
  executeReversibleRename,
  undoReversibleRename,
  NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
  NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
} from "../packages/core/src/node0-reversible-execute-gate.js";

const sha = (b) => createHash("sha256").update(b).digest("hex");
const roots = [];
test.after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

const BASE = Object.freeze({
  effect: { sandbox_root: "/tmp/capsule-root", atoms: [{ from: "a.json", to: "a-2026-08-12.json" }] },
  mission_id: "genesis-mission-001",
  contract_hash: `sha256:${"c".repeat(64)}`,
  purpose_id: "normalize-to-dated-convention",
  repository_commit: "1".repeat(40),
  repository_tree: "2".repeat(40),
  nonce: "gm001-attempt2-0001",
  expires_at: "2026-08-14T15:00:00Z",
});

const build = (over = {}) => {
  const r = buildMissionEffectCapsule({ ...BASE, ...over });
  assert.equal(r.ok, true, `capsule build failed: ${r.reason}`);
  return r.capsule;
};

// ── CC-01 · deterministic identity ──────────────────────────────────────────
test("CC-01: the same capsule inputs derive the same action id and hash", () => {
  const a = build();
  const b = build();
  assert.equal(a.action_id, b.action_id);
  assert.equal(a.capsule_hash, b.capsule_hash);
  assert.match(a.action_id, /^act-[0-9a-f]{24}$/);
});

// ── CC-02 · the caller cannot move the control plane ────────────────────────
test("CC-02: action_id and phases are derived — a caller cannot supply them", () => {
  const hostile = build({ action_id: "attacker-chosen", phases: [], control_plane_footprint: {} });
  const honest = build();
  assert.equal(hostile.action_id, honest.action_id, "a caller-supplied action_id was honoured");
  assert.deepEqual(
    hostile.phases.map((p) => p.name),
    CAPSULE_PHASE_GRAPH,
    "a caller-supplied phase graph was honoured",
  );
  assert.equal(hostile.capsule_hash, honest.capsule_hash);
});

// ── CC-03 · material change matrix — every binding is load-bearing ──────────
test("CC-03: changing any bound field moves the capsule hash", () => {
  const base = build().capsule_hash;
  const mutations = {
    "target": { effect: { ...BASE.effect, atoms: [{ from: "a.json", to: "OTHER.json" }] } },
    "source": { effect: { ...BASE.effect, atoms: [{ from: "OTHER.json", to: "a-2026-08-12.json" }] } },
    "mission root": { effect: { ...BASE.effect, sandbox_root: "/tmp/elsewhere" } },
    "mission id": { mission_id: "genesis-mission-002" },
    "contract": { contract_hash: `sha256:${"d".repeat(64)}` },
    "purpose": { purpose_id: "something-else" },
    "repo commit": { repository_commit: "9".repeat(40) },
    "repo tree": { repository_tree: "9".repeat(40) },
    "nonce": { nonce: "gm001-attempt2-0002" },
    "expiry": { expires_at: "2026-09-01T00:00:00Z" },
  };
  for (const [label, over] of Object.entries(mutations)) {
    assert.notEqual(build(over).capsule_hash, base, `changing ${label} did not move the capsule hash`);
  }
});

// ── CC-04 · the footprint the human sees is the footprint that happens ──────
test("CC-04: the capsule discloses the action-scoped backup path of every mutating phase", () => {
  const c = build();
  const mutating = c.phases.filter((p) => p.mutating);
  assert.equal(mutating.length, 2, "expected provisional and final to mutate");
  for (const p of mutating) {
    assert.equal(p.backup_paths.length, 1);
    assert.ok(
      p.backup_paths[0].startsWith(`.node0-backups/${c.action_id}/${p.name}/`),
      `undisclosed backup path for ${p.name}: ${p.backup_paths[0]}`,
    );
  }
  for (const p of c.phases.filter((x) => !x.mutating)) {
    assert.deepEqual(p.backup_paths, [], `${p.name} claims a backup but does not mutate`);
  }
  assert.equal(c.control_plane_footprint.receipt_log_appends, 2);
  assert.equal(c.control_plane_footprint.preserved_after_undo, true);
});

// ── CC-05 · CALLER_PHASE != AUTHORITY ───────────────────────────────────────
// Strengthened after review found the original defect: this used to pass
// completed phase NAMES, which proved only that the reported order was legal.
// Advancement now consumes evidence, so a name alone completes nothing. The
// forged-history control lives in tests/capsule-phase-evidence-binding.test.js.
test("CC-05: phase names alone advance nothing — evidence is required", () => {
  const c = build();
  assert.equal(nextCapsulePhase(c, [], fs).phase, "p1-provisional-apply");
  const named = nextCapsulePhase(c, [
    { phase: "p1-provisional-apply" },
    { phase: "p2-verify-apply" },
  ], fs);
  assert.equal(named.phase, "p1-provisional-apply", "a bare name completed a phase");
  assert.deepEqual(named.verified_completed, []);
});

// ── CC-06 · RECOVERY != REAUTHORIZATION ─────────────────────────────────────
test("CC-06: an unverified claim of progress does not move the frontier", () => {
  const c = build();
  // Claiming the whole graph completed, with no evidence, must not report done.
  const claimed = nextCapsulePhase(c, CAPSULE_PHASE_GRAPH.map((phase) => ({ phase })), fs);
  assert.notEqual(claimed.complete, true, "an evidence-free claim completed the capsule");
  assert.equal(claimed.phase, CAPSULE_PHASE_GRAPH[0]);
  // Resumption from a genuinely verified frontier is proven end-to-end in
  // tests/capsule-phase-evidence-binding.test.js (PE-02).
});

// ── CC-07 · NON-VACUITY — a valid capsule really completes on a real fs ─────
test("CC-07: the sealed capsule drives a full apply→undo→restore→final lifecycle", () => {
  const root = mkdtempSync(join(tmpdir(), "capsule-live-"));
  roots.push(root);
  writeFileSync(join(root, "a.json"), "governed state\n");
  const genesis = sha(readFileSync(join(root, "a.json")));
  const c = build({ effect: { sandbox_root: root, atoms: [{ from: "a.json", to: "a-2026-08-12.json" }] } });

  const completed = [];
  const step = () => nextCapsulePhase(c, completed, fs);
  const applyPhase = (phaseName) =>
    executeReversibleRename({
      plan: planReversibleRename({
        sandboxRoot: root,
        fileName: "a.json",
        newName: "a-2026-08-12.json",
        goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
        actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
        // DERIVED from the capsule — never chosen here.
        actionId: c.action_id,
        phase: phaseName,
      }),
      fs,
      now: "2026-08-13T17:00:00Z",
    });

  assert.equal(step().phase, "p1-provisional-apply");
  const prov = applyPhase("p1-provisional-apply");
  assert.equal(prov.executed, true, `provisional blocked: ${prov.blocked_by}`);
  completed.push({ phase: "p1-provisional-apply", receipt: prov });

  assert.equal(sha(readFileSync(join(root, "a-2026-08-12.json"))), genesis);
  completed.push({ phase: "p2-verify-apply", observed_hash: prov.after_hash });

  assert.equal(step().phase, "p3-exact-undo");
  const undo = undoReversibleRename({ receipt: prov, fs, actionId: c.action_id });
  assert.equal(undo.proven, true, `undo not proven: ${undo.reason}`);
  completed.push({ phase: "p3-exact-undo", undo });

  assert.equal(sha(readFileSync(join(root, "a.json"))), genesis, "restoration diverged");
  completed.push({ phase: "p4-verify-restored", observed_hash: prov.before_hash });

  assert.equal(step().phase, "p5-final-apply");
  const final = applyPhase("p5-final-apply");
  assert.equal(final.executed, true, `final blocked: ${final.blocked_by}`);
  completed.push({ phase: "p5-final-apply", receipt: final });

  assert.equal(sha(readFileSync(join(root, "a-2026-08-12.json"))), genesis);
  assert.ok(!existsSync(join(root, "a.json")));
  completed.push({ phase: "p6-verify-final", observed_hash: final.after_hash });

  assert.equal(step().complete, true);
  // The disclosed footprint is the footprint that happened, and it survived undo.
  assert.ok(existsSync(prov.backup.path) && existsSync(final.backup.path));
  assert.ok(existsSync(join(root, ".node0-receipts.ndjson")));
});

// ── CC-08 · Attempt-1's consent cannot reach this capsule ───────────────────
test("CC-08: the old effect-only preview hash is not a capsule hash", () => {
  const c = build();
  assert.notEqual(
    c.capsule_hash,
    c.effect_preview.content_hash,
    "the capsule commitment collapsed to the bare effect preview — Attempt-1's consent shape",
  );
  assert.equal(c.schema, MISSION_EFFECT_CAPSULE_SCHEMA);
  assert.equal(c.authority_delta, 0);
});
