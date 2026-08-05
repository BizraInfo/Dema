// NODE0-SEASON-ACTION-AUTHORITY-1A — Phase 5 truth-boundary test.
//
// A pure evaluator must not flip a runtime-enforcement flag. This file exists so
// that adding the predicate can never be mistaken for wiring it.
//
// STATUS 2026-08-05: NODE0-CORRIDOR-SEASON-CONSENT-BRIDGE-1A has landed. NC-01,
// NC-02 and NC-04 were transitioned truthfully under an explicit operator ruling.
// An earlier attempt (research commit ea003519, NOT pushed) claimed a FATE
// integration; that claim was retracted — `packages/fate/src/fate.js` is an
// exact-phrase consent helper, and invoking it ahead of the root-bound corridor
// consent evaluator produced two phrase checks, not an independent policy
// decision. FATE_EFFECT_ROUTE_INTEGRATED stays FALSE and the contract gap is
// recorded as confirmed.
//
// If a later change makes one of the remaining claims true, this file fails and
// forces the claim to be argued rather than absorbed.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  evaluateSeasonActionAuthority,
} from "../packages/core/src/node0-minimum-season-save-resume.js";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const KERNEL = `${REPO}packages/core/src/node0-minimum-season-save-resume.js`;
const MISSION_CLI = `${REPO}apps/cli/src/commands/mission.js`;

const BRIDGE = `${REPO}packages/mission/src/corridor-season-consent-bridge.js`;

// TRANSITIONED: the authoritative Season-to-consent preflight IS wired — and the
// two properties that make it non-vacuous are asserted with it.
test("NC-01 the authoritative Season-to-consent preflight is wired", () => {
  const cli = readFileSync(MISSION_CLI, "utf8");
  assert.ok(cli.includes("evaluateCorridorSeasonConsentBridge"), "the bridge is not called by the route");
  assert.ok(cli.includes("loadSeasonHead"), "the route does not load the authoritative Season HEAD");
  assert.ok(cli.includes("readExecutingRepositoryBinding"), "the route does not measure the executing repository");
  // A binding call with no runner refuses on every path — safe, but it would make
  // the preflight uselessly always-refuse. The route must inject a real runner.
  assert.ok(
    /readExecutingRepositoryBinding\(\{\s*runGit:/.test(cli),
    "the route calls the binding without injecting a git runner",
  );

  // Authority must come from the store, never from a caller-supplied file.
  assert.equal(cli.includes('"--season-state"'), false, "a caller-supplied state file is authority again");

  // The binding must never be state-to-itself. This is the defect that refused
  // the superseded attempt; if it returns, this test is the thing that says so.
  assert.equal(
    /repositoryCommit:\s*(state|seasonState)\.repository_commit/.test(cli),
    false,
    "the route compares the Season State against itself",
  );
  assert.equal(
    /repositoryTree:\s*(state|seasonState)\.repository_tree/.test(cli),
    false,
    "the route compares the Season State against itself",
  );
});

// TRANSITIONED: fate.js must not be represented as independent policy FATE.
test("NC-02 packages/fate/src/fate.js is not represented as independent policy FATE", () => {
  for (const rel of [
    "packages/mission/src/mission-corridor-closure.js",
    "packages/mission/src/corridor-closure-gatherer.js",
    "packages/mission/src/corridor-season-consent-bridge.js",
  ]) {
    const p = `${REPO}${rel}`;
    if (!existsSync(p)) continue;
    const src = readFileSync(p, "utf8");
    assert.ok(src.length > 500, `control: ${rel} read empty — check the path`);
    // Match an IMPORT, not a mention: a file is allowed — and expected — to
    // document in prose why it does NOT use the consent helper.
    assert.equal(
      /^\s*import[\s\S]{0,200}?from\s+["'][^"']*fate\.js["']/m.test(src),
      false,
      `${rel} imports the exact-phrase consent helper and would misrepresent it as policy FATE`,
    );
    assert.equal(/\bevaluateConsent\s*\(/.test(src), false, `${rel} calls the exact-phrase consent helper`);
  }
  // The bridge must not assert the retracted claim anywhere.
  const bridge = readFileSync(BRIDGE, "utf8");
  assert.equal(bridge.includes("FATE_EFFECT_ROUTE_INTEGRATED"), false);
  assert.ok(
    bridge.includes("EXACT_CONTEXT_BOUND_CONSENT_VERIFIED"),
    "the bridge does not state what its PERMIT_PREVIEW actually means",
  );
});

test("NC-03 the kernel executes no effect: no fs, exec, network or clock", () => {
  const src = readFileSync(KERNEL, "utf8");
  // Control: the file is non-empty and really is the kernel we mean.
  assert.ok(src.length > 1000, "kernel source unexpectedly small — check the path");
  assert.ok(src.includes("evaluateSeasonActionAuthority"), "wrong file bound");
  for (const forbidden of ["node:fs", "node:child_process", "node:net", "node:http", "node:https"]) {
    assert.equal(
      src.includes(`from "${forbidden}"`),
      false,
      `CORRIDOR_RENAME_EFFECT_EXECUTED risk — kernel imports ${forbidden}`,
    );
  }
});

// TRANSITIONED: the bridge is wired, so the honest proof is no longer "there is
// no caller" — it is that the caller CANNOT REACH an effect. Enforcement still
// means an effect cannot occur without passing the predicate; a preflight that
// verifies and returns enforces nothing, so the flag stays false.
test("NC-04 the bridge cannot reach nonce claim, pending-effect, C4D or mutation", () => {
  const bridge = readFileSync(BRIDGE, "utf8");
  assert.ok(bridge.length > 1000, "control: bridge source unexpectedly small");

  // Built at runtime so this scan cannot match its own assertion list.
  const CLAIM_FN = `claim${"Consent"}Nonce`;
  for (const forbidden of [
    CLAIM_FN,
    "openClosureTransaction",
    "runTransactionalMechanicalClosure",
    "appendClosureTransactionPhase",
    "buildRenameEffectAdapter",
    "resolveRenameEffectIntent",
    "validatePendingEffect",
  ]) {
    assert.equal(bridge.includes(forbidden), false, `the bridge references ${forbidden}`);
  }
  // It holds no effect capability at all: it imports none.
  for (const cap of ["node:fs", "node:fs/promises", "node:child_process", "node:net", "node:http", "node:https"]) {
    assert.equal(bridge.includes(`from "${cap}"`), false, `the bridge imports ${cap}`);
  }

  // And the product route returns from the preflight BEFORE any nonce claim.
  // Scoped to the gate region: the module-level IMPORT of the claim function
  // appears near the top of the file and is not a call site.
  const cli = readFileSync(MISSION_CLI, "utf8");
  const from = cli.indexOf("async function corridorConsentGate(");
  assert.ok(from > 0, "control: could not locate the consent gate");
  const iPreflight = cli.indexOf("if (seasonPreflight) return null;", from);
  assert.ok(iPreflight > from, "the preflight does not stop the route inside the gate");

  // No nonce claim occurs anywhere between the gate opening and the preflight
  // return — so an engaged preflight provably cannot reach one.
  const beforeReturn = cli.slice(from, iPreflight);
  assert.equal(beforeReturn.includes(`${CLAIM_FN}(`), false, "a nonce is claimed before the preflight returns");

  // Control: the call site does exist later in the file, so this is not vacuous.
  assert.ok(cli.indexOf(`await ${CLAIM_FN}(`) > 0, "control: could not locate the nonce claim call site");
});

test("NC-05 a successful verdict never reads as execution authority", () => {
  const r = evaluateSeasonActionAuthority({});
  assert.notEqual(r.verdict, "AUTHORIZED_TO_EXECUTE");
  assert.equal(r.authority_delta, 0);
  assert.equal(r.consent_still_required, true);
  assert.equal(r.fate_still_required, true);
});

test("NC-06 NODE0_LOCAL_MISSION_PROVEN and DEMA_ACTIVE_LOCAL are not claimed here", () => {
  const src = readFileSync(KERNEL, "utf8");
  for (const flag of ["NODE0_LOCAL_MISSION_PROVEN", "DEMA_ACTIVE_LOCAL", "NODE0_CLOSED"]) {
    assert.equal(src.includes(`${flag} = true`), false, `kernel asserts ${flag}`);
    assert.equal(src.includes(`${flag}: true`), false, `kernel asserts ${flag}`);
  }
});
