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

// M5.1B: production adoption of canonical JSON v1 requires explicit
// registration here — one repo-relative path per consumer, reviewed in that
// consumer's own slice PR. The dema-slice-scaffold auto-inserts newly
// generated kernels at the anchor below. Any canon importer NOT in this list
// (outside tests and this gate) still fails the scan.
export const CANONICAL_JSON_V1_REGISTERED_CONSUMERS = Object.freeze([
  "packages/mission/src/mission-corridor.js",
  // Gate C, C3 — the disk-bound closure orchestrator and CLI derive the exact
  // prepared-effect / transaction identity with canonical JSON v1. Registration
  // is adoption review only; it does not promote the dirty candidate or Node0.
  "packages/mission/src/corridor-closure-gatherer.js",
  "apps/cli/src/commands/mission.js",
  "packages/mission/src/dema-program-graph.js",
  // Gate C, C2 — the mission-closure transaction log. Canonicalises the
  // transaction descriptor, each event body, and the semantic-evidence subset
  // that settles concurrent appends, so every hash it publishes is stable
  // across writers and processes.
  "packages/receipts/src/mission-closure-transaction.js",
  // Gate C, C4D — cross-process ownership claims. The fencing token IS the
  // canonical hash of the claim body, and two different processes must derive
  // the identical token from the identical claim or the fence cannot arbitrate
  // between them, so key-order stability is the whole contract. Registration is
  // adoption review only; it does not promote Node0 or close any DoD gate.
  "packages/receipts/src/mission-closure-ownership.js",
  // NODE0-CLEAN-STATE-JOURNEY-1A — the witness harness publishes ONE
  // cross-machine value (`journey_invariant_hash`) over the subset of a
  // clean-state run that is legitimately identical on every machine. That value
  // is compared by strangers, so it must not depend on key order: canonical
  // JSON v1 is exactly the contract for it. Registration is adoption review
  // only; it does not promote Node0 or close any DoD gate by itself.
  "scripts/proof/node0-clean-state-journey.mjs",
  // Back-registered 2026-07-25. These four landed on main (#401, #402, #403,
  // #405) with the scaffold's registration comment already in their headers —
  // dema-recovery-mission-gatherer.js says "reviewed in this slice's PR" — but
  // the line was never added, because adding it turned the exact-list snapshot
  // in tests/dema-slice-scaffold-canonical.test.js (T8) red. The review
  // happened; only the clerical line was missing. T8 is now an invariant test
  // instead of a snapshot, so a legitimately growing allowlist no longer
  // forces a choice between a green suite and an honest gate.
  //
  // feat/reversible-file-steward-1c had independently back-registered the same
  // four, which is corroboration rather than duplication: two lanes reached the
  // identical conclusion about which consumers were legitimately missing.
  "packages/core/src/dema-recovery-mission-engine.js",
  "packages/core/src/dema-recovery-mission-gatherer.js",
  "packages/core/src/node0-model-swap-invariance.js",
  "packages/core/src/node0-metrics-baseline.js",
  "packages/core/src/node0-realm-state-kernel.js",
  // DEMA-REVERSIBLE-FILE-STEWARD-1A / 1B — registered by the steward slice.
  "packages/core/src/dema-reversible-file-steward.js",
  "packages/core/src/dema-reversible-file-steward-execution.js",
  "packages/core/src/node0-minimum-season-save-resume.js",
  // DEMA-CONVENE-PERSONAL-COUNCIL-1A — the alpha edge publishes ONE value that
  // must be stable across processes: the digest binding a convened plan to the
  // intent it was charged with. DCC-09 uses it to catch an edited plan passing
  // as the one the council actually received, so key order must not change the
  // hash — which is exactly this canon's contract. Registration is adoption
  // review only; it promotes nothing and closes no gate. Convening performs no
  // model call and no dispatch.
  "packages/core/src/dema-convene-personal-council.js",
  // NODE0-WORKER-HANDOFF-1A — the adapter re-derives a recorded handoff's hash
  // instead of trusting the one it carries, and compares the artefact's
  // `executed_code_hash` against the classification kernel's bytes on disk. Both
  // comparisons are made by a READER against a digest written earlier by a
  // different process, so key-order stability is the entire contract: an
  // unstable serializer would silently invalidate every honest artefact and
  // validate none. Registration is adoption review only; it promotes nothing.
  // The adapter performs one file read — no execution, mutation or network —
  // and the ledger does not move until a producer actually runs.
  "packages/core/src/node0-worker-handoff-adapter.js",
  // NODE0-WORKER-HANDOFF-1A producer — the writing half of the same contract.
  // It records the digest that the adapter above later re-derives, in a DIFFERENT
  // process from the one that reads it, which is precisely why key-order
  // stability is load-bearing: an unstable serializer would make every honest
  // artefact fail its own verification. Registered separately from the adapter
  // because writing a digest and reading one are distinct adoptions, and this
  // one performs real execution (two spawns and a SIGKILL) while the adapter
  // performs none.
  "scripts/proof/node0-worker-handoff-proof.mjs",
  // MISSION-CONTRACT-STATE-0A (TASK-026 phase 01) — the mission contract IS its
  // hash: immutability is enforced by content-addressing, not by a guard, so an
  // unstable serializer would not weaken the rule, it would abolish it. A
  // key-order-dependent digest would let the identical contract present two
  // identities, and `contract_binding_mismatch` — the check that stops a resuming
  // worker adopting the wrong mission — would refuse honest resumes and admit
  // nothing. The state snapshot has the same contract across a worker exit: the
  // process that writes the checkpoint is not the process that verifies it.
  // Registration is adoption review only; the kernel is pure, promotes nothing,
  // and conducts no mission.
  "packages/core/src/mission-contract-state.js",
  // MISSION-SUPERVISOR-0A (TASK-026 phase 02) — the conductor's transition
  // receipts and its derived decision-state identity are both canonical hashes,
  // and both are compared ACROSS processes: replay re-derives a state that a
  // different process walked live, and the receipt chain is checked by a reader
  // that did not write it. Key-order instability would make an honest replay
  // diverge from the run it is replaying, which is the one property FR-7 exists
  // to guarantee. Registration is adoption review only; the reducer is pure and
  // performs no execution.
  "packages/core/src/mission-supervisor.js",
  // MISSION-WORKER-ADAPTER-0A (TASK-026 phase 03) — the demonstration receipt is
  // the artefact a stranger reads to decide whether the swap really happened, and
  // T-05 requires two runs of the same fixture to be byte-identical. That is a
  // key-order claim before it is anything else. The proposal hash at the seam is
  // computed over untrusted worker input, so a serializer that reordered keys
  // would let one proposal present two identities to the duplicate check.
  // Registration is adoption review only; the module is pure and spawns nothing.
  "packages/core/src/mission-worker-adapter.js",
  // NODE0-RUNTIME-MISSION-OBSERVATION-1A reader — re-derives a recorded runtime
  // artefact's digest instead of trusting the one it carries, and compares the
  // artefact's `executed_code_hash` against the classification kernel's bytes on
  // disk. Both comparisons are made by a READER against a digest written earlier
  // by a process that is now dead, so key-order stability is the entire contract:
  // an unstable serializer would invalidate every honest artefact and validate
  // none. Registration is adoption review only; this half performs one file read.
  "packages/core/src/node0-runtime-mission-adapter.js",
  // NODE0-RUNTIME-MISSION-OBSERVATION-1A producer — the writing half. It records
  // the digest the reader above later re-derives, in a DIFFERENT process from the
  // one that reads it, and it also hashes the supervisor state that a SIGKILLed
  // predecessor left behind so its successor can prove it resumed that exact
  // checkpoint rather than a fresh one. Registered separately from the reader
  // because writing a digest and reading one are distinct adoptions, and this one
  // performs real execution (spawns and a SIGKILL) while the reader performs none.
  "scripts/proof/node0-runtime-mission-proof.mjs",
  // NODE0-RUNTIME-MISSION-OBSERVATION-1A worker — the disposable process itself.
  // It hashes the supervisor state it checkpoints, and a DIFFERENT process later
  // compares that digest to prove it resumed that exact checkpoint rather than a
  // fresh one. Predecessor and successor never share memory — only bytes on disk
  // — so key-order stability is what makes the comparison mean anything.
  "scripts/proof/node0-runtime-mission-worker.mjs",
  // NODE0-RECOVERY-OBSERVATION-1A. Four processes and no shared memory: worker A
  // hashes the checkpoint it leaves behind, the supervisor never sees it, worker B
  // resumes it, and an INDEPENDENT observer re-derives the contract hash from the
  // persisted fields to decide whether B resumed the same mission. Every one of
  // those comparisons is between bytes written by one dead process and read by
  // another, so key-order stability is the entire basis of the claim.
  "packages/core/src/node0-recovery-adapter.js",
  "scripts/proof/node0-recovery-proof.mjs",
  "scripts/proof/node0-recovery-worker.mjs",
  "scripts/proof/node0-recovery-observer.mjs",
  // NODE0-TRANSITION-COVERAGE-1A \u2014 the first artefact that can carry a
  // REFUTATION into the closure ledger, so its digest is the thing standing
  // between a measured violation and a forged one. The producer re-derives every
  // counterexample from source and a reader in a different process re-derives the
  // digest; key-order instability would let an edited artefact keep its hash.
  "packages/core/src/node0-transition-coverage-adapter.js",
  "scripts/proof/node0-transition-coverage-proof.mjs",
  // NODE0-HISTORY-REPLAY-1A. The producer walks a season history written by
  // processes long dead and re-derives whether it reconstructs; the adapter, in a
  // third process, re-derives the artefact digest before letting it settle a
  // closure row. Every comparison is between bytes one process wrote and another
  // read, so key-order stability is what stops an edited artefact keeping its
  // hash — and this row can carry an INCOMPLETE that blocks closure.
  "packages/core/src/node0-history-replay-adapter.js",
  "scripts/proof/node0-history-replay-proof.mjs",
  // NODE0-DEPLOYMENT-REMOTE-WRITE-1A. The producer measures the host's exposure
  // surface and seals the verdict; the adapter, in a later process on a possibly
  // changed machine, re-derives that digest before letting it settle the one
  // closure row that governs external writes. The artefact is the ONLY thing
  // standing between "this host carries no silent write path" and someone
  // editing a findings array to say so, and the root-file hashes it carries are
  // compared against a Bitcoin-anchored manifest — so key-order stability is
  // what stops an edited artefact keeping its hash.
  "packages/core/src/node0-deployment-remote-write-adapter.js",
  "scripts/proof/node0-deployment-remote-write-proof.mjs",
  // scaffold:register-consumer (anchored insertion point — do not remove)
]);

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
    ...CANONICAL_JSON_V1_REGISTERED_CONSUMERS,
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
