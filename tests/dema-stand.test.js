import test from "node:test";
import assert from "node:assert/strict";
import { sha256, stableStringify } from "../packages/consent/src/consent-common.js";

import {
  planDemaStand,
  buildDemaStandPayload,
  verifyDemaStand,
  runDemaStand,
  DEMA_STAND_SCHEMA,
  DEMA_STAND_TRUTH_LABEL,
  DEMA_STAND_GO_PHRASE,
} from "../packages/core/src/dema-stand.js";
import {
  runDemaStandCheck,
  DEMA_STAND_CANONICAL_FIXTURE,
} from "../scripts/review/dema-stand-check.mjs";

const FIXTURE = DEMA_STAND_CANONICAL_FIXTURE;

function fixtureWith(overrides = {}) {
  return { ...structuredClone(FIXTURE), ...overrides };
}

// ---------------------------------------------------------------------------
// Scaffold proof contract
// ---------------------------------------------------------------------------

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planDemaStand({ consent: "wrong", input: fixtureWith() });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planDemaStand({ consent: DEMA_STAND_GO_PHRASE, input: fixtureWith() });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildDemaStandPayload(fixtureWith());
  assert.equal(payload.schema, DEMA_STAND_SCHEMA);
  assert.equal(payload.truth_label, DEMA_STAND_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  for (const [key, value] of Object.entries(payload.boundary)) {
    assert.equal(value, false, `boundary.${key} must be false`);
  }
});

test("verify accepts a freshly built payload", () => {
  const payload = buildDemaStandPayload(fixtureWith());
  assert.equal(verifyDemaStand(payload).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildDemaStandPayload(fixtureWith());
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyDemaStand(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  const payload = buildDemaStandPayload(fixtureWith());
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyDemaStand(forged).ok, false);
});

test("verify re-derives from raw input: forged derived field + recomputed hash still rejected", () => {
  // Harder launder: swap the derived next_action for a valid-shaped impostor AND
  // recompute the outer hash so the payload is internally consistent. The
  // verifier must rebuild from the embedded raw input and catch the mismatch.
  const payload = buildDemaStandPayload(fixtureWith());
  const { content_hash: _drop, ...body } = payload;
  body.next_action = { id: "impostor", label: "Do something else", command: null, lens: null };
  const laundered = {
    ...body,
    content_hash: `sha256:${sha256(stableStringify(body))}`,
  };
  const verdict = verifyDemaStand(laundered);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason_code, "derived_fields_mismatch");
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runDemaStandCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, DEMA_STAND_SCHEMA);
  assert.equal(result.truth_label, DEMA_STAND_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runDemaStand({ consent: DEMA_STAND_GO_PHRASE, input: fixtureWith() });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

// ---------------------------------------------------------------------------
// STAND domain: standing card, FDE lens, one next action, drain, stale, orbit
// ---------------------------------------------------------------------------

test("clean state with no blockers yields CLEAR lens and the all-clear single action", () => {
  const payload = buildDemaStandPayload(fixtureWith({ blockers: [] }));
  assert.equal(payload.fde.lens, "CLEAR");
  assert.equal(payload.standing.tree_clean, true);
  assert.equal(payload.standing.stale_proof, false);
  assert.equal(payload.next_action.id, "all_clear_pick_next_slice");
});

test("dirty tree wins over blockers: one next action is resolve_dirty_tree", () => {
  const fixture = fixtureWith();
  fixture.git.dirty_files = 3;
  const payload = buildDemaStandPayload(fixture);
  assert.equal(payload.standing.tree_clean, false);
  assert.equal(payload.next_action.id, "resolve_dirty_tree");
  assert.match(payload.next_action.label, /3 dirty file/);
});

test("failing gates outrank everything, including a dirty tree", () => {
  const fixture = fixtureWith();
  fixture.git.dirty_files = 2;
  fixture.gates.test.status = "fail";
  const payload = buildDemaStandPayload(fixture);
  assert.equal(payload.next_action.id, "fix_failing_gates");
  assert.equal(payload.next_action.command, "npm test && npm run check");
  assert.deepEqual(payload.standing.failing_gates, ["test"]);
});

test("stale proof detection: old or missing gate logs trigger rerun_gates", () => {
  const aged = fixtureWith();
  aged.gates.test.age_hours = 48;
  const agedPayload = buildDemaStandPayload(aged);
  assert.equal(agedPayload.standing.stale_proof, true);
  assert.ok(agedPayload.standing.stale_reasons.includes("test_gate_log_older_than_24h"));
  assert.equal(agedPayload.next_action.id, "rerun_gates");

  const missing = fixtureWith();
  missing.gates.check.status = "missing";
  const missingPayload = buildDemaStandPayload(missing);
  assert.ok(missingPayload.standing.stale_reasons.includes("check_gate_log_missing"));
  assert.equal(missingPayload.next_action.id, "rerun_gates");
});

test("OUTWARD billing blocker surfaces when it is the only open lens", () => {
  const payload = buildDemaStandPayload(
    fixtureWith({
      blockers: [
        { id: "github-billing", lens: "OUTWARD", label: "GitHub billing blocks the remote CI lane" },
      ],
    }),
  );
  assert.equal(payload.fde.lens, "OUTWARD");
  assert.equal(payload.next_action.id, "address_outward_blocker");
  assert.match(payload.next_action.label, /billing/);
});

test("AUTHORITY blocker outranks OUTWARD and ECONOMIC in the ladder", () => {
  const payload = buildDemaStandPayload(fixtureWith());
  assert.equal(payload.fde.lens, "MIXED");
  assert.equal(payload.next_action.id, "clear_authority_gate");
  assert.equal(payload.next_action.lens, "AUTHORITY");
  assert.match(payload.next_action.label, /operator-only/);
});

test("ECONOMIC lens never yields a mint action — economy stays blocked", () => {
  const payload = buildDemaStandPayload(
    fixtureWith({
      blockers: [
        { id: "mint-blocked", lens: "ECONOMIC", label: "Token mint stays blocked until verified impact" },
      ],
    }),
  );
  assert.equal(payload.next_action.id, "economy_stays_blocked");
  assert.equal(payload.next_action.command, null);
  assert.match(payload.next_action.label, /no mint/);
});

test("exactly one next action: a single object, never a list", () => {
  const payload = buildDemaStandPayload(fixtureWith());
  assert.equal(Array.isArray(payload.next_action), false);
  assert.equal(typeof payload.next_action, "object");
  assert.equal(typeof payload.next_action.id, "string");
  assert.equal(typeof payload.next_action.label, "string");
});

test("drain metric is declared, never inferred: less/same/more recorded verbatim", () => {
  for (const value of ["less", "same", "more"]) {
    const payload = buildDemaStandPayload(fixtureWith({ drain: value }));
    assert.equal(payload.drain.declared, value);
    assert.equal(payload.drain.status, "declared");
  }
  const undeclared = buildDemaStandPayload(fixtureWith({ drain: null }));
  assert.equal(undeclared.drain.declared, null);
  assert.equal(undeclared.drain.status, "not_declared");
  const plan = planDemaStand({
    consent: DEMA_STAND_GO_PHRASE,
    input: fixtureWith({ drain: "tired" }),
  });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("drain_value_invalid"));
});

test("orbit warning fires on 3+ docs-only commits while blockers stay open", () => {
  const docsOnly = [
    { sha: "aaa", kind: "docs" },
    { sha: "bbb", kind: "docs" },
    { sha: "ccc", kind: "docs" },
  ];
  const orbiting = buildDemaStandPayload(fixtureWith({ recent_commits: docsOnly }));
  assert.equal(orbiting.orbit.warning, true);
  assert.match(orbiting.orbit.reason, /docs-only/);

  const noBlockers = buildDemaStandPayload(
    fixtureWith({ recent_commits: docsOnly, blockers: [] }),
  );
  assert.equal(noBlockers.orbit.warning, false);

  const mixedWork = buildDemaStandPayload(fixtureWith());
  assert.equal(mixedWork.orbit.warning, false);
});

test("malformed evidence fails closed with named blocks", () => {
  const badLens = planDemaStand({
    consent: DEMA_STAND_GO_PHRASE,
    input: fixtureWith({ blockers: [{ id: "x", lens: "SIDEWAYS", label: "y" }] }),
  });
  assert.equal(badLens.eligible, false);
  assert.ok(badLens.blocked_by.includes("blocker_0_lens_invalid"));

  const badGit = planDemaStand({
    consent: DEMA_STAND_GO_PHRASE,
    input: fixtureWith({ git: { head: "", branch: "b", dirty_files: -1 } }),
  });
  assert.equal(badGit.eligible, false);
  assert.ok(badGit.blocked_by.includes("git_head_required"));
  assert.ok(badGit.blocked_by.includes("git_dirty_files_invalid"));

  const rejected = buildDemaStandPayload({ nope: true });
  assert.equal(rejected.rejected, true);
  assert.equal(verifyDemaStand(rejected).ok, false);
});

test("no live-autonomy claim anywhere in the payload prose", () => {
  const payload = buildDemaStandPayload(fixtureWith());
  const prose = JSON.stringify(payload.what_this_proves) + JSON.stringify(payload.what_this_does_not_prove);
  assert.match(prose, /does not prove live autonomy|no live autonomy|not.*live autonomy/i);
});

test("kernel stays pure: no fs/network/process/clock/random imports or calls", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("../packages/core/src/dema-stand.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /node:fs|node:net|node:http|node:https|child_process/);
  assert.doesNotMatch(src, /\bfetch\s*\(/);
  assert.doesNotMatch(src, /Date\.now|new Date\s*\(|Math\.random/);
});
