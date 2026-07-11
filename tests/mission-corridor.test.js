import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MISSION_CORRIDOR_SCHEMA,
  MISSION_CORRIDOR_TRUTH_LABEL,
  CORRIDOR_STATES,
  CORRIDOR_TRANSITIONS,
  buildMissionContract,
  appendCorridorEvent,
  deriveCorridorStatus,
  verifyCorridorJournal,
  runMissionCorridorFixture,
} from "../packages/mission/src/mission-corridor.js";
import { runMissionCorridorCheck } from "../scripts/review/mission-corridor-check.mjs";
import {
  PREVIEW_BOUNDARY_CANONICAL_KEYS,
  buildPreviewBoundary,
} from "../packages/core/src/boundary-schema.js";

// DEMA-MISSION-CORRIDOR-0A — control plane only. The mission remembers itself:
// contract + journal on disk are the ONLY source of truth; status/resume are
// pure derivations. No worker, no daemon, no execution — PREVIEW_ONLY.

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHA40 = "2d7480de70bb7753bae086b354f8a2ee2fb5e364";

function goodContractInput(overrides = {}) {
  return {
    mission_id: "m5-wave-2",
    objective: "Complete M5.2 legacy compatibility registry",
    base_sha: SHA40,
    permitted_actions: ["analyze", "branch", "edit", "test", "commit", "push", "open_draft_pr"],
    merge_policy: "checkpoint_required",
    time_budget_hours: 8,
    repair_budget_per_slice: 2,
    stop_conditions: ["historical_hash_change", "gate_weakened", "base_moved"],
    created_at_iso: "2026-07-11T12:00:00.000Z",
    ...overrides,
  };
}

function seedJournal(contract, contract_hash) {
  const r = appendCorridorEvent({
    contract_hash,
    journal: [],
    event: { state: "CREATED", at_iso: contract.created_at_iso, next_command: "dema mission corridor status m5-wave-2" },
  });
  assert.equal(r.ok, true, r.blocked_by.join(","));
  return r.journal;
}

test("contract builds frozen, content-addressed, fail-closed", () => {
  const r = buildMissionContract(goodContractInput());
  assert.equal(r.ok, true, r.blocked_by.join(","));
  assert.equal(r.schema, MISSION_CORRIDOR_SCHEMA);
  assert.equal(r.truth_label, "PREVIEW_ONLY");
  assert.match(r.contract_hash, /^sha256:[0-9a-f]{64}$/);
  assert.ok(Object.isFrozen(r) && Object.isFrozen(r.contract));
  // determinism
  assert.equal(buildMissionContract(goodContractInput()).contract_hash, r.contract_hash);
});

test("contract rejects bad inputs, each with a named block", () => {
  const cases = [
    [{ mission_id: "../evil" }, "mission_id_invalid"],
    [{ mission_id: "UPPER" }, "mission_id_invalid"],
    [{ base_sha: "abc" }, "base_sha_invalid"],
    [{ objective: "" }, "objective_invalid"],
    [{ merge_policy: "auto_merge" }, "merge_policy_invalid"],
    [{ time_budget_hours: 0 }, "time_budget_invalid"],
    [{ time_budget_hours: 9999 }, "time_budget_invalid"],
    [{ repair_budget_per_slice: -1 }, "repair_budget_invalid"],
    [{ permitted_actions: [] }, "permitted_actions_invalid"],
    [{ stop_conditions: [] }, "stop_conditions_invalid"],
    [{ created_at_iso: "not-a-date" }, "created_at_invalid"],
  ];
  for (const [patch, code] of cases) {
    const r = buildMissionContract(goodContractInput(patch));
    assert.equal(r.ok, false, JSON.stringify(patch));
    assert.ok(r.blocked_by.includes(code), `${code} for ${JSON.stringify(patch)}: got ${r.blocked_by}`);
  }
});

test("journal must open with CREATED; illegal transitions fail closed", () => {
  const c = buildMissionContract(goodContractInput());
  const bad = appendCorridorEvent({
    contract_hash: c.contract_hash,
    journal: [],
    event: { state: "IMPLEMENTING", at_iso: "2026-07-11T12:01:00.000Z" },
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.blocked_by.includes("first_event_must_be_created"));

  const journal = seedJournal(c.contract, c.contract_hash);
  const jump = appendCorridorEvent({
    contract_hash: c.contract_hash,
    journal,
    event: { state: "CI_WAIT", at_iso: "2026-07-11T12:02:00.000Z" },
  });
  assert.equal(jump.ok, false);
  assert.ok(jump.blocked_by.includes("transition_not_allowed"));
});

test("every state is reachable and the transition map is closed over CORRIDOR_STATES", () => {
  assert.ok(Object.isFrozen(CORRIDOR_STATES) && Object.isFrozen(CORRIDOR_TRANSITIONS));
  for (const [from, tos] of Object.entries(CORRIDOR_TRANSITIONS)) {
    assert.ok(CORRIDOR_STATES.includes(from), from);
    for (const to of tos) assert.ok(CORRIDOR_STATES.includes(to), `${from}->${to}`);
  }
  // terminal states allow nothing
  assert.equal(CORRIDOR_TRANSITIONS.COMPLETE.length, 0);
  assert.equal(CORRIDOR_TRANSITIONS.STOPPED.length, 0);
});

test("journal chain is tamper-evident and monotonic", () => {
  const c = buildMissionContract(goodContractInput());
  let journal = seedJournal(c.contract, c.contract_hash);
  const r2 = appendCorridorEvent({
    contract_hash: c.contract_hash,
    journal,
    event: { state: "PREFLIGHT", at_iso: "2026-07-11T12:05:00.000Z", branch: "feat/x", head_sha: SHA40 },
  });
  assert.equal(r2.ok, true);
  journal = r2.journal;

  // clock going backwards is blocked
  const back = appendCorridorEvent({
    contract_hash: c.contract_hash,
    journal,
    event: { state: "PLANNING", at_iso: "2026-07-11T11:00:00.000Z" },
  });
  assert.equal(back.ok, false);
  assert.ok(back.blocked_by.includes("at_iso_not_monotonic"));

  // verify accepts the honest chain
  assert.equal(verifyCorridorJournal({ contract: c.contract, contract_hash: c.contract_hash, journal }).ok, true);

  // any tampered field breaks verification
  const tampered = [...journal];
  tampered[1] = { ...tampered[1], next_command: "rm -rf /" };
  const v = verifyCorridorJournal({ contract: c.contract, contract_hash: c.contract_hash, journal: tampered });
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.some((b) => b.startsWith("event_hash_mismatch")));
});

test("repair rounds may never decrease", () => {
  const c = buildMissionContract(goodContractInput());
  let journal = seedJournal(c.contract, c.contract_hash);
  let r = appendCorridorEvent({
    contract_hash: c.contract_hash,
    journal,
    event: { state: "PREFLIGHT", at_iso: "2026-07-11T12:05:00.000Z", repair_rounds_used: 1 },
  });
  assert.equal(r.ok, true);
  r = appendCorridorEvent({
    contract_hash: c.contract_hash,
    journal: r.journal,
    event: { state: "PLANNING", at_iso: "2026-07-11T12:06:00.000Z", repair_rounds_used: 0 },
  });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("repair_rounds_decreased"));
});

test("status derives lease expiry and repair budget purely from injected now", () => {
  const c = buildMissionContract(goodContractInput());
  const journal = seedJournal(c.contract, c.contract_hash);

  const fresh = deriveCorridorStatus({
    contract: c.contract, contract_hash: c.contract_hash, journal,
    now_iso: "2026-07-11T13:00:00.000Z",
  });
  assert.equal(fresh.ok, true, fresh.blocked_by.join(","));
  assert.equal(fresh.lease_expired, false);
  assert.equal(fresh.repair_budget_remaining, 2);

  const late = deriveCorridorStatus({
    contract: c.contract, contract_hash: c.contract_hash, journal,
    now_iso: "2026-07-12T12:00:00.001Z",
  });
  assert.equal(late.lease_expired, true);
  assert.ok(late.blocked_by.includes("lease_expired"));
  assert.equal(late.requires_human, true);
});

test("resume point reconstructs branch/sha/failing-gate/next-command from the journal alone", () => {
  const c = buildMissionContract(goodContractInput());
  let journal = seedJournal(c.contract, c.contract_hash);
  for (const [state, extra] of [
    ["PREFLIGHT", { branch: "feat/m5-2", head_sha: SHA40 }],
    ["PLANNING", {}],
    ["IMPLEMENTING", { next_command: "node --test tests/m5-2.test.js" }],
    ["VERIFYING", { failing_gate: "npm run check :: legacy-fixture-gate", next_command: "node scripts/review/legacy-fixture-gate.mjs --json", repair_rounds_used: 1 }],
  ]) {
    const r = appendCorridorEvent({
      contract_hash: c.contract_hash,
      journal,
      event: { state, at_iso: `2026-07-11T12:1${journal.length}:00.000Z`, ...extra },
    });
    assert.equal(r.ok, true, `${state}: ${r.blocked_by.join(",")}`);
    journal = r.journal;
  }
  const s = deriveCorridorStatus({
    contract: c.contract, contract_hash: c.contract_hash, journal,
    now_iso: "2026-07-11T13:00:00.000Z",
  });
  assert.equal(s.state, "VERIFYING");
  // latest non-null wins, carried across events
  assert.deepEqual(s.resume_point, {
    branch: "feat/m5-2",
    head_sha: SHA40,
    failing_gate: "npm run check :: legacy-fixture-gate",
    next_command: "node scripts/review/legacy-fixture-gate.mjs --json",
  });
  assert.equal(s.repair_budget_remaining, 1);
});

test("terminal states accept no further events; requires_human surfaces as a block", () => {
  const c = buildMissionContract(goodContractInput());
  let journal = seedJournal(c.contract, c.contract_hash);
  // STOPPED implies requires_human even when the caller omits it (kill switch
  // always hands control back to the human).
  let r = appendCorridorEvent({
    contract_hash: c.contract_hash,
    journal,
    event: { state: "STOPPED", at_iso: "2026-07-11T12:30:00.000Z", note: "operator stop" },
  });
  assert.equal(r.ok, true);
  assert.equal(r.event.requires_human, true, "STOPPED forces requires_human");
  journal = r.journal;

  const after = appendCorridorEvent({
    contract_hash: c.contract_hash,
    journal,
    event: { state: "PREFLIGHT", at_iso: "2026-07-11T12:31:00.000Z" },
  });
  assert.equal(after.ok, false);
  assert.ok(after.blocked_by.includes("corridor_terminal"));

  const s = deriveCorridorStatus({
    contract: c.contract, contract_hash: c.contract_hash, journal,
    now_iso: "2026-07-11T12:32:00.000Z",
  });
  assert.equal(s.terminal, true);
  assert.equal(s.requires_human, true);
  assert.ok(s.blocked_by.includes("human_decision_required"));
});

test("boundary is the canonical 17-key all-false set (deep-equal, no vacuous check)", () => {
  const c = buildMissionContract(goodContractInput());
  assert.deepEqual(c.boundary, buildPreviewBoundary());
  assert.deepEqual(Object.keys(c.boundary).sort(), [...PREVIEW_BOUNDARY_CANONICAL_KEYS].sort());
  for (const k of PREVIEW_BOUNDARY_CANONICAL_KEYS) assert.equal(c.boundary[k], false, k);
});

test("fixture loop and review gate pass", () => {
  const fx = runMissionCorridorFixture();
  assert.equal(fx.ok, true, fx.blocked_by.join(","));
  assert.equal(fx.truth_label, MISSION_CORRIDOR_TRUTH_LABEL);

  const gate = runMissionCorridorCheck();
  assert.equal(gate.ok, true, (gate.blocked_by ?? []).join(","));
  assert.equal(gate.schema, "bizra.dema.mission_corridor_check.v0.1");
  assert.deepEqual(gate.boundary, buildPreviewBoundary());
});

test("CLI: start → status → resume survives process loss → stop; exact consent enforced", (t) => {
  const home = mkdtempSync(join(tmpdir(), "corridor-home-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const dema = join(REPO, "bin/dema");
  const run = (args) =>
    execFileSync("node", [dema, ...args], { encoding: "utf8", env: { ...process.env, DEMA_HOME: home } });

  const startArgs = [
    "mission", "corridor", "start",
    "--id", "demo-corridor",
    "--objective", "demo",
    "--base-sha", SHA40,
    "--json",
  ];
  // wrong consent refused, nothing written
  assert.throws(() => run([...startArgs, "--consent", "yes please"]), (e) => e.status === 1);
  assert.ok(!existsSync(join(home, "missions/demo-corridor/contract.json")));

  // exact consent starts the corridor — and the CLI reports an HONEST boundary:
  // it really wrote under consent (kernel stays all-false; the IO layer must not
  // print false statements about its own effects).
  const started = JSON.parse(run([...startArgs, "--consent", "GO: start mission corridor demo-corridor"]));
  assert.equal(started.ok, true);
  assert.equal(started.boundary.filesystem_write_performed, true);
  assert.equal(started.boundary.consent_collected, true);
  assert.equal(started.boundary.runtime_execution_performed, false);
  assert.ok(existsSync(join(home, "missions/demo-corridor/contract.json")));
  assert.ok(existsSync(join(home, "missions/demo-corridor/journal.jsonl")));

  // double start refused (no clobber)
  assert.throws(() => run([...startArgs, "--consent", "GO: start mission corridor demo-corridor"]), (e) => e.status === 1);

  // resume in a FRESH process (the terminal-loss acceptance): disk alone reconstructs
  const resumed = JSON.parse(run(["mission", "corridor", "resume", "demo-corridor", "--json"]));
  assert.equal(resumed.ok, true);
  assert.equal(resumed.state, "CREATED");
  assert.ok(resumed.resume_point.next_command.length > 0);
  assert.equal(resumed.boundary.content_read, true, "resume honestly reports its reads");
  assert.equal(resumed.boundary.filesystem_write_performed, false);

  // stop requires its own exact phrase
  assert.throws(() => run(["mission", "corridor", "stop", "demo-corridor", "--json", "--consent", "stop it"]), (e) => e.status === 1);

  // stop refuses to extend a tampered chain (verify-before-append)
  const journalPath = join(home, "missions/demo-corridor/journal.jsonl");
  const honest = readFileSync(journalPath, "utf8");
  writeFileSync(journalPath, honest.replace('"corridor created"', '"forged note"'));
  assert.throws(
    () => run(["mission", "corridor", "stop", "demo-corridor", "--json", "--consent", "GO: stop mission corridor demo-corridor"]),
    (e) => e.status === 1 && String(e.stderr).includes("tampered"),
  );
  writeFileSync(journalPath, honest); // restore the honest chain

  const stopped = JSON.parse(run(["mission", "corridor", "stop", "demo-corridor", "--json", "--consent", "GO: stop mission corridor demo-corridor"]));
  assert.equal(stopped.ok, true);
  assert.equal(stopped.boundary.filesystem_write_performed, true);
  assert.equal(stopped.boundary.consent_collected, true);

  const status = JSON.parse(run(["mission", "corridor", "status", "demo-corridor", "--json"]));
  assert.equal(status.state, "STOPPED");
  assert.equal(status.terminal, true);

  // journal on disk is the chain the kernel verifies
  const lines = readFileSync(join(home, "missions/demo-corridor/journal.jsonl"), "utf8").trim().split("\n");
  assert.equal(lines.length, 2);
});
