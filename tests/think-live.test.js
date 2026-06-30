import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, mkdtemp, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  buildThinkLive,
  formatThinkLive,
  THINK_CONSENT_PHRASE,
} from "../packages/think/src/think-live.js";
import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

const FIXED_NOW = new Date("2026-01-01T00:00:00Z");
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("think-live", () => {
  describe("consent gates", () => {
    it("returns error for missing think consent", async () => {
      const e = await buildThinkLive("test query", {
        thinkConsent: "",
        modelConsent: "GO: invoke local LLM at gemma4",
        now: FIXED_NOW,
      });
      assert.ok(e.error);
      assert.match(e.error, /consent mismatch/i);
      assert.equal(e.consent_rejected, true);
    });

    it("returns error for wrong think consent", async () => {
      const e = await buildThinkLive("test query", {
        thinkConsent: "WRONG PHRASE",
        modelConsent: "GO: invoke local LLM at gemma4",
        now: FIXED_NOW,
      });
      assert.ok(e.error);
      assert.equal(e.consent_rejected, true);
    });

    it("returns error for missing model consent", async () => {
      const e = await buildThinkLive("test query", {
        thinkConsent: THINK_CONSENT_PHRASE,
        modelConsent: "",
        now: FIXED_NOW,
      });
      assert.ok(e.error);
      assert.match(e.error, /model-consent/i);
    });

    it("returns error for missing query", async () => {
      const e = await buildThinkLive("", {
        thinkConsent: THINK_CONSENT_PHRASE,
        modelConsent: "GO: invoke local LLM at gemma4",
        now: FIXED_NOW,
      });
      assert.ok(e.error);
      assert.match(e.error, /Usage/);
    });
  });

  describe("envelope shape", () => {
    it("returns schema bizra.dema.think_live.v0.1", async () => {
      const e = await buildThinkLive("test query", {
        thinkConsent: THINK_CONSENT_PHRASE,
        modelConsent: "GO: invoke local LLM at gemma4",
        now: FIXED_NOW,
      });
      assert.equal(e.schema, "bizra.dema.think_live.v0.1");
    });

    it("returns LIVE_INVOCATION mode", async () => {
      const e = await buildThinkLive("test query", {
        thinkConsent: THINK_CONSENT_PHRASE,
        modelConsent: "GO: invoke local LLM at gemma4",
        now: FIXED_NOW,
      });
      assert.equal(e.mode, "LIVE_INVOCATION");
    });

    it("has canonical-key boundary", async () => {
      const e = await buildThinkLive("test query", {
        thinkConsent: THINK_CONSENT_PHRASE,
        modelConsent: "GO: invoke local LLM at gemma4",
        now: FIXED_NOW,
      });
      assert.equal(
        Object.keys(e.boundary).length,
        PREVIEW_BOUNDARY_CANONICAL_KEYS.length,
      );
    });

    it("proof_hash excludes itself", async () => {
      const e = await buildThinkLive("test query", {
        thinkConsent: THINK_CONSENT_PHRASE,
        modelConsent: "GO: invoke local LLM at gemma4",
        now: FIXED_NOW,
      });
      const payload = { ...e };
      delete payload.proof_hash;
      assert.equal(e.proof_hash, sha256(stableStringify(payload)));
    });
  });

  describe("boundary honesty", () => {
    it("model_invocation_performed is true", async () => {
      const e = await buildThinkLive("test query", {
        thinkConsent: THINK_CONSENT_PHRASE,
        modelConsent: "GO: invoke local LLM at gemma4",
        now: FIXED_NOW,
      });
      assert.equal(e.boundary.model_invocation_performed, true);
    });

    it("network_used is true (localhost fetch)", async () => {
      const e = await buildThinkLive("test query", {
        thinkConsent: THINK_CONSENT_PHRASE,
        modelConsent: "GO: invoke local LLM at gemma4",
        now: FIXED_NOW,
      });
      assert.equal(e.boundary.network_used, true);
    });

    it("external_call_performed is true", async () => {
      const e = await buildThinkLive("test query", {
        thinkConsent: THINK_CONSENT_PHRASE,
        modelConsent: "GO: invoke local LLM at gemma4",
        now: FIXED_NOW,
      });
      assert.equal(e.boundary.external_call_performed, true);
    });

    it("public_network_used is false", async () => {
      const e = await buildThinkLive("test query", {
        thinkConsent: THINK_CONSENT_PHRASE,
        modelConsent: "GO: invoke local LLM at gemma4",
        now: FIXED_NOW,
      });
      assert.equal(e.boundary.public_network_used, false);
    });

    it("filesystem_write_performed is false (no persistence in H14A)", async () => {
      const e = await buildThinkLive("test query", {
        thinkConsent: THINK_CONSENT_PHRASE,
        modelConsent: "GO: invoke local LLM at gemma4",
        now: FIXED_NOW,
      });
      assert.equal(e.boundary.filesystem_write_performed, false);
    });

    it("receipt_mint_performed is false", async () => {
      const e = await buildThinkLive("test query", {
        thinkConsent: THINK_CONSENT_PHRASE,
        modelConsent: "GO: invoke local LLM at gemma4",
        now: FIXED_NOW,
      });
      assert.equal(e.boundary.receipt_mint_performed, false);
    });

    it("consent_collected is true", async () => {
      const e = await buildThinkLive("test query", {
        thinkConsent: THINK_CONSENT_PHRASE,
        modelConsent: "GO: invoke local LLM at gemma4",
        now: FIXED_NOW,
      });
      assert.equal(e.boundary.consent_collected, true);
    });

    it("boundary_evidence has external_call_scope localhost_only", async () => {
      const e = await buildThinkLive("test query", {
        thinkConsent: THINK_CONSENT_PHRASE,
        modelConsent: "GO: invoke local LLM at gemma4",
        now: FIXED_NOW,
      });
      assert.equal(e.boundary_evidence.external_call_scope, "localhost_only");
      assert.equal(e.boundary_evidence.public_network, "STATIC_CHECKED");
    });
  });

  describe("no raw snippets in envelope", () => {
    it("hit_summaries contain only id, score, snippet_hash, length_class", async () => {
      const e = await buildThinkLive("test query", {
        thinkConsent: THINK_CONSENT_PHRASE,
        modelConsent: "GO: invoke local LLM at gemma4",
        now: FIXED_NOW,
      });
      for (const h of e.context_manifest.memory.hit_summaries) {
        assert.ok(!("snippet" in h), "must not contain raw snippet");
        assert.ok(!("content" in h), "must not contain raw content");
        assert.ok(!("text" in h), "must not contain raw text");
        const allowed = new Set([
          "id",
          "score",
          "snippet_hash",
          "length_class",
        ]);
        for (const k of Object.keys(h)) {
          assert.ok(allowed.has(k), `unexpected field '${k}' in hit summary`);
        }
      }
    });
  });

  describe("no filesystem writes in isolated DEMA_HOME", () => {
    it("think-live creates no files in temp DEMA_HOME", async () => {
      const home = await mkdtemp(join(tmpdir(), "dema-think-live-"));
      await mkdir(join(home, "receipts"), { recursive: true });
      const old = process.env.DEMA_HOME;
      process.env.DEMA_HOME = home;
      try {
        const beforeReceipts = await readdir(join(home, "receipts"));
        await buildThinkLive("test query", {
          thinkConsent: THINK_CONSENT_PHRASE,
          modelConsent: "GO: invoke local LLM at gemma4",
          now: FIXED_NOW,
        });
        const afterReceipts = await readdir(join(home, "receipts"));
        const newFiles = afterReceipts.filter(
          (f) => !beforeReceipts.includes(f),
        );
        assert.equal(newFiles.length, 0, "no new files should be created");
      } finally {
        if (old) process.env.DEMA_HOME = old;
        else delete process.env.DEMA_HOME;
      }
    });
  });

  describe("model unreachable produces valid envelope", () => {
    it("returns valid envelope when model is unreachable", async () => {
      const e = await buildThinkLive("test query", {
        thinkConsent: THINK_CONSENT_PHRASE,
        modelConsent: "GO: invoke local LLM at gemma4",
        now: FIXED_NOW,
      });
      assert.equal(e.schema, "bizra.dema.think_live.v0.1");
      assert.ok(e.proof_hash);
      assert.equal(e.invocation.model_responded, false);
    });
  });

  describe("static source guard", () => {
    it("think-live.js does not contain direct Ollama/fetch/http calls", async () => {
      const src = await readFile(
        join(REPO_ROOT, "packages/think/src/think-live.js"),
        "utf8",
      );
      assert.ok(
        src.includes("invokeLocalLLM"),
        "must use invokeLocalLLM adapter",
      );
      assert.ok(
        !src.includes("localhost:11434"),
        "must not hardcode Ollama endpoint",
      );
      assert.ok(
        !src.includes('"node:http"') && !src.includes("'node:http'"),
        "must not import node:http",
      );
      assert.ok(
        !src.includes('"node:https"') && !src.includes("'node:https'"),
        "must not import node:https",
      );
    });
  });

  describe("formatThinkLive", () => {
    it("renders human-readable live report", async () => {
      const e = await buildThinkLive("test query", {
        thinkConsent: THINK_CONSENT_PHRASE,
        modelConsent: "GO: invoke local LLM at gemma4",
        now: FIXED_NOW,
      });
      const text = formatThinkLive(e);
      assert.match(text, /Think Live v0\.2A/);
      assert.match(text, /LIVE_INVOCATION/);
      assert.match(text, /Boundary Evidence/);
      assert.match(text, /Proof Hash/);
    });

    it("returns error string when envelope has error", () => {
      assert.equal(formatThinkLive({ error: "bad" }), "bad");
    });
  });
});
