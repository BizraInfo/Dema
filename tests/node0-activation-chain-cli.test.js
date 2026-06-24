import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyNode0ActivationChainPreview } from "../packages/core/src/node0-activation-chain-preview.js";
import { buildModelEvalBaseline } from "../packages/core/src/model-eval-baseline.js";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

function makeBaseline() {
  return buildModelEvalBaseline({
    generated_at_iso: "2026-06-24T00:00:00.000Z",
    suite_id: "bizra-local-small",
    provider_discovery: {},
    models_tested: ["ollama:fast", "ollama:wise"],
    results_by_model: {
      "ollama:fast": {
        tasks: {
          endpoint_reachable: { reachable: true, latency_ms: 80, output: "" },
          latency_ms: { reachable: true, latency_ms: 80, output: "ok" },
          json_obedience: { reachable: true, latency_ms: 80, output: '{"ok":true}' },
          code_microtask: { reachable: true, latency_ms: 80, output: "" },
          no_overclaim: { reachable: true, latency_ms: 80, output: "small" },
          truth_boundary: { reachable: true, latency_ms: 80, output: "x" },
        },
      },
      "ollama:wise": {
        tasks: {
          endpoint_reachable: { reachable: true, latency_ms: 250, output: "" },
          latency_ms: { reachable: true, latency_ms: 250, output: "ok" },
          json_obedience: { reachable: true, latency_ms: 250, output: '{"ok":true}' },
          code_microtask: { reachable: true, latency_ms: 250, output: "def f():\n return 42" },
          no_overclaim: { reachable: true, latency_ms: 250, output: "careful" },
          truth_boundary: { reachable: true, latency_ms: 250, output: "cannot" },
        },
      },
    },
  });
}

test("dema node0 chain --json composes ladder + route + plan + blackboard", async () => {
  const dir = await mkdtemp(join(tmpdir(), "node0-chain-"));
  const file = join(dir, "baseline.json");
  await writeFile(file, JSON.stringify(makeBaseline()));
  const out = execFileSync(
    "node",
    [
      BIN,
      "node0",
      "chain",
      "--pain",
      "VRAM blocks eval",
      "--goal",
      "fair routing",
      "--baseline",
      file,
      "--json",
    ],
    { env: { ...process.env, NO_COLOR: "1", DEMA_NO_TUI: "1" }, timeout: 30000 },
  ).toString();
  const report = JSON.parse(out);
  assert.equal(report.chain_status, "PREVIEW_COMPOSED");
  assert.equal(verifyNode0ActivationChainPreview(report).ok, true);
  assert.equal(report.talk_env_hint?.provider, "ollama");
});

test("dema node0 chain --self-loop embeds autopoietic posture preview", async () => {
  const dir = await mkdtemp(join(tmpdir(), "node0-chain-sl-"));
  const file = join(dir, "baseline.json");
  await writeFile(file, JSON.stringify(makeBaseline()));
  const out = execFileSync(
    "node",
    [
      BIN,
      "node0",
      "chain",
      "--pain",
      "VRAM",
      "--goal",
      "fair routing",
      "--baseline",
      file,
      "--self-loop",
      "--json",
    ],
    { env: { ...process.env, NO_COLOR: "1", DEMA_NO_TUI: "1" }, timeout: 30000 },
  ).toString();
  const report = JSON.parse(out);
  assert.equal(report.chain_status, "PREVIEW_COMPOSED");
  assert.equal(report.autopoietic_posture?.not_autonomous_runtime, true);
  assert.equal(
    report.components.self_loop?.schema,
    "bizra.dema.peak_self_loop_preview.v0.1",
  );
  assert.equal(verifyNode0ActivationChainPreview(report).ok, true);
});
