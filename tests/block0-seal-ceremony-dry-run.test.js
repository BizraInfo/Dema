// BLOCK0-SEAL-CEREMONY-DRY-RUN-1A · fixtures-only kernel tests.
//
// The dry-run performer consumes already-computed readiness + preflight objects
// and previews the Block0 signing ceremony. It NEVER reads a private key, signs,
// or seals. These tests use in-memory fixtures only — no disk, no key, no clock.

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBlock0SealCeremonyDryRun,
  BLOCK0_SEAL_CEREMONY_DRY_RUN_SCHEMA,
} from "../packages/genesis/src/block0-seal-ceremony-dry-run.js";
import { BLOCK0_PREREQUISITE_SLOTS } from "../packages/genesis/src/block0-manifest-verifier.js";

const CANONICAL_BOUNDARY_KEYS = [
  "filesystem_write_performed",
  "network_used",
  "runtime_execution_performed",
  "model_loaded",
  "model_invocation_performed",
  "prompt_executed",
  "external_call_performed",
  "raw_corpus_scan_performed",
  "raw_data_included",
  "tool_executed",
  "chain_advance_performed",
  "receipt_mint_performed",
  "federation_invoked",
  "node_connection_performed",
  "public_network_used",
  "consent_collected",
];

const REQUIRED_ATTESTATIONS = [
  "No private key was read.",
  "No signature was produced.",
  "No Block0 seal was written.",
  "No identity-binding action occurred.",
];

function fullReadiness(overrides = {}) {
  const slots = {};
  for (const slot of BLOCK0_PREREQUISITE_SLOTS) {
    slots[slot] =
      slot === "poi_rule"
        ? { status: "VERIFIABLE_NOW", needs_private_key: false }
        : { status: "NEEDS_OPERATOR_SIGNING", needs_private_key: true };
  }
  return {
    operator_pubkey_present: true,
    poi_rule_verifiable: true,
    slots,
    needs_operator_signing_count: BLOCK0_PREREQUISITE_SLOTS.length - 1,
    ...overrides,
  };
}

const cleanPreflight = () => ({
  blockers: [],
  provenance_next_gate: "NODE0-GENESIS-KEY-CEREMONY-1A",
});

const provenanceBlockedPreflight = () => ({
  blockers: [
    {
      code: "provenance_unresolved",
      message: "Cross-repo provenance is unresolved.",
    },
  ],
  provenance_next_gate: "BLOCKED_BY_UNRESOLVED_PROVENANCE",
});

test("happy path → SIGNING_READY_PREVIEW_ONLY with full 12-slot plan", () => {
  const out = buildBlock0SealCeremonyDryRun({
    readiness: fullReadiness(),
    preflight: cleanPreflight(),
  });
  assert.equal(out.schema, BLOCK0_SEAL_CEREMONY_DRY_RUN_SCHEMA);
  assert.equal(out.truth_label, "BLOCK0_SEAL_DRY_RUN_PREVIEW_ONLY");
  assert.equal(out.mode, "preview_only");
  assert.equal(out.status, "SIGNING_READY_PREVIEW_ONLY");
  assert.deepEqual(out.preconditions, {
    provenance_resolved: true,
    operator_pubkey_present: true,
    all_slots_accounted: true,
  });
  assert.equal(out.blockers.length, 0);
  assert.equal(out.ceremony_plan.slot_count, BLOCK0_PREREQUISITE_SLOTS.length);
  assert.equal(
    out.ceremony_plan.needs_operator_signing_count,
    BLOCK0_PREREQUISITE_SLOTS.length - 1,
  );
  assert.deepEqual(out.ceremony_plan.verifiable_now, ["poi_rule"]);
  assert.equal(out.ceremony_plan.steps.length, BLOCK0_PREREQUISITE_SLOTS.length);
});

test("unresolved provenance → BLOCKED_BY_UNRESOLVED_PROVENANCE", () => {
  const out = buildBlock0SealCeremonyDryRun({
    readiness: fullReadiness(),
    preflight: provenanceBlockedPreflight(),
  });
  assert.equal(out.status, "BLOCKED_BY_UNRESOLVED_PROVENANCE");
  assert.equal(out.preconditions.provenance_resolved, false);
  assert.ok(out.blockers.some((b) => b.code === "provenance_unresolved"));
});

test("missing operator pubkey → BLOCKED_BY_MISSING_OPERATOR_PUBKEY", () => {
  const out = buildBlock0SealCeremonyDryRun({
    readiness: fullReadiness({ operator_pubkey_present: false }),
    preflight: cleanPreflight(),
  });
  assert.equal(out.status, "BLOCKED_BY_MISSING_OPERATOR_PUBKEY");
  assert.equal(out.preconditions.operator_pubkey_present, false);
});

test("poi_rule not verifiable → BLOCKED_BY_INCOMPLETE_SLOTS", () => {
  const r = fullReadiness();
  r.slots.poi_rule = { status: "ABSENT_OR_DRIFTED", needs_private_key: false };
  const out = buildBlock0SealCeremonyDryRun({
    readiness: r,
    preflight: cleanPreflight(),
  });
  assert.equal(out.status, "BLOCKED_BY_INCOMPLETE_SLOTS");
  assert.equal(out.preconditions.all_slots_accounted, false);
});

test("missing slot key → BLOCKED_BY_INCOMPLETE_SLOTS", () => {
  const r = fullReadiness();
  delete r.slots[BLOCK0_PREREQUISITE_SLOTS[0]];
  const out = buildBlock0SealCeremonyDryRun({
    readiness: r,
    preflight: cleanPreflight(),
  });
  assert.equal(out.status, "BLOCKED_BY_INCOMPLETE_SLOTS");
});

test("11 NEEDS_OPERATOR_SIGNING slots are NOT 'incomplete' (expected pre-ceremony)", () => {
  const out = buildBlock0SealCeremonyDryRun({
    readiness: fullReadiness(),
    preflight: cleanPreflight(),
  });
  assert.equal(out.status, "SIGNING_READY_PREVIEW_ONLY");
});

test("precedence: provenance beats pubkey; both surfaced in blockers", () => {
  const out = buildBlock0SealCeremonyDryRun({
    readiness: fullReadiness({ operator_pubkey_present: false }),
    preflight: provenanceBlockedPreflight(),
  });
  assert.equal(out.status, "BLOCKED_BY_UNRESOLVED_PROVENANCE");
  assert.ok(out.blockers.some((b) => b.code === "provenance_unresolved"));
  assert.ok(out.blockers.some((b) => b.code === "operator_pubkey_missing"));
});

test("boundary honesty: every canonical key false; 4 attestations verbatim", () => {
  const out = buildBlock0SealCeremonyDryRun({
    readiness: fullReadiness(),
    preflight: cleanPreflight(),
  });
  for (const key of CANONICAL_BOUNDARY_KEYS) {
    assert.equal(out.boundary[key], false, `boundary.${key} must be false`);
  }
  assert.deepEqual(out.attestations, REQUIRED_ATTESTATIONS);
});

test("determinism: same input → same plan_hash", () => {
  const a = buildBlock0SealCeremonyDryRun({
    readiness: fullReadiness(),
    preflight: cleanPreflight(),
  });
  const b = buildBlock0SealCeremonyDryRun({
    readiness: fullReadiness(),
    preflight: cleanPreflight(),
  });
  assert.equal(a.ceremony_plan.plan_hash, b.ceremony_plan.plan_hash);
  assert.match(a.ceremony_plan.plan_hash, /^[0-9a-f]{64}$/);
});

test("adversarial: a private key passed in is ignored and never echoed", () => {
  const withKey = buildBlock0SealCeremonyDryRun({
    readiness: fullReadiness(),
    preflight: cleanPreflight(),
    operatorPrivateKeyPem:
      "-----BEGIN PRIVATE KEY-----\nMC4CAQ\n-----END PRIVATE KEY-----\n",
  });
  const without = buildBlock0SealCeremonyDryRun({
    readiness: fullReadiness(),
    preflight: cleanPreflight(),
  });
  assert.deepEqual(withKey, without);
  assert.ok(!JSON.stringify(withKey).includes("BEGIN PRIVATE KEY"));
  // No produced-signature VALUE is echoed. (The attestation text legitimately
  // contains the word "signature" — "No signature was produced." — so assert on
  // structure: no object key named signature/private_key anywhere in the output.)
  const forbiddenKeys = ["signature", "private_key", "privateKey", "signed_proof"];
  const walk = (v) => {
    if (Array.isArray(v)) return v.some(walk);
    if (v && typeof v === "object") {
      return Object.keys(v).some(
        (k) => forbiddenKeys.includes(k) || walk(v[k]),
      );
    }
    return false;
  };
  assert.equal(walk(withKey), false, "no signature/private_key field may exist");
});

test("output is deeply frozen", () => {
  const out = buildBlock0SealCeremonyDryRun({
    readiness: fullReadiness(),
    preflight: cleanPreflight(),
  });
  assert.ok(Object.isFrozen(out));
  assert.ok(Object.isFrozen(out.ceremony_plan));
  assert.ok(Object.isFrozen(out.ceremony_plan.steps));
  assert.ok(Object.isFrozen(out.boundary));
});

test("malformed readiness → fails closed to a BLOCKED status (never throws, never READY)", () => {
  const out = buildBlock0SealCeremonyDryRun({
    readiness: null,
    preflight: cleanPreflight(),
  });
  assert.notEqual(out.status, "SIGNING_READY_PREVIEW_ONLY");
  assert.ok(out.status.startsWith("BLOCKED_BY_"));
});
