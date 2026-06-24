// MODEL-ROUTING-PREVIEW-1A — CLI tests (`dema eval route`).

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildModelEvalBaseline } from "../packages/core/src/model-eval-baseline.js";
import { sha256, stableStringify } from "../packages/consent/src/consent-common.js";

const execFileAsync = promisify(execFile);
const demaCli = fileURLToPath(new URL("../bin/dema", import.meta.url));
const env = { ...process.env, NODE_ENV: "test" };

function tasksFor(o) {
  const t = {};
  for (const id of ["endpoint_reachable", "latency_ms", "json_obedience", "code_microtask", "no_overclaim", "truth_boundary"]) {
    t[id] = { reachable: o.reachable, latency_ms: o.latency, output: o[id] ?? "" };
  }
  return t;
}
function makeBaseline() {
  return buildModelEvalBaseline({
    generated_at_iso: "2026-06-24T00:00:00.000Z",
    suite_id: "bizra-local-small",
    provider_discovery: {},
    models_tested: ["ollama:fast", "ollama:wise"],
    results_by_model: {
      "ollama:fast": { tasks: tasksFor({ reachable: true, latency: 80, json_obedience: '{"ok":true}', no_overclaim: "small local model", truth_boundary: "price will be 100000" }) },
      "ollama:wise": { tasks: tasksFor({ reachable: true, latency: 250, json_obedience: '{"ok":true}', code_microtask: "def f():\n return 42", no_overclaim: "careful local model", truth_boundary: "I cannot predict that" }) },
    },
  });
}
async function run(args) {
  try {
    const r = await execFileAsync("node", [demaCli, ...args], { env });
    return { code: 0, out: `${r.stdout}${r.stderr}` };
  } catch (e) {
    return { code: e.code ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

test("eval route --json on a valid baseline → deterministic preview, exit 0", async () => {
  const dir = await mkdtemp(join(tmpdir(), "route-"));
  const file = join(dir, "baseline.json");
  await writeFile(file, JSON.stringify(makeBaseline()));
  const { code, out } = await run(["eval", "route", "--baseline", file, "--json"]);
  assert.equal(code, 0);
  const p = JSON.parse(out);
  assert.equal(p.schema, "bizra.dema.model_routing_preview.v0.1");
  assert.equal(p.truth_label, "MODEL_ROUTING_PREVIEW_LOCAL_ONLY");
  assert.equal(p.assignments.coordinator.model, "ollama:fast");
  assert.equal(p.assignments.reasoner.model, "ollama:wise");
  assert.ok(p.preview_hash);
});

test("eval route plain mode prints PREVIEW + role arrows", async () => {
  const dir = await mkdtemp(join(tmpdir(), "route-"));
  const file = join(dir, "baseline.json");
  await writeFile(file, JSON.stringify(makeBaseline()));
  const { code, out } = await run(["eval", "route", "--baseline", file]);
  assert.equal(code, 0);
  assert.match(out, /Model routing PREVIEW/);
  assert.match(out, /coordinator\s+→/);
});

test("missing --baseline → exit 1", async () => {
  const { code, out } = await run(["eval", "route"]);
  assert.notEqual(code, 0);
  assert.match(out, /Missing path|baseline/i);
});

test("relative path → exit 1", async () => {
  const { code, out } = await run(["eval", "route", "--baseline", "relative.json"]);
  assert.notEqual(code, 0);
  assert.match(out, /absolute path/i);
});

test("tampered baseline → exit 1 + input_baseline_invalid", async () => {
  const dir = await mkdtemp(join(tmpdir(), "route-"));
  const file = join(dir, "tampered.json");
  const b = makeBaseline();
  const { baseline_hash, ...body } = b;
  const forged = { ...body, boundary: { ...body.boundary, mutation_performed: true } };
  await writeFile(file, JSON.stringify({ ...forged, baseline_hash: sha256(stableStringify(forged)) }));
  const { code, out } = await run(["eval", "route", "--baseline", file, "--json"]);
  assert.equal(code, 1);
  assert.match(out, /input_baseline_invalid/);
});
