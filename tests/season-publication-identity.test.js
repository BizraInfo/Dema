// SEASON-PUBLICATION-IDENTITY-1A — PI-01…PI-08.
//
// THE DEFECT, measured on ee00d3a8. The sequence fence persists BOTH
// `state_hash` and `receipt_hash`, and `loadSeasonHead` compares both. But the
// EEXIST retry path decides the writer is the same by comparing `state_hash`
// ALONE, then builds HEAD from the CANDIDATE's receipt:
//
//   const sameWriter = !owner.error && owner.value?.state_hash === state.state_hash;
//   ...
//   const head = buildSeasonHead({ ..., receipt_hash: receipt.receipt_hash, ... });
//
// The comment above it reads "we already own this sequence with these exact
// bytes" — a claim the code does not check. `saved_at` is deliberately EXCLUDED
// from the semantic state hash and INCLUDED in the receipt hash, so:
//
//   same semantic state + different save time  =>  same state_hash, new receipt_hash
//
// A crash-retry with a fresh clock therefore publishes a HEAD naming a receipt
// the fence does not own. SAME_STATE is not SAME_SAVE.
//
// WHY THE OBVIOUS FIX IS WRONG. Refusing on a receipt mismatch would destroy the
// repair this branch exists for: a writer that died between winning the fence
// and replacing HEAD must be able to come back and fix HEAD. Refusing turns a
// recoverable crash into a permanent stall.
//
// So the law is ADOPTION, not refusal:
//
//   HEAD repaired after a crash MUST name the exact receipt already owned by the
//   fence — never a newly generated substitute.
//
// That is safe because of the publication order: state -> receipt -> fence. A
// fence naming R1 proves R1 was durable BEFORE the fence existed.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  saveSeasonState,
  loadSeasonHead,
  _internal,
} from "../packages/receipts/src/season-state-store.js";

const SHA = "a".repeat(40);
const SEASON = "SEASON_PI";

const input = (saved_at, over = {}) => ({
  season_id: SEASON,
  mission_id: "MISSION_PI",
  mission_phase: "PHASE_PI",
  next_safe_action: "RUN_PROOF_GATE",
  repository_commit: SHA,
  repository_tree: SHA,
  completed_steps: [],
  must_not_repeat: [],
  pending_consent: [],
  saved_at,
  ...over,
});

const home = () => mkdtemp(join(tmpdir(), "season-pi-"));

/** The fence record for sequence N — the owner of that publication. */
async function readFence(h, seq) {
  const p = join(_internal.seqDir(h, SEASON), _internal.seqName(seq));
  return JSON.parse(await readFile(p, "utf8"));
}

/** Save, dying immediately after the fence is won and before HEAD is replaced. */
async function saveThenDieAfterFence(h, saved_at) {
  await assert.rejects(() =>
    saveSeasonState({
      demaHome: h,
      state: input(saved_at),
      hooks: { afterFencePublish: async () => { throw new Error("simulated death after fence"); } },
    }));
}

// ── PI-01 ──────────────────────────────────────────────────────────────────
test("PI-01: exact {state_hash, receipt_hash} replay repairs a stranded HEAD", async () => {
  const h = await home();
  const T = "2026-08-11T10:00:00Z";
  await saveThenDieAfterFence(h, T);

  const beforeHead = await loadSeasonHead({ demaHome: h, seasonId: SEASON });
  assert.equal(beforeHead.outcome, "EMPTY", "HEAD must still be unset after the crash");

  // Same input, same clock → byte-identical publication.
  const again = await saveSeasonState({ demaHome: h, state: input(T) });
  assert.equal(again.ok, true, `replay should repair HEAD: ${again.reason}`);
  assert.equal(again.idempotent, true);

  const fence = await readFence(h, 1);
  const head = await loadSeasonHead({ demaHome: h, seasonId: SEASON });
  assert.equal(head.outcome, "OK");
  assert.equal(head.state.state_hash, fence.state_hash);
  assert.equal(head.receipt.receipt_hash, fence.receipt_hash);
});

// ── PI-02 / PI-03 · the defect ─────────────────────────────────────────────
test("PI-02/PI-03: same state_hash + different receipt_hash is NOT the same publication", async () => {
  const h = await home();
  await saveThenDieAfterFence(h, "2026-08-11T10:00:00Z");

  const fence = await readFence(h, 1);

  // Retry with a FRESH clock: identical semantic state, different save time.
  const retry = await saveSeasonState({ demaHome: h, state: input("2026-08-11T10:00:01Z") });
  assert.equal(retry.ok, true, `retry should still repair HEAD: ${retry.reason}`);

  // The semantic state is genuinely identical...
  assert.equal(retry.state_hash, fence.state_hash);

  // ...but PI-05 is the law: HEAD may only ever name the receipt the fence owns.
  const head = await loadSeasonHead({ demaHome: h, seasonId: SEASON });
  assert.equal(
    head.receipt.receipt_hash, fence.receipt_hash,
    "HEAD named a receipt the sequence fence does not own — SAME_STATE was treated as SAME_SAVE",
  );
});

// ── PI-05 ──────────────────────────────────────────────────────────────────
test("PI-05: the reported receipt is the published one, never the rejected candidate", async () => {
  const h = await home();
  await saveThenDieAfterFence(h, "2026-08-11T11:00:00Z");
  const fence = await readFence(h, 1);

  const retry = await saveSeasonState({ demaHome: h, state: input("2026-08-11T11:00:05Z") });
  assert.equal(retry.ok, true);
  // A caller told "receipt_hash: X" while HEAD names Y has been misinformed
  // about what it published — the quietest possible false success.
  assert.equal(retry.receipt_hash, fence.receipt_hash,
    "save reported the candidate receipt, not the receipt actually published");
  assert.equal(retry.adopted_existing_publication, true,
    "an adopted publication must say so rather than pass as an ordinary save");
});

// ── PI-06 ──────────────────────────────────────────────────────────────────
test("PI-06: crash-after-fence retry adopts the winning publication, never invents one", async () => {
  const h = await home();
  await saveThenDieAfterFence(h, "2026-08-11T12:00:00Z");
  const fence = await readFence(h, 1);

  await saveSeasonState({ demaHome: h, state: input("2026-08-11T12:00:30Z") });

  // The candidate receipt object is durable on disk (published before the
  // fence attempt). It is orphan evidence — never authoritative.
  const receipts = await readdir(_internal.receiptsDir(h, SEASON));
  assert.ok(receipts.length >= 1);
  const head = await loadSeasonHead({ demaHome: h, seasonId: SEASON });
  assert.equal(head.receipt.receipt_hash, fence.receipt_hash);
  assert.equal(head.ok, true, "HEAD must verify against the receipt it names");
});

// ── PI-08 ──────────────────────────────────────────────────────────────────
test("PI-08: adoption mutates no already-durable object", async () => {
  const h = await home();
  await saveThenDieAfterFence(h, "2026-08-11T13:00:00Z");

  const snap = async () => {
    const dir = _internal.receiptsDir(h, SEASON);
    const names = (await readdir(dir)).sort();
    return Object.fromEntries(await Promise.all(
      names.map(async (n) => [n, await readFile(join(dir, n), "utf8")])));
  };
  const before = await snap();
  await saveSeasonState({ demaHome: h, state: input("2026-08-11T13:00:09Z") });
  const after = await snap();

  for (const [name, bytes] of Object.entries(before)) {
    assert.equal(after[name], bytes, `receipt ${name} was rewritten — history must be immutable`);
  }
});

// ── PI-09 ──────────────────────────────────────────────────────────────────
// A fence naming R1 proves R1 was durable WHEN THE FENCE WAS CREATED. It does
// not prove R1 is valid NOW. Between the crash and this retry the winning
// receipt can be lost or corrupted; repairing HEAD from the fence's hash on
// faith would publish an authoritative HEAD naming an object that does not
// verify. Required: reload and fully reverify the winner BEFORE HEAD, and on
// failure refuse with publication_recovery_required — never publish, never
// substitute the candidate.
test("PI-09: retry with the winning receipt MISSING refuses before HEAD, never publishes", async () => {
  const h = await home();
  await saveThenDieAfterFence(h, "2026-08-11T15:00:00Z");
  const fence = await readFence(h, 1);

  // The winning receipt R1 disappears (crash-adjacent corruption / loss).
  const { unlink } = await import("node:fs/promises");
  await unlink(join(_internal.receiptsDir(h, SEASON), _internal.objectName(fence.receipt_hash)));

  // Retry with a fresh clock: candidate R2, semantically equal state.
  const retry = await saveSeasonState({ demaHome: h, state: input("2026-08-11T15:00:30Z") });
  assert.equal(retry.ok, false, "a retry must not succeed against an unverifiable winner");
  assert.equal(retry.reason, "publication_recovery_required",
    `refusal must be publication_recovery_required, got: ${retry.reason}`);

  // The load-bearing half: HEAD was NEVER published. A refusal after
  // publication would leave a broken authoritative HEAD behind.
  const head = await loadSeasonHead({ demaHome: h, seasonId: SEASON });
  assert.equal(head.outcome, "EMPTY",
    "HEAD must remain unset — publishing then failing verification is the defect this test exists to refuse");
});

test("PI-09: retry with the winning receipt CORRUPT refuses before HEAD, never substitutes R2", async () => {
  const h = await home();
  await saveThenDieAfterFence(h, "2026-08-11T16:00:00Z");
  const fence = await readFence(h, 1);

  // R1's bytes rot: still JSON, still at the content address, hash now false.
  const { writeFile } = await import("node:fs/promises");
  const p = join(_internal.receiptsDir(h, SEASON), _internal.objectName(fence.receipt_hash));
  const rotten = JSON.parse(await readFile(p, "utf8"));
  rotten.saved_at = "1970-01-01T00:00:00Z"; // body changed, receipt_hash not recomputed
  await writeFile(p, JSON.stringify(rotten, null, 2) + "\n");

  const retry = await saveSeasonState({ demaHome: h, state: input("2026-08-11T16:00:30Z") });
  assert.equal(retry.ok, false);
  assert.equal(retry.reason, "publication_recovery_required");

  const head = await loadSeasonHead({ demaHome: h, seasonId: SEASON });
  assert.equal(head.outcome, "EMPTY", "no HEAD may name a receipt that does not verify");

  // And R2 was not silently substituted: the fence still owns R1.
  const fenceAfter = await readFence(h, 1);
  assert.equal(fenceAfter.receipt_hash, fence.receipt_hash,
    "the fence's ownership must survive the refusal untouched");
});

// ── negative control ───────────────────────────────────────────────────────
test("negative control: a genuinely different state still loses the race", async () => {
  const h = await home();
  await saveThenDieAfterFence(h, "2026-08-11T14:00:00Z");

  // Different semantic state at the same sequence → must refuse, not adopt.
  const other = await saveSeasonState({
    demaHome: h,
    state: input("2026-08-11T14:00:00Z", { next_safe_action: "CLOSE_MISSION_LOOP_REVIEW" }),
  });
  assert.equal(other.ok, false, "a different state must not be adopted as the same publication");
  assert.equal(other.reason, "stale_head_lost_race");
});
