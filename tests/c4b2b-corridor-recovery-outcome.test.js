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
  assert.deepEqual([...CORRIDOR_RECOVERY_VERDICTS], ["STOP_CONSENT_REQUIRED", "CORRIDOR_UNCHANGED"]);
  assert.ok(!CORRIDOR_RECOVERY_VERDICTS.includes("CORRIDOR_STOPPED"),
    "this map may never emit a corridor terminal");
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
  const end = src.indexOf("const result = await runCorridorClosure", start);
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
  const end = src.indexOf("const result = await runCorridorClosure", start);
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
  // a typed terminal outcome, no closure bindings, requires_human forced true.
  const r = appendCorridorEvent({
    contract_hash, journal,
    event: {
      state: "STOPPED", at_iso: "2026-08-02T10:01:00.000Z",
      terminal_outcome: "RECOVERY_REQUIRED", requires_human: true,
      note: "operator stop · recovery RECOVERY_REQUIRED · closure_transaction tx-1",
    },
  });
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  assert.equal(r.event.state, "STOPPED");
  assert.equal(r.event.terminal_outcome, "RECOVERY_REQUIRED");
  assert.equal(r.event.requires_human, true);
  assert.ok(r.event.note.includes("closure_transaction tx-1"), "the recovery transaction is named");
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
