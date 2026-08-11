// REALM0-ANCHOR-BINDING-0B — B-01…B-14.
//
// THE CONTRACT. A season publication must be able to state, cryptographically,
// "this authoritative publication was created against world anchor X" in a way
// that cannot be stripped without invalidating the publication. The anchor
// belongs to PUBLICATION identity (receipt_hash), never SEMANTIC identity
// (state_hash): the same mission continuation can legitimately exist under two
// different world estates, so the anchor must not move state_hash by one byte.
//
//   receipt v0.1   existing closed body                      (legacy, unchanged)
//   receipt v0.2   v0.1 fields + world_anchor_ref            (INSIDE receipt_hash)
//
// HEAD already binds receipt_hash and the sequence fence already binds
// receipt_hash, so coverage reaches the authoritative pointer with no HEAD
// schema change and no fence change.
//
// BASELINE LAW. status/resume never establishes an anchor expectation. Every
// anchor outcome except WORLD_ANCHOR_MATCH withholds continuation:
//
//   v0.1 receipt                     LEGACY_WORLD_ANCHOR_ABSENT   withheld
//   v0.2 ref, object absent          WORLD_ANCHOR_MISSING         fail closed
//   v0.2 ref, integrity/digest bad   WORLD_ANCHOR_INVALID         fail closed
//   v0.2 ref, version incomparable   WORLD_ANCHOR_INCOMPARABLE    fail closed
//   v0.2 ref, verified match         WORLD_ANCHOR_MATCH           continuation
//
// WRITE-AHEAD. anchor durable → state → receipt referencing it → fence → HEAD.
// An authoritative HEAD never requires an object that was not already durable.
//
// RETRY LAW (§23). A retry repairs publication; it does not renegotiate the
// assumptions of the publication that already won. If the fence owns (S, R1)
// and R1 references W1, a world-changed retry carrying W2 must repair HEAD to
// R1/W1 — R2/W2 survive only as orphan evidence with zero authority.
//
// 0B proves the CONTRACT with synthetic observed payloads. No world observer,
// no comparator, no model — a later slice supplies the observation.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, unlink, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import * as kernel from "../packages/core/src/node0-minimum-season-save-resume.js";
import * as store from "../packages/receipts/src/season-state-store.js";
import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";

const execFileAsync = promisify(execFile);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const SEASON = "SEASON_0B";

const input = (saved_at, over = {}) => ({
  season_id: SEASON,
  mission_id: "MISSION_0B",
  mission_phase: "PHASE_0B",
  next_safe_action: "RUN_PROOF_GATE",
  repository_commit: SHA_A,
  repository_tree: SHA_A,
  completed_steps: [],
  must_not_repeat: [],
  pending_consent: [{ phrase: "HOLD_THE_GATE", scope: "test" }],
  saved_at,
  ...over,
});

const W1 = { world: "synthetic-estate-1", devices: 1 };
const W2 = { world: "synthetic-estate-2", devices: 2 };

const home = () => mkdtemp(join(tmpdir(), "realm0-0b-"));

const receiptPath = (h, hash) =>
  join(store._internal.receiptsDir(h, SEASON), store._internal.objectName(hash));
const anchorPath = (h, hash) =>
  join(store._internal.anchorsDir(h, SEASON), store._internal.objectName(hash));

async function readJson(p) {
  return JSON.parse(await readFile(p, "utf8"));
}

// ── B-01 · legacy receipts verify byte-identically ──────────────────────────
test("B-01: v0.1 receipt bytes and hash are unchanged by this slice (golden vector)", () => {
  // Golden vector computed on the pre-0B tree (frontier 1fb3422f). If either
  // hash moves, the slice changed legacy identity and B-01 has failed.
  const st = kernel.buildSeasonState({
    season_id: "SEASON_0B_GOLDEN", mission_id: "MISSION_0B", mission_phase: "PHASE_0B",
    next_safe_action: "RUN_PROOF_GATE", repository_commit: SHA_A, repository_tree: SHA_B,
    completed_steps: ["S1"], must_not_repeat: ["X1"], pending_consent: [{ phrase: "P", scope: "s" }],
    state_sequence: 1, previous_state_hash: null, saved_at: "2026-08-11T18:00:00Z",
  });
  assert.equal(st.ok, true);
  assert.equal(st.state.state_hash,
    "sha256:87d1ed7fe7acda010b4e820b0d2ba1a62864228b3260bc08873dfcb84890bd79");

  const r = kernel.buildSeasonReceipt({
    season_id: "SEASON_0B_GOLDEN", state_hash: st.state.state_hash, state_sequence: 1,
    previous_state_hash: null, saved_at: "2026-08-11T18:00:00Z",
  });
  assert.equal(r.receipt_hash,
    "sha256:92c98e05be7120ac4034aff84f969c574f11d17d9acf65c78ccac18f4f931639");
  assert.deepEqual(Object.keys(r).sort(),
    ["domain", "previous_state_hash", "receipt_hash", "saved_at", "schema", "season_id", "state_hash", "state_sequence"],
    "a v0.1 receipt must not gain fields");
  assert.equal(kernel.verifySeasonReceipt(r, st.state).ok, true);
});

// ── B-02 / B-12 · semantic identity frozen ──────────────────────────────────
test("B-02/B-12: SEMANTIC_STATE_FIELDS unchanged; anchor never reaches state_hash", async () => {
  assert.deepEqual([...kernel.SEMANTIC_STATE_FIELDS], [
    "schema", "domain", "season_id", "mission_id", "mission_contract_hash",
    "mission_phase", "completed_steps", "next_safe_action", "must_not_repeat",
    "pending_consent", "last_receipt_hash", "repository_commit", "repository_tree",
    "state_sequence", "previous_state_hash", "truth_label", "boundary",
  ], "the semantic surface is frozen — 0B is a publication-identity change only");

  // The strong half: identical semantic input saved WITH and WITHOUT an anchor
  // must produce the SAME state_hash. The anchor is publication identity.
  const h1 = await home();
  const h2 = await home();
  const legacy = await store.saveSeasonState({ demaHome: h1, state: input("2026-08-11T18:10:00Z") });
  const anchored = await store.saveSeasonState({
    demaHome: h2, state: input("2026-08-11T18:10:00Z"), worldAnchor: { observed: W1 },
  });
  assert.equal(legacy.ok, true);
  assert.equal(anchored.ok, true, `anchored save refused: ${anchored.reason}`);
  assert.equal(anchored.state_hash, legacy.state_hash,
    "world anchoring moved state_hash — it leaked into semantic identity");
});

// ── B-03 · a v0.2 receipt carrying a ref verifies ───────────────────────────
test("B-03: anchored save publishes a v0.2 receipt whose ref is inside receipt_hash", async () => {
  const h = await home();
  const r = await store.saveSeasonState({
    demaHome: h, state: input("2026-08-11T18:20:00Z"), worldAnchor: { observed: W1 },
  });
  assert.equal(r.ok, true, `anchored save refused: ${r.reason}`);
  assert.equal(typeof r.world_anchor_ref, "string");
  assert.match(r.world_anchor_ref, /^sha256:[0-9a-f]{64}$/);

  const receipt = await readJson(receiptPath(h, r.receipt_hash));
  assert.equal(receipt.schema, kernel.SEASON_RECEIPT_SCHEMA_V0_2);
  assert.equal(receipt.world_anchor_ref, r.world_anchor_ref);
  assert.equal(kernel.verifySeasonReceipt(receipt, r.state).ok, true);

  // The anchor object is durable, content-addressed, and re-derivable.
  const anchor = await readJson(anchorPath(h, r.world_anchor_ref));
  assert.equal(kernel.verifyWorldAnchor(anchor).ok, true);
  assert.equal(anchor.anchor_hash, r.world_anchor_ref);

  const loaded = await store.loadSeasonHead({ demaHome: h, seasonId: SEASON });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.world_anchor, "WORLD_ANCHOR_MATCH");
});

// ── B-04 · the strip attack ─────────────────────────────────────────────────
test("B-04: stripping world_anchor_ref from a v0.2 receipt is a fail-closed integrity failure", async () => {
  const h = await home();
  const r = await store.saveSeasonState({
    demaHome: h, state: input("2026-08-11T18:30:00Z"), worldAnchor: { observed: W1 },
  });
  assert.equal(r.ok, true);

  const p = receiptPath(h, r.receipt_hash);
  const receipt = await readJson(p);
  delete receipt.world_anchor_ref;
  await writeFile(p, JSON.stringify(receipt, null, 2) + "\n");

  // Direct verification refuses the stripped object…
  assert.equal(kernel.verifySeasonReceipt(receipt, r.state).ok, false);
  // …and the production load path refuses the publication.
  const loaded = await store.loadSeasonHead({ demaHome: h, seasonId: SEASON });
  assert.equal(loaded.ok, false, "a stripped anchor reference must invalidate the publication");
  assert.match(String(loaded.reason), /receipt/,
    "the refusal must be a receipt-integrity refusal, not an incidental one");
});

// ── B-05 · the downgrade attack ─────────────────────────────────────────────
test("B-05: rewriting a v0.2 receipt as internally-consistent v0.1 is refused, never read as legacy", async () => {
  const h = await home();
  const r = await store.saveSeasonState({
    demaHome: h, state: input("2026-08-11T18:40:00Z"), worldAnchor: { observed: W1 },
  });
  assert.equal(r.ok, true);

  // Forge: drop the ref, rewrite schema to v0.1, RECOMPUTE the hash so the
  // object is internally consistent. Content addressing + HEAD/fence binding
  // must still refuse it — the file sits at the OLD hash's address and HEAD
  // names the OLD hash.
  const p = receiptPath(h, r.receipt_hash);
  const receipt = await readJson(p);
  delete receipt.world_anchor_ref;
  receipt.schema = kernel.SEASON_RECEIPT_SCHEMA;
  delete receipt.receipt_hash;
  const forged = { ...receipt, receipt_hash: sha256CanonicalJsonV1(receipt) };
  assert.equal(kernel.verifySeasonReceipt(forged, r.state).ok, true,
    "control: the forgery must be internally consistent or this test proves nothing");
  await writeFile(p, JSON.stringify(forged, null, 2) + "\n");

  const loaded = await store.loadSeasonHead({ demaHome: h, seasonId: SEASON });
  assert.equal(loaded.ok, false, "an internally-consistent downgrade must still be refused");
  assert.notEqual(loaded.world_anchor, "LEGACY_WORLD_ANCHOR_ABSENT",
    "a downgraded v0.2 publication must never be classified as legitimate legacy");
  // Bounded claim: this proves downgrade resistance under the existing
  // authoritative chain (content address + HEAD + fence). An attacker who can
  // rewrite EVERY local trust artifact is out of scope and stated so.
});

// ── B-06 · negative verifier control ────────────────────────────────────────
test("B-06: an anchor-blind verifier accepts the strip attack the real verifier refuses", async () => {
  const h = await home();
  const r = await store.saveSeasonState({
    demaHome: h, state: input("2026-08-11T18:50:00Z"), worldAnchor: { observed: W1 },
  });
  const p = receiptPath(h, r.receipt_hash);
  const valid = await readJson(p);

  // The blind verifier a lazy implementation would ship: presence and shape,
  // no hash re-derivation. It accepts the valid receipt (as the real one does)…
  const anchorBlind = (receipt) =>
    receipt && typeof receipt.receipt_hash === "string" &&
    String(receipt.schema).startsWith("bizra.dema.node0_season_save_receipt");
  assert.equal(anchorBlind(valid), true);
  assert.equal(kernel.verifySeasonReceipt(valid, r.state).ok, true);

  // …and on the attack inputs the two verdicts MUST diverge, proving the real
  // verifier's sensitivity to the field is load-bearing rather than incidental.
  const stripped = { ...valid };
  delete stripped.world_anchor_ref;
  assert.equal(anchorBlind(stripped), true, "control: the blind verifier must miss the strip");
  assert.equal(kernel.verifySeasonReceipt(stripped, r.state).ok, false);

  const tampered = { ...valid, world_anchor_ref: "sha256:" + "0".repeat(64) };
  assert.equal(anchorBlind(tampered), true, "control: the blind verifier must miss the tamper");
  assert.equal(kernel.verifySeasonReceipt(tampered, r.state).ok, false,
    "changing the ref without recomputing receipt_hash must be receipt_hash_mismatch");
});

// ── B-07 · legacy resume withholds, reports, never baselines ────────────────
test("B-07: v0.1 resume is LEGACY_WORLD_ANCHOR_ABSENT — withheld, reported, no auto-baseline", async () => {
  const h = await home();
  const saved = await store.saveSeasonState({ demaHome: h, state: input("2026-08-11T19:00:00Z") });
  assert.equal(saved.ok, true);
  assert.equal(saved.world_anchor_ref, null, "a legacy save must not invent an anchor");

  const resume = await store.resumeSeason({
    demaHome: h, seasonId: SEASON, repositoryCommit: SHA_A, repositoryTree: SHA_A,
  });
  assert.equal(resume.ok, false, "legacy resume must withhold continuation");
  assert.equal(resume.outcome, "CONTINUATION_WITHHELD");
  assert.equal(resume.world_anchor, "LEGACY_WORLD_ANCHOR_ABSENT");
  assert.equal(resume.continuation, undefined, "the continuation payload must not be handed out");
  assert.equal(resume.consent_granted, false);

  // Reporting stays legible: status verifies and NAMES the classification.
  const status = await store.seasonStatus({ demaHome: h, seasonId: SEASON });
  assert.equal(status.ok, true);
  assert.equal(status.world_anchor, "LEGACY_WORLD_ANCHOR_ABSENT");
  assert.equal(status.pending_consent_pending, true, "B-11: consent survives as PENDING");

  // No auto-baseline: neither resume nor status created an anchor expectation.
  assert.equal(existsSync(store._internal.anchorsDir(h, SEASON)), false,
    "observation authorized its own expectation — the exact defect 0B exists to refuse");
});

// ── B-08 · missing anchor fails closed ──────────────────────────────────────
test("B-08: a v0.2 publication whose anchor object is gone refuses everywhere", async () => {
  const h = await home();
  const r = await store.saveSeasonState({
    demaHome: h, state: input("2026-08-11T19:10:00Z"), worldAnchor: { observed: W1 },
  });
  assert.equal(r.ok, true);
  await unlink(anchorPath(h, r.world_anchor_ref));

  const loaded = await store.loadSeasonHead({ demaHome: h, seasonId: SEASON });
  assert.equal(loaded.ok, false);
  assert.equal(loaded.reason, "world_anchor_missing");

  const resume = await store.resumeSeason({
    demaHome: h, seasonId: SEASON, repositoryCommit: SHA_A, repositoryTree: SHA_A,
  });
  assert.equal(resume.ok, false);

  // Fail closed forward too: nothing may build on an unverifiable world binding.
  const next = await store.saveSeasonState({ demaHome: h, state: input("2026-08-11T19:11:00Z") });
  assert.equal(next.ok, false, "a save must not extend a chain whose anchor cannot be verified");
});

// ── B-09 · invalid and incomparable are distinct refusals ───────────────────
test("B-09: corrupt anchor → WORLD_ANCHOR_INVALID; alien version → WORLD_ANCHOR_INCOMPARABLE", async () => {
  const h = await home();
  const r = await store.saveSeasonState({
    demaHome: h, state: input("2026-08-11T19:20:00Z"), worldAnchor: { observed: W1 },
  });
  assert.equal(r.ok, true);
  const p = anchorPath(h, r.world_anchor_ref);
  const good = await readJson(p);

  // Invalid: body changed, hash not recomputed — integrity failure.
  const rotten = { ...good, observed: { world: "someone-else" } };
  await writeFile(p, JSON.stringify(rotten, null, 2) + "\n");
  let loaded = await store.loadSeasonHead({ demaHome: h, seasonId: SEASON });
  assert.equal(loaded.ok, false);
  assert.equal(loaded.reason, "world_anchor_invalid");

  // Incomparable: same anchor family, a version this verifier cannot compare.
  // Internally consistent on purpose — the refusal must be about VERSION, not rot.
  const alienBody = { ...good, schema: "bizra.dema.realm0_world_anchor.v9.9" };
  delete alienBody.anchor_hash;
  const alien = { ...alienBody, anchor_hash: sha256CanonicalJsonV1(alienBody) };
  await writeFile(p, JSON.stringify(alien, null, 2) + "\n");
  loaded = await store.loadSeasonHead({ demaHome: h, seasonId: SEASON });
  assert.equal(loaded.ok, false);
  assert.equal(loaded.reason, "world_anchor_incomparable",
    "an unknown observer-contract version is INCOMPARABLE — neither valid nor rot");
});

// ── B-10 · crash between anchor durability and receipt publication ──────────
test("B-10: an orphan anchor grants nothing; the old HEAD stays authoritative", async () => {
  const h = await home();
  // Establish a legacy HEAD first so "old HEAD" is a real object, not absence.
  const first = await store.saveSeasonState({ demaHome: h, state: input("2026-08-11T19:30:00Z") });
  assert.equal(first.ok, true);

  await assert.rejects(() => store.saveSeasonState({
    demaHome: h,
    state: input("2026-08-11T19:31:00Z", { completed_steps: ["S2"] }),
    worldAnchor: { observed: W1 },
    hooks: { afterAnchorPublish: async () => { throw new Error("simulated death after anchor"); } },
  }));

  // The anchor object is durable — write-ahead — yet authority never moved.
  const anchors = await readdir(store._internal.anchorsDir(h, SEASON));
  assert.equal(anchors.length, 1, "control: the orphan anchor must exist or this proves nothing");
  const loaded = await store.loadSeasonHead({ demaHome: h, seasonId: SEASON });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.state_hash, first.state_hash, "old HEAD must remain authoritative");
  assert.equal(loaded.world_anchor, "LEGACY_WORLD_ANCHOR_ABSENT");
});

// ── B-11 · withholding results change nothing ───────────────────────────────
test("B-11: every withholding outcome leaves the state bytes and pending consent untouched", async () => {
  const h = await home();
  const saved = await store.saveSeasonState({ demaHome: h, state: input("2026-08-11T19:40:00Z") });
  const statePath = saved.state_path;
  const before = await readFile(statePath, "utf8");

  const resume = await store.resumeSeason({
    demaHome: h, seasonId: SEASON, repositoryCommit: SHA_A, repositoryTree: SHA_A,
  });
  assert.equal(resume.ok, false);
  assert.equal(resume.executed, false);
  assert.equal(resume.mutated, false);
  assert.equal(resume.consent_granted, false);

  const after = await readFile(statePath, "utf8");
  assert.equal(after, before, "a withholding resume mutated durable state");
  assert.equal(JSON.parse(after).pending_consent.length, 1, "consent must survive as PENDING");
});

// ── B-13 · fresh-process resolution through the production seam ─────────────
test("B-13: a fresh OS process recovers HEAD → receipt → ref → anchor → MATCH from disk alone", async () => {
  const h = await home();
  const r = await store.saveSeasonState({
    demaHome: h, state: input("2026-08-11T19:50:00Z"), worldAnchor: { observed: W1 },
  });
  assert.equal(r.ok, true);

  // The child gets two strings. No object passing, no shared memory, no fixture
  // seam production lacks — it imports the production module and resolves.
  const script = `
    import(${JSON.stringify(join(REPO_ROOT, "packages/receipts/src/season-state-store.js"))}).then(async (m) => {
      const resume = await m.resumeSeason({
        demaHome: ${JSON.stringify(h)}, seasonId: ${JSON.stringify(SEASON)},
        repositoryCommit: ${JSON.stringify(SHA_A)}, repositoryTree: ${JSON.stringify(SHA_A)},
      });
      process.stdout.write(JSON.stringify({
        ok: resume.ok, world_anchor: resume.world_anchor,
        world_anchor_ref: resume.world_anchor_ref ?? null,
        has_continuation: resume.continuation !== undefined,
        next: resume.continuation?.next_safe_action ?? null,
      }));
    });`;
  const { stdout } = await execFileAsync("node", ["--input-type=module", "-e", script]);
  const child = JSON.parse(stdout);
  assert.equal(child.ok, true, "fresh process must recover the anchored continuation");
  assert.equal(child.world_anchor, "WORLD_ANCHOR_MATCH");
  assert.equal(child.world_anchor_ref, r.world_anchor_ref);
  assert.equal(child.has_continuation, true);
  assert.equal(child.next, "RUN_PROOF_GATE");
});

// ── B-14 / §23 · crash, world change, retry — R1/W1 win, R2/W2 are orphans ──
test("B-14: a world-changed retry repairs HEAD to the fence's R1/W1, never R2/W2", async () => {
  const h = await home();

  // Writer A: state S, anchor W1, receipt R1 — dies after winning the fence.
  await assert.rejects(() => store.saveSeasonState({
    demaHome: h, state: input("2026-08-11T20:00:00Z"), worldAnchor: { observed: W1 },
    hooks: { afterFencePublish: async () => { throw new Error("simulated death before HEAD"); } },
  }));
  const fence = await readJson(
    join(store._internal.seqDir(h, SEASON), store._internal.seqName(1)));
  const r1 = await readJson(receiptPath(h, fence.receipt_hash));
  assert.equal(r1.schema, kernel.SEASON_RECEIPT_SCHEMA_V0_2,
    "control: the winning publication must be anchored or this proves nothing");

  // The world changes. Writer B retries the SAME semantic state under W2.
  const retry = await store.saveSeasonState({
    demaHome: h, state: input("2026-08-11T20:00:45Z"), worldAnchor: { observed: W2 },
  });
  assert.equal(retry.ok, true, `retry must repair, got: ${retry.reason}`);
  assert.equal(retry.adopted_existing_publication, true);

  // §24 return-value consistency: every reported publication field is R1's.
  assert.equal(retry.receipt_hash, fence.receipt_hash);
  assert.equal(retry.world_anchor_ref, r1.world_anchor_ref,
    "the result described the loser's anchor — publication identity split one layer higher");

  // HEAD → R1 → W1, verified end to end.
  const loaded = await store.loadSeasonHead({ demaHome: h, seasonId: SEASON });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.receipt.receipt_hash, fence.receipt_hash);
  assert.equal(loaded.receipt.world_anchor_ref, r1.world_anchor_ref);
  assert.equal(loaded.world_anchor, "WORLD_ANCHOR_MATCH");

  // The loser's artifacts survive as orphan evidence with zero authority.
  const anchors = (await readdir(store._internal.anchorsDir(h, SEASON))).sort();
  assert.equal(anchors.length, 2, "W2 must survive as an orphan, not be erased");
  assert.notEqual(loaded.receipt.world_anchor_ref, retry.candidate_world_anchor_ref ?? "absent",
    "HEAD must never reference the loser's anchor");
});

// ── PI-09 × 0B · recovery reverifies the winner's ANCHOR too ────────────────
test("PI-09×0B: retry against a fence-owned v0.2 receipt whose anchor is lost refuses recovery", async () => {
  const h = await home();
  await assert.rejects(() => store.saveSeasonState({
    demaHome: h, state: input("2026-08-11T20:10:00Z"), worldAnchor: { observed: W1 },
    hooks: { afterFencePublish: async () => { throw new Error("simulated death before HEAD"); } },
  }));
  const fence = await readJson(
    join(store._internal.seqDir(h, SEASON), store._internal.seqName(1)));
  const r1 = await readJson(receiptPath(h, fence.receipt_hash));

  // W1 is lost between crash and retry.
  await unlink(anchorPath(h, r1.world_anchor_ref));

  const retry = await store.saveSeasonState({
    demaHome: h, state: input("2026-08-11T20:10:30Z"), worldAnchor: { observed: W2 },
  });
  assert.equal(retry.ok, false,
    "repairing HEAD to a publication whose anchor cannot be verified is the fail-open 0B forbids");
  assert.equal(retry.reason, "publication_recovery_required");

  const head = await store.loadSeasonHead({ demaHome: h, seasonId: SEASON });
  assert.equal(head.outcome, "EMPTY", "no HEAD may be published during a failed recovery");
});

// ── production wiring · the CLI consumes this exact module ──────────────────
test("wiring: the shipped season CLI imports the store whose contract B-01…B-14 just proved", async () => {
  const src = await readFile(join(REPO_ROOT, "apps/cli/src/commands/season.js"), "utf8");
  assert.match(src, /from\s+["'].*packages\/receipts\/src\/season-state-store\.js["']/,
    "the CLI must consume the production store, or these proofs govern nothing the operator runs");
  for (const fn of ["saveSeasonState", "resumeSeason", "seasonStatus"]) {
    assert.ok(src.includes(fn), `CLI must reference ${fn}`);
  }
  assert.ok(src.includes("--world-anchor-observed"),
    "the CLI must expose the anchor seam — without it no operator save can ever be anchored");
});
