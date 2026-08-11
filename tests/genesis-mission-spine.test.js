// GENESIS-MISSION-SPINE-1A — GS-01…GS-13.
//
// Contract: BIZRA-GENESIS-LOOP-1A §5, stages 1–5, composed from shipped kernels
// and HALTING AT THE CONSENT GATE. The spine walks:
//
//   INTENTION      compileIntentPacket        (fail-closed atoms, risk classes)
//   RISK_ENVELOPE  reversible-local only      (LOW/MEDIUM; HIGH refuses)
//   PREVIEW        buildDemaReversibleFileStewardPayload
//                  → content_hash IS the sealed preview hash (§5.4)
//   CONSENT_GATE   evaluateCorridorSeasonConsentBridge with
//                  prepared_intent_hash = preview_hash (§5.5: consent binds the
//                  PREVIEW, not a category of work)
//
// THE HALT IS STRUCTURAL. The spine never imports the steward execution module;
// PERMIT_PREVIEW is its terminal success and grants nothing: no nonce, no
// pending effect, no mutation, authority_delta 0. Stages 6–9 (bounded action,
// judge-free verification, receipt, undo) are later, separately consented acts.
//
// §5.5's material-change law is the load-bearing control (GS-06): consent
// captured against preview A must BLOCK when replayed against preview B,
// because the consent context hash derives from prepared_intent_hash.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { saveSeasonState, loadSeasonHead } from "../packages/receipts/src/season-state-store.js";
import { canonicalSeasonAction } from "../packages/core/src/node0-minimum-season-save-resume.js";
import { readExecutingRepositoryBinding } from "../packages/mission/src/executing-repository-binding.js";
import { buildDemaReversibleFileStewardPayload } from "../packages/core/src/dema-reversible-file-steward.js";
import {
  walkGenesisMissionSpine,
  GENESIS_MISSION_SPINE_SCHEMA,
  SPINE_STAGES,
  SPINE_RISK_ENVELOPE,
} from "../packages/mission/src/genesis-mission-spine.js";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const SPINE_SRC = `${REPO}packages/mission/src/genesis-mission-spine.js`;

const EXEC_COMMIT = "1111111111111111111111111111111111111111";
const EXEC_TREE = "2222222222222222222222222222222222222222";
const ACTION = "RUN_GENESIS_MISSION_SPINE";
const CANON = canonicalSeasonAction(ACTION);
const SEASON = "genesis-spine-season";
const MISSION = "genesis-mission-001";
const NOW = "2026-08-11T12:00:00Z";

const INTENTION = "Create the canonical manifest receipt";
const EFFECT = Object.freeze({
  sandbox_root: "/tmp/genesis-sb",
  atoms: [{ from: "a.md", to: "canonical-a.md" }],
});
const EFFECT_B = Object.freeze({
  sandbox_root: "/tmp/genesis-sb",
  atoms: [{ from: "b.md", to: "canonical-b.md" }],
});

const homes = [];
async function newHome() {
  const h = await mkdtemp(join(tmpdir(), "genesis-spine-"));
  homes.push(h);
  return h;
}
test.after(async () => {
  for (const h of homes) await rm(h, { recursive: true, force: true }).catch(() => {});
});

async function anchoredHome(over = {}) {
  const home = await newHome();
  const saved = await saveSeasonState({
    demaHome: home,
    state: {
      season_id: SEASON,
      mission_id: MISSION,
      mission_phase: "SPINE_WALK",
      completed_steps: [],
      next_safe_action: CANON,
      must_not_repeat: [],
      pending_consent: [],
      repository_commit: EXEC_COMMIT,
      repository_tree: EXEC_TREE,
      saved_at: "2026-08-11T09:00:00Z",
      ...over,
    },
    worldAnchor: { observed: { fixture: "genesis-spine-world" } },
  });
  assert.equal(saved.ok, true, `fixture save failed: ${saved.reason}`);
  return home;
}

const execBinding = (commit = EXEC_COMMIT, tree = EXEC_TREE) =>
  readExecutingRepositoryBinding({
    runGit: async (args) => (args.includes("HEAD^{tree}") ? `${tree}\n` : `${commit}\n`),
  });

function corridorContext(over = {}) {
  return {
    kind: "START",
    mission_id: MISSION,
    contract_hash: `sha256:${"c".repeat(64)}`,
    permitted_actions: ["analyze", "edit", "test"],
    mission_root: "/tmp/genesis-mission-root",
    nonce: "genesis-nonce-0001",
    expires_at: "2026-08-11T23:59:59Z",
    ...over,
  };
}

async function walk(over = {}) {
  const home = over.home ?? (await anchoredHome(over.seasonOver ?? {}));
  const seasonLoad = await loadSeasonHead({ demaHome: home, seasonId: over.seasonId ?? SEASON });
  return {
    home,
    r: walkGenesisMissionSpine({
      intention: over.intention ?? INTENTION,
      effect: over.effect ?? EFFECT,
      seasonLoad,
      executingRepository: over.executingRepository ?? (await execBinding()),
      actionId: over.actionId ?? ACTION,
      corridorContext: over.corridorContext ?? corridorContext(),
      presentedPhrase: over.presentedPhrase,
      presentedConsentContextHash: over.presentedConsentContextHash,
      now: over.now ?? NOW,
      usedNonces: over.usedNonces ?? [],
    }),
  };
}

/** Non-grant invariants that must hold on EVERY returned path — the halt. */
function assertGrantsNothing(r) {
  assert.equal(r.authority_delta, 0);
  assert.equal(r.grants_execution, false);
  assert.equal(r.effect_executed, false);
  assert.equal(r.nonce_claimed, false);
  assert.equal(r.pending_effect_created, false);
  assert.ok(Object.isFrozen(r), "spine result must be frozen");
}

// ── GS-01 · unresolvable intention fails closed at stage 1 ──────────────────
test("GS-01: an unresolvable intention refuses at INTENTION and never reaches consent", async () => {
  const { r } = await walk({ intention: "Frobnicate the quux" });
  assert.equal(r.ok, false);
  assert.equal(r.stage, "INTENTION");
  assert.equal(r.verdict, "REFUSED");
  assert.equal(r.reason, "intent_not_route_eligible");
  assert.ok(r.blocked_by.includes("action_unclassified"));
  assert.equal(r.preview_hash, null, "no preview may be sealed for an unbound intent");
  assert.equal(r.consent, null, "the consent gate must never see an unbound intent");
  assertGrantsNothing(r);
});

// ── GS-02 · a HIGH-risk intention exceeds the reversible envelope ───────────
test("GS-02: a validated but HIGH-risk intention refuses at RISK_ENVELOPE", async () => {
  const { r } = await walk({ intention: "Merge main" });
  assert.equal(r.ok, false);
  assert.equal(r.stage, "RISK_ENVELOPE");
  assert.equal(r.reason, "risk_exceeds_reversible_envelope");
  assert.ok(r.blocked_by.includes("risk:HIGH"));
  assert.ok(r.intent_packet_hash, "the packet WAS compiled — refusal is about envelope, not parsing");
  assert.equal(r.preview_hash, null);
  assertGrantsNothing(r);
});

// ── GS-03 · a non-reversible effect cannot become a sealed preview ──────────
test("GS-03: a noop/non-reversible effect refuses at PREVIEW", async () => {
  const { r } = await walk({ effect: { sandbox_root: "/tmp/genesis-sb", atoms: [{ from: "a.md", to: "a.md" }] } });
  assert.equal(r.ok, false);
  assert.equal(r.stage, "PREVIEW");
  assert.equal(r.reason, "preview_not_executable");
  assert.equal(r.consent, null);
  assertGrantsNothing(r);
});

// ── GS-04 · the gate names what must be typed; nothing is granted ───────────
test("GS-04: without a phrase the walk halts at CONSENT_REQUIRED with the binding exposed", async () => {
  const { r } = await walk({});
  assert.equal(r.ok, false);
  assert.equal(r.stage, "CONSENT_GATE");
  assert.equal(r.verdict, "CONSENT_REQUIRED");
  assert.equal(typeof r.consent.required_phrase, "string");
  assert.match(r.consent.consent_context_hash ?? "", /^sha256:/);
  // §5.4: the sealed preview is content-addressed and reported.
  const expected = buildDemaReversibleFileStewardPayload(EFFECT);
  assert.equal(r.preview_hash, expected.content_hash);
  assert.equal(r.preview.all_reversible, true);
  assert.ok(r.intent_packet_hash.startsWith("sha256:"));
  assertGrantsNothing(r);
});

// ── GS-05 · the two-step human flow succeeds and STILL grants nothing ───────
test("GS-05: exact phrase + exact context hash → PERMIT_PREVIEW, and the spine halts", async () => {
  const home = await anchoredHome();
  const probe = (await walk({ home })).r;
  assert.equal(probe.verdict, "CONSENT_REQUIRED", "control: probe must demand consent");
  const { r } = await walk({
    home,
    presentedPhrase: probe.consent.required_phrase,
    presentedConsentContextHash: probe.consent.consent_context_hash,
  });
  assert.equal(r.ok, true, `blocked_by: ${r.blocked_by.join(",")}`);
  assert.equal(r.stage, "CONSENT_GATE");
  assert.equal(r.verdict, "PERMIT_PREVIEW");
  assert.equal(r.consent.consent_verified, true);
  // THE HALT: verified consent is the terminal success of this slice.
  assertGrantsNothing(r);
});

// ── GS-06 · §5.5 — consent binds the preview; a changed effect invalidates it ─
test("GS-06: consent captured for preview A BLOCKS when replayed against preview B", async () => {
  const home = await anchoredHome();
  const probeA = (await walk({ home })).r;
  const { r } = await walk({
    home,
    effect: EFFECT_B, // material change after consent capture
    presentedPhrase: probeA.consent.required_phrase,
    presentedConsentContextHash: probeA.consent.consent_context_hash,
  });
  assert.equal(r.ok, false);
  assert.equal(r.verdict, "BLOCK",
    "consent for one preview must never authorize a different one — the §5.5 law");
  assert.equal(r.consent.consent_verified, false);
  assert.notEqual(r.preview_hash, probeA.preview_hash, "control: the previews genuinely differ");
  assertGrantsNothing(r);
});

// ── GS-07 · a wrong phrase blocks ───────────────────────────────────────────
test("GS-07: a wrong phrase BLOCKS at the gate", async () => {
  const home = await anchoredHome();
  const probe = (await walk({ home })).r;
  const { r } = await walk({
    home,
    presentedPhrase: "GO: something else entirely",
    presentedConsentContextHash: probe.consent.consent_context_hash,
  });
  assert.equal(r.verdict, "BLOCK");
  assert.equal(r.consent.consent_verified, false);
  assertGrantsNothing(r);
});

// ── GS-08 · no authoritative season → the gate refuses before consent ───────
test("GS-08: an empty home refuses at the season stage of the gate", async () => {
  const home = await newHome(); // no save — EMPTY, orphans are never authority
  const { r } = await walk({ home });
  assert.equal(r.ok, false);
  assert.equal(r.stage, "CONSENT_GATE");
  assert.equal(r.verdict, "REFUSED");
  assert.equal(r.consent.stage, "SEASON_LOAD");
  assertGrantsNothing(r);
});

// ── GS-09 · the executing repository must match the season's claim ──────────
test("GS-09: a repository mismatch refuses at REPOSITORY_BINDING", async () => {
  const { r } = await walk({
    executingRepository: await execBinding("9".repeat(40), "8".repeat(40)),
  });
  assert.equal(r.ok, false);
  assert.equal(r.consent.stage, "REPOSITORY_BINDING");
  assert.ok(r.blocked_by.includes("repository_commit_mismatch"));
  assertGrantsNothing(r);
});

// ── GS-10 · the season must name this action ────────────────────────────────
test("GS-10: an action the season does not name refuses at SEASON_AUTHORITY", async () => {
  const { r } = await walk({ actionId: "SOME_OTHER_ACTION" });
  assert.equal(r.ok, false);
  assert.equal(r.consent.stage, "SEASON_AUTHORITY");
  assertGrantsNothing(r);
});

// ── GS-11 · preview identity is content-addressed and deterministic ─────────
test("GS-11: the same effect seals the same preview hash; a different effect differs", async () => {
  const home = await anchoredHome();
  const r1 = (await walk({ home })).r;
  const r2 = (await walk({ home })).r;
  assert.equal(r1.preview_hash, r2.preview_hash);
  const r3 = (await walk({ home, effect: EFFECT_B })).r;
  assert.notEqual(r3.preview_hash, r1.preview_hash);
});

// ── GS-12 · the halt is structural, not behavioral ──────────────────────────
test("GS-12: the spine module cannot execute — it never imports an execution surface", () => {
  const src = readFileSync(SPINE_SRC, "utf8");
  assert.ok(src.length > 1500, "control: spine source unexpectedly small");
  assert.equal(src.includes("dema-reversible-file-steward-execution"), false,
    "the spine must not import the steward EXECUTION module");
  assert.equal(src.includes("sequenceExecuteStewardJob"), false);
  assert.equal(/from\s+["'][^"']*season-state-store\.js["']/.test(src), false,
    "the spine reads season state only through the INJECTED load — no ambient store access");
  assert.equal(src.includes("node:fs"), false, "pure kernel: no filesystem");
  assert.equal(src.includes("node:child_process"), false);
});

// ── GS-13 · schema surface ──────────────────────────────────────────────────
test("GS-13: stages and envelope are closed vocabularies", () => {
  assert.deepEqual([...SPINE_STAGES], ["INTENTION", "RISK_ENVELOPE", "PREVIEW", "CONSENT_GATE"]);
  assert.deepEqual([...SPINE_RISK_ENVELOPE], ["LOW", "MEDIUM"]);
  assert.match(GENESIS_MISSION_SPINE_SCHEMA, /^bizra\.dema\.genesis_mission_spine\.v0\.1$/);
});
