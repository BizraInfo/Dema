// NODE0-CORRIDOR-SEASON-CONSENT-BRIDGE-1A — authoritative Season → root-bound consent.
//
// The load-bearing tests are B6-B9. B6/B7 prove the bridge compares the Season
// State's CLAIMED repository binding against the INDEPENDENTLY MEASURED executing
// repository; B8/B9 prove the product route never feeds the state's own fields
// back in as the expected values.
//
// That defect is why the superseded attempt was refused: `verifyRepositoryBinding`
// compares `state.repository_commit !== repositoryCommit`, so passing the state's
// own field as the expected value is `x !== x` — always false, always ok. A test
// that exercises only the pure kernel cannot catch it; it has to exercise the
// route.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { saveSeasonState, loadSeasonHead } from "../packages/receipts/src/season-state-store.js";
import { canonicalSeasonAction } from "../packages/core/src/node0-minimum-season-save-resume.js";
import {
  evaluateCorridorSeasonConsentBridge,
  CORRIDOR_SEASON_CONSENT_BRIDGE_SCHEMA,
} from "../packages/mission/src/corridor-season-consent-bridge.js";
import { readExecutingRepositoryBinding } from "../packages/mission/src/executing-repository-binding.js";
import { corridorRequiredPhrase } from "../packages/mission/src/mission-corridor.js";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const BRIDGE = `${REPO}packages/mission/src/corridor-season-consent-bridge.js`;
const MISSION_CLI = `${REPO}apps/cli/src/commands/mission.js`;

const EXEC_COMMIT = "1111111111111111111111111111111111111111";
const EXEC_TREE = "2222222222222222222222222222222222222222";
const OTHER_COMMIT = "9999999999999999999999999999999999999999";
const OTHER_TREE = "8888888888888888888888888888888888888888";

const ACTION = "CORRIDOR_RENAME_EXECUTE";
const CANON = canonicalSeasonAction(ACTION);
const SEASON = "bridge-season";
const MISSION = "bridge-mission";
const ROOT = "/tmp/bridge-mission-root";
const NONCE = "bridge-nonce-0001";
const EXPIRES = "2026-08-05T23:59:59Z";
const NOW = "2026-08-05T12:00:00Z";
const KIND = "START";
const CONTRACT_HASH = `sha256:${"c".repeat(64)}`;
const PERMITTED = Object.freeze(["analyze", "edit", "test"]);

const homes = [];
async function newHome() {
  const h = await mkdtemp(join(tmpdir(), "dema-bridge-"));
  homes.push(h);
  return h;
}
test.after(async () => {
  for (const h of homes) await rm(h, { recursive: true, force: true }).catch(() => {});
});

function seasonInput(over = {}) {
  return {
    season_id: SEASON,
    mission_id: MISSION,
    mission_phase: "LOCAL_EFFECT_PREPARED",
    completed_steps: [],
    next_safe_action: CANON,
    must_not_repeat: [],
    pending_consent: [{ phrase: "GO: stop mission corridor bridge", scope: "corridor" }],
    repository_commit: EXEC_COMMIT,
    repository_tree: EXEC_TREE,
    saved_at: "2026-08-05T09:00:00Z",
    ...over,
  };
}

async function storeWith(over = {}) {
  const home = await newHome();
  const saved = await saveSeasonState({ demaHome: home, state: seasonInput(over) });
  assert.equal(saved.ok, true, `fixture save failed: ${saved.reason}`);
  return home;
}

// The trusted seam, driven by an injected runner so no test depends on ambient git.
const execBinding = (commit = EXEC_COMMIT, tree = EXEC_TREE) =>
  readExecutingRepositoryBinding({
    runGit: async (args) => (args.includes("HEAD^{tree}") ? `${tree}\n` : `${commit}\n`),
  });

function corridorContext(over = {}) {
  return {
    kind: KIND,
    mission_id: MISSION,
    contract_hash: CONTRACT_HASH,
    permitted_actions: [...PERMITTED],
    mission_root: ROOT,
    nonce: NONCE,
    expires_at: EXPIRES,
    ...over,
  };
}

async function bridge(over = {}) {
  const home = over.home ?? (await storeWith(over.seasonOver ?? {}));
  const seasonLoad = await loadSeasonHead({ demaHome: home, seasonId: over.seasonId ?? SEASON });
  return evaluateCorridorSeasonConsentBridge({
    seasonLoad,
    executingRepository: over.executingRepository ?? (await execBinding()),
    actionId: over.actionId ?? ACTION,
    corridorContext: over.corridorContext ?? corridorContext(),
    presentedPhrase: over.presentedPhrase,
    presentedConsentContextHash: over.presentedConsentContextHash,
    now: over.now ?? NOW,
    usedNonces: over.usedNonces ?? [],
  });
}

// Non-grant invariants that must hold on EVERY returned path.
function assertGrantsNothing(r) {
  assert.equal(r.authority_delta, 0);
  assert.equal(r.grants_execution, false);
  assert.equal(r.nonce_claimed, false);
  assert.equal(r.pending_effect_created, false);
  assert.equal(r.transaction_prepared, false);
  assert.equal(r.effect_executed, false);
  assert.ok(Object.isFrozen(r), "result must be frozen");
}

// ── B1–B2 · the product surface demands authoritative selection ────────────

test("B1 missing --season refuses", () => {
  const cli = readFileSync(MISSION_CLI, "utf8");
  assert.ok(cli.includes('argValue(argv, "--season")'), "the route does not read --season");
  assert.ok(cli.includes("season_selection_required"), "the route does not refuse without --season");
});

test("B2 missing --dema-home refuses", () => {
  const cli = readFileSync(MISSION_CLI, "utf8");
  assert.ok(cli.includes("dema_home_required"), "the route does not refuse without --dema-home");
  // The superseded caller-supplied state-file authority must be gone.
  assert.equal(cli.includes('"--season-state"'), false, "the bypassed --season-state surface is still present");
});

// ── B3–B5 · authoritative store behavior ───────────────────────────────────

test("B3 unknown Season refuses", async () => {
  const home = await newHome();
  const r = await bridge({ home, seasonId: SEASON });
  assert.equal(r.verdict, "REFUSED");
  assert.equal(r.stage, "SEASON_LOAD");
  assert.match(r.reason, /season_not_authoritative|season_load_refused/);
  assertGrantsNothing(r);
});

test("B4 ambiguous Season selection refuses", async () => {
  const home = await storeWith();
  // Forge a competing sequence fence: HEAD now names a different winner than the
  // fence that decided this sequence. Neither candidate may be trusted.
  const fence = join(home, "seasons", SEASON, "seq", "000001.json");
  const original = JSON.parse(await readFile(fence, "utf8"));
  await writeFile(fence, JSON.stringify({ ...original, state_hash: `sha256:${"0".repeat(64)}` }));
  const r = await bridge({ home });
  assert.equal(r.verdict, "REFUSED");
  assert.equal(r.stage, "SEASON_LOAD");
  assert.match(r.reason, /head_candidates_conflict/);
  assertGrantsNothing(r);
});

test("B5 corrupt authoritative Season State refuses", async () => {
  const home = await storeWith();
  const head = JSON.parse(await readFile(join(home, "seasons", SEASON, "HEAD.json"), "utf8"));
  const obj = join(home, "seasons", SEASON, "states", `${head.state_hash.replace(":", "-")}.json`);
  const state = JSON.parse(await readFile(obj, "utf8"));
  await writeFile(obj, JSON.stringify({ ...state, mission_phase: "TAMPERED" }));
  const r = await bridge({ home });
  assert.equal(r.verdict, "REFUSED");
  assert.equal(r.stage, "SEASON_LOAD");
  assertGrantsNothing(r);
});

// ── B6–B9 · THE CORRECTION ─────────────────────────────────────────────────

test("B6 a valid state claiming another commit refuses against the executing commit", async () => {
  const home = await storeWith({ repository_commit: OTHER_COMMIT });
  const r = await bridge({ home });
  assert.equal(r.verdict, "REFUSED");
  assert.equal(r.stage, "REPOSITORY_BINDING");
  assert.equal(r.reason, "repository_commit_mismatch");
  assert.equal(r.claimed_repository_commit, OTHER_COMMIT);
  assert.equal(r.executing_repository_commit, EXEC_COMMIT);
  assert.equal(r.repository_binding_valid, false);
  assertGrantsNothing(r);
});

test("B7 a valid state claiming another tree refuses against the executing tree", async () => {
  const home = await storeWith({ repository_tree: OTHER_TREE });
  const r = await bridge({ home });
  assert.equal(r.verdict, "REFUSED");
  assert.equal(r.stage, "REPOSITORY_BINDING");
  assert.equal(r.reason, "repository_tree_mismatch");
  assert.equal(r.claimed_repository_tree, OTHER_TREE);
  assert.equal(r.executing_repository_tree, EXEC_TREE);
  assertGrantsNothing(r);
});

test("B8 the product route never supplies state.repository_commit as the expected commit", () => {
  const cli = readFileSync(MISSION_CLI, "utf8");
  // The exact self-referential expression that made the superseded route vacuous.
  assert.equal(
    /repositoryCommit:\s*(state|seasonState)\.repository_commit/.test(cli),
    false,
    "the route feeds the state's own claimed commit back in as the expected commit",
  );
  const bridgeSrc = readFileSync(BRIDGE, "utf8");
  assert.ok(bridgeSrc.includes("repositoryCommit: execCommit"), "the bridge does not pass the executing commit");
});

test("B9 the product route never supplies state.repository_tree as the expected tree", () => {
  const cli = readFileSync(MISSION_CLI, "utf8");
  assert.equal(
    /repositoryTree:\s*(state|seasonState)\.repository_tree/.test(cli),
    false,
    "the route feeds the state's own claimed tree back in as the expected tree",
  );
  const bridgeSrc = readFileSync(BRIDGE, "utf8");
  assert.ok(bridgeSrc.includes("repositoryTree: execTree"), "the bridge does not pass the executing tree");

  // Control: prove the guard is not vacuous — it MUST fire on the old expression.
  const superseded = "evaluateAuthority({ repositoryTree: state.repository_tree })";
  assert.equal(/repositoryTree:\s*(state|seasonState)\.repository_tree/.test(superseded), true,
    "control: the regex fails to detect the superseded defect");
});

// ── B10–B12 · Season policy ────────────────────────────────────────────────

test("B10 next_safe_action mismatch refuses", async () => {
  const home = await storeWith({ next_safe_action: "ACTION:SOMETHING_ELSE" });
  const r = await bridge({ home });
  assert.equal(r.verdict, "REFUSED");
  assert.equal(r.stage, "SEASON_AUTHORITY");
  assert.match(r.reason, /next_safe_action_mismatch/);
  assertGrantsNothing(r);
});

test("B11 exact must_not_repeat prohibition refuses", async () => {
  const home = await storeWith({ must_not_repeat: [CANON] });
  const r = await bridge({ home });
  assert.equal(r.verdict, "REFUSED");
  assert.equal(r.stage, "SEASON_AUTHORITY");
  assertGrantsNothing(r);
});

test("B12 duplicate canonical prohibition refuses", async () => {
  const home = await storeWith({ must_not_repeat: [CANON, CANON] });
  const r = await bridge({ home });
  assert.equal(r.verdict, "REFUSED");
  assert.equal(r.stage, "SEASON_AUTHORITY");
  assertGrantsNothing(r);
});

// ── B13–B14 · consent is required, and the route says exactly what to type ──

test("B13 eligible Season without consent returns CONSENT_REQUIRED", async () => {
  const r = await bridge({});
  assert.equal(r.verdict, "CONSENT_REQUIRED");
  assert.equal(r.stage, "CONSENT_REQUIRED");
  assert.equal(r.repository_binding_valid, true);
  assert.equal(r.season_authority_verdict, "ELIGIBLE_TO_REQUEST_CONSENT_AND_FATE");
  assert.equal(r.consent_presented, false);
  assert.equal(r.consent_verified, false);
  assertGrantsNothing(r);
});

test("B14 CONSENT_REQUIRED exposes the existing exact phrase and context hash", async () => {
  const r = await bridge({});
  assert.equal(r.required_phrase, corridorRequiredPhrase(KIND, MISSION, undefined));
  assert.ok(typeof r.consent_context_hash === "string" && r.consent_context_hash.length > 0);
  assert.equal(r.season_id, SEASON);
  assert.equal(r.authoritative_sequence, 1);
});

// ── B15–B19 · the existing root-bound evaluator still owns every binding ───

async function withPhrase(over = {}) {
  const home = over.home ?? (await storeWith());
  const probe = await bridge({ home });
  return bridge({
    home,
    presentedPhrase: over.phrase ?? probe.required_phrase,
    presentedConsentContextHash: over.contextHash ?? probe.consent_context_hash,
    corridorContext: over.corridorContext ?? corridorContext(),
    now: over.now ?? NOW,
    usedNonces: over.usedNonces ?? [],
  });
}

test("B15 wrong phrase blocks", async () => {
  const r = await withPhrase({ phrase: "GO: something else entirely" });
  assert.equal(r.verdict, "BLOCK");
  assert.equal(r.consent_verified, false);
  assertGrantsNothing(r);
});

test("B16 context mismatch blocks", async () => {
  const r = await withPhrase({ contextHash: `sha256:${"0".repeat(64)}` });
  assert.equal(r.verdict, "BLOCK");
  assert.ok(r.blocked_by.includes("consent_context_mismatch"), r.blocked_by.join(","));
  assertGrantsNothing(r);
});

test("B17 payload, scope, root or action-class mismatch blocks", async () => {
  const home = await storeWith();
  const probe = await bridge({ home });
  // Same phrase and same presented context hash, but the ACTUAL context about to
  // be written differs — a captured phrase must not replay against another write.
  for (const mutation of [
    { mission_root: "/tmp/some-other-root" },
    { permitted_actions: ["analyze", "edit", "test", "push"] },
    { contract_hash: `sha256:${"d".repeat(64)}` },
  ]) {
    const r = await bridge({
      home,
      presentedPhrase: probe.required_phrase,
      presentedConsentContextHash: probe.consent_context_hash,
      corridorContext: corridorContext(mutation),
    });
    assert.equal(r.verdict, "BLOCK", `mutation accepted: ${JSON.stringify(mutation)}`);
    assertGrantsNothing(r);
  }
});

test("B18 expired consent blocks", async () => {
  const r = await withPhrase({ now: "2026-08-06T00:00:01Z" });
  assert.equal(r.verdict, "BLOCK");
  assertGrantsNothing(r);
});

test("B19 replayed nonce input blocks without claiming a nonce", async () => {
  const r = await withPhrase({ usedNonces: [NONCE] });
  assert.equal(r.verdict, "BLOCK");
  assert.equal(r.nonce_claimed, false, "a nonce was claimed while blocking a replay");
  assertGrantsNothing(r);
});

// ── B20–B21 · the one success path, and what it does NOT mean ──────────────

test("B20 exact root-bound consent returns PERMIT_PREVIEW", async () => {
  const r = await withPhrase({});
  assert.equal(r.verdict, "PERMIT_PREVIEW", `blocked_by: ${r.blocked_by.join(",")}`);
  assert.equal(r.ok, true);
  assert.equal(r.stage, "CONSENT_EVALUATION");
  assert.equal(r.consent_presented, true);
  assert.equal(r.consent_verified, true);
  assert.equal(r.means, "EXACT_CONTEXT_BOUND_CONSENT_VERIFIED");
});

test("B21 PERMIT_PREVIEW has authority_delta=0 and grants_execution=false", async () => {
  const r = await withPhrase({});
  assert.equal(r.verdict, "PERMIT_PREVIEW");
  assertGrantsNothing(r);
  assert.notEqual(r.verdict, "AUTHORIZED_TO_EXECUTE");
  assert.notEqual(r.means, "FATE_POLICY_PERMITTED");
});

// ── B22–B25 · nothing was renamed, prepared, claimed or mutated ────────────

test("B22 packages/fate/src/fate.js is not imported by the bridge", () => {
  const src = readFileSync(BRIDGE, "utf8");
  assert.ok(src.length > 1000, "control: bridge source unexpectedly small");
  assert.equal(/from\s+["'][^"']*fate\.js["']/.test(src), false, "the bridge imports the FATE consent helper");
  assert.equal(src.includes("evaluateConsent("), false, "the bridge calls the FATE consent helper");
  // And it must not represent itself as an independent policy FATE.
  assert.equal(src.includes("FATE_EFFECT_ROUTE_INTEGRATED"), false);
});

test("B23 no pending_effect is created", async () => {
  const r = await withPhrase({});
  assert.equal(r.pending_effect_created, false);
  const src = readFileSync(BRIDGE, "utf8");
  assert.equal(src.includes("validatePendingEffect"), false);
  assert.equal(src.includes("season_pending_effect"), false);
});

test("B24 no transaction is prepared", async () => {
  const r = await withPhrase({});
  assert.equal(r.transaction_prepared, false);
  const src = readFileSync(BRIDGE, "utf8");
  for (const t of ["openClosureTransaction", "runTransactionalMechanicalClosure", "appendClosureTransactionPhase"]) {
    assert.equal(src.includes(t), false, `the bridge references ${t}`);
  }
});

test("B25 no nonce is claimed and no filesystem mutation occurs", async () => {
  const r = await withPhrase({});
  assert.equal(r.nonce_claimed, false);
  assert.equal(r.effect_executed, false);

  const src = readFileSync(BRIDGE, "utf8");
  // Built at runtime: a literal would be found by this very scan.
  const CLAIM_FN = `claim${"Consent"}Nonce`;
  assert.equal(src.includes(CLAIM_FN), false, "the bridge claims a consent nonce");
  // The bridge holds no effect capability at all — it imports none.
  for (const cap of ["node:fs", "node:fs/promises", "node:child_process", "node:net", "node:http", "node:https"]) {
    assert.equal(src.includes(`from "${cap}"`), false, `the bridge imports ${cap}`);
  }
  assert.equal(r.schema, CORRIDOR_SEASON_CONSENT_BRIDGE_SCHEMA);
});
