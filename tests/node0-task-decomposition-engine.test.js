import test from "node:test";
import assert from "node:assert/strict";

import {
  compileIntentPacket,
  verifyIntentPacket,
  DEFAULT_INTENT_REGISTRY,
  NODE0_TADE_SCHEMA,
  NODE0_TADE_TRUTH_LABEL,
} from "../packages/core/src/node0-task-decomposition-engine.js";
import { isCanonicalBoundaryShape } from "../packages/core/src/preview-boundary.js";

// NODE0-TASK-DECOMPOSITION-ENGINE-1A — Authoritative Intent Packet Compiler.
// Human/LLM input is an UNTRUSTED client intent packet until TADE compiles it
// into ontology-bound, fail-closed atoms. The load-bearing invariant:
// SERVER_VALIDATED means every field was POSITIVELY resolved against the
// registry — never "no marker tripped".

test("compileIntentPacket emits schema + preview truth label + untrusted authority", () => {
  const p = compileIntentPacket({ input: "verify origin/main" });
  assert.equal(p.schema, NODE0_TADE_SCHEMA);
  assert.equal(p.truth_label, NODE0_TADE_TRUTH_LABEL);
  assert.equal(p.authority, "untrusted_until_compiled");
  assert.equal(p.source, "human_input");
  assert.equal(p.packet_type, "MISSION_INTENT_PREVIEW");
});

test("a fully-resolved read intent compiles to a SERVER_VALIDATED, route-eligible atom", () => {
  const p = compileIntentPacket({ input: "verify origin/main" });
  assert.equal(p.compiled_atoms.length, 1);
  const a = p.compiled_atoms[0];
  assert.equal(a.atom_id, "ATOM-0001");
  assert.equal(a.intent_packet.action, "VERIFY");
  assert.equal(a.intent_packet.capability_required, "READ_LOCAL_STATE");
  assert.equal(a.risk_class, "LOW");
  assert.equal(a.authority_status, "SERVER_VALIDATED_PREVIEW_ONLY");
  assert.equal(a.route_eligible, true);
  assert.deepEqual(a.blocked_by, []);
  assert.equal(a.consent_required, true);
});

// THE INVARIANT (operator's catch): validated means PROVEN, not UNFLAGGED.
// "verify" is a known action (passes the linguistic floor), but "the flux
// capacitor" binds to no ontology entity → must fail closed, never validate by
// the mere absence of a block.
test("a real action verb with NO ontology binding is BLOCKED_UNCLASSIFIED, never SERVER_VALIDATED", () => {
  const p = compileIntentPacket({ input: "verify the flux capacitor" });
  const a = p.compiled_atoms[0];
  assert.equal(a.intent_packet.action, "VERIFY"); // linguistic floor passed
  assert.equal(a.authority_status, "REJECTED_BY_TADE_GATE");
  assert.equal(a.risk_class, "BLOCKED_UNCLASSIFIED");
  assert.equal(a.route_eligible, false);
  assert.ok(a.blocked_by.includes("ontology_unresolved"));
});

// Self-critique guard: ontology binding must be a WHOLE-token match, not a naive
// substring. "domain" contains "main" — it must NOT bind to the ontology entity
// `main`. A spurious substring bind would validate an atom by coincidence, which
// is exactly "validated by absence-of-proof".
test("ontology binding is token-bounded: 'domain' does NOT spuriously bind to 'main'", () => {
  const p = compileIntentPacket({ input: "verify the domain" });
  const a = p.compiled_atoms[0];
  assert.equal(a.intent_packet.action, "VERIFY");
  assert.equal(a.intent_packet.object, null);
  assert.ok(a.blocked_by.includes("ontology_unresolved"));
  assert.equal(a.authority_status, "REJECTED_BY_TADE_GATE");
});

test("an unknown action verb yields action_unclassified + BLOCKED_UNCLASSIFIED", () => {
  const p = compileIntentPacket({ input: "frobnicate the widget" });
  const a = p.compiled_atoms[0];
  assert.equal(a.intent_packet.action, "UNKNOWN");
  assert.equal(a.authority_status, "REJECTED_BY_TADE_GATE");
  assert.equal(a.risk_class, "BLOCKED_UNCLASSIFIED");
  assert.ok(a.blocked_by.includes("action_unclassified"));
  assert.ok(a.blocked_by.includes("ontology_unresolved"));
  assert.equal(a.route_eligible, false);
});

// Positive resolution requires EVERY field — a missing capability binding must
// block even when action + ontology + risk all resolve.
test("a resolved action with NO capability mapping is blocked (capability_unresolved), not validated", () => {
  const registry = { ...DEFAULT_INTENT_REGISTRY, capabilities: {} };
  const p = compileIntentPacket({ input: "verify origin/main", registry });
  const a = p.compiled_atoms[0];
  assert.equal(a.intent_packet.action, "VERIFY");
  assert.equal(a.intent_packet.capability_required, null);
  assert.ok(a.blocked_by.includes("capability_unresolved"));
  assert.equal(a.authority_status, "REJECTED_BY_TADE_GATE");
  assert.equal(a.route_eligible, false);
});

test("a resolved action with NO risk mapping is blocked (risk_unclassified), not validated", () => {
  const registry = { ...DEFAULT_INTENT_REGISTRY, risks: {} };
  const p = compileIntentPacket({ input: "verify origin/main", registry });
  const a = p.compiled_atoms[0];
  assert.ok(a.blocked_by.includes("risk_unclassified"));
  assert.equal(a.authority_status, "REJECTED_BY_TADE_GATE");
});

test("empty / whitespace input fails closed: no atoms, not route-eligible", () => {
  for (const input of ["", "   ", "\n\t"]) {
    const p = compileIntentPacket({ input });
    assert.equal(p.compiled_atoms.length, 0);
    assert.equal(p.route_eligible, false);
  }
});

test("packet is route-eligible only when ALL atoms are validated", () => {
  const p = compileIntentPacket({
    input: "verify origin/main. frobnicate the widget",
  });
  assert.equal(p.compiled_atoms.length, 2);
  assert.equal(p.compiled_atoms[0].route_eligible, true);
  assert.equal(p.compiled_atoms[1].route_eligible, false);
  assert.equal(p.route_eligible, false); // one blocked atom blocks the packet
});

test("boundary is the canonical all-false preview boundary", () => {
  const p = compileIntentPacket({ input: "verify origin/main" });
  assert.ok(isCanonicalBoundaryShape(p.boundary));
});

test("content hash is deterministic and content-addressed (sha256:)", () => {
  const a = compileIntentPacket({ input: "verify origin/main" });
  const b = compileIntentPacket({ input: "verify origin/main" });
  assert.equal(a.content_hash, b.content_hash);
  assert.match(a.content_hash, /^sha256:[0-9a-f]{64}$/);
});

test("verifyIntentPacket re-derives from input and accepts an honest packet", () => {
  const p = compileIntentPacket({ input: "verify origin/main" });
  const v = verifyIntentPacket(p);
  assert.equal(v.ok, true);
});

// Forgery: launder a rejected atom into SERVER_VALIDATED. Re-derivation from the
// input span must reject it regardless of whether the hash was also forged.
test("verifyIntentPacket rejects a forged rejected→SERVER_VALIDATED atom", () => {
  const p = compileIntentPacket({ input: "frobnicate the widget" });
  const forged = JSON.parse(JSON.stringify(p));
  forged.compiled_atoms[0].authority_status = "SERVER_VALIDATED_PREVIEW_ONLY";
  forged.compiled_atoms[0].route_eligible = true;
  forged.compiled_atoms[0].risk_class = "LOW";
  forged.compiled_atoms[0].blocked_by = [];
  const v = verifyIntentPacket(forged);
  assert.equal(v.ok, false);
});

test("verifyIntentPacket fails closed on a packet missing its input span", () => {
  const v = verifyIntentPacket({ schema: NODE0_TADE_SCHEMA, compiled_atoms: [] });
  assert.equal(v.ok, false);
});
