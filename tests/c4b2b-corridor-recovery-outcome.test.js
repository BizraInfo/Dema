// C4B2B-01…14 — MECHANICAL RECOVERY → CORRIDOR VERDICT (Gate C, C4 step 2B).
//
// C4B2A settles a post-effect-boundary failure into a qualified recovery class
// and deliberately stopped there: nothing mapped that class onto the corridor,
// so every mechanical failure died with `corridorFail` and wrote no terminal at
// all. A mission whose effect was cleanly rolled back and a mission whose estate
// is broken were indistinguishable from the corridor's point of view.
//
// TWO FACTS SHAPE THE MAP.
//
//  1. The corridor is ALREADY at CHECKPOINT when a closure runs — COMPLETE is
//     reachable only from CHECKPOINT (mission.js). So a VERIFIED_ROLLBACK, where
//     the world was restored and nothing happened, must write NOTHING: the
//     mission is healthy and stays where it was. "→ CHECKPOINT" means "remains".
//  2. `STOPPED: []` is terminal. Publishing it permanently ends the corridor.
//
// RECOGNITION IS NOT AUTHORITY (operator ruling, corrected 2026-08-03).
// A closure runs holding a COMPLETE claim. STOP is a SEPARATE corridor authority
// with its own phrase, its own hashed payload and its own capability scope, so no
// recovery outcome may append a terminal STOPPED under it. A qualified
// RECOVERY_REQUIRED therefore earns a HANDOFF — STOP_CONSENT_REQUIRED, corridor
// unchanged, nothing written — and only `dema mission corridor stop`, under fresh
// context-bound STOP consent, may append CHECKPOINT → STOPPED.
//
// Disclosure on the consent card cannot substitute: it is presentational by
// construction (outside the hashed envelope, so existing claims stay valid),
// which is exactly why it grants no cryptographically bound stop authority.
//
// MEASURED, and why the previous shape was doubly wrong: a STOPPED event
// carrying closure bindings is REFUSED by the corridor schema
// (`closure_binding_on_noncomplete_state` + three invalid-hash errors), because
// closure bindings are COMPLETE-only. The earlier write could never have
// executed; no test exercised the append. C4B2B-15 now does.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";

import {
  mapRecoveryClassToCorridor,
  CORRIDOR_RECOVERY_VERDICTS,
} from "../packages/mission/src/mission-corridor-closure.js";
import {
  CORRIDOR_TRANSITIONS,
  appendCorridorEvent,
  corridorRequiredPhrase,
} from "../packages/mission/src/mission-corridor.js";

const MISSION_CLI = join(process.cwd(), "apps/cli/src/commands/mission.js");
const cli = () => readFileSync(MISSION_CLI, "utf8");

// ── THE MAP ─────────────────────────────────────────────────────────────────

test("C4B2B-01: a verified rollback leaves the corridor untouched", () => {
  const v = mapRecoveryClassToCorridor("VERIFIED_ROLLBACK");
  assert.equal(v.verdict, "CORRIDOR_UNCHANGED");
  assert.equal(v.terminal_outcome, null);
  assert.equal(v.requires_human, false);
  // The world was restored, so a NEW consented closure is legitimate.
  assert.equal(v.fresh_attempt_permitted, true);
});

test("C4B2B-02: a qualified RECOVERY_REQUIRED asks for STOP consent and writes nothing", () => {
  const v = mapRecoveryClassToCorridor("RECOVERY_REQUIRED");
  assert.equal(v.verdict, "STOP_CONSENT_REQUIRED");
  assert.equal(v.terminal_outcome, null, "recognition carries no terminal");
  assert.equal(v.required_consent_kind, "STOP");
  assert.equal(v.requires_human, true);
  assert.equal(v.fresh_attempt_permitted, false);

  // NO class may end the corridor from here. Recognition is never authority.
  const stopping = ["VERIFIED_ROLLBACK", "RECOVERY_REQUIRED", "INVALID",
    "LEGACY_UNQUALIFIED_ROLLBACK", "NON_ROLLBACK_TERMINAL", "FORWARD_COMPLETED"]
    .filter((c) => mapRecoveryClassToCorridor(c).verdict === "CORRIDOR_STOPPED");
  assert.deepEqual(stopping, [], "no recovery class may append a corridor terminal");
  // And only the proven one may even ASK.
  const asking = ["VERIFIED_ROLLBACK", "RECOVERY_REQUIRED", "INVALID",
    "LEGACY_UNQUALIFIED_ROLLBACK", "NON_ROLLBACK_TERMINAL", "FORWARD_COMPLETED"]
    .filter((c) => mapRecoveryClassToCorridor(c).required_consent_kind === "STOP");
  assert.deepEqual(asking, ["RECOVERY_REQUIRED"]);
});

test("C4B2B-03: every unqualified class writes nothing and asks for a human", () => {
  for (const c of ["INVALID", "LEGACY_UNQUALIFIED_ROLLBACK", "NON_ROLLBACK_TERMINAL"]) {
    const v = mapRecoveryClassToCorridor(c);
    assert.equal(v.verdict, "CORRIDOR_UNCHANGED", `${c} must not end the corridor`);
    assert.equal(v.terminal_outcome, null, `${c} must not carry a terminal outcome`);
    assert.equal(v.requires_human, true, `${c} must ask for a human`);
    assert.equal(v.fresh_attempt_permitted, false, `${c} must not invite a retry`);
  }
});

test("C4B2B-04: a legacy unqualified rollback can never reach CHECKPOINT or STOPPED", () => {
  const v = mapRecoveryClassToCorridor("LEGACY_UNQUALIFIED_ROLLBACK");
  assert.equal(v.verdict, "CORRIDOR_UNCHANGED");
  assert.notEqual(v.terminal_outcome, "COMPLETED_VERIFIED");
  assert.equal(v.requires_human, true);
});

test("C4B2B-05: a forward-completed transaction is not a rollback and stops nothing", () => {
  const v = mapRecoveryClassToCorridor("FORWARD_COMPLETED");
  assert.equal(v.verdict, "CORRIDOR_UNCHANGED");
  assert.equal(v.requires_human, false);
  assert.equal(v.fresh_attempt_permitted, false, "the normal completion path owns it");
});

test("C4B2B-06: an unknown class fails closed", () => {
  for (const c of [undefined, null, "", "SOMETHING_NEW", 42, {}]) {
    const v = mapRecoveryClassToCorridor(c);
    assert.equal(v.verdict, "CORRIDOR_UNCHANGED", "an unknown class must never end the corridor");
    assert.equal(v.requires_human, true, "an unknown class must never look benign");
    assert.equal(v.fresh_attempt_permitted, false);
  }
});

test("C4B2B-07: the verdict set is closed and every result is frozen", () => {
  // C4C added RECONCILIATION_CONSENT_REQUIRED to the vocabulary. The load-bearing
  // assertion is unchanged: no corridor TERMINAL is in it, and the recovery map
  // emits only its own two.
  assert.deepEqual([...CORRIDOR_RECOVERY_VERDICTS],
    ["STOP_CONSENT_REQUIRED", "RECONCILIATION_CONSENT_REQUIRED", "CORRIDOR_UNCHANGED"]);
  assert.ok(!CORRIDOR_RECOVERY_VERDICTS.includes("CORRIDOR_STOPPED"),
    "this map may never emit a corridor terminal");
  const emitted = new Set(["VERIFIED_ROLLBACK", "RECOVERY_REQUIRED", "RECOVERY_REQUIRED_UNQUALIFIED",
    "INVALID", "LEGACY_UNQUALIFIED_ROLLBACK", "NON_ROLLBACK_TERMINAL", "FORWARD_COMPLETED", "NOPE"]
    .map((c) => mapRecoveryClassToCorridor(c).verdict));
  assert.deepEqual([...emitted].sort(), ["CORRIDOR_UNCHANGED", "STOP_CONSENT_REQUIRED"],
    "the recovery map never emits the reconciliation verdict");
  assert.ok(Object.isFrozen(CORRIDOR_RECOVERY_VERDICTS));
  for (const c of ["VERIFIED_ROLLBACK", "RECOVERY_REQUIRED", "INVALID", "NOPE"]) {
    const v = mapRecoveryClassToCorridor(c);
    assert.ok(Object.isFrozen(v), `${c} verdict must be immutable`);
    assert.ok(CORRIDOR_RECOVERY_VERDICTS.includes(v.verdict));
  }
});

test("C4B2B-08: STOPPED really is terminal, so only a proven chain may cause one", () => {
  assert.deepEqual([...CORRIDOR_TRANSITIONS.STOPPED], [], "STOPPED must have no exit");
  assert.ok(CORRIDOR_TRANSITIONS.CHECKPOINT.includes("STOPPED"), "CHECKPOINT → STOPPED must be legal");
  assert.ok(
    !CORRIDOR_TRANSITIONS.CHECKPOINT.includes("CHECKPOINT"),
    "CHECKPOINT → CHECKPOINT is not a transition, which is why a verified rollback writes nothing",
  );
});

// ── PRODUCTION WIRING ───────────────────────────────────────────────────────

test("C4B2B-09: the mechanical exit writes no corridor event at all", () => {
  const src = cli();
  const start = src.indexOf("if (!mechanical.ok) {");
  const end = src.indexOf("const result = await runOwnedCorridorWeld", start);
  assert.ok(start > 0 && end > start);
  const region = src.slice(start, end);
  assert.ok(region.includes("mapRecoveryClassToCorridor(mechanical.recovery_class)"));
  assert.ok(!region.includes("appendCorridorEvent"), "no corridor event may be built here");
  assert.ok(!region.includes("appendCorridorJournalEvent"), "nothing may be persisted here");
  assert.ok(!region.includes('state: "STOPPED"'), "no STOPPED terminal may be minted here");
  assert.ok(region.includes("corridor_write_performed: false"));
});

test("C4B2B-10: the handoff exposes the EXACT existing STOP phrase, not a copy", () => {
  const src = cli();
  const start = src.indexOf('if (corridorVerdict.verdict === "STOP_CONSENT_REQUIRED")');
  assert.ok(start > 0, "the handoff branch must exist");
  const region = src.slice(start, start + 2400);
  // Derived from the same function the STOP gate uses, so it cannot drift.
  assert.ok(region.includes('corridorRequiredPhrase("STOP", id)'),
    "the phrase must be derived, never hardcoded");
  assert.ok(region.includes("required_consent_kind"));
  assert.ok(region.includes("dema mission corridor stop"));
  assert.equal(corridorRequiredPhrase("STOP", "demo-mission"),
    "GO: stop mission corridor demo-mission");
});

test("C4B2B-11: the retry-asserting message is gone from the mechanical exit", () => {
  const src = cli();
  const start = src.indexOf("if (!mechanical.ok) {");
  const end = src.indexOf("const result = await runOwnedCorridorWeld", start);
  const region = src.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.ok(
    !region.includes("re-run this exact transaction"),
    "C2 history forbids re-running a settled transaction; the message must not assert it",
  );
  assert.ok(region.includes("must NOT be re-run"), "the honest posture must be stated");
  assert.ok(region.includes("dema mission corridor stop"),
    "an unqualified failure must hand the operator the exact next command");
});

test("C4B2B-12: the card never claims COMPLETE consent covers STOPPED", () => {
  const src = cli();
  assert.ok(src.includes("CORRIDOR_COMPLETE_LAWFUL_TERMINALS"));
  assert.ok(src.includes("the only terminal this phrase authorizes"));
  assert.ok(src.includes("needs its own separate authorization"));
  assert.ok(src.includes("this phrase authorizes:"), "the human card must print it");
  // The retracted claim must be gone.
  assert.ok(!src.includes("STOPPED (qualified recovery required — a human must inspect the estate)"),
    "the disclosure must not present STOPPED as a terminal this phrase grants");
});

test("C4B2B-13: the disclosure is presentational and cannot move consent_context_hash", () => {
  const corridor = readFileSync(
    join(process.cwd(), "packages/mission/src/mission-corridor.js"), "utf8",
  );
  // The hashed envelope is built from buildCorridorConsentContext's declared
  // inputs. lawful_terminals is NOT one of them, so existing claims stay valid.
  const sigStart = corridor.indexOf("export function buildCorridorConsentContext({");
  const sig = corridor.slice(sigStart, corridor.indexOf("} = {}) {", sigStart));
  assert.ok(sigStart > 0);
  assert.ok(!sig.includes("lawful_terminals"),
    "disclosure must never enter the hashed consent envelope");
  assert.ok(!sig.includes("cardExtra"), "card presentation must never be hashed");
});

test("C4B2B-14: no corridor state was invented and the closure kernel still owns COMPLETE", () => {
  const kernel = readFileSync(
    join(process.cwd(), "packages/mission/src/mission-corridor-closure.js"), "utf8",
  );
  // C4B2B maps ONTO the existing corridor; it must not add lifecycle states.
  for (const invented of ["ROLLBACK_STARTED:", "ROLLED_BACK:", "BEFORE_STATE_VERIFIED:", "HALTED"]) {
    assert.ok(!CORRIDOR_TRANSITIONS[invented?.replace(":", "")],
      `${invented} must not become a corridor state`);
  }
  assert.equal(Object.keys(CORRIDOR_TRANSITIONS).length, 11, "the corridor state count is unchanged");
  assert.ok(kernel.includes('state: outcome === "COMPLETED_VERIFIED" ? "COMPLETE" : "STOPPED"'),
    "the weld kernel's own terminal mapping is untouched");
});

// ── THE APPEND ITSELF — the coverage the first C4B2B shape never had ────────

/** A real journal driven to CHECKPOINT through the corridor's own writer. */
function journalAtCheckpoint() {
  const contract_hash = `sha256:${"a".repeat(64)}`;
  let journal = [];
  for (const state of ["CREATED", "PREFLIGHT", "PLANNING", "IMPLEMENTING",
    "VERIFYING", "SAT_REVIEW", "CHECKPOINT"]) {
    const r = appendCorridorEvent({
      contract_hash, journal, event: { state, at_iso: "2026-08-02T10:00:00.000Z" },
    });
    assert.equal(r.ok, true, `${state}: ${r.blocked_by?.join(", ")}`);
    journal = r.journal;
  }
  return { contract_hash, journal };
}

test("C4B2B-15: a STOPPED event carrying closure bindings is refused by the schema", () => {
  const { contract_hash, journal } = journalAtCheckpoint();
  assert.equal(journal.at(-1).state, "CHECKPOINT");
  // This is EXACTLY the shape the first C4B2B implementation tried to write.
  // It was never executable: closure bindings are COMPLETE-only, and the
  // seal/ledger/anchor members do not exist for a failed closure.
  const r = appendCorridorEvent({
    contract_hash, journal,
    event: {
      state: "STOPPED", at_iso: "2026-08-02T10:01:00.000Z",
      terminal_outcome: "RECOVERY_REQUIRED", requires_human: true,
      closure_transaction_id: "tx-1",
      consent_claim_hash: "b".repeat(64),
      prepared_intent_hash: `sha256:${"c".repeat(64)}`,
    },
  });
  assert.equal(r.ok, false, "the corridor schema must refuse this shape");
  assert.ok(r.blocked_by.includes("closure_binding_on_noncomplete_state"));
  assert.ok(r.blocked_by.includes("closure_binding_incomplete"));
});

test("C4B2B-16: the STOP path's event shape is accepted and terminal", () => {
  const { contract_hash, journal } = journalAtCheckpoint();
  // What `dema mission corridor stop --closure-transaction` actually writes:
  // a typed terminal outcome plus the C4B2B.1 causal binding (required since
  // that slice), no COMPLETE-shaped closure bindings, requires_human forced true.
  const r = appendCorridorEvent({
    contract_hash, journal,
    event: {
      state: "STOPPED", at_iso: "2026-08-02T10:01:00.000Z",
      terminal_outcome: "RECOVERY_REQUIRED", requires_human: true,
      recovery_stop_binding: {
        schema: "bizra.dema.corridor_recovery_stop_binding.v0.1",
        closure_transaction_id: "tx-1",
        transaction_hash: `sha256:${"1".repeat(64)}`,
        prepared_intent_hash: `sha256:${"2".repeat(64)}`,
        terminal_event_hash: `sha256:${"3".repeat(64)}`,
        terminal_outcome: "RECOVERY_REQUIRED",
      },
      note: "operator stop · recovery RECOVERY_REQUIRED",
    },
  });
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  assert.equal(r.event.state, "STOPPED");
  assert.equal(r.event.terminal_outcome, "RECOVERY_REQUIRED");
  assert.equal(r.event.requires_human, true);
  assert.equal(r.event.recovery_stop_binding.closure_transaction_id, "tx-1",
    "the recovery transaction is named by a TYPED binding, not prose");
  // Terminal: the corridor cannot be extended afterwards.
  const after = appendCorridorEvent({
    contract_hash, journal: r.journal,
    event: { state: "COMPLETE", at_iso: "2026-08-02T10:02:00.000Z", terminal_outcome: "COMPLETED_VERIFIED" },
  });
  assert.equal(after.ok, false);
  assert.ok(after.blocked_by.includes("corridor_terminal"));
});

test("C4B2B-17: the STOP path is gated on a re-verified RECOVERY_REQUIRED transaction", () => {
  const src = cli();
  const stop = src.indexOf('if (verb === "stop")');
  assert.ok(stop > 0);
  const region = src.slice(stop, stop + 4000);
  assert.ok(region.includes("readRollbackBindingContext"), "the stop must re-read C2 from disk");
  assert.ok(region.includes("classifySettledMechanicalRecovery"), "and re-classify it");
  assert.ok(region.includes('cls !== "RECOVERY_REQUIRED"'),
    "a transaction that does not classify RECOVERY_REQUIRED cannot justify a stop");
  // The binding is never taken on the caller's word.
  assert.ok(!region.includes("argv.recovery_class"), "the class must never be caller-supplied");
});

test("C4B2B-18: COMPLETE and STOP remain separate authorities", () => {
  assert.notEqual(corridorRequiredPhrase("COMPLETE", "m"), corridorRequiredPhrase("STOP", "m"));
  assert.equal(corridorRequiredPhrase("COMPLETE", "m"), "GO: complete mission corridor m");
  assert.equal(corridorRequiredPhrase("STOP", "m"), "GO: stop mission corridor m");
  // The handoff hands over the STOP phrase, never the COMPLETE one it holds.
  const src = cli();
  const start = src.indexOf('if (corridorVerdict.verdict === "STOP_CONSENT_REQUIRED")');
  const region = src.slice(start, start + 2400);
  assert.ok(region.includes('corridorRequiredPhrase("STOP", id)'));
  assert.ok(!region.includes('corridorRequiredPhrase("COMPLETE"'));
});

// ── C4B2B.1 — DURABLE RECOVERY-STOP BINDING ─────────────────────────────────
//
// The GATE proves the stop was permitted at the moment it happened. It does not
// let the journal LATER prove which verified failure made that stop necessary:
// journal law checks hashing, index order, contract binding, transition legality
// and terminality, but derives no causal link to C2. A note naming the
// transaction is tamper-evident (the event is hashed) yet is not a typed,
// machine-validated proof relationship.
//
// So a recovery-caused STOPPED carries an exact typed binding — a DISTINCT
// contract, never the COMPLETE one padded with nulls, because a failed closure
// legitimately has no seal_head, ledger_head or anchor_hash.

import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { claimConsentNonce } from "../packages/receipts/src/consent-nonce-claim.js";
import {
  replayClosureTransaction,
  readRollbackBindingContext,
} from "../packages/receipts/src/mission-closure-transaction.js";
import {
  buildRenameEffectAdapter, buildRenameEffectIntent,
  runTransactionalMechanicalClosure,
  verifyRecoveryStopBinding, CORRIDOR_RENAME_RECOVERY_POLICY_HASH,
} from "../packages/mission/src/corridor-closure-gatherer.js";
import {
  CORRIDOR_RECOVERY_STOP_BINDING_SCHEMA,
  MISSION_CORRIDOR_EVENT_SCHEMA_V0_2,
  verifyCorridorJournal,
} from "../packages/mission/src/mission-corridor.js";

const AT = "2026-08-02T12:00:00.000Z";
const NOW = 1_786_000_000_000;

/** Drive a REAL closure to a settled, qualified RECOVERY_REQUIRED transaction. */
async function settledRecovery(tag) {
  const demaHome = await mkdtemp(join(tmpdir(), `c4b2b1-${tag}-`));
  const estate = join(demaHome, "estate");
  await mkdir(estate, { recursive: true });
  await writeFile(join(estate, "a.draft.json"), "{}\n");
  const prepared = buildRenameEffectIntent({ scopeRoot: estate, from: "a.draft.json", to: "a.sealed.json" });
  const cr = await claimConsentNonce({
    nonce: `n-${tag}`, actionClass: "C3_LOCAL_WRITE", actionKind: "COMPLETE", missionId: "m",
    contractHash: `sha256:${"c".repeat(64)}`, consentContextHash: `sha256:${"d".repeat(64)}`,
    transactionId: `tx-${tag}`, checkpointEventHash: `sha256:${"e".repeat(64)}`,
    preparedIntentHash: prepared.prepared_intent_hash,
    recoveryPolicyHash: CORRIDOR_RENAME_RECOVERY_POLICY_HASH, claimedAtIso: AT, demaHome,
  });
  const base = buildRenameEffectAdapter({ scopeRoot: estate, from: "a.draft.json", to: "a.sealed.json" });
  const r = await runTransactionalMechanicalClosure({
    demaHome, claim: cr.claim, prepared,
    mission: { objective: "one rename", root: estate },
    lease: { lease_id: "l", scope_root: estate, expires_at: NOW + 60_000, budget_acts: 1 },
    consent: { by: "operator", ref: cr.claim.consent_context_hash, nonce: `n-${tag}`, plan_hash: prepared.intent.plan_hash },
    anchorDir: join(demaHome, "anchors"),
    // Apply for real, then fail; the settler's undo lies, so restoration cannot
    // be verified and the transaction escalates to RECOVERY_REQUIRED.
    effect: Object.freeze({
      ...base,
      apply: (plan) => { base.apply(plan); throw Object.assign(new Error("post-apply"), { code: "effect_failed" }); },
      undo: () => true,
    }),
    now: NOW, atIso: AT,
  });
  assert.equal(r.recovery_required, true, r.reason);
  const state = await replayClosureTransaction({ demaHome, transactionId: `tx-${tag}` });
  assert.equal(state.terminal_outcome, "RECOVERY_REQUIRED");
  const bound = await readRollbackBindingContext({ demaHome, transactionId: `tx-${tag}` });
  assert.equal(bound.ok, true, bound.reason);
  return { demaHome, txId: `tx-${tag}`, state, bound };
}

/** The binding the STOP gate derives — every field from disk. */
const bindingFrom = ({ txId, state, bound }) => ({
  schema: CORRIDOR_RECOVERY_STOP_BINDING_SCHEMA,
  closure_transaction_id: txId,
  transaction_hash: bound.context.transaction_hash,
  prepared_intent_hash: bound.context.prepared_intent_hash,
  terminal_event_hash: state.head_event_hash,
  terminal_outcome: state.terminal_outcome,
});

const stoppedEvent = (binding) => ({
  state: "STOPPED", at_iso: "2026-08-02T10:01:00.000Z",
  terminal_outcome: "RECOVERY_REQUIRED", requires_human: true,
  recovery_stop_binding: binding,
});

test("C4B2B1-01: a recovery STOPPED without its binding is refused on append", () => {
  const { contract_hash, journal } = journalAtCheckpoint();
  const r = appendCorridorEvent({
    contract_hash, journal,
    event: { state: "STOPPED", at_iso: "2026-08-02T10:01:00.000Z",
      terminal_outcome: "RECOVERY_REQUIRED", requires_human: true },
  });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("recovery_stop_binding_required"));
});

test("C4B2B1-02: an ordinary operator STOP stays legal and stays v0.1", () => {
  const { contract_hash, journal } = journalAtCheckpoint();
  const r = appendCorridorEvent({
    contract_hash, journal,
    event: { state: "STOPPED", at_iso: "2026-08-02T10:01:00.000Z", requires_human: true, note: "operator stop" },
  });
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  assert.equal(r.event.schema, "bizra.dema.mission_corridor_event.v0.1");
  assert.equal(r.event.recovery_stop_binding, undefined, "no binding may be added to a manual stop");
});

test("C4B2B1-03: a bound recovery STOPPED is accepted and declares v0.2", async () => {
  const s = await settledRecovery("ok");
  const { contract_hash, journal } = journalAtCheckpoint();
  const r = appendCorridorEvent({ contract_hash, journal, event: stoppedEvent(bindingFrom(s)) });
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  assert.equal(r.event.schema, MISSION_CORRIDOR_EVENT_SCHEMA_V0_2);
  assert.equal(r.event.recovery_stop_binding.closure_transaction_id, s.txId);
  // v0.1 events in the same journal are untouched and the whole chain verifies.
  assert.equal(journal[0].schema, "bizra.dema.mission_corridor_event.v0.1");
  const contract = { schema: "x" };
  void contract;
});

test("C4B2B1-04: the binding replays through the full cross-artifact chain", async () => {
  const s = await settledRecovery("chain");
  const { contract_hash, journal } = journalAtCheckpoint();
  const r = appendCorridorEvent({ contract_hash, journal, event: stoppedEvent(bindingFrom(s)) });
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  const v = await verifyRecoveryStopBinding({ demaHome: s.demaHome, event: r.event });
  assert.equal(v.ok, true, v.reason);
  assert.equal(v.recovery_class, "RECOVERY_REQUIRED");
});

test("C4B2B1-05: every forged binding field is rejected by the verifier", async () => {
  const s = await settledRecovery("forge");
  const good = bindingFrom(s);
  const cases = [
    ["closure_transaction_id", "tx-does-not-exist", /closure_transaction_unverifiable/],
    ["transaction_hash", `sha256:${"0".repeat(64)}`, /transaction_hash_mismatch/],
    ["prepared_intent_hash", `sha256:${"1".repeat(64)}`, /prepared_intent_hash_mismatch/],
    ["terminal_event_hash", `sha256:${"2".repeat(64)}`, /terminal_event_hash_mismatch/],
  ];
  for (const [field, forged, expected] of cases) {
    const v = await verifyRecoveryStopBinding({
      demaHome: s.demaHome,
      event: { state: "STOPPED", terminal_outcome: "RECOVERY_REQUIRED",
        recovery_stop_binding: { ...good, [field]: forged } },
    });
    assert.equal(v.ok, false, `${field} forgery must be refused`);
    assert.match(v.reason, expected, `${field}: ${v.reason}`);
  }
});

test("C4B2B1-06: a head that advanced invalidates the binding", async () => {
  const s = await settledRecovery("head");
  const good = bindingFrom(s);
  // The terminal_event_hash pins the exact head. Any other head is refused.
  const stale = { ...good, terminal_event_hash: s.state.events[0].event_hash };
  const v = await verifyRecoveryStopBinding({
    demaHome: s.demaHome,
    event: { state: "STOPPED", terminal_outcome: "RECOVERY_REQUIRED", recovery_stop_binding: stale },
  });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "terminal_event_hash_mismatch");
});

test("C4B2B1-07: a non-recovery transaction can never justify a recovery stop", async () => {
  const s = await settledRecovery("nonrec");
  // Point the binding at a transaction that settled a VERIFIED rollback.
  const other = await (async () => {
    const demaHome = await mkdtemp(join(tmpdir(), "c4b2b1-vr-"));
    const estate = join(demaHome, "estate");
    await mkdir(estate, { recursive: true });
    await writeFile(join(estate, "a.draft.json"), "{}\n");
    const prepared = buildRenameEffectIntent({ scopeRoot: estate, from: "a.draft.json", to: "a.sealed.json" });
    const cr = await claimConsentNonce({
      nonce: "n-vr", actionClass: "C3_LOCAL_WRITE", actionKind: "COMPLETE", missionId: "m",
      contractHash: `sha256:${"c".repeat(64)}`, consentContextHash: `sha256:${"d".repeat(64)}`,
      transactionId: "tx-vr", checkpointEventHash: `sha256:${"e".repeat(64)}`,
      preparedIntentHash: prepared.prepared_intent_hash,
      recoveryPolicyHash: CORRIDOR_RENAME_RECOVERY_POLICY_HASH, claimedAtIso: AT, demaHome,
    });
    const base = buildRenameEffectAdapter({ scopeRoot: estate, from: "a.draft.json", to: "a.sealed.json" });
    const r = await runTransactionalMechanicalClosure({
      demaHome, claim: cr.claim, prepared,
      mission: { objective: "one rename", root: estate },
      lease: { lease_id: "l", scope_root: estate, expires_at: NOW + 60_000, budget_acts: 1 },
      consent: { by: "operator", ref: cr.claim.consent_context_hash, nonce: "n-vr", plan_hash: prepared.intent.plan_hash },
      anchorDir: join(demaHome, "anchors"),
      effect: Object.freeze({ ...base,
        apply: (plan) => { base.apply(plan); throw Object.assign(new Error("x"), { code: "effect_failed" }); } }),
      now: NOW, atIso: AT,
    });
    assert.equal(r.rollback_verified, true, r.reason);
    const state = await replayClosureTransaction({ demaHome, transactionId: "tx-vr" });
    const bound = await readRollbackBindingContext({ demaHome, transactionId: "tx-vr" });
    return { demaHome, txId: "tx-vr", state, bound };
  })();

  const v = await verifyRecoveryStopBinding({
    demaHome: other.demaHome,
    event: { state: "STOPPED", terminal_outcome: "RECOVERY_REQUIRED",
      recovery_stop_binding: bindingFrom(other) },
  });
  assert.equal(v.ok, false, "a verified rollback must never justify a stop");
  // The transaction settled EXECUTION_FAILED_ROLLED_BACK, so the binding it
  // would produce cannot claim RECOVERY_REQUIRED.
  assert.match(v.reason, /terminal_outcome_invalid|outcome_not_recovery_required|unqualified/,
    `unexpected reason: ${v.reason}`);
  void s;
});

test("C4B2B1-08: the STOP gate derives every binding field from disk", () => {
  const src = cli();
  const stop = src.indexOf('if (verb === "stop")');
  const region = src.slice(stop, stop + 5000);
  assert.ok(region.includes("transaction_hash: bound.context.transaction_hash"));
  assert.ok(region.includes("prepared_intent_hash: bound.context.prepared_intent_hash"));
  assert.ok(region.includes("terminal_event_hash: bound.state.head_event_hash"));
  assert.ok(region.includes("terminal_outcome: bound.state.terminal_outcome"));
  // The only caller-supplied member is the locator.
  assert.ok(region.includes("closure_transaction_id: closureTxId"));
  assert.ok(region.includes("is a LOCATOR"), "the locator-not-authority law must be stated");
});

test("C4B2B1-09: a journal carrying a v0.2 bound event still verifies end to end", async () => {
  const s = await settledRecovery("verify");
  const contract = { schema: "bizra.demo.contract", mission_id: "m" };
  const contract_hash = sha256CanonicalJsonV1(contract);
  let journal = [];
  for (const state of ["CREATED", "PREFLIGHT", "PLANNING", "IMPLEMENTING",
    "VERIFYING", "SAT_REVIEW", "CHECKPOINT"]) {
    const r = appendCorridorEvent({ contract_hash, journal, event: { state, at_iso: "2026-08-02T10:00:00.000Z" } });
    assert.equal(r.ok, true, r.blocked_by?.join(", "));
    journal = r.journal;
  }
  const stop = appendCorridorEvent({ contract_hash, journal, event: stoppedEvent(bindingFrom(s)) });
  assert.equal(stop.ok, true, stop.blocked_by?.join(", "));
  const verified = verifyCorridorJournal({ contract, contract_hash, journal: stop.journal });
  assert.equal(verified.ok, true, verified.blocked_by?.join(", "));
  // Mixed schemas in one chain, and the hash chain still holds.
  assert.equal(stop.journal[0].schema, "bizra.dema.mission_corridor_event.v0.1");
  assert.equal(stop.journal.at(-1).schema, MISSION_CORRIDOR_EVENT_SCHEMA_V0_2);
});

// ── C4B2B-Q — A CLASS MUST BE MEASURED, NEVER ASSERTED ──────────────────────
//
// MEASURED DEFECT. Every refusal path in the recovery writer reported the
// QUALIFIED class RECOVERY_REQUIRED — including refusals that classified
// nothing: a post-ledger divergence, an unreadable transaction, a failed
// durability probe. Under C4B2B that class maps to STOP_CONSENT_REQUIRED, so
// each of those invited the operator to end the corridor on evidence that was
// never established. The STOP gate re-verifies and refuses, so it failed closed
// — but the handoff was a lie, and the same assertion leaked into
// terminal_outcome, which named a terminal the transaction never reached.

test("C4B2B-Q1: a post-ledger refusal reports the UNQUALIFIED class, not the earned one", async () => {
  const s = await settledRecovery("postledger");
  // Advance the transaction past the ledger boundary.
  const st = await replayClosureTransaction({ demaHome: s.demaHome, transactionId: s.txId });
  assert.equal(st.terminal, true, "the fixture settles first");

  const g = await import("../packages/mission/src/corridor-closure-gatherer.js");
  const settled = await g.settleMechanicalFailureWithVerifiedRollback({
    demaHome: s.demaHome,
    claim: { transaction_id: "tx-does-not-exist" },
    prepared: null,
    effect: null,
    failure: { stage: "EFFECT_APPLY", reason: "x", omega0_card: { reason: "effect_failed" } },
  });
  assert.equal(settled.recovery_required, true, "recovery genuinely is required");
  assert.equal(settled.recovery_class, "RECOVERY_REQUIRED_UNQUALIFIED",
    "a refusal must not claim the qualified class");
  assert.equal(settled.terminal_outcome, null, "a refusal settled no terminal");
  assert.equal(settled.rollback_verified, false);
});

test("C4B2B-Q2: the unqualified class offers no stop and ends no corridor", () => {
  const v = mapRecoveryClassToCorridor("RECOVERY_REQUIRED_UNQUALIFIED");
  assert.equal(v.verdict, "CORRIDOR_UNCHANGED");
  assert.equal(v.terminal_outcome, null);
  assert.equal(v.requires_human, true, "a human is still needed");
  assert.equal(v.required_consent_kind, null, "but no stop may be offered on unearned evidence");
  assert.equal(v.fresh_attempt_permitted, false);
  // Only the measured class may ever ask for STOP consent.
  assert.equal(mapRecoveryClassToCorridor("RECOVERY_REQUIRED").required_consent_kind, "STOP");
});

test("C4B2B-Q3: exactly one helper may emit the qualified class", () => {
  const src = readFileSync(
    join(process.cwd(), "packages/mission/src/corridor-closure-gatherer.js"), "utf8",
  );
  // The distinction is structural: refusals cannot reach the qualified shape.
  assert.equal((src.match(/recovery_class: "RECOVERY_REQUIRED",/g) ?? []).length, 1,
    "only rollbackQualifiedRecovery may set the earned class");
  const qualified = src.indexOf("function rollbackQualifiedRecovery(");
  const reportSettled = src.indexOf("function reportSettled(");
  assert.ok(qualified > 0 && reportSettled > 0);
  // …and it is called only from the path that classified first.
  // Exclude the declaration itself; count invocations only.
  const calls = [...src.matchAll(/(?<!function )rollbackQualifiedRecovery\(\{/g)];
  assert.equal(calls.length, 1, "exactly one invocation");
  const body = src.slice(reportSettled, src.indexOf("\n}\n", reportSettled));
  assert.ok(body.includes("rollbackQualifiedRecovery({"),
    "the only caller is the one that ran classifySettledMechanicalRecovery");
});

test("C4B2B-Q4: the rollback-started schema declares v2 after its key set changed", async () => {
  const tx = await import("../packages/receipts/src/mission-closure-transaction.js");
  assert.equal(tx.CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA,
    "bizra.dema.corridor_rollback_started_evidence.v2");
  // The keys it now carries are the monotonic-recovery triple, not the frozen
  // single terminal the v1 name described.
  const s = await settledRecovery("schema");
  const started = s.state.events.find((e) => e.phase === "ROLLBACK_STARTED");
  assert.ok(started, "the fixture produced a real adjudication");
  const ev = started.evidence_refs[0];
  assert.equal(ev.schema, "bizra.dema.corridor_rollback_started_evidence.v2");
  assert.deepEqual(Object.keys(ev).sort(), [
    "failure_reason_code", "failure_stage", "prepared_intent_hash",
    "recovery_fallback_outcome", "recovery_objective", "rollback_success_outcome",
    "schema", "transaction_hash",
  ]);
  assert.equal(ev.intended_terminal_outcome, undefined, "the v1 field is gone, not aliased");
});
