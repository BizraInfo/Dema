// GENESIS-MISSION-TRACE-SEAM-0A — TS-01…TS-10 carrying T-01…T-14.
//
// PURPOSE. Before Dema is allowed to act, she must be able to prove how she
// legitimately arrived at the boundary where action became possible. This seam
// makes INTENTION → RISK → PREVIEW → CONSENT_REQUESTED causally reconstructable
// BEFORE any authority or effect exists.
//
// CONSTITUTION (frozen):
//   TRACE EVENT   = one causal fact          TRACE ≠ AUTHORITY
//   TRACE JOURNAL = ordered causal history   TRACE ≠ RECEIPT
//   RECEIPT       = independently accepted   TRACE ≠ POINTER
//   POINTER       = authoritative now
//
// THE STRONGEST CONTROL IS VOCABULARY: `authority_state` has exactly one legal
// value in v0.1 — "NOT_GRANTED". A trace event claiming granted authority is
// not merely rejected; it is UNREPRESENTABLE, so T-09's forged-grant attack
// dies at the closed vocabulary before any consumer could believe it.
//
// The golden adversarial specimen is GS-06's own consent law: consent captured
// against preview A evaluated against preview B must journal as
// CONSENT_BINDING_MISMATCH with BOTH commitments preserved — history is never
// rewritten into a clean narrative.
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
  GENESIS_TRACE_EVENT_SCHEMA,
  TRACE_EVENT_TYPES,
  TRACE_AUTHORITY_STATES,
  buildTraceEvent,
  appendTraceEvent,
  verifyTraceJournal,
  verifyCausalMission,
  runTracedSpineWalk,
} from "../packages/mission/src/genesis-mission-trace.js";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const TRACE_SRC = `${REPO}packages/mission/src/genesis-mission-trace.js`;

const EXEC_COMMIT = "1111111111111111111111111111111111111111";
const EXEC_TREE = "2222222222222222222222222222222222222222";
const ACTION = "RUN_GENESIS_MISSION_SPINE";
const CANON = canonicalSeasonAction(ACTION);
const SEASON = "genesis-trace-season";
const MISSION = "genesis-mission-001";
const CONTRACT_HASH = `sha256:${"c".repeat(64)}`;
const NOW = "2026-08-11T12:00:00Z";
const TRACE_ID = "trace-genesis-0001";
const CAUSATION = "cause-genesis-0001";
const CORRELATION = "corr-genesis-0001";

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
  const h = await mkdtemp(join(tmpdir(), "genesis-trace-"));
  homes.push(h);
  return h;
}
test.after(async () => {
  for (const h of homes) await rm(h, { recursive: true, force: true }).catch(() => {});
});

async function anchoredHome() {
  const home = await newHome();
  const saved = await saveSeasonState({
    demaHome: home,
    state: {
      season_id: SEASON, mission_id: MISSION, mission_phase: "SPINE_WALK",
      completed_steps: [], next_safe_action: CANON, must_not_repeat: [],
      pending_consent: [], repository_commit: EXEC_COMMIT, repository_tree: EXEC_TREE,
      saved_at: "2026-08-11T09:00:00Z",
    },
    worldAnchor: { observed: { fixture: "genesis-trace-world" } },
  });
  assert.equal(saved.ok, true, saved.reason);
  return home;
}

const execBinding = () =>
  readExecutingRepositoryBinding({
    runGit: async (args) => (args.includes("HEAD^{tree}") ? `${EXEC_TREE}\n` : `${EXEC_COMMIT}\n`),
  });

function corridorContext() {
  return {
    kind: "START", mission_id: MISSION, contract_hash: CONTRACT_HASH,
    permitted_actions: ["analyze", "edit", "test"], mission_root: "/tmp/genesis-mission-root",
    nonce: "genesis-nonce-0001", expires_at: "2026-08-11T23:59:59Z",
  };
}

async function traced(over = {}) {
  const home = over.home ?? (await anchoredHome());
  const seasonLoad = await loadSeasonHead({ demaHome: home, seasonId: SEASON });
  return {
    home,
    t: runTracedSpineWalk({
      intention: over.intention ?? INTENTION,
      effect: over.effect ?? EFFECT,
      seasonLoad,
      executingRepository: await execBinding(),
      actionId: ACTION,
      corridorContext: corridorContext(),
      presentedPhrase: over.presentedPhrase,
      presentedConsentContextHash: over.presentedConsentContextHash,
      now: NOW,
      trace: {
        trace_id: over.trace_id ?? TRACE_ID,
        mission_id: MISSION,
        mission_contract_hash: CONTRACT_HASH,
        causation_id: over.causation_id ?? CAUSATION,
        correlation_id: CORRELATION,
        retry_of: over.retry_of,
      },
      appendEventFn: over.appendEventFn,
    }),
  };
}

// ── TS-01 · T-01: no consequential transition without causal identity ───────
test("TS-01: every journal event carries trace/span/causation/mission identity and a re-derivable hash", async () => {
  const { t } = await traced({});
  assert.equal(t.trace_status, "TRACED");
  assert.ok(t.journal.length >= 4);
  for (const e of t.journal) {
    assert.equal(e.schema, GENESIS_TRACE_EVENT_SCHEMA);
    assert.equal(e.trace_id, TRACE_ID);
    assert.match(e.span_id, /^SP-\d{4}$/);
    assert.equal(e.causation_id, CAUSATION);
    assert.equal(e.mission_id, MISSION);
    assert.equal(e.mission_contract_hash, CONTRACT_HASH);
    assert.match(e.event_hash, /^sha256:/);
    assert.ok(TRACE_EVENT_TYPES.includes(e.event_type), `unknown event_type ${e.event_type}`);
  }
  const v = verifyTraceJournal({ journal: t.journal, mission_contract_hash: CONTRACT_HASH });
  assert.equal(v.ok, true, v.reason);
});

// ── TS-02 · T-02/T-11: data minimization — commitments, never content ───────
test("TS-02: the journal carries hashes and refs, never the raw intention or effect content", async () => {
  const { t } = await traced({});
  const serialized = JSON.stringify(t.journal);
  assert.equal(serialized.includes(INTENTION), false, "raw intention text leaked into the trace");
  assert.equal(serialized.includes("canonical-a.md"), false, "raw effect content leaked into the trace");
  const sealed = t.journal.find((e) => e.event_type === "PREVIEW_SEALED");
  assert.equal(sealed.preview_hash, buildDemaReversibleFileStewardPayload(EFFECT).content_hash);
});

// ── TS-03 · T-03/T-09: authority is unrepresentable, and forgery breaks the chain ─
test("TS-03: a forged consent-granted event is unrepresentable AND breaks journal verification", async () => {
  assert.deepEqual([...TRACE_AUTHORITY_STATES], ["NOT_GRANTED"],
    "v0.1 must be structurally incapable of recording granted authority");
  const built = buildTraceEvent({
    trace_id: TRACE_ID, sequence: 1, previous_event_hash: null,
    mission_id: MISSION, mission_contract_hash: CONTRACT_HASH,
    event_type: "CONSENT_REQUESTED", stage: "CONSENT_GATE",
    causation_id: CAUSATION, correlation_id: CORRELATION,
    authority_state: "GRANTED", outcome: "forged",
  });
  assert.equal(built.ok, false);
  assert.equal(built.reason, "authority_state_invalid");

  // Even hand-authoring the object and splicing it in breaks verification.
  const { t } = await traced({});
  const forged = { ...t.journal[t.journal.length - 1], authority_state: "GRANTED" };
  const tampered = [...t.journal.slice(0, -1), forged];
  const v = verifyTraceJournal({ journal: tampered, mission_contract_hash: CONTRACT_HASH });
  assert.equal(v.ok, false);
});

// ── TS-04 · T-07: order integrity — delete / reorder / substitute all fail ──
test("TS-04: deleting, reordering, or editing any event fails journal verification", async () => {
  const { t } = await traced({});
  const j = t.journal;
  assert.ok(j.length >= 4, "control: need a multi-event journal");

  const deleted = [j[0], ...j.slice(2)];
  assert.equal(verifyTraceJournal({ journal: deleted, mission_contract_hash: CONTRACT_HASH }).ok, false,
    "a deleted middle event must break the chain");

  const reordered = [j[0], j[2], j[1], ...j.slice(3)];
  assert.equal(verifyTraceJournal({ journal: reordered, mission_contract_hash: CONTRACT_HASH }).ok, false,
    "a reordered journal must not verify");

  const edited = j.map((e, i) => (i === 1 ? { ...e, outcome: "rewritten" } : e));
  assert.equal(verifyTraceJournal({ journal: edited, mission_contract_hash: CONTRACT_HASH }).ok, false,
    "an edited body must fail hash re-derivation");
});

// ── TS-05 · T-08: the golden specimen — contradiction preserved, never rewritten ─
test("TS-05: consent(A) against preview(B) journals CONSENT_BINDING_MISMATCH with both commitments", async () => {
  const home = await anchoredHome();
  const probeA = (await traced({ home })).t;
  assert.equal(probeA.result.verdict, "CONSENT_REQUIRED", "control: probe must demand consent");
  const bindingA = probeA.result.consent.consent_context_hash;

  const { t } = await traced({
    home,
    effect: EFFECT_B, // the world moved: preview is now B
    presentedPhrase: probeA.result.consent.required_phrase,
    presentedConsentContextHash: bindingA,
    trace_id: "trace-genesis-0002",
  });
  const last = t.journal[t.journal.length - 1];
  assert.equal(last.event_type, "CONSENT_BINDING_MISMATCH");
  assert.equal(last.authority_state, "NOT_GRANTED");
  const names = last.input_commitments.map((c) => c.name);
  assert.ok(names.includes("supplied_binding") && names.includes("required_binding"),
    "both commitments must be preserved — the trace must show A vs B, not a clean story");
  const supplied = last.input_commitments.find((c) => c.name === "supplied_binding").hash;
  const required = last.input_commitments.find((c) => c.name === "required_binding").hash;
  assert.equal(supplied, bindingA);
  assert.notEqual(supplied, required, "control: the mismatch is genuine");
  // The failed path is a VALID journal — history is preserved, not erased.
  assert.equal(verifyTraceJournal({ journal: t.journal, mission_contract_hash: CONTRACT_HASH }).ok, true);
});

// ── TS-06 · T-10: trace sink unavailable → TRACE_UNAVAILABLE, never success ─
test("TS-06: an unavailable trace sink yields TRACE_UNAVAILABLE and the traced walk cannot claim success", async () => {
  const { t } = await traced({
    appendEventFn: () => { throw new Error("sink down"); },
  });
  assert.equal(t.trace_status, "TRACE_UNAVAILABLE");
  assert.equal(t.ok, false, "a walk whose causality cannot be recorded may not claim traced success");
  assert.equal(t.journal, null);
  assert.equal(t.result.effect_executed, false);
  assert.equal(t.result.authority_delta, 0);
});

// ── TS-07 · T-12: production wiring — the composed runner is the seam ───────
test("TS-07: the traced runner produces a verified journal covering the required stages", async () => {
  const home = await anchoredHome();
  const probe = (await traced({ home })).t;
  const { t } = await traced({
    home,
    presentedPhrase: probe.result.consent.required_phrase,
    presentedConsentContextHash: probe.result.consent.consent_context_hash,
    trace_id: "trace-genesis-0003",
  });
  assert.equal(t.ok, true, `verdict: ${t.result.verdict}`);
  const types = t.journal.map((e) => e.event_type);
  assert.deepEqual(types, ["INTENTION_ACCEPTED", "RISK_CLASSIFIED", "PREVIEW_SEALED", "CONSENT_REQUESTED"]);
  const mission = verifyCausalMission({
    journal: t.journal, mission_contract_hash: CONTRACT_HASH,
    required_stages: ["INTENTION_ACCEPTED", "RISK_CLASSIFIED", "PREVIEW_SEALED", "CONSENT_REQUESTED"],
  });
  assert.equal(mission.ok, true, mission.reason);
  // Verified consent is still NOT authority — on every event.
  for (const e of t.journal) assert.equal(e.authority_state, "NOT_GRANTED");
});

// ── TS-08 · T-13: a retry names its predecessor, never a fresh mission ──────
test("TS-08: a retry carries retry_of and the same causation identity under a new trace", async () => {
  const home = await anchoredHome();
  const first = (await traced({ home })).t;
  const retry = (await traced({
    home,
    trace_id: "trace-genesis-0004",
    causation_id: CAUSATION, // same stable causal identity
    retry_of: first.journal[first.journal.length - 1].span_id,
  })).t;
  assert.equal(retry.trace_status, "TRACED");
  for (const e of retry.journal) {
    assert.equal(e.causation_id, CAUSATION);
    assert.equal(e.retry_of, first.journal[first.journal.length - 1].span_id,
      "a retry must name what it retries — it may never masquerade as a fresh mission");
  }
  assert.notEqual(retry.journal[0].trace_id, first.journal[0].trace_id);
});

// ── TS-09 · T-14: an empty journal is never a completed causal mission ──────
test("TS-09: a verifier given [] may not report a completed causal mission", () => {
  const empty = verifyCausalMission({
    journal: [], mission_contract_hash: CONTRACT_HASH,
    required_stages: ["INTENTION_ACCEPTED"],
  });
  assert.equal(empty.ok, false);
  assert.equal(empty.reason, "causal_mission_empty_no_proof");
  // And a journal missing a required stage is equally not complete.
  const partialOnly = verifyCausalMission({
    journal: [], mission_contract_hash: CONTRACT_HASH, required_stages: [],
  });
  assert.equal(partialOnly.ok, false, "zero required stages must not make emptiness a pass");
});

// ── TS-10 · refusal paths journal their refusals; the seam stays pure ───────
test("TS-10: refused walks journal INTENTION_REFUSED / RISK_REFUSED / PREVIEW_REFUSED faithfully", async () => {
  const a = (await traced({ intention: "Frobnicate the quux" })).t;
  assert.deepEqual(a.journal.map((e) => e.event_type), ["INTENTION_REFUSED"]);
  const b = (await traced({ intention: "Merge main" })).t;
  assert.deepEqual(b.journal.map((e) => e.event_type), ["INTENTION_ACCEPTED", "RISK_REFUSED"]);
  const c = (await traced({ effect: { sandbox_root: "/tmp/genesis-sb", atoms: [{ from: "a.md", to: "a.md" }] } })).t;
  assert.deepEqual(c.journal.map((e) => e.event_type), ["INTENTION_ACCEPTED", "RISK_CLASSIFIED", "PREVIEW_REFUSED"]);
  for (const t of [a, b, c]) {
    assert.equal(verifyTraceJournal({ journal: t.journal, mission_contract_hash: CONTRACT_HASH }).ok, true,
      "refused paths are valid history");
  }
  // Purity: the seam imports no execution surface, no store, no fs, no clock.
  const src = readFileSync(TRACE_SRC, "utf8");
  assert.equal(src.includes("node:fs"), false);
  assert.equal(src.includes("child_process"), false);
  assert.equal(/from\s+["'][^"']*season-state-store\.js["']/.test(src), false);
  assert.equal(src.includes("Date.now"), false);
  assert.equal(src.includes("dema-reversible-file-steward-execution"), false);
});
