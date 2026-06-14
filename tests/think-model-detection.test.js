import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkModelReadiness } from "../packages/think/src/think-dry-run.js";

let modelsDir;
let savedEnv;

function makeManifestFile(base, model, tag) {
  const dir = join(
    base,
    "manifests",
    "registry.ollama.ai",
    "library",
    model,
    tag,
  );
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "manifest"), JSON.stringify({ fake: true }));
}

describe("checkModelReadiness — disk manifest detection", () => {
  before(() => {
    modelsDir = mkdtempSync(join(tmpdir(), "dema-ollama-models-"));
    makeManifestFile(modelsDir, "gemma4", "26b");
    makeManifestFile(modelsDir, "deepseek-r1", "7b");
    makeManifestFile(modelsDir, "nomic-embed-text", "latest");
    savedEnv = process.env.OLLAMA_MODELS;
    process.env.OLLAMA_MODELS = modelsDir;
  });

  after(() => {
    if (savedEnv === undefined) {
      delete process.env.OLLAMA_MODELS;
    } else {
      process.env.OLLAMA_MODELS = savedEnv;
    }
  });

  it("ollama_installed is true when OLLAMA_MODELS dir exists", async () => {
    const result = await checkModelReadiness();
    assert.equal(result.ollama_installed, true);
  });

  it("ollama_models_dir reflects the env-resolved path", async () => {
    const result = await checkModelReadiness();
    assert.equal(result.ollama_models_dir, modelsDir);
  });

  it("available_models includes gemma4:26b", async () => {
    const result = await checkModelReadiness();
    assert.ok(
      result.available_models.includes("gemma4:26b"),
      `expected gemma4:26b in ${JSON.stringify(result.available_models)}`,
    );
  });

  it("available_models includes deepseek-r1:7b", async () => {
    const result = await checkModelReadiness();
    assert.ok(
      result.available_models.includes("deepseek-r1:7b"),
      `expected deepseek-r1:7b in ${JSON.stringify(result.available_models)}`,
    );
  });

  it("available_models excludes embed models", async () => {
    const result = await checkModelReadiness();
    const embedsFound = result.available_models.filter((m) =>
      m.includes("embed"),
    );
    assert.deepStrictEqual(
      embedsFound,
      [],
      `embed models must be excluded, found: ${JSON.stringify(embedsFound)}`,
    );
  });

  it("models_source is disk_manifests when API is unreachable", async () => {
    const result = await checkModelReadiness();
    if (result.broker_reachable !== "LOCALHOST_API_OBSERVED") {
      assert.equal(result.models_source, "disk_manifests");
    }
  });

  it("model_readiness_evidence is DISK_MANIFESTS_OBSERVED when API unreachable and models found", async () => {
    const result = await checkModelReadiness();
    if (result.broker_reachable !== "LOCALHOST_API_OBSERVED") {
      assert.equal(result.model_readiness_evidence, "DISK_MANIFESTS_OBSERVED");
    }
  });

  it("recommended_model is set when disk models are found", async () => {
    const result = await checkModelReadiness();
    if (result.broker_reachable !== "LOCALHOST_API_OBSERVED") {
      assert.ok(
        result.recommended_model !== null,
        "recommended_model must be set when disk models found",
      );
    }
  });
});
