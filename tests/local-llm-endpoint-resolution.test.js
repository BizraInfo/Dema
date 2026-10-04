// PERIMETER-BRIDGE-PARITY-1A (TASK-044) — one endpoint, one resolver.
//
// Measured 2026-07-28: `dema models discover` read process.env.DEMA_OLLAMA_URL
// (model-inventory.js) while `dema llm-invoke` had zero references to it
// (llm-adapter.js) and used its own default. An operator following ADR-042 and
// exporting DEMA_OLLAMA_URL would get Dema listing models from the bridged
// endpoint and invoking a different one — reporting models it cannot invoke,
// and invoking a model it never listed.
//
// Doctrine: "Probabilistic Core, Deterministic Perimeter." Two surfaces must
// never derive the same fact from different sources. These tests pin the single
// resolver and its precedence so the split cannot silently return.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  DEFAULT_OLLAMA_URL,
  DEFAULT_LM_STUDIO_URL,
  resolveLocalLlmBase,
} from "../packages/models/src/model-common.js";

// ── precedence: explicit > env bridge > loopback default ─────────────────────

test("resolveLocalLlmBase: explicit argument wins over the env bridge", () => {
  const resolved = resolveLocalLlmBase({
    explicit: "http://127.0.0.1:9999",
    envValue: "http://127.0.0.1:8888",
    fallback: DEFAULT_OLLAMA_URL,
  });
  assert.equal(resolved, "http://127.0.0.1:9999");
});

test("resolveLocalLlmBase: env bridge wins over the default when no explicit", () => {
  const resolved = resolveLocalLlmBase({
    envValue: "http://127.0.0.1:8888",
    fallback: DEFAULT_OLLAMA_URL,
  });
  assert.equal(resolved, "http://127.0.0.1:8888");
});

test("resolveLocalLlmBase: falls back to the loopback default when nothing is supplied", () => {
  assert.equal(
    resolveLocalLlmBase({ fallback: DEFAULT_OLLAMA_URL }),
    DEFAULT_OLLAMA_URL,
  );
});

// ── the localhost-only boundary survives resolution, whatever the source ─────

for (const [label, input] of [
  ["explicit", { explicit: "http://evil.example:11434" }],
  ["env bridge", { envValue: "http://evil.example:11434" }],
  ["localhost-prefix smuggling", { envValue: "http://localhost.evil.example:11434" }],
  ["userinfo smuggling", { envValue: "http://localhost@evil.example:11434" }],
  ["https non-loopback", { explicit: "https://example.com:11434" }],
]) {
  test(`resolveLocalLlmBase: refuses a non-loopback ${label} and falls back`, () => {
    const resolved = resolveLocalLlmBase({
      ...input,
      fallback: DEFAULT_OLLAMA_URL,
    });
    assert.equal(
      resolved,
      DEFAULT_OLLAMA_URL,
      `non-loopback ${label} must never be resolved`,
    );
  });
}

// ── malformed and empty input degrade to the default, never throw ────────────

for (const bad of [null, undefined, "", "   ", "not-a-url", 42, {}]) {
  test(`resolveLocalLlmBase: ignores malformed input ${JSON.stringify(bad)}`, () => {
    assert.equal(
      resolveLocalLlmBase({ explicit: bad, fallback: DEFAULT_OLLAMA_URL }),
      DEFAULT_OLLAMA_URL,
    );
  });
}

// ── no default may depend on a resolver (LOCAL-LLM-BASE-RESOLVER-1A) ─────────

test("shipped defaults are literal loopback IPs, never the hostname", () => {
  for (const base of [DEFAULT_OLLAMA_URL, DEFAULT_LM_STUDIO_URL]) {
    assert.ok(base.startsWith("http://127.0.0.1"), base);
    assert.doesNotMatch(base, /localhost/);
  }
});

// ── the parity property itself: both surfaces agree ──────────────────────────

test("PARITY: inventory and adapter resolve the SAME endpoint from the same inputs", async () => {
  const bridged = "http://127.0.0.1:8899";
  const [{ collectModelInventory }, adapter] = await Promise.all([
    import("../packages/models/src/model-inventory.js"),
    import("../packages/core/src/llm-adapter.js"),
  ]);
  assert.equal(typeof collectModelInventory, "function");

  // Both must route through the shared resolver, so the same env bridge
  // produces the same endpoint on each surface.
  const previous = process.env.DEMA_OLLAMA_URL;
  process.env.DEMA_OLLAMA_URL = bridged;
  try {
    const preview = adapter.buildLLMInvocationPreview({
      model: "any-model",
      prompt: "parity probe",
    });
    assert.equal(
      preview.target_endpoint,
      bridged,
      "llm-invoke must honour DEMA_OLLAMA_URL exactly as models discover does",
    );
    assert.equal(preview.target_is_localhost, true);
  } finally {
    if (previous === undefined) delete process.env.DEMA_OLLAMA_URL;
    else process.env.DEMA_OLLAMA_URL = previous;
  }
});
