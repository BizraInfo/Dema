#!/usr/bin/env node
// CANONICAL-JSON-V1-0A — contract conformance gate.
//
// Replays the committed vector corpus against the JavaScript implementation
// (exact bytes, hashes, error codes, determinism), runs the independent
// Python verifier for cross-language byte convergence, and enforces the
// slice's adoption freeze: no production surface may import packages/canon
// in this slice (tests and this gate only).

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  MAX_CANONICAL_DEPTH,
  MAX_CANONICAL_BYTES,
  MAX_OBJECT_KEYS,
  MAX_ARRAY_LENGTH,
  MAX_STRING_BYTES,
  canonicalizeJsonV1,
} from "../../packages/canon/src/canonical-json-v1.js";
import { CanonicalJsonV1Error } from "../../packages/canon/src/canonical-json-errors.js";
import { buildPreviewBoundary } from "../../packages/core/src/boundary-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const JSON_MODE = process.argv.includes("--json");

const EXPECTED_LIMITS = Object.freeze({
  MAX_CANONICAL_DEPTH: 64,
  MAX_CANONICAL_BYTES: 1048576,
  MAX_OBJECT_KEYS: 256,
  MAX_ARRAY_LENGTH: 1024,
  MAX_STRING_BYTES: 65536,
});

export function buildGeneratorValue(g) {
  if (g.type === "nest_arrays") {
    let v = g.leaf;
    for (let i = 0; i < g.depth; i++) v = [v];
    return v;
  }
  if (g.type === "string_repeat") return g.char.repeat(g.count);
  if (g.type === "key_fanout") {
    const o = {};
    for (let i = 0; i < g.count; i++) o[`k${String(i).padStart(3, "0")}`] = 0;
    return o;
  }
  if (g.type === "array_fill") return Array(g.count).fill(g.value);
  if (g.type === "array_of_strings") return Array(g.count).fill(g.char.repeat(g.repeat));
  throw new Error(`unknown generator ${g.type}`);
}

export function buildInvalidValue(construct) {
  switch (construct) {
    case "undefined_root":
      return undefined;
    case "undefined_object_value":
      return { a: undefined, b: 1 };
    case "undefined_array_value":
      return [undefined];
    case "function_value":
      return { f: () => 1 };
    case "symbol_value":
      return { s: Symbol("x") };
    case "bigint_value":
      return { n: 1n };
    case "nan":
      return { n: NaN };
    case "infinity":
      return { n: Infinity };
    case "negative_infinity":
      return { n: -Infinity };
    case "unsafe_integer_pos":
      return 9007199254740992;
    case "unsafe_integer_neg":
      return -9007199254740992;
    case "huge_integral_float":
      return 1e300;
    case "sparse_array": {
      const a = [1, 2, 3];
      delete a[1];
      return a;
    }
    case "circular_reference": {
      const o = { a: {} };
      o.a.back = o;
      return o;
    }
    case "depth_exceeded": {
      let v = 1;
      for (let i = 0; i < MAX_CANONICAL_DEPTH + 1; i++) v = [v];
      return v;
    }
    case "string_bytes_exceeded":
      return "a".repeat(MAX_STRING_BYTES + 1);
    case "object_keys_exceeded": {
      const o = {};
      for (let i = 0; i < MAX_OBJECT_KEYS + 1; i++) o[`k${i}`] = 0;
      return o;
    }
    case "array_length_exceeded":
      return Array(MAX_ARRAY_LENGTH + 1).fill(0);
    case "total_bytes_exceeded":
      return Array(20).fill("a".repeat(60000));
    case "lone_high_surrogate":
      return "x\ud800y";
    case "lone_low_surrogate":
      return "x\udc00y";
    case "getter_property": {
      const o = {};
      Object.defineProperty(o, "g", {
        enumerable: true,
        configurable: true,
        get() {
          throw new Error("getter must never execute");
        },
      });
      return o;
    }
    case "setter_property": {
      const o = {};
      Object.defineProperty(o, "s", { enumerable: true, configurable: true, set() {} });
      return o;
    }
    case "class_instance": {
      class Thing {
        constructor() {
          this.a = 1;
        }
      }
      return new Thing();
    }
    case "date_value":
      return new Date(0);
    case "map_value":
      return new Map([["a", 1]]);
    case "set_value":
      return new Set([1]);
    case "typed_array":
      return new Uint8Array([1, 2, 3]);
    case "symbol_keyed_property":
      return { [Symbol("k")]: 1, a: 1 };
    case "non_enumerable_property": {
      const o = { a: 1 };
      Object.defineProperty(o, "hidden", { enumerable: false, value: 2 });
      return o;
    }
    case "array_with_extra_property": {
      const a = [1, 2];
      a.extra = 3;
      return a;
    }
    case "array_prop_leading_zeros": {
      const a = [1, 2];
      Object.defineProperty(a, "00", { enumerable: true, configurable: true, writable: true, value: 9 });
      return a;
    }
    case "array_prop_negative_zero": {
      const a = [1, 2];
      Object.defineProperty(a, "-0", { enumerable: true, configurable: true, writable: true, value: 9 });
      return a;
    }
    case "array_prop_exponent": {
      const a = [1, 2];
      Object.defineProperty(a, "1e0", { enumerable: true, configurable: true, writable: true, value: 9 });
      return a;
    }
    default:
      throw new Error(`unknown construct ${construct}`);
  }
}

function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function loadVectors(name) {
  return JSON.parse(readFileSync(join(REPO_ROOT, "packages/canon/vectors", name), "utf8"));
}

function scanForForbiddenImporters() {
  const offenders = [];
  const scanDirs = ["packages", "apps", "bin", "scripts"];
  const allowed = new Set([
    "scripts/review/canonical-json-v1-check.mjs",
  ]);
  for (const dir of scanDirs) {
    let entries;
    try {
      entries = readdirSync(join(REPO_ROOT, dir), { recursive: true, withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isFile()) continue;
      if (!/\.(js|mjs|cjs)$/.test(e.name)) continue;
      const abs = join(e.parentPath ?? e.path, e.name);
      const rel = relative(REPO_ROOT, abs).replaceAll("\\", "/");
      if (rel.startsWith("packages/canon/")) continue;
      if (allowed.has(rel)) continue;
      const src = readFileSync(abs, "utf8");
      if (src.includes("canon/src/canonical-json") || src.includes("canon/src/sha256-canonical-json")) {
        offenders.push(rel);
      }
    }
  }
  return offenders;
}

function runPythonVerifier() {
  try {
    const out = execFileSync("python3", [join(__dirname, "canonical-json-v1-verify.py")], {
      encoding: "utf8",
    });
    return JSON.parse(out);
  } catch (err) {
    if (err.code === "ENOENT") {
      return { ok: false, failures: ["python3_unavailable"] };
    }
    const stdout = err.stdout ? String(err.stdout) : "";
    try {
      return JSON.parse(stdout);
    } catch {
      return { ok: false, failures: [`python_verifier_crashed: ${String(err.message).slice(0, 200)}`] };
    }
  }
}

export function runCanonicalJsonV1Check() {
  const blocked_by = [];

  const actualLimits = {
    MAX_CANONICAL_DEPTH,
    MAX_CANONICAL_BYTES,
    MAX_OBJECT_KEYS,
    MAX_ARRAY_LENGTH,
    MAX_STRING_BYTES,
  };
  for (const [name, expected] of Object.entries(EXPECTED_LIMITS)) {
    if (actualLimits[name] !== expected) {
      blocked_by.push(`limit_drift:${name}`);
    }
  }

  const valid = loadVectors("canonical-json-v1-valid.json");
  const invalid = loadVectors("canonical-json-v1-invalid.json");
  if (valid.vectors.length < 15) blocked_by.push("valid_vector_count_below_minimum");
  if (invalid.vectors.length < 24) blocked_by.push("invalid_vector_count_below_minimum");

  for (const v of valid.vectors) {
    if (!/^sha256:[0-9a-f]{64}$/.test(v.expected_sha256)) {
      blocked_by.push(`vector_hash_malformed:${v.id}`);
      continue;
    }
    let text;
    try {
      const input = v.generator ? buildGeneratorValue(v.generator) : v.value;
      text = canonicalizeJsonV1(input);
      // Determinism: three independent canonicalization passes over the same
      // input must be byte-identical (named passes keep the executions
      // syntactically distinct — CodeQL identical-operands finding on 4b814ad).
      const secondPass = canonicalizeJsonV1(input);
      const thirdPass = canonicalizeJsonV1(input);
      if (secondPass !== text || thirdPass !== text) {
        blocked_by.push(`nondeterministic:${v.id}`);
        continue;
      }
    } catch (err) {
      blocked_by.push(`valid_vector_rejected:${v.id}:${err.code ?? err.message}`);
      continue;
    }
    if (v.expected_canonical !== undefined && text !== v.expected_canonical) {
      blocked_by.push(`byte_mismatch:${v.id}`);
      continue;
    }
    if (v.expected_byte_length !== undefined && Buffer.byteLength(text, "utf8") !== v.expected_byte_length) {
      blocked_by.push(`byte_length_mismatch:${v.id}`);
      continue;
    }
    if (`sha256:${sha256Hex(text)}` !== v.expected_sha256) {
      blocked_by.push(`hash_mismatch:${v.id}`);
    }
  }

  for (const v of invalid.vectors) {
    let input;
    try {
      input = buildInvalidValue(v.construct);
    } catch (err) {
      blocked_by.push(`construct_failed:${v.id}`);
      continue;
    }
    try {
      canonicalizeJsonV1(input);
      blocked_by.push(`invalid_vector_accepted:${v.id}`);
    } catch (err) {
      if (!(err instanceof CanonicalJsonV1Error)) {
        blocked_by.push(`invalid_vector_wrong_error_type:${v.id}`);
      } else if (err.code !== v.expected_error_code) {
        blocked_by.push(`invalid_vector_wrong_code:${v.id}:${err.code}`);
      }
    }
  }

  const offenders = scanForForbiddenImporters();
  for (const rel of offenders) {
    blocked_by.push(`forbidden_importer:${rel}`);
  }

  const python = runPythonVerifier();
  if (!python.ok) {
    for (const f of python.failures ?? ["python_verifier_failed"]) {
      blocked_by.push(`python:${f}`);
    }
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: "bizra.dema.canonical_json_v1_check.v0.1",
    algorithm: "bizra.canonical-json.v1",
    truth_label: "PREVIEW_ONLY",
    authority_delta: 0,
    boundary: buildPreviewBoundary(),
    valid_vector_count: valid.vectors.length,
    invalid_vector_count: invalid.vectors.length,
    python_convergence: Object.freeze({
      ok: python.ok === true,
      valid_passed: python.valid_passed ?? 0,
      invalid_passed: python.invalid_passed ?? 0,
      skipped_js_only: python.skipped_js_only ?? 0,
    }),
    limits: Object.freeze(actualLimits),
    blocked_by: Object.freeze(blocked_by),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runCanonicalJsonV1Check();
  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - canonical JSON v1 contract");
    console.log(`  algorithm: ${result.algorithm}`);
    console.log(`  valid vectors: ${result.valid_vector_count}`);
    console.log(`  invalid vectors: ${result.invalid_vector_count}`);
    console.log(`  python convergence: ${result.python_convergence.ok ? "PASS" : "FAIL"} (skipped js_only: ${result.python_convergence.skipped_js_only})`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by) console.log(`    ${code}`);
    }
  }
  if (!result.ok) process.exit(1);
}
