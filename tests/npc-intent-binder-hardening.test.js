// Red-first proof contract for DEMA-NPC-INTENT-BINDER-HARDENING-1A.
//
// The binder is the UPSTREAM front-end to TADE (#305): it takes raw, untrusted
// agent/LLM output (```json-fenced OR bare JSON) and fail-closed binds it into a
// content-addressed intent packet with the canonical 17-key preview boundary.
// It parses; it never executes, mints, networks, or reads files.
//
// Corrections vs the candidate brief (disk wins): boundary is the canonical
// 17-key buildPreviewBoundary (not "10-key"); JS uses .trim() (not .strip()).

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildPreviewBoundary } from "../packages/core/src/preview-boundary.js";
import {
  NPC_INTENT_BINDER_SCHEMA,
  bindNpcIntent,
  verifyNpcIntentPacket,
} from "../packages/core/src/npc-intent-binder-hardening.js";

const VALID = { action_type: "read_file", target_path: "docs/README.md", note: "x" };
const fenced = "```json\n" + JSON.stringify(VALID) + "\n```";
const bare = JSON.stringify(VALID);

test("1. parses standard ```json fenced payload", () => {
  const p = bindNpcIntent({ raw: fenced });
  assert.equal(p.schema, NPC_INTENT_BINDER_SCHEMA);
  assert.equal(p.bound, true);
  assert.equal(p.intent.action_type, "read_file");
  assert.equal(p.intent.target_path, "docs/README.md");
});

test("2. parses bare JSON payload", () => {
  const p = bindNpcIntent({ raw: bare });
  assert.equal(p.bound, true);
  assert.equal(p.intent.action_type, "read_file");
});

test("3. rejects non-JSON text (fail-closed)", () => {
  const p = bindNpcIntent({ raw: "just some prose, not json at all" });
  assert.equal(p.bound, false);
  assert.ok(p.reject_reasons.includes("non_json_input"));
});

test("4. rejects malformed JSON", () => {
  const p = bindNpcIntent({ raw: '{ "action_type": "read_file", ' });
  assert.equal(p.bound, false);
  assert.ok(p.reject_reasons.includes("malformed_json"));
});

test("5. rejects missing action_type", () => {
  const p = bindNpcIntent({ raw: JSON.stringify({ target_path: "a/b" }) });
  assert.equal(p.bound, false);
  assert.ok(p.reject_reasons.includes("missing_action_type"));
});

test("6. rejects missing target_path", () => {
  const p = bindNpcIntent({ raw: JSON.stringify({ action_type: "read_file" }) });
  assert.equal(p.bound, false);
  assert.ok(p.reject_reasons.includes("missing_target_path"));
});

test("7. binds exactly the canonical boundary keys", () => {
  const p = bindNpcIntent({ raw: bare });
  assert.deepEqual(
    Object.keys(p.boundary).sort(),
    Object.keys(buildPreviewBoundary()).sort(),
  );
});

test("8. every boundary key is false", () => {
  const p = bindNpcIntent({ raw: bare });
  assert.ok(Object.values(p.boundary).every((v) => v === false));
  // also on a rejection packet
  const r = bindNpcIntent({ raw: "nope" });
  assert.ok(Object.values(r.boundary).every((v) => v === false));
});

test("9. packet_hash is deterministic sha256", () => {
  const p = bindNpcIntent({ raw: bare });
  assert.match(p.packet_hash, /^sha256:[a-f0-9]{64}$/);
});

test("10. same payload produces same packet_hash", () => {
  assert.equal(
    bindNpcIntent({ raw: bare }).packet_hash,
    bindNpcIntent({ raw: fenced }).packet_hash, // fenced vs bare, same intent → same hash
  );
});

test("11. field tampering changes hash + fails verify", () => {
  const p = bindNpcIntent({ raw: bare });
  const forged = { ...p, intent: { ...p.intent, target_path: "/etc/shadow" } };
  assert.notEqual(
    bindNpcIntent({ raw: JSON.stringify({ ...VALID, target_path: "/etc/shadow" }) }).packet_hash,
    p.packet_hash,
  );
  assert.equal(verifyNpcIntentPacket(forged).ok, false);
  assert.equal(verifyNpcIntentPacket(p).ok, true);
});

test("12. packet says it does not prove execution/safety/consent", () => {
  const p = bindNpcIntent({ raw: bare });
  const t = JSON.stringify(p.what_this_does_not_prove).toLowerCase();
  for (const word of ["execut", "safe", "consent"]) assert.ok(t.includes(word));
});

test("kernel source performs no fs / network / process effects", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(
    new URL("../packages/core/src/npc-intent-binder-hardening.js", import.meta.url),
    "utf8",
  );
  for (const forbidden of ["node:fs", "node:net", "node:http", "node:child_process", "fetch(", "process.env"]) {
    assert.ok(!src.includes(forbidden), `kernel must not reference ${forbidden}`);
  }
});
