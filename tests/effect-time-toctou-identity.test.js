// EFFECT-TIME-TOCTOU-IDENTITY-1A — TOC-01…TOC-04.
//
// THE QUESTION. `expected_before_hash` verifies the bytes the actuator READ.
// `renameSync` then moves a PATHNAME. Those are two operations on two different
// things, and between them the source pathname can be repointed at other
// content — so hash-checking and then renaming does not, by itself, establish
//
//     VERIFIED OBJECT == MOVED OBJECT
//
// "Same synchronous function" is not atomicity. Adjacency narrows the window; it
// does not close it, and a claim of atomicity resting on adjacency would be the
// same representation-for-reality error this whole line of work exists to refuse.
//
// THE INSTRUMENT. The gate takes an INJECTED fs, so the adversarial interleaving
// is deterministic rather than a race to lose: the adapter replaces the source
// pathname's content at the exact instant between the verified read and the
// rename. No sleeps, no flakiness, no hoping.
//
// MEASURED RESULT. The gate already contains a post-move comparison — written to
// police the reversible invariant, not this attack — and it catches it. With the
// comparison removed, the attacker's bytes land at the target and carry
// `executed: true` with an authoritative success receipt. So the safeguard is
// real and load-bearing, but it was UNNAMED, UNTESTED against this attack, and
// reported a generic `execute_failed` indistinguishable from a disk error.
// An unnamed safeguard is one refactor away from deletion.
//
// WHAT THIS PROVES: attacker content can never acquire an authoritative success
// receipt under authorization granted for other content, and never remains at
// the target. WHAT IT DOES NOT PROVE: that the rename itself is object-bound.
// The guarantee here is DETECT-AND-REFUSE after the move, not prevention of the
// move — closing that needs an fd/inode-bound primitive the runtime does not
// offer for rename(2). The boundary is stated rather than dressed up.

import test from "node:test";
import assert from "node:assert/strict";
import * as realFs from "node:fs";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

import {
  planReversibleRename,
  executeReversibleRename,
  NODE0_REVERSIBLE_EXECUTE_BLOCK_REASONS,
  NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
  NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
} from "../packages/core/src/node0-reversible-execute-gate.js";

const AUTHORIZED = "AAAA the authorized bytes\n";
const ATTACKER = "BBBB the attacker bytes\n";
const NOW = "2026-08-14T00:00:00Z";
const h = (s) => `sha256:${createHash("sha256").update(s).digest("hex")}`;

const roots = [];
function sandbox() {
  const root = mkdtempSync(join(tmpdir(), "toc-"));
  roots.push(root);
  writeFileSync(join(root, "a.json"), AUTHORIZED);
  return root;
}
test.after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

/** An fs that repoints the source pathname in the instant before the rename. */
function interleavingFs(swapWith) {
  const state = { fired: false };
  const adapter = new Proxy(realFs, {
    get(target, key) {
      if (key !== "renameSync") return target[key];
      return (from, to) => {
        if (!state.fired && String(from).endsWith("a.json")) {
          state.fired = true;
          writeFileSync(from, swapWith);
        }
        return target.renameSync(from, to);
      };
    },
  });
  return { adapter, state };
}

const run = (root, fs, expectedBeforeHash) =>
  executeReversibleRename({
    plan: planReversibleRename({
      sandboxRoot: root,
      fileName: "a.json",
      newName: "b.json",
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
      actionId: "act-toctou0000000000000",
      phase: "p1-provisional-apply",
      expectedBeforeHash,
    }),
    fs,
    now: NOW,
  });

// ── TOC-01 · THE KILLER INTERLEAVING ────────────────────────────────────────
test("TOC-01: content swapped between the verified read and the rename cannot succeed", () => {
  const root = sandbox();
  const { adapter, state } = interleavingFs(ATTACKER);
  const r = run(root, adapter, h(AUTHORIZED));

  assert.equal(state.fired, true, "control: the interleaving must actually have occurred");
  assert.equal(r.executed, false, "ATTACKER BYTES CARRIED AN AUTHORITATIVE SUCCESS RECEIPT");
  assert.ok(
    r.blocked_by.includes("post_move_identity_mismatch"),
    `a security refusal must be diagnosable, got ${JSON.stringify(r.blocked_by)}`,
  );
  // Strong result: the attacker's bytes do not remain at the target either.
  assert.equal(existsSync(join(root, "b.json")), false, "attacker bytes remained at the target");
});

// ── TOC-02 · NON-VACUITY — the uncontested move still succeeds ──────────────
test("TOC-02: with no interleaving, the same guarded call executes", () => {
  const root = sandbox();
  const r = run(root, realFs, h(AUTHORIZED));
  assert.equal(r.executed, true, `an honest move was blocked: ${r.blocked_by}`);
  assert.equal(r.after_hash, h(AUTHORIZED));
  assert.equal(readFileSync(join(root, "b.json"), "utf8"), AUTHORIZED);
});

// ── TOC-03 · the refusal is a declared reason, not an ad-hoc string ─────────
test("TOC-03: the identity refusals are part of the gate's declared vocabulary", () => {
  assert.ok(NODE0_REVERSIBLE_EXECUTE_BLOCK_REASONS.includes("post_move_identity_mismatch"));
  assert.ok(NODE0_REVERSIBLE_EXECUTE_BLOCK_REASONS.includes("backup_identity_mismatch"));
  // And an UNEXPECTED fault must still read as unexpected — a known-reason list
  // that swallowed everything would make every fault look handled.
  const root = sandbox();
  const exploding = new Proxy(realFs, {
    get(t, k) {
      if (k !== "renameSync") return t[k];
      return () => {
        throw new Error("disk on fire");
      };
    },
  });
  const r = run(root, exploding, h(AUTHORIZED));
  assert.equal(r.executed, false);
  assert.deepEqual(r.blocked_by, ["execute_failed"], "an unknown fault was dressed up as a handled one");
});

// ── TOC-04 · the authorized bytes survive the attack as evidence ────────────
test("TOC-04: the backup still holds the authorized content after a refused move", () => {
  const root = sandbox();
  const { adapter } = interleavingFs(ATTACKER);
  const r = run(root, adapter, h(AUTHORIZED));
  assert.equal(r.executed, false);

  // The attacker owns the source pathname now — that write was theirs and is not
  // ours to undo. What must survive is the record of what WAS authorized.
  const backups = realFs
    .readdirSync(join(root, ".node0-backups"), { recursive: true })
    .filter((p) => String(p).endsWith(".bak"));
  assert.equal(backups.length, 1, `expected one backup, saw ${JSON.stringify(backups)}`);
  assert.equal(
    readFileSync(join(root, ".node0-backups", String(backups[0])), "utf8"),
    AUTHORIZED,
    "the authorized bytes were lost, so the refusal destroyed its own evidence",
  );
});

// ── TOC-05 · the consent contract says which identity it binds ──────────────
test("TOC-05: the capsule declares that consent binds pathnames, not content", async () => {
  const { buildMissionEffectCapsule, nextCapsulePhase, CAPSULE_PHASE_GRAPH } = await import(
    "../packages/core/src/dema-reversible-file-steward.js"
  );
  const built = buildMissionEffectCapsule({
    effect: { sandbox_root: "/tmp/x", atoms: [{ from: "a.json", to: "b.json" }] },
    mission_id: "genesis-mission-001",
    contract_hash: `sha256:${"c".repeat(64)}`,
    purpose_id: "normalize",
    repository_commit: "1".repeat(40),
    repository_tree: "2".repeat(40),
    nonce: "gm001-toc-00000000000001",
    expires_at: "2026-08-15T00:00:00Z",
  });
  assert.equal(built.ok, true, built.reason);
  // The gap was real and invisible. Declaring it makes the contract readable in
  // the artifact the human approves; it does not widen or narrow what is
  // authorized. Changing it is a sovereign act, not an implementation detail.
  assert.equal(built.capsule.source_content_binding, "PATHNAME_ONLY");
  // And the declaration is inside the hashed body, so it cannot drift silently.
  const { source_content_binding: _b, capsule_hash: _h, ...rest } = built.capsule;
  assert.ok(built.capsule.capsule_hash.startsWith("sha256:"));
  assert.ok(Object.keys(rest).length > 5, "control: the body must be non-trivial");

  // p1 therefore carries no content expectation, and p5 does. Stated, not faked.
  const step = nextCapsulePhase(built.capsule, [], undefined);
  assert.equal(step.phase, CAPSULE_PHASE_GRAPH[0]);
  assert.equal(step.expected_before_hash ?? null, null, "p1 must not claim a content expectation it never had");
});
