import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildThinkDryRun,
  checkModelReadiness,
  formatThinkDryRun,
} from "../packages/think/src/think-dry-run.js";
import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

const FIXED_NOW = new Date("2026-01-01T00:00:00Z");

describe("think-dry-run", () => {
  describe("buildThinkDryRun", () => {
    it("returns schema bizra.dema.think_dry_run.v0.1", async () => {
      const e = await buildThinkDryRun("test query", { now: FIXED_NOW });
      assert.equal(e.schema, "bizra.dema.think_dry_run.v0.1");
    });

    it("returns DRY_RUN mode", async () => {
      const e = await buildThinkDryRun("test query", { now: FIXED_NOW });
      assert.equal(e.mode, "DRY_RUN");
    });

    it("returns error for missing query", async () => {
      const e = await buildThinkDryRun("", { now: FIXED_NOW });
      assert.ok(e.error);
      assert.match(e.error, /Usage/);
    });

    it("returns error for null query", async () => {
      const e = await buildThinkDryRun(null, { now: FIXED_NOW });
      assert.ok(e.error);
    });

    it("returns error for whitespace-only query", async () => {
      const e = await buildThinkDryRun("   ", { now: FIXED_NOW });
      assert.ok(e.error);
    });

    it("trims query whitespace", async () => {
      const e = await buildThinkDryRun("  hello world  ", { now: FIXED_NOW });
      assert.equal(e.query, "hello world");
    });

    it("proof_hash is deterministic for same now", async () => {
      const e1 = await buildThinkDryRun("test query", { now: FIXED_NOW });
      const e2 = await buildThinkDryRun("test query", { now: FIXED_NOW });
      assert.equal(e1.proof_hash, e2.proof_hash);
    });

    it("orders equal-sized API models deterministically", async () => {
      const oldFetch = globalThis.fetch;
      let requestCount = 0;
      globalThis.fetch = async () => {
        requestCount += 1;
        const models =
          requestCount % 2 === 1
            ? [
                { name: "zeta:latest", size: 10 },
                { name: "alpha:latest", size: 10 },
              ]
            : [
                { name: "alpha:latest", size: 10 },
                { name: "zeta:latest", size: 10 },
              ];
        return {
          ok: true,
          json: async () => ({ models }),
        };
      };

      try {
        const first = await checkModelReadiness();
        const second = await checkModelReadiness();
        assert.deepEqual(first.available_models, [
          "alpha:latest",
          "zeta:latest",
        ]);
        assert.deepEqual(second.available_models, first.available_models);
        assert.equal(first.recommended_model, "alpha:latest");
        assert.equal(second.recommended_model, first.recommended_model);
      } finally {
        globalThis.fetch = oldFetch;
      }
    });

    it("proof_hash is sha256 of stableStringify excluding proof_hash", async () => {
      const e = await buildThinkDryRun("test query", { now: FIXED_NOW });
      const payload = { ...e };
      delete payload.proof_hash;
      const expected = sha256(stableStringify(payload));
      assert.equal(e.proof_hash, expected);
    });

    it("boundary has all canonical keys", async () => {
      const e = await buildThinkDryRun("test query", { now: FIXED_NOW });
      const keys = Object.keys(e.boundary);
      assert.equal(keys.length, PREVIEW_BOUNDARY_CANONICAL_KEYS.length);
    });

    it("model_invocation_performed is false", async () => {
      const e = await buildThinkDryRun("test query", { now: FIXED_NOW });
      assert.equal(e.boundary.model_invocation_performed, false);
      assert.equal(e.boundary.model_loaded, false);
      assert.equal(e.boundary.prompt_executed, false);
    });

    it("no receipt minted", async () => {
      const e = await buildThinkDryRun("test query", { now: FIXED_NOW });
      assert.equal(e.boundary.receipt_mint_performed, false);
    });

    it("no public network used", async () => {
      const e = await buildThinkDryRun("test query", { now: FIXED_NOW });
      assert.equal(e.boundary.public_network_used, false);
    });

    it("no filesystem write", async () => {
      const e = await buildThinkDryRun("test query", { now: FIXED_NOW });
      assert.equal(e.boundary.filesystem_write_performed, false);
    });

    it("boundary_evidence uses evidence labels not booleans", async () => {
      const e = await buildThinkDryRun("test query", { now: FIXED_NOW });
      assert.equal(
        e.boundary_evidence.model_invocation,
        "NOT_PERFORMED_DRY_RUN",
      );
      assert.ok(
        ["STATIC_CHECKED", "LOCALHOST_API_OBSERVED"].includes(
          e.boundary_evidence.network_used,
        ),
      );
      assert.equal(e.boundary_evidence.receipt_minted, "NOT_PERFORMED_DRY_RUN");
    });

    it("marks localhost and wrapper probes as real boundary effects when observed", async () => {
      const oldFetch = globalThis.fetch;
      const oldWrapper = process.env.DEMA_AGENT_DB_QUERY_PATH;
      const dir = mkdtempSync(join(tmpdir(), "dema-think-probes-"));
      const wrapper = join(dir, "agent-db-query.py");
      writeFileSync(wrapper, 'import json\nprint(json.dumps({"hits": []}))\n');
      process.env.DEMA_AGENT_DB_QUERY_PATH = wrapper;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ models: [{ name: "llama3.2:latest", size: 1 }] }),
      });
      try {
        const e = await buildThinkDryRun("test query", { now: FIXED_NOW });
        assert.equal(e.boundary.network_used, true);
        assert.equal(e.boundary.runtime_execution_performed, true);
        assert.equal(e.boundary.public_network_used, false);
        assert.equal(
          e.probe_profile.localhost_readiness_probe_performed,
          true,
        );
        assert.equal(e.probe_profile.runtime_wrapper_probe_performed, true);
        assert.equal(e.boundary_evidence.network_used, "LOCALHOST_API_OBSERVED");
        assert.equal(e.boundary_evidence.memory_query, "WRAPPER_SPAWNED_LOCAL");
      } finally {
        globalThis.fetch = oldFetch;
        if (oldWrapper) process.env.DEMA_AGENT_DB_QUERY_PATH = oldWrapper;
        else delete process.env.DEMA_AGENT_DB_QUERY_PATH;
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("memory query handles wrapper missing gracefully", async () => {
      const old = process.env.DEMA_AGENT_DB_QUERY_PATH;
      process.env.DEMA_AGENT_DB_QUERY_PATH = "/nonexistent/wrapper-test";
      try {
        const e = await buildThinkDryRun("test query", { now: FIXED_NOW });
        assert.equal(e.context_manifest.memory.available, false);
        assert.equal(e.context_manifest.memory.reason, "wrapper_not_found");
        assert.equal(e.context_manifest.memory.hits_count, 0);
        assert.deepStrictEqual(e.context_manifest.memory.hit_summaries, []);
      } finally {
        if (old) process.env.DEMA_AGENT_DB_QUERY_PATH = old;
        else delete process.env.DEMA_AGENT_DB_QUERY_PATH;
      }
    });

    it("no raw snippets in memory hit_summaries", async () => {
      const e = await buildThinkDryRun("test query", { now: FIXED_NOW });
      for (const h of e.context_manifest.memory.hit_summaries) {
        assert.ok(!("snippet" in h), "hit_summaries must not contain snippets");
        assert.ok(!("content" in h), "hit_summaries must not contain content");
        assert.ok(!("text" in h), "hit_summaries must not contain text");
      }
    });

    it("model_readiness detects adapter-visible models when Ollama is running", async () => {
      const e = await buildThinkDryRun("test query", { now: FIXED_NOW });
      const mr = e.context_manifest.model_readiness;
      if (mr.broker_reachable === "LOCALHOST_API_OBSERVED") {
        assert.ok(mr.available_models.length > 0);
        assert.ok(mr.recommended_model);
        assert.equal(mr.model_readiness_evidence, "LOCALHOST_API_OBSERVED");
      }
    });

    it("would_invoke shows consent required and model consent phrase", async () => {
      const e = await buildThinkDryRun("test query", { now: FIXED_NOW });
      assert.equal(e.would_invoke.consent_required, true);
      assert.equal(e.would_invoke.think_consent_phrase, "RUN LOCAL THINK");
      assert.equal(e.would_invoke.model_invocation_performed, false);
      assert.ok(e.would_invoke.required_model_consent_phrase);
    });

    it("resource estimate includes context length", async () => {
      const e = await buildThinkDryRun("test query", { now: FIXED_NOW });
      assert.equal(
        e.context_manifest.resource_estimate.context_length_chars,
        10,
      );
    });

    it("generated_at uses injected now", async () => {
      const e = await buildThinkDryRun("test query", { now: FIXED_NOW });
      assert.equal(e.generated_at, "2026-01-01T00:00:00.000Z");
    });
  });

  describe("formatThinkDryRun", () => {
    it("renders human-readable dry-run report", async () => {
      const e = await buildThinkDryRun("test query", { now: FIXED_NOW });
      const text = formatThinkDryRun(e);
      assert.match(text, /Dema Think Dry-Run/);
      assert.match(text, /DRY_RUN/);
      assert.match(text, /test query/);
      assert.match(text, /Proof Hash/);
      assert.match(text, /Boundary Evidence/);
    });

    it("renders error string when envelope has error", () => {
      const text = formatThinkDryRun({ error: "missing query" });
      assert.equal(text, "missing query");
    });

    it("shows NOT_PERFORMED_DRY_RUN in evidence", async () => {
      const e = await buildThinkDryRun("test query", { now: FIXED_NOW });
      const text = formatThinkDryRun(e);
      assert.match(text, /NOT_PERFORMED_DRY_RUN/);
    });
  });
});
