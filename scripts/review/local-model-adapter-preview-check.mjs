#!/usr/bin/env node
// LOCAL-MODEL-ADAPTER-PREVIEW-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runLocalModelAdapterPreview,
  LOCAL_MODEL_ADAPTER_PREVIEW_SCHEMA,
  LOCAL_MODEL_ADAPTER_PREVIEW_TRUTH_LABEL,
  LOCAL_MODEL_ADAPTER_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/local-model-adapter-preview.js";

const JSON_MODE = process.argv.includes("--json");

// Canonical deterministic fixture — mirrors the real `dema models discover`
// report shape (bizra.dema.model_discover.v0.1). No fs, no network: the gate
// proves the adapter CONTRACT, not live runtime reachability.
const GATE_FIXTURE_INPUT = {
  discovery: {
    schema: "bizra.dema.model_discover.v0.1",
    provider_discovery: {
      ollama: { reachable: true, model_count: 2 },
      lm_studio: { reachable: false, model_count: 0 },
      llamacpp: { reachable: false, model_count: 0 },
    },
    models: ["ollama:whiterabbitneo-v3:7b-q4_K_M", "ollama:nomic-embed-text:latest"],
  },
};

export function runLocalModelAdapterPreviewCheck() {
  return runLocalModelAdapterPreview({ consent: LOCAL_MODEL_ADAPTER_PREVIEW_GO_PHRASE, input: GATE_FIXTURE_INPUT });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runLocalModelAdapterPreviewCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - LOCAL-MODEL-ADAPTER-PREVIEW-1A");
    console.log(`  schema: ${LOCAL_MODEL_ADAPTER_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${LOCAL_MODEL_ADAPTER_PREVIEW_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
