import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildLocalModelInventoryScan,
  buildLocalModelInventorySummary,
  wrapInventoryAsLocalScan,
  LOCAL_MODEL_INVENTORY_SCHEMA,
  LOCAL_MODEL_INVENTORY_TRUTH_LABEL,
  LOCAL_MODEL_INVENTORY_REQUIRED_BLOCKED_EFFECTS,
} from "../packages/core/src/local-model-inventory-scan.js";
import {
  isCanonicalBoundary,
  PREVIEW_BOUNDARY_CANONICAL_KEYS,
} from "../packages/core/src/preview-boundary.js";

function mockInventory(overrides = {}) {
  return {
    schema: "bizra.dema.model_inventory.v0.1",
    truth_label: "MEASURED_PARTIAL",
    generated_at: "2026-05-18T08:00:00.000Z",
    providers: {
      ollama: {
        reachable: true,
        available: [
          {
            id: "llama3.1:8b",
            source: "ollama",
            size_bytes: 4683075440,
            modified_at: "2026-05-18T00:00:00.000Z",
          },
          {
            id: "qwen3-coder-next:q4_K_M",
            source: "ollama",
            size_bytes: 51741611823,
            modified_at: "2026-04-20T05:59:13.275Z",
          },
          {
            id: "nomic-embed-text:latest",
            source: "ollama",
            size_bytes: 274302450,
            modified_at: "2026-04-12T01:54:10.349Z",
          },
        ],
      },
      lm_studio: { reachable: false, error: "fetch failed" },
      downloads: {
        root: "/home/test/Downloads",
        root_present: true,
        files: [
          {
            id: "Qwen3VL-8B.gguf",
            source: "filesystem",
            path: "/home/test/Downloads/Qwen3VL-8B.gguf",
            size_bytes: 8709519456,
            modified_at: "2026-05-13T00:00:00.000Z",
          },
        ],
      },
    },
    ...overrides,
  };
}

// =========================================================================
// CORE STRUCTURE TESTS (5)
// =========================================================================

test("Scan emits canonical schema + truth label + preview_only mode", () => {
  const s = wrapInventoryAsLocalScan(mockInventory());
  assert.equal(s.schema, LOCAL_MODEL_INVENTORY_SCHEMA);
  assert.equal(s.schema, "bizra.dema.local_model_inventory.v0.1");
  assert.equal(s.truth_label, LOCAL_MODEL_INVENTORY_TRUTH_LABEL);
  assert.equal(s.truth_label, "LOCALHOST_READ_ONLY_SCAN");
  assert.equal(s.mode, "preview_only");
});

test("Scan boundary is canonical 16-key all-false frozen object", () => {
  const s = wrapInventoryAsLocalScan(mockInventory());
  assert.ok(isCanonicalBoundary(s.boundary));
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(s.boundary[key], false, `boundary.${key} must be false`);
  }
});

test("Scan is deep-frozen at all sub-views", () => {
  const s = wrapInventoryAsLocalScan(mockInventory());
  assert.ok(Object.isFrozen(s));
  assert.ok(Object.isFrozen(s.providers));
  assert.ok(Object.isFrozen(s.providers.ollama));
  assert.ok(Object.isFrozen(s.providers.ollama.models));
  assert.ok(Object.isFrozen(s.blocked_effects));
  assert.ok(Object.isFrozen(s.boundary));
});

test("Scan surfaces total_models correctly across providers", () => {
  const s = wrapInventoryAsLocalScan(mockInventory());
  // 3 ollama + 0 lm_studio + 1 downloads = 4
  assert.equal(s.total_models, 4);
});

test("Scan declares required blocked_effects (no chain advance · no mint · etc.)", () => {
  const s = wrapInventoryAsLocalScan(mockInventory());
  for (const required of [
    "model_load",
    "prompt_execution",
    "public_network_use",
    "chain_advance",
    "receipt_mint",
    "federation_invocation",
  ]) {
    assert.ok(s.blocked_effects.includes(required), `must block ${required}`);
  }
});

// =========================================================================
// RECORD AUGMENTATION TESTS (5)
// =========================================================================

test("Record augmentation classifies ollama provider correctly", () => {
  const s = wrapInventoryAsLocalScan(mockInventory());
  const llama = s.providers.ollama.models.find(
    (m) => m.model_id === "llama3.1:8b",
  );
  assert.equal(llama.provider, "ollama");
  assert.equal(llama.file_type, "ollama");
  assert.equal(llama.source, "api");
  assert.equal(llama.load_status, "not_loaded_by_scan");
});

test("Record augmentation infers usable_for from naming · embedding case", () => {
  const s = wrapInventoryAsLocalScan(mockInventory());
  const embed = s.providers.ollama.models.find(
    (m) => m.model_id === "nomic-embed-text:latest",
  );
  assert.ok(
    embed.usable_for.includes("embedding"),
    `embedding model should classify · got ${JSON.stringify(embed.usable_for)}`,
  );
});

test("Record augmentation infers usable_for from naming · coding case", () => {
  const s = wrapInventoryAsLocalScan(mockInventory());
  const coder = s.providers.ollama.models.find((m) =>
    m.model_id.startsWith("qwen3-coder"),
  );
  assert.ok(
    coder.usable_for.includes("coding"),
    `coder model should classify · got ${JSON.stringify(coder.usable_for)}`,
  );
});

test("Record augmentation infers file_type from path · gguf case", () => {
  const s = wrapInventoryAsLocalScan(mockInventory());
  const gguf = s.providers.downloads.models.find((m) =>
    m.path.endsWith(".gguf"),
  );
  assert.equal(gguf.file_type, "gguf");
  assert.equal(gguf.source, "filesystem");
});

test("Record augmentation handles missing fields with safe defaults", () => {
  const malformed = {
    providers: {
      ollama: { reachable: true, available: [{ size_bytes: "not-a-number" }] },
    },
  };
  const s = wrapInventoryAsLocalScan(malformed);
  const record = s.providers.ollama.models[0];
  assert.equal(record.model_id, "unknown");
  assert.equal(record.size_bytes, 0);
  assert.equal(record.path, null);
  assert.equal(record.load_status, "not_loaded_by_scan");
});

// =========================================================================
// ADVERSARIAL INPUT TESTS (4)
// =========================================================================

test("Adversarial · non-object inventory yields empty-but-canonical scan", () => {
  const s = wrapInventoryAsLocalScan(null);
  assert.equal(s.schema, LOCAL_MODEL_INVENTORY_SCHEMA);
  assert.equal(s.total_models, 0);
  assert.ok(isCanonicalBoundary(s.boundary));
});

test("Adversarial · models with function/symbol fields are filtered", () => {
  const adversarial = {
    providers: {
      ollama: {
        reachable: true,
        available: [
          { id: "ok-model:1b", source: "ollama", size_bytes: 100 },
          { id: () => "malicious", source: "ollama", size_bytes: 100 },
          { id: Symbol("evil"), source: "ollama", size_bytes: 100 },
        ],
      },
    },
  };
  const s = wrapInventoryAsLocalScan(adversarial);
  // All 3 are present but malicious id values are coerced to "unknown"
  assert.equal(s.providers.ollama.model_count, 3);
  const ids = s.providers.ollama.models.map((m) => m.model_id);
  assert.ok(ids.includes("ok-model:1b"));
  assert.equal(ids.filter((id) => id === "unknown").length, 2);
});

test("Adversarial · non-localhost endpoint reachable=false propagates honestly", () => {
  const adversarial = mockInventory({
    providers: {
      ollama: { reachable: false, error: "non_localhost_endpoint" },
      lm_studio: { reachable: false, error: "fetch failed" },
      downloads: { root: "/x", root_present: false, files: [] },
    },
  });
  const s = wrapInventoryAsLocalScan(adversarial);
  assert.equal(s.providers.ollama.reachable, false);
  assert.equal(s.providers.ollama.error, "non_localhost_endpoint");
  assert.equal(s.total_models, 0);
});

test("Adversarial · routing_readiness honestly reports false when no models", () => {
  const empty = wrapInventoryAsLocalScan({});
  const summary = buildLocalModelInventorySummary(empty);
  assert.equal(summary.routing_readiness.has_chat_capable, false);
  assert.equal(summary.routing_readiness.has_embedding_capable, false);
  assert.equal(summary.routing_readiness.has_coding_capable, false);
  assert.equal(summary.routing_readiness.has_vision_capable, false);
});

// =========================================================================
// HUGGINGFACE CACHE + SECONDARY ROOT TESTS (3)
// =========================================================================

test("HF cache scan included in providers when provided · model_count > 0", () => {
  const inv = mockInventory();
  const hfMock = Object.freeze({
    root: "/home/test/.cache/huggingface/hub",
    root_present: true,
    model_count: 2,
    models: Object.freeze([
      Object.freeze({
        provider: "huggingface",
        model_id: "hexgrad/Kokoro-82M",
        file_type: "hf_snapshot",
        source: "filesystem",
        load_status: "not_loaded_by_scan",
        path: "/x",
        size_bytes: 0,
        modified_at: null,
        usable_for: Object.freeze(["text_to_speech"]),
      }),
      Object.freeze({
        provider: "huggingface",
        model_id: "Systran/faster-whisper-large-v3",
        file_type: "hf_snapshot",
        source: "filesystem",
        load_status: "not_loaded_by_scan",
        path: "/x",
        size_bytes: 0,
        modified_at: null,
        usable_for: Object.freeze(["speech_to_text"]),
      }),
    ]),
  });
  const s = wrapInventoryAsLocalScan(inv, { hfScan: hfMock });
  assert.equal(s.providers.huggingface_cache.model_count, 2);
  assert.equal(s.total_models, 6); // 3 ollama + 1 downloads + 2 hf
});

test("Secondary filesystem scans propagate to total_models honestly", () => {
  const inv = mockInventory();
  const secondaryMock = [
    Object.freeze({
      root: "/data/bizra/models",
      root_present: true,
      model_count: 1,
      models: Object.freeze([
        Object.freeze({
          provider: "filesystem",
          model_id: "WhiteRabbitNeo.gguf",
          file_type: "gguf",
          source: "filesystem",
          load_status: "not_loaded_by_scan",
          path: "/x",
          size_bytes: 4683074752,
          modified_at: null,
          usable_for: Object.freeze(["unknown"]),
        }),
      ]),
    }),
  ];
  const s = wrapInventoryAsLocalScan(inv, { secondaryScans: secondaryMock });
  assert.equal(s.providers.secondary_filesystem_scans.length, 1);
  assert.equal(s.total_models, 5); // 3 ollama + 1 downloads + 1 secondary
});

test("Summary fits within line budget pretty-printed", () => {
  const inv = mockInventory();
  const scan = wrapInventoryAsLocalScan(inv);
  const summary = buildLocalModelInventorySummary(scan);
  const lines = JSON.stringify(summary, null, 2).split("\n").length;
  assert.ok(lines <= 41, `summary must be <= 41 lines, got ${lines}`);
});

// =========================================================================
// INTEGRATION TEST · full async scan with mocked collectFn (1)
// =========================================================================

test("buildLocalModelInventoryScan composes inventory + HF + secondary without I/O surprises", async () => {
  const mockCollect = async () => mockInventory();
  const s = await buildLocalModelInventoryScan({
    collectFn: mockCollect,
    hfCacheRoot: "/nonexistent/path/that/does/not/exist",
    secondaryRoots: ["/nonexistent/secondary/path"],
  });
  assert.equal(s.schema, LOCAL_MODEL_INVENTORY_SCHEMA);
  assert.equal(s.truth_label, LOCAL_MODEL_INVENTORY_TRUTH_LABEL);
  assert.equal(s.providers.huggingface_cache.root_present, false);
  assert.equal(s.providers.secondary_filesystem_scans[0].root_present, false);
  assert.ok(isCanonicalBoundary(s.boundary));
});

// =========================================================================
// EXPORTS + CONSTANTS (2)
// =========================================================================

test("Exported constants are present and frozen", () => {
  assert.equal(typeof LOCAL_MODEL_INVENTORY_SCHEMA, "string");
  assert.equal(typeof LOCAL_MODEL_INVENTORY_TRUTH_LABEL, "string");
  assert.ok(Array.isArray(LOCAL_MODEL_INVENTORY_REQUIRED_BLOCKED_EFFECTS));
  assert.ok(Object.isFrozen(LOCAL_MODEL_INVENTORY_REQUIRED_BLOCKED_EFFECTS));
  assert.ok(
    LOCAL_MODEL_INVENTORY_REQUIRED_BLOCKED_EFFECTS.includes(
      "public_network_use",
    ),
  );
});

test("Summary preserves canonical 16-key boundary from source scan", () => {
  const inv = mockInventory();
  const scan = wrapInventoryAsLocalScan(inv);
  const summary = buildLocalModelInventorySummary(scan);
  assert.ok(isCanonicalBoundary(summary.boundary));
});
