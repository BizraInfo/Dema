import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import {
  buildThinkReceipt,
  saveThinkReceipt,
  THINK_RECEIPT_SAVE_CONSENT,
  THINK_RECEIPT_SCHEMA,
} from "../packages/think/src/think-receipt-save.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

function makeValidEnvelope(overrides = {}) {
  const base = {
    schema: "bizra.dema.think_live.v0.1",
    generated_at: "2026-05-26T22:00:00.000Z",
    mode: "LIVE_INVOCATION",
    query: "What is BIZRA?",
    context_manifest: {
      memory: {
        available: false,
        hits_count: 0,
        hit_summaries: [],
        reason: "wrapper_not_found",
      },
      model: "gemma4",
      prompt_length_chars: 100,
    },
    invocation: {
      status: "invocation_completed",
      model_responded: true,
      output_length_chars: 42,
      consent_phrase_verified: true,
      error_reason: null,
    },
    output: "BIZRA is a constitutional computing ecosystem.",
    boundary: {
      filesystem_write_performed: false,
      network_used: true,
      runtime_execution_performed: true,
      model_loaded: true,
      model_invocation_performed: true,
      prompt_executed: true,
      external_call_performed: true,
      raw_corpus_scan_performed: false,
      raw_data_included: false,
      tool_executed: false,
      chain_advance_performed: false,
      receipt_mint_performed: false,
      federation_invoked: false,
      node_connection_performed: false,
      public_network_used: false,
      consent_collected: true,
    },
    boundary_evidence: {
      model_invocation: "OBSERVED",
      network_used: "OBSERVED",
      external_call: "OBSERVED",
      external_call_scope: "localhost_only",
      public_network: "STATIC_CHECKED",
      filesystem_write: "OBSERVED_FALSE",
      receipt_minted: "OBSERVED_FALSE",
      federation: "DECLARED_NOT_OBSERVABLE_V0_2",
      memory_query: "WRAPPER_MISSING",
    },
    ...overrides,
  };
  const payload = { ...base };
  delete payload.proof_hash;
  base.proof_hash = sha256(stableStringify(payload));
  return base;
}

async function makeDemaHome() {
  return mkdtemp(join(tmpdir(), "dema-think-receipt-"));
}

describe("buildThinkReceipt", () => {
  it("produces a valid receipt from a good envelope", () => {
    const envelope = makeValidEnvelope();
    const receipt = buildThinkReceipt(envelope);
    assert.ok(!receipt.error, `unexpected error: ${receipt.error}`);
    assert.equal(receipt.schema, THINK_RECEIPT_SCHEMA);
    assert.equal(receipt.query, "What is BIZRA?");
    assert.equal(receipt.model, "gemma4");
    assert.equal(receipt.mode, "LIVE_INVOCATION");
    assert.equal(
      receipt.output_preview,
      "BIZRA is a constitutional computing ecosystem.",
    );
    assert.equal(receipt.source_envelope.proof_hash_verified, true);
    assert.equal(receipt.source_envelope.schema, "bizra.dema.think_live.v0.1");
  });

  it("receipt_hash is deterministic and excludes itself", () => {
    const envelope = makeValidEnvelope();
    const now = new Date("2026-05-26T23:00:00.000Z");
    const receipt = buildThinkReceipt(envelope, { now });
    const check = { ...receipt };
    delete check.receipt_hash;
    const expected = sha256(stableStringify(check));
    assert.equal(receipt.receipt_hash, expected);
  });

  it("rejects null input", () => {
    const result = buildThinkReceipt(null);
    assert.ok(result.error);
    assert.match(result.error, /valid think_live envelope/);
  });

  it("rejects wrong schema", () => {
    const envelope = makeValidEnvelope({ schema: "wrong.schema" });
    const result = buildThinkReceipt(envelope);
    assert.ok(result.error);
    assert.match(result.error, /Expected schema/);
  });

  it("rejects tampered envelope (proof_hash mismatch)", () => {
    const envelope = makeValidEnvelope();
    envelope.query = "tampered query";
    const result = buildThinkReceipt(envelope);
    assert.ok(result.error);
    assert.match(result.error, /proof_hash verification failed/);
  });

  it("output_preview is capped at 500 chars", () => {
    const longOutput = "x".repeat(1000);
    const envelope = makeValidEnvelope({ output: longOutput });
    const receipt = buildThinkReceipt(envelope);
    assert.ok(!receipt.error);
    assert.equal(receipt.output_preview.length, 500);
  });

  it("does not include raw memory snippets", () => {
    const envelope = makeValidEnvelope();
    envelope.context_manifest.memory.hit_summaries = [
      { id: "m1", score: 0.9, snippet_hash: "abc123", length_class: "short" },
    ];
    const payloadNoHash = { ...envelope };
    delete payloadNoHash.proof_hash;
    envelope.proof_hash = sha256(stableStringify(payloadNoHash));

    const receipt = buildThinkReceipt(envelope);
    assert.ok(!receipt.error);
    const json = JSON.stringify(receipt);
    assert.ok(
      !json.includes("hit_summaries"),
      "receipt must not contain hit_summaries",
    );
    assert.ok(
      !json.includes("snippet_hash"),
      "receipt must not contain snippet_hash",
    );
    assert.ok(
      !json.includes("context_manifest"),
      "receipt must not contain context_manifest",
    );
  });

  it("boundary_summary reflects source envelope boundary", () => {
    const envelope = makeValidEnvelope();
    const receipt = buildThinkReceipt(envelope);
    assert.equal(receipt.boundary_summary.model_invocation_performed, true);
    assert.equal(receipt.boundary_summary.public_network_used, false);
    assert.equal(receipt.boundary_summary.filesystem_write_performed, false);
    assert.equal(receipt.boundary_summary.consent_collected, true);
    assert.equal(
      receipt.boundary_summary.external_call_scope,
      "localhost_only",
    );
  });

  it("save_boundary reports filesystem_write_performed=true", () => {
    const envelope = makeValidEnvelope();
    const receipt = buildThinkReceipt(envelope);
    assert.equal(receipt.save_boundary.filesystem_write_performed, true);
    assert.equal(receipt.save_boundary.receipt_mint_performed, false);
    assert.equal(receipt.save_boundary.network_used, false);
    assert.equal(receipt.save_boundary.public_network_used, false);
  });

  it("consent_evidence tracks both consent gates", () => {
    const envelope = makeValidEnvelope();
    const receipt = buildThinkReceipt(envelope);
    assert.equal(receipt.consent_evidence.think_consent_verified, true);
    assert.equal(receipt.consent_evidence.save_consent_verified, true);
  });

  it("handles envelope with null output gracefully", () => {
    const envelope = makeValidEnvelope({ output: null });
    const receipt = buildThinkReceipt(envelope);
    assert.ok(!receipt.error);
    assert.equal(receipt.output_preview, null);
  });
});

describe("saveThinkReceipt", () => {
  it("saves with valid consent", async () => {
    const home = await makeDemaHome();
    const envelope = makeValidEnvelope();
    const result = await saveThinkReceipt(envelope, {
      demaHome: home,
      consent: THINK_RECEIPT_SAVE_CONSENT,
      pretty: true,
    });
    assert.equal(result.saved, true);
    assert.ok(existsSync(result.path));
    assert.match(result.filename, /^think-[a-f0-9]{64}\.json$/);
  });

  it("rejects missing consent", async () => {
    const home = await makeDemaHome();
    const envelope = makeValidEnvelope();
    const result = await saveThinkReceipt(envelope, { demaHome: home });
    assert.equal(result.saved, false);
    assert.equal(result.reason, "consent_missing");
    assert.equal(result.expected, THINK_RECEIPT_SAVE_CONSENT);
  });

  it("rejects wrong consent phrase", async () => {
    const home = await makeDemaHome();
    const envelope = makeValidEnvelope();
    const result = await saveThinkReceipt(envelope, {
      demaHome: home,
      consent: "wrong phrase",
    });
    assert.equal(result.saved, false);
    assert.equal(result.reason, "consent_mismatch");
  });

  it("rejects tampered envelope before writing", async () => {
    const home = await makeDemaHome();
    const envelope = makeValidEnvelope();
    envelope.query = "tampered";
    const result = await saveThinkReceipt(envelope, {
      demaHome: home,
      consent: THINK_RECEIPT_SAVE_CONSENT,
    });
    assert.equal(result.saved, false);
    assert.equal(result.reason, "verification_failed");
    if (existsSync(join(home, "receipts"))) {
      const files = await readdir(join(home, "receipts"));
      assert.equal(
        files.filter((f) => f.startsWith("think-")).length,
        0,
        "no receipt should be written for tampered envelope",
      );
    }
  });

  it("saved file is content-addressed (filename = think-<sha256>.json)", async () => {
    const home = await makeDemaHome();
    const envelope = makeValidEnvelope();
    const result = await saveThinkReceipt(envelope, {
      demaHome: home,
      consent: THINK_RECEIPT_SAVE_CONSENT,
    });
    assert.equal(result.saved, true);
    const onDisk = await readFile(result.path, "utf8");
    const expected = createHash("sha256").update(onDisk).digest("hex");
    assert.equal(result.filename, `think-${expected}.json`);
  });

  it("saved receipt JSON has correct schema and receipt_hash", async () => {
    const home = await makeDemaHome();
    const envelope = makeValidEnvelope();
    const result = await saveThinkReceipt(envelope, {
      demaHome: home,
      consent: THINK_RECEIPT_SAVE_CONSENT,
      pretty: true,
    });
    assert.equal(result.saved, true);
    const onDisk = JSON.parse(await readFile(result.path, "utf8"));
    assert.equal(onDisk.schema, THINK_RECEIPT_SCHEMA);
    const check = { ...onDisk };
    delete check.receipt_hash;
    const recomputed = sha256(stableStringify(check));
    assert.equal(onDisk.receipt_hash, recomputed);
  });

  it("saved receipt does not contain raw output or raw memory", async () => {
    const home = await makeDemaHome();
    const longOutput = "A".repeat(600) + "TAIL_MARKER_SHOULD_NOT_PERSIST";
    const envelope = makeValidEnvelope({ output: longOutput });
    const result = await saveThinkReceipt(envelope, {
      demaHome: home,
      consent: THINK_RECEIPT_SAVE_CONSENT,
    });
    assert.equal(result.saved, true);
    const raw = await readFile(result.path, "utf8");
    assert.ok(
      !raw.includes("TAIL_MARKER_SHOULD_NOT_PERSIST"),
      "output beyond 500-char preview must not be persisted",
    );
    assert.ok(!raw.includes("hit_summaries"));
    assert.ok(!raw.includes("context_manifest"));
  });

  it("two saves with different timestamps produce two files", async () => {
    const home = await makeDemaHome();
    const envelope = makeValidEnvelope();
    const r1 = await saveThinkReceipt(envelope, {
      demaHome: home,
      consent: THINK_RECEIPT_SAVE_CONSENT,
      now: new Date("2026-05-26T23:00:00.000Z"),
    });
    const r2 = await saveThinkReceipt(envelope, {
      demaHome: home,
      consent: THINK_RECEIPT_SAVE_CONSENT,
      now: new Date("2026-05-26T23:01:00.000Z"),
    });
    assert.equal(r1.saved, true);
    assert.equal(r2.saved, true);
    assert.notEqual(r1.filename, r2.filename);
    const files = await readdir(join(home, "receipts"));
    const thinkFiles = files.filter(
      (f) => f.startsWith("think-") && f.endsWith(".json"),
    );
    assert.equal(thinkFiles.length, 2);
  });

  it("no file written when consent is missing", async () => {
    const home = await makeDemaHome();
    const envelope = makeValidEnvelope();
    await saveThinkReceipt(envelope, { demaHome: home });
    if (existsSync(join(home, "receipts"))) {
      const files = await readdir(join(home, "receipts"));
      assert.equal(files.filter((f) => f.startsWith("think-")).length, 0);
    }
  });
});
