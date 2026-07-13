import test from "node:test";
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MISSION_CORRIDOR_SCHEMA,
  MISSION_CORRIDOR_TRUTH_LABEL,
  CORRIDOR_STATES,
  CORRIDOR_TRANSITIONS,
  CORRIDOR_WRITE_ACTION_CLASS,
  buildMissionContract,
  appendCorridorEvent,
  deriveCorridorStatus,
  verifyCorridorJournal,
  buildCorridorConsentContext,
  evaluateCorridorWriteConsent,
  corridorRequiredPhrase,
  runMissionCorridorFixture,
} from "../packages/mission/src/mission-corridor.js";
import { evaluateContextBoundConsent } from "../packages/consent/src/root-bound-consent-envelope-preview.js";
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
  // canonical algorithm identity is declared on every persisted body (M5 policy)
  assert.equal(r.contract.canonicalization_algorithm, "bizra.canonical-json.v1");
  assert.equal(r.contract.hash_algorithm, "sha256");
  assert.equal(r.contract.text_encoding, "utf-8");
  const seeded = seedJournal(r.contract, r.contract_hash);
  assert.equal(seeded[0].canonicalization_algorithm, "bizra.canonical-json.v1");
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

// --- Root-bound consent (S2 reconciliation) ---------------------------------
// ROOT_BOUND_CONSENT_ENVELOPE_PREVIEW_REUSED: a phrase alone never authorizes
// a corridor write; consent binds mission id, contract hash, capability scope,
// mission root, action class, nonce, and expiry via the existing envelope kernel.

const CONSENT_BASE = Object.freeze({
  kind: "START",
  mission_id: "m5-wave-2",
  mission_root: "/tmp/dema-home/missions/m5-wave-2",
  nonce: "nonce-001",
  expires_at: "2026-07-11T14:00:00.000Z",
});

function consentArgsFor(contract, contract_hash, overrides = {}) {
  return {
    ...CONSENT_BASE,
    contract_hash,
    permitted_actions: [...contract.permitted_actions],
    ...overrides,
  };
}

test("root-bound consent: a phrase alone is never authority", () => {
  const c = buildMissionContract(goodContractInput());
  const r = evaluateCorridorWriteConsent({
    ...consentArgsFor(c.contract, c.contract_hash, { nonce: "", expires_at: "" }),
    phrase: corridorRequiredPhrase("START", "m5-wave-2"),
    consent_context_hash: "",
    now: "2026-07-11T12:30:00.000Z",
  });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("consent_context_missing"), r.blocked_by.join(","));
  assert.ok(r.blocked_by.includes("nonce_missing"), r.blocked_by.join(","));
  assert.equal(r.verdict, "BLOCK");
  assert.equal(r.authority_delta, 0);
});

test("root-bound consent: exact context permits; every swapped binding fails closed", () => {
  const c = buildMissionContract(goodContractInput());
  const args = consentArgsFor(c.contract, c.contract_hash);
  const ctx = buildCorridorConsentContext(args);
  assert.equal(ctx.ok, true, ctx.blocked_by.join(","));
  assert.equal(ctx.envelope.action_class, CORRIDOR_WRITE_ACTION_CLASS);
  const approved = ctx.envelope.consent_context_hash;
  const phrase = corridorRequiredPhrase("START", "m5-wave-2");
  const now = "2026-07-11T12:30:00.000Z";

  // deterministic: same context → same hash
  assert.equal(buildCorridorConsentContext(args).envelope.consent_context_hash, approved);

  // happy path
  const permit = evaluateCorridorWriteConsent({ ...args, phrase, consent_context_hash: approved, now });
  assert.equal(permit.ok, true, permit.blocked_by.join(","));
  assert.equal(permit.verdict, "PERMIT_PREVIEW");
  assert.equal(permit.authority_delta, 0);

  // modified payload: a different contract (changed objective) with the reused approval
  const other = buildMissionContract(goodContractInput({ objective: "swapped objective" }));
  assert.notEqual(other.contract_hash, c.contract_hash, "precondition: contract changed");
  const swappedContract = evaluateCorridorWriteConsent({
    ...consentArgsFor(other.contract, other.contract_hash),
    phrase, consent_context_hash: approved, now,
  });
  assert.equal(swappedContract.ok, false);
  assert.ok(swappedContract.blocked_by.includes("consent_context_mismatch"));

  // modified root set
  const swappedRoot = evaluateCorridorWriteConsent({
    ...args, mission_root: "/somewhere/else", phrase, consent_context_hash: approved, now,
  });
  assert.equal(swappedRoot.ok, false);
  assert.ok(swappedRoot.blocked_by.includes("consent_context_mismatch"));

  // a START approval never authorizes STOP (kind swap → different scope+payload)
  const swappedKind = evaluateCorridorWriteConsent({
    ...args, kind: "STOP", phrase: corridorRequiredPhrase("STOP", "m5-wave-2"),
    consent_context_hash: approved, now,
  });
  assert.equal(swappedKind.ok, false);
  assert.ok(swappedKind.blocked_by.includes("consent_context_mismatch"));

  // wrong phrase
  const wrongPhrase = evaluateCorridorWriteConsent({
    ...args, phrase: "yes please", consent_context_hash: approved, now,
  });
  assert.equal(wrongPhrase.ok, false);
  assert.ok(wrongPhrase.blocked_by.includes("phrase_mismatch"));

  // expired consent
  const expired = evaluateCorridorWriteConsent({
    ...args, phrase, consent_context_hash: approved, now: "2026-07-11T14:00:00.000Z",
  });
  assert.equal(expired.ok, false);
  assert.ok(expired.blocked_by.includes("consent_expired"));

  // replayed nonce
  const replayed = evaluateCorridorWriteConsent({
    ...args, phrase, consent_context_hash: approved, now, used_nonces: ["nonce-001"],
  });
  assert.equal(replayed.ok, false);
  assert.ok(replayed.blocked_by.includes("nonce_replayed"));
});

test("root-bound consent: action-class and envelope tamper fail closed", () => {
  const c = buildMissionContract(goodContractInput());
  const args = consentArgsFor(c.contract, c.contract_hash);
  const { envelope } = buildCorridorConsentContext(args);
  const phrase = corridorRequiredPhrase("START", "m5-wave-2");
  const now = "2026-07-11T12:30:00.000Z";
  const matched = {
    phrase,
    proposal_hash: envelope.proposal_hash,
    payload_hash: envelope.payload_hash,
    capability_scope_hash: envelope.capability_scope_hash,
    root_set_hash: envelope.root_set_hash,
    action_class: envelope.action_class,
  };
  // a write consent presented as a read (or any other class) is a mismatch
  const declassed = evaluateContextBoundConsent({
    envelope, presented: { ...matched, action_class: "C1_READ" }, now,
  });
  assert.equal(declassed.accepted, false);
  assert.ok(declassed.blocked_by.includes("action_class_mismatch"));
  // an envelope mutated after sealing breaks its own context hash
  const tampered = evaluateContextBoundConsent({
    envelope: { ...envelope, payload_hash: `sha256:${"e".repeat(64)}` },
    presented: matched,
    now,
  });
  assert.equal(tampered.accepted, false);
  assert.ok(tampered.blocked_by.includes("consent_context_hash_mismatch"));
});

test("root-bound consent: STOP binds the existing contract hash", () => {
  const c = buildMissionContract(goodContractInput());
  const other = buildMissionContract(goodContractInput({ objective: "different corridor" }));
  const stopArgs = consentArgsFor(c.contract, c.contract_hash, { kind: "STOP" });
  const approved = buildCorridorConsentContext(stopArgs).envelope.consent_context_hash;
  const phrase = corridorRequiredPhrase("STOP", "m5-wave-2");
  const now = "2026-07-11T12:30:00.000Z";

  const permit = evaluateCorridorWriteConsent({ ...stopArgs, phrase, consent_context_hash: approved, now });
  assert.equal(permit.ok, true, permit.blocked_by.join(","));

  // the same approval against a DIFFERENT contract hash must fail closed
  const mismatched = evaluateCorridorWriteConsent({
    ...consentArgsFor(other.contract, other.contract_hash, { kind: "STOP" }),
    phrase, consent_context_hash: approved, now,
  });
  assert.equal(mismatched.ok, false);
  assert.ok(mismatched.blocked_by.includes("consent_context_mismatch"));
});

test("CLI: start → status → resume survives process loss → stop; root-bound consent enforced", (t) => {
  const home = mkdtempSync(join(tmpdir(), "corridor-home-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const dema = join(REPO, "bin/dema");
  const run = (args) =>
    execFileSync("node", [dema, ...args], { encoding: "utf8", env: { ...process.env, DEMA_HOME: home } });

  const T0 = "2026-07-13T00:00:00.000Z";
  const T1 = "2026-07-13T01:00:00.000Z";
  const EXP = "2026-07-13T08:00:00.000Z";
  const startArgs = [
    "mission", "corridor", "start",
    "--id", "demo-corridor",
    "--objective", "demo",
    "--base-sha", SHA40,
    "--json",
  ];
  // phrase alone (old style) is not authority: no nonce/expiry → refused, nothing written
  assert.throws(
    () => run([...startArgs, "--now", T0, "--consent", "GO: start mission corridor demo-corridor"]),
    (e) => e.status === 1 && String(e.stderr).includes("root-bound consent"),
  );
  assert.ok(!existsSync(join(home, "missions/demo-corridor/contract.json")));

  // step 1: consent card WITHOUT --created-at — the card fixes created_at_iso
  // once, prints the exact rerun line, and reserves NOTHING.
  const card = JSON.parse(run([...startArgs, "--now", T0, "--nonce", "n-start-1", "--expires", EXP]));
  assert.equal(card.step, "CONSENT_CARD");
  assert.equal(card.required_phrase, "GO: start mission corridor demo-corridor");
  assert.equal(card.created_at_iso, T0, "the card fixes the contract timestamp once");
  assert.ok(card.rerun_with.includes(`--created-at ${T0}`), "rerun line carries the exact created-at");
  assert.ok(card.rerun_with.includes(card.consent_context_hash));
  assert.match(card.consent_context_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(card.boundary.filesystem_write_performed, false);
  assert.ok(!existsSync(join(home, "missions/demo-corridor/contract.json")));
  assert.ok(!existsSync(join(home, "missions/consent-nonces")), "a consent card reserves no nonce");

  // authorization without --created-at is refused: the clock never re-derives
  // the approved contract timestamp.
  assert.throws(
    () => run([
      ...startArgs, "--now", T1, "--nonce", "n-start-1", "--expires", EXP,
      "--consent", "GO: start mission corridor demo-corridor",
      "--consent-context", card.consent_context_hash,
    ]),
    (e) => e.status === 1 && String(e.stderr).includes("--created-at"),
  );

  // a tampered created-at is a DIFFERENT contract → consent_context_mismatch
  assert.throws(
    () => run([
      ...startArgs, "--now", T1, "--created-at", T1, "--nonce", "n-start-1", "--expires", EXP,
      "--consent", "GO: start mission corridor demo-corridor",
      "--consent-context", card.consent_context_hash,
    ]),
    (e) => e.status === 1 && String(e.stderr).includes("consent_context_mismatch"),
  );

  // wrong context commitment refused, nothing written
  assert.throws(
    () => run([
      ...startArgs, "--now", T1, "--created-at", T0, "--nonce", "n-start-1", "--expires", EXP,
      "--consent", "GO: start mission corridor demo-corridor",
      "--consent-context", `sha256:${"e".repeat(64)}`,
    ]),
    (e) => e.status === 1 && String(e.stderr).includes("consent_context_mismatch"),
  );
  assert.ok(!existsSync(join(home, "missions/demo-corridor/contract.json")));

  // step 2: a LATER now with the card's created-at reproduces the approved
  // hashes exactly — deterministic two-step consent. The CLI reports an HONEST
  // boundary: it really wrote under consent (kernel stays all-false; the IO
  // layer must not print false statements about its own effects).
  const fullStart = [
    ...startArgs, "--now", T1, "--created-at", T0, "--nonce", "n-start-1", "--expires", EXP,
    "--consent", "GO: start mission corridor demo-corridor",
    "--consent-context", card.consent_context_hash,
  ];
  const started = JSON.parse(run(fullStart));
  assert.equal(started.ok, true);
  assert.equal(started.contract_hash, card.contract_hash, "later now must not move the approved contract hash");
  assert.equal(started.consent_context_hash, card.consent_context_hash);
  assert.equal(started.boundary.filesystem_write_performed, true);
  assert.equal(started.boundary.consent_collected, true);
  assert.equal(started.boundary.runtime_execution_performed, false);
  assert.ok(existsSync(join(home, "missions/demo-corridor/contract.json")));
  assert.ok(existsSync(join(home, "missions/demo-corridor/journal.jsonl")));
  assert.equal(readdirSync(join(home, "missions/consent-nonces")).length, 1, "exactly one nonce marker after start");

  // double start: the consumed nonce is refused atomically, BEFORE any clobber path
  assert.throws(() => run(fullStart), (e) => e.status === 1 && String(e.stderr).includes("nonce_replayed"));

  // fresh nonce against the existing corridor → no clobber; the reserved nonce
  // stays burned by design (burning beats replaying authority)
  const clobberCard = JSON.parse(run([...startArgs, "--now", T1, "--created-at", T0, "--nonce", "n-clobber", "--expires", EXP]));
  assert.throws(
    () => run([
      ...startArgs, "--now", T1, "--created-at", T0, "--nonce", "n-clobber", "--expires", EXP,
      "--consent", "GO: start mission corridor demo-corridor",
      "--consent-context", clobberCard.consent_context_hash,
    ]),
    (e) => e.status === 1 && String(e.stderr).includes("refusing to clobber"),
  );
  assert.equal(readdirSync(join(home, "missions/consent-nonces")).length, 2, "burned nonce marker persists after the failed operation");

  // resume in a FRESH process (the terminal-loss acceptance): disk alone reconstructs
  const resumed = JSON.parse(run(["mission", "corridor", "resume", "demo-corridor", "--json"]));
  assert.equal(resumed.ok, true);
  assert.equal(resumed.state, "CREATED");
  assert.ok(resumed.resume_point.next_command.length > 0);
  assert.equal(resumed.boundary.content_read, true, "resume honestly reports its reads");
  assert.equal(resumed.boundary.filesystem_write_performed, false);

  // stop refuses to extend a tampered chain (verify-before-append)
  const journalPath = join(home, "missions/demo-corridor/journal.jsonl");
  const honest = readFileSync(journalPath, "utf8");
  writeFileSync(journalPath, honest.replace("corridor created", "forged note"));
  assert.throws(
    () => run(["mission", "corridor", "stop", "demo-corridor", "--json", "--now", T1, "--nonce", "n-stop-1", "--expires", EXP]),
    (e) => e.status === 1 && String(e.stderr).includes("tampered"),
  );
  writeFileSync(journalPath, honest); // restore the honest chain

  // stop consent card, then expired consent refused, then replayed nonce refused
  const stopCard = JSON.parse(run(["mission", "corridor", "stop", "demo-corridor", "--json", "--now", T1, "--nonce", "n-stop-1", "--expires", EXP]));
  assert.equal(stopCard.step, "CONSENT_CARD");
  assert.equal(stopCard.required_phrase, "GO: stop mission corridor demo-corridor");
  assert.notEqual(stopCard.consent_context_hash, card.consent_context_hash, "STOP context differs from START context");

  const expiredCard = JSON.parse(run(["mission", "corridor", "stop", "demo-corridor", "--json", "--now", T1, "--nonce", "n-stop-2", "--expires", "2026-07-13T00:30:00.000Z"]));
  assert.throws(
    () => run([
      "mission", "corridor", "stop", "demo-corridor", "--json", "--now", T1,
      "--nonce", "n-stop-2", "--expires", "2026-07-13T00:30:00.000Z",
      "--consent", "GO: stop mission corridor demo-corridor",
      "--consent-context", expiredCard.consent_context_hash,
    ]),
    (e) => e.status === 1 && String(e.stderr).includes("consent_expired"),
  );

  const replayCard = JSON.parse(run(["mission", "corridor", "stop", "demo-corridor", "--json", "--now", T1, "--nonce", "n-start-1", "--expires", EXP]));
  assert.throws(
    () => run([
      "mission", "corridor", "stop", "demo-corridor", "--json", "--now", T1,
      "--nonce", "n-start-1", "--expires", EXP,
      "--consent", "GO: stop mission corridor demo-corridor",
      "--consent-context", replayCard.consent_context_hash,
    ]),
    (e) => e.status === 1 && String(e.stderr).includes("nonce_replayed"),
  );

  const stopped = JSON.parse(run([
    "mission", "corridor", "stop", "demo-corridor", "--json", "--now", T1,
    "--nonce", "n-stop-1", "--expires", EXP,
    "--consent", "GO: stop mission corridor demo-corridor",
    "--consent-context", stopCard.consent_context_hash,
  ]));
  assert.equal(stopped.ok, true);
  assert.equal(stopped.consent_context_hash, stopCard.consent_context_hash);
  assert.equal(stopped.boundary.filesystem_write_performed, true);
  assert.equal(stopped.boundary.consent_collected, true);

  const status = JSON.parse(run(["mission", "corridor", "status", "demo-corridor", "--json"]));
  assert.equal(status.state, "STOPPED");
  assert.equal(status.terminal, true);

  // journal on disk is the chain the kernel verifies; every consumed nonce is
  // an atomic create-only marker (sha256-named — raw nonces never become paths)
  const lines = readFileSync(join(home, "missions/demo-corridor/journal.jsonl"), "utf8").trim().split("\n");
  assert.equal(lines.length, 2);
  const markers = readdirSync(join(home, "missions/consent-nonces")).sort();
  assert.equal(markers.length, 3, "n-start-1 + burned n-clobber + n-stop-1");
  for (const m of markers) assert.match(m, /^[0-9a-f]{64}\.json$/);
  const startMarker = `${createHash("sha256").update("n-start-1", "utf8").digest("hex")}.json`;
  assert.ok(markers.includes(startMarker), "marker filename is the sha256 of the nonce");
});

test("CLI: consented mission root is absolute and lexically normalized", (t) => {
  const base = mkdtempSync(join(tmpdir(), "corridor-norm-"));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  // a messy home path: redundant `.` and `..` segments (raw concatenation —
  // join() would pre-normalize them and defeat the test)
  const messy = `${base}/x/../dema-home/.`;
  const clean = resolve(messy);
  assert.notEqual(messy, clean, "precondition: the raw home is not normalized");
  const dema = join(REPO, "bin/dema");
  const run = (args) =>
    execFileSync("node", [dema, ...args], { encoding: "utf8", env: { ...process.env, DEMA_HOME: messy } });
  const T0 = "2026-07-13T00:00:00.000Z";
  const EXP = "2026-07-13T08:00:00.000Z";
  const startCmd = [
    "mission", "corridor", "start", "--id", "norm-corridor", "--objective", "demo",
    "--base-sha", SHA40, "--now", T0, "--nonce", "n-norm-1", "--expires", EXP, "--json",
  ];
  const card = JSON.parse(run(startCmd));
  assert.ok(isAbsolute(card.mission_root), "consented root is absolute");
  assert.equal(card.mission_root, join(clean, "missions", "norm-corridor"), "consented root is the normalized path");
  const started = JSON.parse(run([
    ...startCmd, "--created-at", T0,
    "--consent", "GO: start mission corridor norm-corridor",
    "--consent-context", card.consent_context_hash,
  ]));
  assert.equal(started.ok, true);
  assert.equal(started.dir, card.mission_root, "the write landed exactly on the consented root");
  assert.ok(existsSync(join(clean, "missions", "norm-corridor", "contract.json")));
});

test("CLI: atomic nonce reservation — cross-mission replay, malformed marker, fail-closed error, concurrency", async (t) => {
  const home = mkdtempSync(join(tmpdir(), "corridor-nonce-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const dema = join(REPO, "bin/dema");
  const env = { ...process.env, DEMA_HOME: home };
  const run = (args) => execFileSync("node", [dema, ...args], { encoding: "utf8", env });
  const T0 = "2026-07-13T00:00:00.000Z";
  const EXP = "2026-07-13T08:00:00.000Z";
  const startCmd = (id, nonce) => [
    "mission", "corridor", "start", "--id", id, "--objective", "demo",
    "--base-sha", SHA40, "--now", T0, "--created-at", T0,
    "--nonce", nonce, "--expires", EXP, "--json",
  ];
  const authorized = (id, nonce) => {
    const card = JSON.parse(run(startCmd(id, nonce)));
    return [
      ...startCmd(id, nonce),
      "--consent", `GO: start mission corridor ${id}`,
      "--consent-context", card.consent_context_hash,
    ];
  };

  // the same nonce can never authorize a SECOND mission either — the marker is
  // global under the missions root, not per-mission
  run(authorized("na-one", "shared-nonce"));
  assert.throws(
    () => run(authorized("na-two", "shared-nonce")),
    (e) => e.status === 1 && String(e.stderr).includes("nonce_replayed"),
  );
  assert.ok(!existsSync(join(home, "missions/na-two/contract.json")), "no mutation after reservation failure");

  // a pre-existing MALFORMED marker still blocks: existence is authoritative,
  // parsed content never is
  const digest = createHash("sha256").update("poisoned-nonce", "utf8").digest("hex");
  writeFileSync(join(home, "missions/consent-nonces", `${digest}.json`), "NOT JSON {{{");
  assert.throws(
    () => run(authorized("na-three", "poisoned-nonce")),
    (e) => e.status === 1 && String(e.stderr).includes("nonce_replayed"),
  );
  assert.ok(!existsSync(join(home, "missions/na-three/contract.json")));

  // an unexpected reservation-path error (consent-nonces is a FILE) fails
  // CLOSED and performs no corridor mutation — never treated as "no nonces used"
  const home2 = mkdtempSync(join(tmpdir(), "corridor-noncedir-"));
  t.after(() => rmSync(home2, { recursive: true, force: true }));
  mkdirSync(join(home2, "missions"), { recursive: true });
  writeFileSync(join(home2, "missions/consent-nonces"), "i am a file, not a directory");
  const run2 = (args) => execFileSync("node", [dema, ...args], { encoding: "utf8", env: { ...process.env, DEMA_HOME: home2 } });
  const card2 = JSON.parse(run2(startCmd("na-four", "n4")));
  assert.throws(
    () => run2([
      ...startCmd("na-four", "n4"),
      "--consent", "GO: start mission corridor na-four",
      "--consent-context", card2.consent_context_hash,
    ]),
    (e) => e.status === 1 && String(e.stderr).includes("failed closed"),
  );
  assert.ok(!existsSync(join(home2, "missions/na-four/contract.json")));

  // concurrency: two authorized operations racing the SAME nonce — exactly one
  // reservation succeeds, exactly one is rejected as a replay (wx is atomic)
  const argsA = authorized("nc-one", "race-nonce");
  const cardB = JSON.parse(run(startCmd("nc-two", "race-nonce")));
  const argsB = [
    ...startCmd("nc-two", "race-nonce"),
    "--consent", "GO: start mission corridor nc-two",
    "--consent-context", cardB.consent_context_hash,
  ];
  const runAsync = (args) =>
    new Promise((done) =>
      execFile("node", [dema, ...args], { encoding: "utf8", env }, (err, _stdout, stderr) =>
        done({ code: err ? err.code : 0, stderr: String(stderr) }),
      ),
    );
  const [ra, rb] = await Promise.all([runAsync(argsA), runAsync(argsB)]);
  const wins = [ra, rb].filter((r) => r.code === 0);
  const losses = [ra, rb].filter((r) => r.code !== 0);
  assert.equal(wins.length, 1, `exactly one winner expected: ${JSON.stringify([ra.code, rb.code])}`);
  assert.equal(losses.length, 1);
  assert.ok(losses[0].stderr.includes("nonce_replayed"), losses[0].stderr);
});
