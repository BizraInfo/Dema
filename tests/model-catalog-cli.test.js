// PROVIDER-AWARE-MODEL-CATALOG-1A — `dema models catalog` CLI smoke tests.
// Annotate/validate only — no subprocess, no network, no model call. Router
// stays authoritative (the catalog reports its verdict).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

function catalog(args) {
  return execFileSync("node", [BIN, "models", "catalog", ...args], {
    encoding: "utf8",
  });
}

test("ollama family:tag → compatible, parsed, router-authoritative verdict", () => {
  const d = JSON.parse(catalog(["--provider", "ollama", "--model", "qwen2.5:7b", "--json"]));
  assert.equal(d.name_shape, "ollama_family_tag");
  assert.equal(d.parsed.family, "qwen2.5");
  assert.equal(d.router_model_allowed, true);
  assert.equal(d.compatibility, "compatible");
});

test("lmstudio publisher/model not in allow-list → honest family_not_in_allowlist", () => {
  const d = JSON.parse(catalog(["--provider", "lmstudio", "--model", "qwen/qwen3-coder", "--json"]));
  assert.equal(d.parsed.publisher, "qwen");
  assert.equal(d.router_model_allowed, false);
  assert.equal(d.compatibility, "family_not_in_allowlist");
});

test("unknown provider → unknown_provider", () => {
  const d = JSON.parse(catalog(["--provider", "openai", "--model", "gpt-4", "--json"]));
  assert.equal(d.provider_known, false);
  assert.equal(d.compatibility, "unknown_provider");
});

test("human render discloses no subprocess / no network / no model call + the verdict", () => {
  const out = catalog(["--provider", "ollama", "--model", "qwen2.5:7b"]);
  assert.match(out, /no subprocess/i);
  assert.match(out, /no model call/i);
  assert.match(out, /Compatibility: compatible/);
  assert.match(out, /authoritative/i);
});
