#!/usr/bin/env node
// Review gate for DEMA-NPC-INTENT-BINDER-HARDENING-1A.
// Runs the binder through a golden bind → verify → tamper-fail → reject cycle,
// asserts the canonical 17-key all-false boundary, and fails closed. Read-only.

import { buildPreviewBoundary } from "../../packages/core/src/preview-boundary.js";
import {
  bindNpcIntent,
  verifyNpcIntentPacket,
} from "../../packages/core/src/npc-intent-binder-hardening.js";

const checks = [];
const add = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail });

const fenced = "```json\n" + JSON.stringify({ action_type: "read_file", target_path: "docs/README.md" }) + "\n```";
const bound = bindNpcIntent({ raw: fenced });
add("binds_fenced_json", bound.bound === true && bound.intent?.action_type === "read_file");
add("packet_hash_sha256", /^sha256:[a-f0-9]{64}$/.test(bound.packet_hash || ""));

const boundaryKeys = Object.keys(buildPreviewBoundary()).sort();
add(
  "boundary_canonical_17_key",
  JSON.stringify(Object.keys(bound.boundary).sort()) === JSON.stringify(boundaryKeys),
  `${boundaryKeys.length} keys`,
);
add("boundary_all_false", Object.values(bound.boundary).every((v) => v === false));

add("verify_ok_on_bound", verifyNpcIntentPacket(bound).ok === true);

const forged = { ...bound, intent: { ...bound.intent, target_path: "/etc/shadow" } };
add("verify_fails_on_tamper", verifyNpcIntentPacket(forged).ok === false);

add("rejects_non_json", bindNpcIntent({ raw: "not json" }).bound === false);
add("rejects_malformed", bindNpcIntent({ raw: '{ "action_type":' }).bound === false);
add("rejects_missing_action_type", bindNpcIntent({ raw: '{"target_path":"a"}' }).reject_reasons?.includes("missing_action_type"));
add("rejects_missing_target_path", bindNpcIntent({ raw: '{"action_type":"a"}' }).reject_reasons?.includes("missing_target_path"));
add("no_live_claim", bound.truth_label === "NPC_INTENT_BINDER_PREVIEW_ONLY");

const failed = checks.filter((c) => !c.ok);
const report = {
  schema: "bizra.dema.review.npc_intent_binder_hardening.v0.1",
  ok: failed.length === 0,
  checks,
  boundary: buildPreviewBoundary(),
};
console.log(JSON.stringify(report, null, 2));
if (failed.length > 0) {
  console.error(`\nnpc-intent-binder-hardening: FAIL — ${failed.map((c) => c.name).join(", ")}`);
  process.exit(1);
}
console.error("npc-intent-binder-hardening: OK");
