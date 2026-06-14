import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverLocalRuntimes } from "../packages/think/src/think-dry-run.js";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), "dema-runtime-discovery-"));
}

function writeGguf(dir, name, content = "") {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), content);
}

function makeOllamaManifest(base, model, tag) {
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

// ---------------------------------------------------------------------------
// Suite A — lm_studio detection
// ---------------------------------------------------------------------------

describe("discoverLocalRuntimes — lm_studio", () => {
  let root;

  before(() => {
    root = makeTmpDir();
    // pub/repo/Model-Q4_K_M.gguf  (nested — lm_studio uses deep scan)
    writeGguf(join(root, "pub", "repo"), "Model-Q4_K_M.gguf");
  });

  after(() => rmSync(root, { recursive: true, force: true }));

  it("installed is true when lmStudioDir exists", async () => {
    const r = await discoverLocalRuntimes({ lmStudioDir: root, ggufDirs: [] });
    assert.equal(r.lm_studio.installed, true);
  });

  it("detects the nested gguf file", async () => {
    const r = await discoverLocalRuntimes({ lmStudioDir: root, ggufDirs: [] });
    assert.equal(r.lm_studio.models.length, 1);
    assert.equal(r.lm_studio.models[0].name, "Model-Q4_K_M.gguf");
  });

  it("infers quant Q4_K_M from filename", async () => {
    const r = await discoverLocalRuntimes({ lmStudioDir: root, ggufDirs: [] });
    assert.equal(r.lm_studio.models[0].quant, "Q4_K_M");
  });

  it("size_bytes is a non-negative number", async () => {
    const r = await discoverLocalRuntimes({ lmStudioDir: root, ggufDirs: [] });
    const m = r.lm_studio.models[0];
    assert.ok(typeof m.size_bytes === "number" && m.size_bytes >= 0);
  });

  it("mtime_iso is an ISO string", async () => {
    const r = await discoverLocalRuntimes({ lmStudioDir: root, ggufDirs: [] });
    const m = r.lm_studio.models[0];
    assert.ok(typeof m.mtime_iso === "string" && m.mtime_iso.includes("T"));
  });

  it("models_source is filesystem", async () => {
    const r = await discoverLocalRuntimes({ lmStudioDir: root, ggufDirs: [] });
    assert.equal(r.lm_studio.models_source, "filesystem");
  });

  it("installed is false when dir does not exist", async () => {
    const r = await discoverLocalRuntimes({
      lmStudioDir: join(root, "nonexistent"),
      ggufDirs: [],
    });
    assert.equal(r.lm_studio.installed, false);
    assert.deepStrictEqual(r.lm_studio.models, []);
  });
});

// ---------------------------------------------------------------------------
// Suite B — loose_gguf detection
// ---------------------------------------------------------------------------

describe("discoverLocalRuntimes — loose_gguf", () => {
  let root;

  before(() => {
    root = makeTmpDir();
    writeGguf(root, "llama3-Q8_0.gguf");
    writeGguf(root, "mistral-f16.gguf");
  });

  after(() => rmSync(root, { recursive: true, force: true }));

  it("detects both gguf files", async () => {
    const r = await discoverLocalRuntimes({
      lmStudioDir: join(root, "none"),
      ggufDirs: [root],
    });
    assert.equal(r.loose_gguf.models.length, 2);
  });

  it("installed is true when files found", async () => {
    const r = await discoverLocalRuntimes({
      lmStudioDir: join(root, "none"),
      ggufDirs: [root],
    });
    assert.equal(r.loose_gguf.installed, true);
  });

  it("infers Q8_0 quant", async () => {
    const r = await discoverLocalRuntimes({
      lmStudioDir: join(root, "none"),
      ggufDirs: [root],
    });
    const q8 = r.loose_gguf.models.find((m) => m.name.includes("Q8_0"));
    assert.ok(q8, "expected Q8_0 model");
    assert.equal(q8.quant, "Q8_0");
  });

  it("infers F16 quant (case-insensitive match)", async () => {
    const r = await discoverLocalRuntimes({
      lmStudioDir: join(root, "none"),
      ggufDirs: [root],
    });
    const f16 = r.loose_gguf.models.find((m) => m.name.includes("f16"));
    assert.ok(f16, "expected f16 model");
    assert.equal(f16.quant, "F16");
  });

  it("installed is false when dir has no gguf files", async () => {
    const emptyDir = makeTmpDir();
    try {
      const r = await discoverLocalRuntimes({
        lmStudioDir: join(root, "none"),
        ggufDirs: [emptyDir],
      });
      assert.equal(r.loose_gguf.installed, false);
      assert.deepStrictEqual(r.loose_gguf.models, []);
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Suite C — llmfit detection
// ---------------------------------------------------------------------------

describe("discoverLocalRuntimes — llmfit", () => {
  let root;
  let realFile;

  before(() => {
    root = makeTmpDir();
    realFile = join(root, "llmfit");
    writeFileSync(realFile, "#!/bin/sh\necho ok");
  });

  after(() => rmSync(root, { recursive: true, force: true }));

  it("installed is true when llmfitPath points to existing file", async () => {
    const r = await discoverLocalRuntimes({
      llmfitPath: realFile,
      lmStudioDir: join(root, "none"),
      ggufDirs: [],
    });
    assert.equal(r.llmfit.installed, true);
  });

  it("installed is false when llmfitPath does not exist", async () => {
    const r = await discoverLocalRuntimes({
      llmfitPath: join(root, "does_not_exist"),
      lmStudioDir: join(root, "none"),
      ggufDirs: [],
    });
    assert.equal(r.llmfit.installed, false);
  });

  it("mode is optional_external_tool", async () => {
    const r = await discoverLocalRuntimes({
      llmfitPath: realFile,
      lmStudioDir: join(root, "none"),
      ggufDirs: [],
    });
    assert.equal(r.llmfit.mode, "optional_external_tool");
  });
});

// ---------------------------------------------------------------------------
// Suite D — quant inference edge cases
// ---------------------------------------------------------------------------

describe("discoverLocalRuntimes — quant inference", () => {
  let root;

  before(() => {
    root = makeTmpDir();
    writeGguf(root, "plain-model-no-quant-token.gguf");
  });

  after(() => rmSync(root, { recursive: true, force: true }));

  it("quant is null when filename has no recognized quant token", async () => {
    const r = await discoverLocalRuntimes({
      lmStudioDir: join(root, "none"),
      ggufDirs: [root],
    });
    assert.equal(r.loose_gguf.models.length, 1);
    assert.equal(r.loose_gguf.models[0].quant, null);
  });
});

// ---------------------------------------------------------------------------
// Suite E — NEVER reads file contents (SECRET_WEIGHTS guard)
// ---------------------------------------------------------------------------

describe("discoverLocalRuntimes — no content read", () => {
  let root;

  before(() => {
    root = makeTmpDir();
    // Write a "gguf" whose bytes are a recognizable sentinel
    writeFileSync(join(root, "weights-Q4_K_M.gguf"), "SECRET_WEIGHTS");
  });

  after(() => rmSync(root, { recursive: true, force: true }));

  it("returned JSON does not contain SECRET_WEIGHTS", async () => {
    const r = await discoverLocalRuntimes({
      lmStudioDir: join(root, "none"),
      ggufDirs: [root],
    });
    const serialized = JSON.stringify(r);
    assert.ok(
      !serialized.includes("SECRET_WEIGHTS"),
      "discovery must never read file contents",
    );
  });
});

// ---------------------------------------------------------------------------
// Suite F — integration: all four runtimes wired at once
// ---------------------------------------------------------------------------

describe("discoverLocalRuntimes — integration (all runtimes)", () => {
  let root;
  let ollamaDir;
  let lmStudioDir;
  let ggufDir;
  let llmfitPath;

  before(() => {
    root = makeTmpDir();

    // Ollama disk manifests
    ollamaDir = join(root, "ollama-models");
    makeOllamaManifest(ollamaDir, "gemma4", "4b");

    // LM Studio gguf tree
    lmStudioDir = join(root, "lmstudio");
    writeGguf(join(lmStudioDir, "pub", "repo"), "Phi3-Q5_K_M.gguf");

    // Loose gguf dir
    ggufDir = join(root, "loose");
    writeGguf(ggufDir, "deepseek-Q8_0.gguf");

    // llmfit binary
    llmfitPath = join(root, "llmfit");
    writeFileSync(llmfitPath, "#!/bin/sh");
  });

  after(() => rmSync(root, { recursive: true, force: true }));

  it("boundary.model_invoked is false", async () => {
    const r = await discoverLocalRuntimes({
      ollamaModelsDir: ollamaDir,
      lmStudioDir,
      ggufDirs: [ggufDir],
      llmfitPath,
    });
    assert.equal(r.boundary.model_invoked, false);
  });

  it("boundary.files_content_read is false", async () => {
    const r = await discoverLocalRuntimes({
      ollamaModelsDir: ollamaDir,
      lmStudioDir,
      ggufDirs: [ggufDir],
      llmfitPath,
    });
    assert.equal(r.boundary.files_content_read, false);
  });

  it("ollama detects disk manifest model", async () => {
    const r = await discoverLocalRuntimes({
      ollamaModelsDir: ollamaDir,
      lmStudioDir,
      ggufDirs: [ggufDir],
      llmfitPath,
    });
    assert.ok(r.ollama.installed, "ollama should be installed");
    // API unreachable in test; falls back to disk manifests
    if (r.ollama.models_source === "disk_manifests") {
      assert.ok(r.ollama.models.includes("gemma4:4b"));
    }
  });

  it("lm_studio detects Phi3 model", async () => {
    const r = await discoverLocalRuntimes({
      ollamaModelsDir: ollamaDir,
      lmStudioDir,
      ggufDirs: [ggufDir],
      llmfitPath,
    });
    assert.equal(r.lm_studio.installed, true);
    assert.ok(r.lm_studio.models.some((m) => m.name === "Phi3-Q5_K_M.gguf"));
  });

  it("loose_gguf detects deepseek model", async () => {
    const r = await discoverLocalRuntimes({
      ollamaModelsDir: ollamaDir,
      lmStudioDir,
      ggufDirs: [ggufDir],
      llmfitPath,
    });
    assert.equal(r.loose_gguf.installed, true);
    assert.ok(r.loose_gguf.models.some((m) => m.name === "deepseek-Q8_0.gguf"));
  });

  it("llmfit is detected as installed", async () => {
    const r = await discoverLocalRuntimes({
      ollamaModelsDir: ollamaDir,
      lmStudioDir,
      ggufDirs: [ggufDir],
      llmfitPath,
    });
    assert.equal(r.llmfit.installed, true);
  });

  it("runtimes object has all four keys", async () => {
    const r = await discoverLocalRuntimes({
      ollamaModelsDir: ollamaDir,
      lmStudioDir,
      ggufDirs: [ggufDir],
      llmfitPath,
    });
    assert.ok("ollama" in r);
    assert.ok("lm_studio" in r);
    assert.ok("loose_gguf" in r);
    assert.ok("llmfit" in r);
    assert.ok("boundary" in r);
  });
});
