// DEMA-TALK-LOOP-1A — pure talk-consent-preview kernel tests.
// Wraps the existing (hardened) llm-adapter PREVIEW path into a friendly talk
// consent ceremony. It makes NO model call (preview only): it shows the model,
// the exact consent phrase, and the boundary, so the operator can decide. The
// live invocation is DEMA-TALK-LOOP-1B under its own GO.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  buildDemaTalkPreview,
  DEMA_TALK_LOOP_PREVIEW_SCHEMA,
} from "../packages/core/src/dema-talk-loop-preview.js";
import { LLM_ADAPTER_MAX_PROMPT_LENGTH } from "../packages/core/src/llm-adapter.js";

const MODULE_PATH = fileURLToPath(
  new URL("../packages/core/src/dema-talk-loop-preview.js", import.meta.url),
);

// The CANONICAL effect keys that must be false — a talk PREVIEW invokes nothing.
// (Canonical vocabulary, not a coined parallel set — matches the 1B result.)
const CANONICAL_EFFECT_KEYS = [
  "model_invocation_performed",
  "model_loaded",
  "prompt_executed",
  "network_used",
  "external_call_performed",
  "runtime_execution_performed",
  "tool_executed",
];

function assertDeepFrozen(value, label = "value") {
  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`);
  if (!value || typeof value !== "object") return;
  for (const [k, c] of Object.entries(value)) {
    if (c && typeof c === "object") assertDeepFrozen(c, `${label}.${k}`);
  }
}

test("a whitelisted model → allowed, with the exact per-model consent phrase", () => {
  const p = buildDemaTalkPreview({ prompt: "hello", model: "qwen2.5" });
  assert.equal(p.model, "qwen2.5");
  assert.equal(p.model_allowed_in_whitelist, true);
  assert.equal(p.consent_required, "GO: invoke local LLM at qwen2.5");
});

test("a non-whitelisted model → not allowed (Dema would refuse)", () => {
  const p = buildDemaTalkPreview({ prompt: "hi", model: "gpt-4" });
  assert.equal(p.model_allowed_in_whitelist, false);
});

test("the kernel NEVER reports a model invocation — it is preview-only", () => {
  for (const model of ["qwen2.5", "gpt-4", ""]) {
    const p = buildDemaTalkPreview({ prompt: "x", model });
    assert.equal(p.model_invoked, false);
    assert.equal(p.mode, "preview_only");
  }
});

test("explanation discloses localhost-only, no-internet, no-fs, suggestion-only, preview", () => {
  const text = buildDemaTalkPreview({ prompt: "hi", model: "qwen2.5" })
    .explanation_lines.join(" ");
  assert.match(text, /local|localhost/i);
  assert.match(text, /internet|upload|remote/i);
  assert.match(text, /suggestion/i);
  assert.match(text, /preview|have not (called|invoked)/i);
});

test("target is localhost; an oversized prompt is flagged too-long", () => {
  const ok = buildDemaTalkPreview({ prompt: "short", model: "qwen2.5" });
  assert.equal(ok.target_is_localhost, true);
  assert.equal(ok.prompt_too_long, false);
  const big = buildDemaTalkPreview({
    prompt: "a".repeat(LLM_ADAPTER_MAX_PROMPT_LENGTH + 1),
    model: "qwen2.5",
  });
  assert.equal(big.prompt_too_long, true);
});

test("boundary is all-false — no call, no effect, on every path", () => {
  for (const model of ["qwen2.5", "gpt-4"]) {
    const p = buildDemaTalkPreview({ prompt: "x", model });
    for (const key of CANONICAL_EFFECT_KEYS) {
      assert.equal(p.boundary[key], false, `boundary.${key} must be false`);
    }
  }
});

test("next_safe_actions offers the exact-consent path and skip — never an autorun", () => {
  const p = buildDemaTalkPreview({ prompt: "x", model: "qwen2.5" });
  assert.ok(p.next_safe_actions.includes("grant_exact_consent_to_talk"));
  assert.ok(p.next_safe_actions.includes("skip"));
});

test("schema + truth_label exact; deep-frozen", () => {
  const p = buildDemaTalkPreview({ prompt: "x", model: "qwen2.5" });
  assert.equal(p.schema, "bizra.dema.talk_loop_preview.v0.1");
  assert.equal(p.schema, DEMA_TALK_LOOP_PREVIEW_SCHEMA);
  assert.equal(p.truth_label, "DEMA_TALK_LOOP_PREVIEW_ONLY");
  assertDeepFrozen(p, "preview");
});

test("what_this_does_not_prove states no model was called", () => {
  const text = buildDemaTalkPreview({ prompt: "x", model: "qwen2.5" })
    .what_this_does_not_prove.join(" ");
  assert.match(text, /no model|not.*call|not.*invok/i);
});

test("module imports no node fs/net/http/child_process/os directly", () => {
  const source = readFileSync(MODULE_PATH, "utf8");
  assert.doesNotMatch(
    source,
    /from\s+["']node:(fs|fs\/promises|net|http|https|child_process|os)["']/,
  );
});
