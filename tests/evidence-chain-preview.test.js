import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  EVIDENCE_CHAIN_PREVIEW_CHAIN_ID,
  EVIDENCE_CHAIN_PREVIEW_SCHEMA,
  EVIDENCE_CHAIN_VERIFICATION_PREVIEW_SCHEMA,
  buildEvidenceChainPreview,
  formatEvidenceChainPreview,
  verifyEvidenceChainPreview
} from "../packages/verifier/src/evidence-chain-preview.js";
import {
  EVIDENCE_RECEIPT_PREVIEW_SCHEMA,
  buildEvidenceReceiptPreview,
  canonicalJson
} from "../packages/verifier/src/evidence-receipt-preview.js";

const fixedNow = new Date("2026-05-15T00:00:00.000Z");
const modulePath = fileURLToPath(new URL("../packages/verifier/src/evidence-chain-preview.js", import.meta.url));
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const checkPath = fileURLToPath(new URL("../scripts/check.mjs", import.meta.url));
const architecturePath = fileURLToPath(new URL("../docs/ARCHITECTURE.md", import.meta.url));
const readmePath = fileURLToPath(new URL("../README.md", import.meta.url));
const receiptsDocPath = fileURLToPath(new URL("../docs/RECEIPTS.md", import.meta.url));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeReceipt(seed, overrides = {}) {
  return buildEvidenceReceiptPreview({
    input: {
      seed,
      nested: { z: `input-${seed}`, a: 1 }
    },
    output: {
      result: `preview-${seed}`,
      ok: seed.length > 0
    },
    policy: {
      version: "test",
      seed,
      floor: 0.95
    },
    toolCalls: [
      { name: "noop", executed: false, seed }
    ],
    decision: {
      verdict: seed.includes("reject") ? "PREVIEW_REJECT" : "PREVIEW_REVIEW",
      ihsan_floor_preview: null
    },
    now: fixedNow,
    ...overrides
  });
}

function denialCodes(chain) {
  return chain.denials.map((denial) => denial.code);
}

function expectDenial(chain, code) {
  assert.equal(chain.valid, false);
  assert.ok(
    denialCodes(chain).includes(code),
    `expected denial ${code}, got ${JSON.stringify(chain.denials)}`
  );
}

function buildTwoReceiptChain() {
  const first = makeReceipt("alpha");
  const second = makeReceipt("beta");
  assert.notEqual(first.self_digest, second.self_digest);
  return buildEvidenceChainPreview({
    receipts: [first, second],
    purpose: "review local evidence receipt previews",
    now: fixedNow
  });
}

test("buildEvidenceChainPreview emits a schema-tagged no-authority PREVIEW_ONLY chain", () => {
  const first = makeReceipt("alpha");
  const second = makeReceipt("beta");
  const chain = buildEvidenceChainPreview({
    receipts: [first, second],
    purpose: "review local evidence receipt previews",
    now: fixedNow
  });

  assert.equal(chain.schema, EVIDENCE_CHAIN_PREVIEW_SCHEMA);
  assert.equal(chain.mode, "PREVIEW_ONLY");
  assert.equal(chain.truth_label, "DECLARED");
  assert.equal(chain.certifies, false);
  assert.equal(chain.valid, true);
  assert.equal(chain.chain_id, EVIDENCE_CHAIN_PREVIEW_CHAIN_ID);
  assert.equal(chain.chain_id, "preview-no-chain");
  assert.equal(chain.producer_identity, null);
  assert.equal(chain.timestamp, fixedNow.toISOString());
  assert.equal(chain.denials.length, 0);
  assert.match(chain.preview_chain_digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(chain.links.length, 2);
  assert.equal(chain.links[0].previous_entry_digest, "preview-chain-genesis");
  assert.equal(chain.links[1].previous_entry_digest, chain.links[0].link_digest);
  assert.deepEqual(
    chain.links.map((link) => link.entry_schema),
    [EVIDENCE_RECEIPT_PREVIEW_SCHEMA, EVIDENCE_RECEIPT_PREVIEW_SCHEMA]
  );
  assert.ok(Object.values(chain.policy).every((value) => value === true));
  assert.equal(chain.boundary.scope, "in-memory-review-preview");
  for (const [field, value] of Object.entries(chain.boundary)) {
    if (field === "scope") continue;
    assert.equal(value, false, `${field} must be false`);
  }

  const verification = verifyEvidenceChainPreview(chain);
  assert.equal(verification.schema, EVIDENCE_CHAIN_VERIFICATION_PREVIEW_SCHEMA);
  assert.equal(verification.mode, "PREVIEW_ONLY");
  assert.equal(verification.truth_label, "DECLARED");
  assert.equal(verification.certifies, false);
  assert.equal(verification.ok, true);
  assert.equal(verification.actual_preview_chain_digest, chain.preview_chain_digest);
});

test("buildEvidenceChainPreview requires at least one receipt", () => {
  const chain = buildEvidenceChainPreview({ receipts: [], now: fixedNow });

  expectDenial(chain, "empty_chain");
  assert.equal(verifyEvidenceChainPreview(chain).ok, false);
});

test("buildEvidenceChainPreview accepts only Dema evidence receipt preview entries", () => {
  const chain = buildEvidenceChainPreview({
    receipts: [{ schema: "bizra.other.receipt.v0.1", mode: "PREVIEW_ONLY" }],
    now: fixedNow
  });

  expectDenial(chain, "invalid_receipt_schema");
});

test("buildEvidenceChainPreview rejects Proof Forge receipt shapes explicitly", () => {
  const chain = buildEvidenceChainPreview({
    receipts: [{
      schema: "bizra.proof-forge.receipt.v0.1",
      anchor_type: "proof_forge_evidence",
      chain: {
        previous_hash: "abc",
        evidence_hash: "def"
      }
    }],
    now: fixedNow
  });

  expectDenial(chain, "proof_forge_receipt_rejected");
});

test("buildEvidenceChainPreview rejects canonical receipt-like shapes explicitly", () => {
  const chain = buildEvidenceChainPreview({
    receipts: [{
      schema: "bizra.node0.receipt.v1",
      receipt_id: "canonical-1",
      chain_id: "node0-main",
      prev_digest: "sha256:abc",
      producer_identity: { node: "node0" },
      signature: "not-preview"
    }],
    now: fixedNow
  });

  expectDenial(chain, "canonical_receipt_rejected");
});

test("buildEvidenceChainPreview rejects receipt previews that fail receipt preview verification", () => {
  const receipt = makeReceipt("tampered-receipt");
  receipt.input_hash = "0".repeat(64);

  const chain = buildEvidenceChainPreview({ receipts: [receipt], now: fixedNow });

  expectDenial(chain, "receipt_verification_failed");
});

test("buildEvidenceChainPreview rejects receipts with non-preview chain identity", () => {
  const receipt = makeReceipt("wrong-chain");
  receipt.chain_id = "node0-main";

  const chain = buildEvidenceChainPreview({ receipts: [receipt], now: fixedNow });

  expectDenial(chain, "receipt_has_chain_identity");
});

test("buildEvidenceChainPreview rejects receipts with non-null prev_digest", () => {
  const receipt = makeReceipt("prev-digest");
  receipt.prev_digest = "sha256:abc";

  const chain = buildEvidenceChainPreview({ receipts: [receipt], now: fixedNow });

  expectDenial(chain, "receipt_has_prev_digest");
});

test("buildEvidenceChainPreview rejects producer, session, and signature-like fields", () => {
  const cases = [
    ["producer_identity", { node: "node0" }, "receipt_has_producer_identity"],
    ["session_id", "session-1", "receipt_has_signature_fields"],
    ["signature", "sig", "receipt_has_signature_fields"],
    ["pubkey", "pub", "receipt_has_signature_fields"],
    ["key_id", "key-1", "receipt_has_signature_fields"],
    ["producer_id", "producer-1", "receipt_has_signature_fields"]
  ];

  for (const [field, value, code] of cases) {
    const receipt = makeReceipt(`identity-${field}`);
    receipt[field] = value;
    const chain = buildEvidenceChainPreview({ receipts: [receipt], now: fixedNow });
    expectDenial(chain, code);
  }
});

test("buildEvidenceChainPreview rejects any receipt boundary effect set to true", () => {
  const boundaryFields = [
    "filesystem_write_performed",
    "chain_head_advanced",
    "receipt_minted",
    "identity_bound",
    "signature_emitted",
    "runtime_gate_executed",
    "network_connection_attempted",
    "external_posting_performed"
  ];

  for (const field of boundaryFields) {
    const receipt = makeReceipt(`boundary-${field}`);
    receipt.boundary[field] = true;
    const chain = buildEvidenceChainPreview({ receipts: [receipt], now: fixedNow });
    expectDenial(chain, "receipt_boundary_has_effects");
  }
});

test("buildEvidenceChainPreview rejects duplicate self_digest values", () => {
  const receipt = makeReceipt("duplicate");
  const chain = buildEvidenceChainPreview({
    receipts: [receipt, clone(receipt)],
    now: fixedNow
  });

  expectDenial(chain, "duplicate_entry_digest");
});

test("buildEvidenceChainPreview rejects embedded position claims", () => {
  const cases = [
    ["position", 0],
    ["chain_position", 1],
    ["chainPosition", 2]
  ];

  for (const [field, value] of cases) {
    const receipt = makeReceipt(`position-${field}`);
    receipt.decision[field] = value;
    const chain = buildEvidenceChainPreview({ receipts: [receipt], now: fixedNow });
    expectDenial(chain, "entry_contains_position_claim");
  }
});

test("fixed-order inputs produce stable preview_chain_digest", () => {
  const receipts = [makeReceipt("stable-a"), makeReceipt("stable-b")];
  const first = buildEvidenceChainPreview({ receipts: clone(receipts), now: fixedNow });
  const second = buildEvidenceChainPreview({ receipts: clone(receipts), now: fixedNow });

  assert.equal(first.valid, true);
  assert.equal(second.valid, true);
  assert.equal(first.preview_chain_digest, second.preview_chain_digest);
  assert.deepEqual(first.links, second.links);
});

test("reordering otherwise identical receipts changes preview_chain_digest", () => {
  const firstReceipt = makeReceipt("order-a");
  const secondReceipt = makeReceipt("order-b");
  const firstOrder = buildEvidenceChainPreview({
    receipts: [firstReceipt, secondReceipt],
    now: fixedNow
  });
  const secondOrder = buildEvidenceChainPreview({
    receipts: [secondReceipt, firstReceipt],
    now: fixedNow
  });

  assert.equal(firstOrder.valid, true);
  assert.equal(secondOrder.valid, true);
  assert.notEqual(firstOrder.preview_chain_digest, secondOrder.preview_chain_digest);
});

test("verifyEvidenceChainPreview fails entry, link, previous link, and policy tampering", () => {
  const chain = buildTwoReceiptChain();
  const cases = [
    ["entry digest", (value) => {
      value.links[0].entry_digest = "f".repeat(64);
    }],
    ["link digest", (value) => {
      value.links[1].link_digest = `sha256:${"0".repeat(64)}`;
    }],
    ["previous_entry_digest", (value) => {
      value.links[1].previous_entry_digest = `sha256:${"1".repeat(64)}`;
    }],
    ["chain policy", (value) => {
      value.policy.does_not_advance_chain_head = false;
    }]
  ];

  for (const [name, mutate] of cases) {
    const tampered = clone(chain);
    mutate(tampered);
    assert.equal(verifyEvidenceChainPreview(tampered).ok, false, `${name} tampering must fail`);
  }
});

test("semantically equal source receipts with different key insertion order produce the same chain digest", () => {
  const receiptA = buildEvidenceReceiptPreview({
    input: { a: 1, b: { c: 2, d: 3 } },
    output: { ok: true, values: ["x", "y"] },
    policy: { floor: 0.95, version: "test" },
    toolCalls: [{ name: "noop", executed: false }],
    decision: { verdict: "PREVIEW_REVIEW", ihsan_floor_preview: null },
    now: fixedNow
  });
  const receiptB = buildEvidenceReceiptPreview({
    input: { b: { d: 3, c: 2 }, a: 1 },
    output: { values: ["x", "y"], ok: true },
    policy: { version: "test", floor: 0.95 },
    toolCalls: [{ executed: false, name: "noop" }],
    decision: { ihsan_floor_preview: null, verdict: "PREVIEW_REVIEW" },
    now: fixedNow
  });

  assert.equal(receiptA.self_digest, receiptB.self_digest);

  const chainA = buildEvidenceChainPreview({ receipts: [receiptA], now: fixedNow });
  const chainB = buildEvidenceChainPreview({ receipts: [receiptB], now: fixedNow });

  assert.equal(chainA.valid, true);
  assert.equal(chainB.valid, true);
  assert.equal(chainA.preview_chain_digest, chainB.preview_chain_digest);
});

test("builder and verifier do not mutate inputs", () => {
  const receipts = [makeReceipt("immutable-a"), makeReceipt("immutable-b")];
  const receiptsBefore = canonicalJson(receipts);
  const chain = buildEvidenceChainPreview({ receipts, now: fixedNow });

  assert.equal(canonicalJson(receipts), receiptsBefore);

  const chainBefore = canonicalJson(chain);
  const verification = verifyEvidenceChainPreview(chain);

  assert.equal(verification.ok, true);
  assert.equal(canonicalJson(chain), chainBefore);
});

test("invalid now returns an invalid_now denial instead of throwing", () => {
  const receipt = makeReceipt("invalid-now");
  let chain;

  assert.doesNotThrow(() => {
    chain = buildEvidenceChainPreview({
      receipts: [receipt],
      now: new Date("not-a-date")
    });
  });
  expectDenial(chain, "invalid_now");
});

test("formatEvidenceChainPreview repeats no-authority boundary and omits sensitive local data", () => {
  const sensitiveToken = "access-token-should-not-print";
  const sensitivePath = "/home/example/private-input.txt";
  const receipt = buildEvidenceReceiptPreview({
    input: { sensitiveToken, sensitivePath },
    output: { secret: "raw-output-should-not-print" },
    policy: { rule: "format-redaction" },
    toolCalls: [{ name: "none", args: [sensitiveToken], executed: false }],
    decision: { verdict: "PREVIEW_REVIEW", ihsan_floor_preview: null },
    now: fixedNow
  });
  const chain = buildEvidenceChainPreview({
    receipts: [receipt],
    purpose: `review ${sensitivePath} ${sensitiveToken}`,
    now: fixedNow
  });
  const output = formatEvidenceChainPreview(chain);

  assert.match(output, /DEMA EvidenceChain Preview/);
  assert.match(output, /no filesystem write/);
  assert.match(output, /no chain advance/);
  assert.match(output, /no receipt mint/);
  assert.match(output, /no identity binding/);
  assert.match(output, /no signature/);
  assert.match(output, /no runtime gate/);
  assert.match(output, /no network/);
  assert.match(output, /no external posting/);
  assert.match(output, /no federation/);
  assert.match(output, /no Step 7/);
  assert.match(output, /not a canonical chain/);
  assert.match(output, /not a receipt mint/);
  assert.match(output, /not a signature/);
  assert.match(output, /not Step 7/);
  assert.doesNotMatch(output, /\x1B\[/);
  assert.doesNotMatch(output, new RegExp(sensitiveToken));
  assert.doesNotMatch(output, new RegExp(sensitivePath.replaceAll("/", "\\/")));
  assert.doesNotMatch(output, /raw-output-should-not-print/);
});

test("evidence chain preview source imports no runtime, write, network, dynamic, or eval surfaces", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(source, /\bfrom\s+["']node:(?:fs|fs\/promises|child_process|net|tls|http|https|dgram|dns)["']/);
  assert.doesNotMatch(source, /\b(writeFile|appendFile|mkdir|rename|unlink|rm|rmdir|createWriteStream)\b/);
  assert.doesNotMatch(source, /\b(exec|execFile|spawn|spawnSync|execFileSync)\b/);
  assert.doesNotMatch(source, /\b(fetch|WebSocket|XMLHttpRequest)\b/);
  assert.doesNotMatch(source, /\bimport\s*\(/);
  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /\bnew\s+Function\b/);
  assert.doesNotMatch(source, /(?:^|[/"'`])\.proof-forge(?:[/"'`]|$)|Downloads|chain-head\.txt/);
});

test("pure module slice has no CLI, smoke, architecture, README, or receipt-doc command wiring", async () => {
  const [cli, check, architecture, readme, receiptsDoc] = await Promise.all([
    readFile(cliPath, "utf8"),
    readFile(checkPath, "utf8"),
    readFile(architecturePath, "utf8"),
    readFile(readmePath, "utf8"),
    readFile(receiptsDocPath, "utf8")
  ]);

  assert.doesNotMatch(cli, /evidence-chain-preview\.js|dema evidence chain|evidence chain preview/i);
  assert.doesNotMatch(check, /evidence["']\s*,\s*["']chain|evidence chain preview/i);
  assert.doesNotMatch(architecture, /`dema evidence chain|evidence chain preview/i);
  assert.doesNotMatch(readme, /dema evidence chain|evidence chain preview/i);
  assert.doesNotMatch(receiptsDoc, /EvidenceChain preview|evidence chain preview/i);
});
