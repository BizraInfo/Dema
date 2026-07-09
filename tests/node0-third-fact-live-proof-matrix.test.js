import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ponytail: one check — the spec must not drift below its required coverage.
// If a category, status label, or non-claim is dropped, this fails.
const spec = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../docs/specs/NODE0_THIRD_FACT_LIVE_PROOF_MATRIX_0A.md"),
  "utf8",
);

const CATEGORIES = [
  "human-mission-centric", "context-window-bypass", "persistent-memory",
  "hallucination-resistance", "consent-and-sovereignty", "local-asset-inventory",
  "asset-shareability-value-map", "receipt-chain-and-tamper-evidence",
  "fde-failure-classification", "pat-sat-boundary", "proof-of-impact-candidate-path",
  "performance-quality-gates", "node0-one-human-full-lifecycle",
];
const STATUS_LABELS = ["PROVEN", "CANDIDATE", "DESIGNED_NOT_LIVE", "BLOCKED"];
const NON_CLAIMS = ["verified impact", "live PoI", "token reward", "federation", "public network", "autonomous SAT minting"];

test("spec carries its truth label + next slice", () => {
  assert.match(spec, /DESIGN_ONLY_LIVE_PROOF_MATRIX_0A/);
  assert.match(spec, /DEMA-ASSET-SHAREABILITY-0A/);
});

test("every required claim category is present", () => {
  for (const c of CATEGORIES) assert.ok(spec.includes(c), `missing category: ${c}`);
});

test("all four status labels are used", () => {
  for (const s of STATUS_LABELS) assert.ok(spec.includes(s), `missing status label: ${s}`);
});

test("every explicit non-claim is present", () => {
  for (const n of NON_CLAIMS) assert.ok(spec.includes(n), `missing non-claim: ${n}`);
});

test("core measured metrics are named", () => {
  for (const m of ["mission_reconstruction_accuracy", "unsupported_claim_block_rate", "raw_data_leakage_count", "receipt_verify_latency"]) {
    assert.ok(spec.includes(m), `missing metric: ${m}`);
  }
});
