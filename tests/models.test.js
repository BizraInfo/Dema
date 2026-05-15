import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  collectModelInventory,
  formatModelInventory
} from "../packages/models/src/model-inventory.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

test("collectModelInventory inventories Ollama, LM Studio, downloads, and exposure read-only", async () => {
  const downloadsRoot = await mkdtemp(join(tmpdir(), "dema-models-downloads-"));
  await writeFile(join(downloadsRoot, "GLM-4.7-Flash-Q4_K_M.gguf"), "model-bytes");
  await writeFile(join(downloadsRoot, "notes.txt"), "not a model");
  await mkdir(join(downloadsRoot, "vision"), { recursive: true });
  await writeFile(join(downloadsRoot, "vision", "Qwen3VL-8B-Uncensored-Aggressive-Q8_0.gguf"), "model-bytes");
  await writeFile(join(downloadsRoot, "vision", "mmproj-Qwen3VL-f16.gguf"), "x");

  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(String(url));
    if (String(url).endsWith("/api/tags")) {
      return jsonResponse({
        models: [
          { name: "qwen3-coder-next:q4_K_M", size: 51741611823 },
          { name: "gemma4:26b-bizra-16k", size: 17987581261 },
          { name: "deepseek-r1:7b", size: 4683072000 },
          { name: "nomic-embed-text:latest", size: 274302450 }
        ]
      });
    }
    if (String(url).endsWith("/api/ps")) {
      return jsonResponse({
        models: [
          { name: "qwen3-coder-next:q4_K_M", size: 51741611823 }
        ]
      });
    }
    if (String(url).endsWith("/v1/models")) {
      return jsonResponse({
        data: [
          { id: "qwen3.6-35b-a3b-uncensored-hauhaucs-aggressive" },
          { id: "google/gemma-4-e4b" },
          { id: "text-embedding-nomic-embed-text-v1.5" }
        ]
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const inventory = await collectModelInventory({
    downloadsRoot,
    fetchImpl,
    tcpBindings: [
      { port: 11434, address: "127.0.0.1" },
      { port: 1234, address: "0.0.0.0" }
    ]
  });

  assert.equal(inventory.schema, "bizra.dema.model_inventory.v0.1");
  assert.equal(inventory.boundary.inference_invoked, false);
  assert.equal(inventory.boundary.local_http_probe_performed, true);
  assert.equal(inventory.boundary.external_network_probe_performed, false);
  assert.equal(inventory.boundary.tcp_listener_probe_performed, true);
  assert.equal(inventory.providers.ollama.model_count, 4);
  assert.equal(inventory.providers.ollama.active_count, 1);
  assert.equal(inventory.providers.lm_studio.model_count, 3);
  assert.equal(inventory.providers.downloads.model_count, 3);
  assert.equal(inventory.safety.exposures.length, 1);
  assert.equal(inventory.safety.exposures[0].provider, "lm_studio");
  assert.equal(inventory.safety.model_name_flags.length, 2);
  assert.ok(
    inventory.safety.model_name_flags.some((f) => /Uncensored-Aggressive/.test(f.model))
  );
  assert.equal(inventory.routing_recommendations.coding.model, "qwen3-coder-next:q4_K_M");
  assert.equal(inventory.routing_recommendations.reasoning.model, "deepseek-r1:7b");
  assert.equal(inventory.routing_recommendations.embedding.model, "nomic-embed-text:latest");
  assert.notEqual(inventory.routing_recommendations.fast.model, "mmproj-Qwen3VL-f16.gguf");

  assert.deepEqual(requested.sort(), [
    "http://127.0.0.1:11434/api/ps",
    "http://127.0.0.1:11434/api/tags",
    "http://127.0.0.1:1234/v1/models"
  ]);

  const formatted = formatModelInventory(inventory);
  assert.match(formatted, /DEMA Local Model Inventory/);
  assert.match(formatted, /qwen3-coder-next:q4_K_M/);
  assert.match(formatted, /LAN-exposed/);
  assert.match(formatted, /Boundary: read-only; local probes only; no model invoked/);
});

test("collectModelInventory refuses non-local model server endpoints", async () => {
  const downloadsRoot = await mkdtemp(join(tmpdir(), "dema-models-external-"));
  let called = false;
  const inventory = await collectModelInventory({
    ollamaUrl: "https://models.example.test",
    lmStudioUrl: "https://lm.example.test",
    downloadsRoot,
    fetchImpl: async () => {
      called = true;
      throw new Error("should not fetch external endpoints");
    },
    tcpBindings: []
  });

  assert.equal(called, false);
  assert.equal(inventory.providers.ollama.reachable, false);
  assert.equal(inventory.providers.ollama.error, "non-local endpoint refused");
  assert.equal(inventory.providers.lm_studio.reachable, false);
  assert.equal(inventory.providers.lm_studio.error, "non-local endpoint refused");
  assert.equal(inventory.boundary.external_network_probe_performed, false);
});

test("dema models prints a human-readable local model inventory", async () => {
  const downloadsRoot = await mkdtemp(join(tmpdir(), "dema-models-cli-"));
  await writeFile(join(downloadsRoot, "Nemotron3-Nano-4B-Q8_K_P.gguf"), "model-bytes");

  const server = createServer((req, res) => {
    const json = (body) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.url === "/api/tags") {
      json({ models: [{ name: "deepseek-r1:7b", size: 4683075440 }] });
      return;
    }
    if (req.url === "/api/ps") {
      json({ models: [] });
      return;
    }
    if (req.url === "/v1/models") {
      json({ data: [{ id: "google/gemma-4-e4b" }] });
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  const endpoint = await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve(`http://127.0.0.1:${port}`);
    });
  });

  try {
    const { stdout } = await execFileAsync("node", [cliPath, "models"], {
      env: {
        ...process.env,
        DEMA_OLLAMA_URL: endpoint,
        DEMA_LM_STUDIO_URL: endpoint,
        DEMA_MODEL_DOWNLOADS_ROOT: downloadsRoot,
        DEMA_MODELS_SKIP_TCP: "1"
      }
    });
    assert.match(stdout, /DEMA Local Model Inventory/);
    assert.match(stdout, /Ollama: reachable/);
    assert.match(stdout, /LM Studio: reachable/);
    assert.match(stdout, /Nemotron3-Nano-4B-Q8_K_P\.gguf/);
    assert.match(stdout, /Boundary: read-only; local probes only; no model invoked/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
