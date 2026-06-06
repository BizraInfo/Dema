import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildEvidenceReceiptPreview,
  canonicalJson,
  formatEvidenceReceiptPreview,
  sha256Canonical,
  verifyEvidenceReceiptPreview,
} from "../packages/verifier/src/evidence-receipt-preview.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);
const modulePath = fileURLToPath(
  new URL(
    "../packages/verifier/src/evidence-receipt-preview.js",
    import.meta.url,
  ),
);
const fixedNow = new Date("2026-05-15T00:00:00.000Z");

function makeReceipt(overrides = {}) {
  return buildEvidenceReceiptPreview({
    input: { b: 2, a: { z: "seed", y: "light" } },
    output: { result: "preview" },
    policy: { version: "test", floor: 0.95 },
    toolCalls: [{ name: "none", executed: false }],
    decision: {
      verdict: "PREVIEW_REVIEW",
      ihsan_floor_preview: null,
    },
    now: fixedNow,
    ...overrides,
  });
}

test("canonicalJson sorts nested keys and preserves JSON text", () => {
  const value = { z: 1, a: { b: "light", a: true }, list: [{ y: 2, x: 1 }] };

  assert.equal(
    canonicalJson(value),
    '{"a":{"a":true,"b":"light"},"list":[{"x":1,"y":2}],"z":1}',
  );
  assert.equal(
    sha256Canonical({ a: 1, b: 2 }),
    sha256Canonical({ b: 2, a: 1 }),
  );
});

test("buildEvidenceReceiptPreview emits a no-mint preview receipt shape", () => {
  const receipt = makeReceipt();

  assert.equal(receipt.schema, "bizra.dema.evidence_receipt_preview.v0.1");
  assert.equal(receipt.truth_label, "DECLARED");
  assert.equal(receipt.mode, "PREVIEW_ONLY");
  assert.equal(receipt.certifies, false);
  assert.equal(receipt.digest_algo, "sha256");
  assert.equal(receipt.prev_digest, null);
  assert.equal(receipt.producer_identity, null);
  assert.equal(receipt.chain_id, "preview-no-chain");
  assert.match(receipt.self_digest, /^[0-9a-f]{64}$/);
  assert.equal(receipt.boundary.filesystem_write_performed, false);
  assert.equal(receipt.boundary.chain_head_advanced, false);
  assert.equal(receipt.boundary.receipt_minted, false);
  assert.equal(receipt.boundary.identity_bound, false);
  assert.equal(receipt.boundary.signature_emitted, false);
  assert.equal(receipt.boundary.network_connection_attempted, false);
  assert.equal(receipt.boundary.external_posting_performed, false);
  assert.ok(!("signature" in receipt));
  assert.ok(!("pubkey" in receipt));
  assert.ok(!("key_id" in receipt));
});

test("verifyEvidenceReceiptPreview recomputes the digest and keeps placeholder posture", () => {
  const verdict = verifyEvidenceReceiptPreview(makeReceipt());

  assert.equal(verdict.truth_label, "DECLARED");
  assert.equal(verdict.certifies, false);
  assert.equal(verdict.verdict, "PARTIAL_PLACEHOLDER");
  assert.ok(verdict.checks.every((check) => check.pass));
});

test("receipt preview exists for rejected decisions too", () => {
  const receipt = makeReceipt({
    decision: {
      verdict: "PREVIEW_REJECT",
      ihsan_floor_preview: null,
    },
  });

  assert.equal(receipt.decision.verdict, "PREVIEW_REJECT");
  assert.equal(
    verifyEvidenceReceiptPreview(receipt).verdict,
    "PARTIAL_PLACEHOLDER",
  );
});

test("tampering with each load-bearing field changes or breaks self_digest", () => {
  const original = makeReceipt();
  const mutations = [
    { ...original, input_hash: sha256Canonical({ changed: "input" }) },
    { ...original, output_hash: sha256Canonical({ changed: "output" }) },
    { ...original, policy_hash: sha256Canonical({ changed: "policy" }) },
    { ...original, tool_calls_hash: sha256Canonical([{ changed: "tool" }]) },
  ];

  for (const mutated of mutations) {
    assert.equal(
      verifyEvidenceReceiptPreview(mutated).verdict,
      "PREVIEW_REJECT",
    );
  }
});

test("evidence receipt preview source contains no filesystem mutation primitives", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(
    source,
    /\b(writeFile|appendFile|mkdir|rename|unlink|createWriteStream)\b/,
  );
});

test("formatEvidenceReceiptPreview renders hashes, checks, and no-mint boundary", () => {
  const output = formatEvidenceReceiptPreview(makeReceipt());

  assert.match(output, /DEMA Evidence Receipt Preview/);
  assert.match(output, /Self digest/);
  assert.match(output, /Verification checks/);
  assert.match(output, /no receipt mint/);
  assert.match(output, /no network/);
});

test("dema evidence receipt preview prints a human-readable placeholder", async () => {
  const { stdout } = await execFileAsync("node", [
    cliPath,
    "evidence",
    "receipt",
    "preview",
  ]);

  assert.match(stdout, /DEMA Evidence Receipt Preview/);
  assert.match(stdout, /preview-only/);
  assert.match(stdout, /no receipt mint/);
});

test("dema evidence receipt preview --json emits the schema-tagged receipt", async () => {
  const { stdout } = await execFileAsync("node", [
    cliPath,
    "evidence",
    "receipt",
    "preview",
    "--json",
  ]);
  const receipt = JSON.parse(stdout);

  assert.equal(receipt.schema, "bizra.dema.evidence_receipt_preview.v0.1");
  assert.equal(receipt.mode, "PREVIEW_ONLY");
  assert.equal(receipt.certifies, false);
  assert.equal(receipt.boundary.receipt_minted, false);
  assert.equal(receipt.boundary.network_connection_attempted, false);
});

test("dema evidence rejects unknown receipt subcommands", async () => {
  await assert.rejects(
    execFileAsync("node", [cliPath, "evidence", "receipt", "mint"]),
    /Unknown evidence command/,
  );
});
