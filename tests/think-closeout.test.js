import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildThinkCloseout,
  formatThinkCloseout,
} from "../packages/think/src/think-closeout.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

function makeEnvelope(overrides = {}) {
  const base = {
    schema: "bizra.dema.think_live.v0.1",
    generated_at: "2026-01-01T00:00:00.000Z",
    mode: "LIVE_INVOCATION",
    query: "test query",
    context_manifest: {
      memory: {
        available: false,
        hits_count: 0,
        hit_summaries: [],
        reason: "wrapper_not_found",
      },
      model: "gemma4:e4b",
      prompt_length_chars: 100,
    },
    invocation: {
      status: "completed",
      model_responded: true,
      output_length_chars: 43,
      consent_phrase_verified: true,
      error_reason: null,
    },
    output: "BIZRA live local think path is operational.",
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
      memory_query: "wrapper_not_found",
    },
    ...overrides,
  };
  const payload = { ...base };
  delete payload.proof_hash;
  base.proof_hash = sha256(stableStringify(payload));
  return base;
}

describe("think-closeout", () => {
  describe("buildThinkCloseout", () => {
    it("returns schema bizra.dema.think_closeout.v0.1", () => {
      const c = buildThinkCloseout(makeEnvelope());
      assert.equal(c.schema, "bizra.dema.think_closeout.v0.1");
    });

    it("verifies proof_hash matches", () => {
      const c = buildThinkCloseout(makeEnvelope());
      assert.equal(c.verification.proof_hash_match, true);
      assert.equal(c.warning_count, 0);
    });

    it("detects tampered proof_hash", () => {
      const env = makeEnvelope();
      env.proof_hash = "0000000000000000000000000000000000000000";
      const c = buildThinkCloseout(env);
      assert.equal(c.verification.proof_hash_match, false);
      assert.ok(c.warnings.some((w) => w.includes("MISMATCH")));
    });

    it("includes output preview", () => {
      const c = buildThinkCloseout(makeEnvelope());
      assert.ok(c.output_preview);
      assert.match(c.output_preview, /BIZRA/);
    });

    it("reports consent verified", () => {
      const c = buildThinkCloseout(makeEnvelope());
      assert.equal(c.invocation.consent_verified, true);
    });

    it("warns on unverified consent", () => {
      const env = makeEnvelope();
      env.invocation.consent_phrase_verified = false;
      env.proof_hash = sha256(
        stableStringify({ ...env, proof_hash: undefined }),
      );
      const c = buildThinkCloseout(env);
      assert.ok(c.warnings.some((w) => w.includes("consent")));
    });

    it("boundary summary is correct", () => {
      const c = buildThinkCloseout(makeEnvelope());
      assert.equal(c.boundary_summary.model_invocation_performed, true);
      assert.equal(c.boundary_summary.public_network_used, false);
      assert.equal(c.boundary_summary.filesystem_write_performed, false);
      assert.equal(c.boundary_summary.receipt_mint_performed, false);
      assert.equal(c.boundary_summary.external_call_scope, "localhost_only");
    });

    it("evidence summary is correct", () => {
      const c = buildThinkCloseout(makeEnvelope());
      assert.equal(c.evidence_summary.model_invocation, "OBSERVED");
      assert.equal(c.evidence_summary.public_network, "STATIC_CHECKED");
      assert.equal(c.evidence_summary.filesystem_write, "OBSERVED_FALSE");
    });

    it("returns error for null input", () => {
      const c = buildThinkCloseout(null);
      assert.ok(c.error);
    });

    it("returns error for wrong schema", () => {
      const c = buildThinkCloseout({ schema: "wrong.schema.v0.1" });
      assert.ok(c.error);
      assert.match(c.error, /Expected schema/);
    });

    it("warns on public network usage", () => {
      const env = makeEnvelope();
      env.boundary.public_network_used = true;
      env.proof_hash = sha256(
        stableStringify({ ...env, proof_hash: undefined }),
      );
      const c = buildThinkCloseout(env);
      assert.ok(c.warnings.some((w) => w.includes("public network")));
    });

    it("warns on filesystem write", () => {
      const env = makeEnvelope();
      env.boundary.filesystem_write_performed = true;
      env.proof_hash = sha256(
        stableStringify({ ...env, proof_hash: undefined }),
      );
      const c = buildThinkCloseout(env);
      assert.ok(c.warnings.some((w) => w.includes("filesystem")));
    });
  });

  describe("formatThinkCloseout", () => {
    it("renders human-readable closeout", () => {
      const c = buildThinkCloseout(makeEnvelope());
      const text = formatThinkCloseout(c);
      assert.match(text, /Think Closeout Report/);
      assert.match(text, /gemma4:e4b/);
      assert.match(text, /PASS/);
      assert.match(text, /BIZRA/);
      assert.match(text, /localhost_only/);
    });

    it("renders error string", () => {
      assert.equal(formatThinkCloseout({ error: "bad" }), "bad");
    });

    it("renders warnings when present", () => {
      const env = makeEnvelope();
      env.proof_hash = "bad";
      const c = buildThinkCloseout(env);
      const text = formatThinkCloseout(c);
      assert.match(text, /Warnings/);
      assert.match(text, /MISMATCH/);
    });
  });
});
