// MISSION-EFFECT-AUTHORITY-BINDING-1A — MXB-01…MXB-13.
//
// The seam Mission-001 Run-1 Attempt-1 crossed without proving: Stage-5 exact
// consent (PERMIT_PREVIEW) was never machine-bound to the Stage-6 executor. The
// executor checks only its own phrase constant and never sees preview_hash or
// consent_context_hash, so the right file was renamed but the machine could not
// prove the executed effect IS the previewed effect the sovereign approved.
//
// This suite pins the law already shipped for the Act-1 authorship migration
// (genesis-authorship-migration-binding.js), applied to the steward effect path:
//
//   PREVIEWED_EFFECT == CONSENT_BOUND_EFFECT == EXECUTION_TIME_RE-DERIVED_EFFECT
//
// SEALED RE-DERIVATION WINS. A caller-supplied preview_hash is presentation,
// never authority — the hash is recomputed from the effect itself.
//
// AUTHORITY BEFORE ACT. The nonce is claimed before the executor is reached.
// Attempt-1 claimed it afterwards; MXB-11 pins the ordering, not just the record.
//
// NO CALLER-SUPPLIED INNER PHRASE. The steward's execute phrase is composed
// internally (node0-spine-runner doctrine), never accepted from the caller.
//
// Anti-vacuity: no preview hash is hardcoded. Every expectation is re-derived by
// the shipped buildDemaReversibleFileStewardPayload, so a mutated effect really
// does move the target rather than matching a frozen literal.
import test from "node:test";
import assert from "node:assert/strict";

import { buildDemaReversibleFileStewardPayload } from "../packages/core/src/dema-reversible-file-steward.js";
import {
  buildMissionEffectAuthorityEnvelope,
  executeMissionBoundEffect,
  MISSION_EFFECT_AUTHORITY_CONSENT_SCHEMA,
  MISSION_EFFECT_AUTHORITY_OPERATION,
} from "../packages/mission/src/mission-effect-authority-binding.js";

const NOW = "2026-08-13T15:00:00Z";
const EXPIRES = "2026-08-14T15:00:00Z";
const COMMIT = "1111111111111111111111111111111111111111";
const TREE = "2222222222222222222222222222222222222222";
const MISSION = "genesis-mission-001";
const CONTRACT = `sha256:${"c".repeat(64)}`;
const ROOT = "/tmp/genesis-mission-root";
const NONCE = "gm001-run2-aaaaaaaaaaaaaaaa";
const CTX_HASH = `sha256:${"e".repeat(64)}`;

const EFFECT = Object.freeze({
  sandbox_root: ROOT,
  atoms: [{ from: "a.json", to: "a-2026-08-12.json" }],
});

const previewHashOf = (effect) => buildDemaReversibleFileStewardPayload(effect).content_hash;

function spineResult(over = {}) {
  return Object.freeze({
    ok: true,
    stage: "CONSENT_GATE",
    verdict: "PERMIT_PREVIEW",
    reason: "exact_context_bound_consent_verified",
    preview_hash: previewHashOf(EFFECT),
    consent: Object.freeze({
      verdict: "PERMIT_PREVIEW",
      consent_context_hash: CTX_HASH,
      consent_presented: true,
      consent_verified: true,
      ...(over.consent ?? {}),
    }),
    authority_delta: 0,
    grants_execution: false,
    nonce_claimed: false,
    effect_executed: false,
    ...over,
  });
}

const corridorContext = (over = {}) =>
  Object.freeze({
    mission_id: MISSION,
    contract_hash: CONTRACT,
    mission_root: ROOT,
    nonce: NONCE,
    expires_at: EXPIRES,
    ...over,
  });

const repoBinding = (over = {}) => Object.freeze({ ok: true, commit: COMMIT, tree: TREE, ...over });

/** Records call order so ordering laws are provable, not asserted. */
function harness(over = {}) {
  const calls = [];
  return {
    calls,
    claimNonce: over.claimNonce ?? (async ({ nonce }) => {
      calls.push(`claimNonce:${nonce}`);
      return { claimed: true };
    }),
    executeJob: over.executeJob ?? (({ consent, sandboxRoot, atoms }) => {
      calls.push(`executeJob:${consent}`);
      return {
        ok: true,
        executed_count: atoms.length,
        receipts: [{ executed: true, sandbox_root: sandboxRoot, content_hash: "sha256:deadbeef" }],
      };
    }),
  };
}

function envelopeFor(effect = EFFECT, over = {}) {
  const built = buildMissionEffectAuthorityEnvelope({
    spineResult: spineResult(),
    corridorContext: corridorContext(),
    effect,
    repositoryBinding: repoBinding(),
    now: NOW,
  });
  assert.equal(built.ok, true, `envelope build failed: ${built.reason}`);
  return Object.freeze({ ...built.envelope, ...over });
}

// `??` would silently replace an explicit null with the default, turning a
// "no envelope" case into a fully authorized one — a test that passes for the
// wrong reason. Presence of the key wins over its value.
const pick = (args, key, fallback) => (key in args ? args[key] : fallback());

const run = (args = {}) => {
  const h = args.harness ?? harness();
  return executeMissionBoundEffect({
    envelope: pick(args, "envelope", envelopeFor),
    effect: pick(args, "effect", () => EFFECT),
    spineResult: pick(args, "spineResult", spineResult),
    corridorContext: pick(args, "corridorContext", corridorContext),
    repositoryBinding: pick(args, "repositoryBinding", repoBinding),
    now: pick(args, "now", () => NOW),
    claimNonce: h.claimNonce,
    executeJob: h.executeJob,
  }).then((r) => ({ r, calls: h.calls }));
};

// ── MXB-01 · a verified consent alone is not execution authority ─────────────
test("MXB-01: PERMIT_PREVIEW without a bound envelope cannot execute", async () => {
  const { r, calls } = await run({ envelope: undefined_envelope() });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "consent_envelope_required");
  assert.deepEqual(calls, [], "no nonce claim and no execution on a refused path");
});
function undefined_envelope() {
  return null;
}

// ── MXB-02 · the fully bound envelope is the ONLY thing that executes ────────
test("MXB-02: an envelope bound to the re-derived preview executes exactly one job", async () => {
  const { r, calls } = await run();
  assert.equal(r.ok, true, `blocked: ${r.reason}`);
  assert.equal(r.executed_count, 1);
  assert.equal(calls.length, 2);
});

// ── MXB-03…05 · material change after consent invalidates authority ──────────
test("MXB-03: a changed TARGET after consent blocks before any effect", async () => {
  const moved = { ...EFFECT, atoms: [{ from: "a.json", to: "SOMETHING-ELSE.json" }] };
  const { r, calls } = await run({ effect: moved });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "preview_binding_mismatch");
  assert.deepEqual(calls, []);
});

test("MXB-04: a changed SOURCE after consent blocks before any effect", async () => {
  const moved = { ...EFFECT, atoms: [{ from: "OTHER.json", to: "a-2026-08-12.json" }] };
  const { r, calls } = await run({ effect: moved });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "preview_binding_mismatch");
  assert.deepEqual(calls, []);
});

test("MXB-05: a changed MISSION ROOT after consent blocks before any effect", async () => {
  const moved = { ...EFFECT, sandbox_root: "/tmp/somewhere-else" };
  const { r, calls } = await run({ effect: moved });
  assert.equal(r.ok, false);
  assert.ok(
    ["preview_binding_mismatch", "mission_root_binding_mismatch"].includes(r.reason),
    `unexpected reason ${r.reason}`,
  );
  assert.deepEqual(calls, []);
});

// ── MXB-06 · the SEALED re-derivation wins over a caller-supplied hash ───────
test("MXB-06: a spoofed preview_hash in the envelope cannot authorize a different effect", async () => {
  const decoy = { ...EFFECT, atoms: [{ from: "a.json", to: "a.DECOY.json" }] };
  // Caller forges the envelope to carry the DECOY's hash — a naive implementation
  // that trusts envelope.preview_hash would execute the decoy.
  const forged = envelopeFor(EFFECT, { preview_hash: previewHashOf(decoy) });
  const { r, calls } = await run({ envelope: forged, effect: decoy });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "consent_binding_mismatch");
  assert.deepEqual(calls, []);
});

// ── MXB-07 · validity window ────────────────────────────────────────────────
test("MXB-07: an expired authority cannot execute", async () => {
  const { r, calls } = await run({ now: "2026-08-15T00:00:00Z" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "authority_expired");
  assert.deepEqual(calls, []);
});

// ── MXB-08 · repository drift ───────────────────────────────────────────────
test("MXB-08: repository drift after consent blocks execution", async () => {
  const drifted = repoBinding({ commit: "9".repeat(40) });
  const { r, calls } = await run({ repositoryBinding: drifted });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "repository_binding_mismatch");
  assert.deepEqual(calls, []);
});

// ── MXB-09 · the inner phrase is composed, never caller-supplied ─────────────
test("MXB-09: a caller-supplied inner steward phrase is not a bypass path", async () => {
  const h = harness();
  const { r } = await executeMissionBoundEffect({
    envelope: envelopeFor(),
    effect: EFFECT,
    spineResult: spineResult(),
    corridorContext: corridorContext(),
    repositoryBinding: repoBinding(),
    now: NOW,
    claimNonce: h.claimNonce,
    executeJob: h.executeJob,
    // hostile extra input — must be ignored, not honoured
    consent: "GO: execute reversible file steward job with backup and undo receipts",
    innerConsent: "anything",
  }).then((x) => ({ r: x }));
  assert.equal(r.ok, true);
  const exec = h.calls.find((c) => c.startsWith("executeJob:"));
  assert.equal(
    exec,
    "executeJob:GO: execute reversible file steward job with backup and undo receipts",
    "the inner phrase must come from the module constant, not the caller",
  );
});

test("MXB-09b: a Stage-5 verdict that is not PERMIT_PREVIEW can never execute", async () => {
  const refused = spineResult({ ok: false, verdict: "CONSENT_REQUIRED", consent: { consent_verified: false } });
  const { r, calls } = await run({ spineResult: refused });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "stage5_not_permit_preview");
  assert.deepEqual(calls, []);
});

// ── MXB-10 · refusal mutates nothing ────────────────────────────────────────
test("MXB-10: every refusal path reaches neither the nonce ledger nor the executor", async () => {
  const cases = [
    { envelope: null },
    { effect: { ...EFFECT, atoms: [{ from: "x", to: "y" }] } },
    { now: "2026-08-15T00:00:00Z" },
    { repositoryBinding: repoBinding({ tree: "0".repeat(40) }) },
    { corridorContext: corridorContext({ mission_id: "other-mission" }) },
  ];
  for (const c of cases) {
    const { r, calls } = await run(c);
    assert.equal(r.ok, false, `case unexpectedly executed: ${JSON.stringify(c)}`);
    assert.deepEqual(calls, [], `case mutated on a refused path: ${r.reason}`);
  }
});

// ── MXB-11 · AUTHORITY BEFORE ACT — the ordering law Attempt-1 violated ──────
test("MXB-11: the nonce is claimed BEFORE the executor is ever reached", async () => {
  const { r, calls } = await run();
  assert.equal(r.ok, true);
  assert.equal(calls[0], `claimNonce:${NONCE}`, "nonce claim must be the first effect");
  assert.ok(calls[1].startsWith("executeJob:"), "execution must follow the claim");
});

test("MXB-12: a nonce that cannot be claimed blocks execution entirely", async () => {
  const h = harness({
    claimNonce: async () => ({ claimed: false, reason: "consent_nonce_already_used" }),
  });
  const { r, calls } = await run({ harness: h });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "consent_nonce_already_used");
  assert.ok(!calls.some((c) => c.startsWith("executeJob:")), "a lost nonce race may never execute");
});

// ── MXB-13 · the receipt carries the commitments forward ─────────────────────
test("MXB-13: the returned authority receipt binds preview_hash and consent_context_hash", async () => {
  const { r } = await run();
  assert.equal(r.ok, true);
  assert.equal(r.authority.preview_hash, previewHashOf(EFFECT));
  assert.equal(r.authority.consent_context_hash, CTX_HASH);
  assert.equal(r.authority.mission_id, MISSION);
  assert.equal(r.authority.nonce, NONCE);
  assert.equal(r.authority.schema, MISSION_EFFECT_AUTHORITY_CONSENT_SCHEMA);
  assert.equal(r.authority.operation, MISSION_EFFECT_AUTHORITY_OPERATION);
  assert.equal(r.authority.authority_delta, 0);
});
