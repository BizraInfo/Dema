import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  runCanonicalJsonV1Check,
  CANONICAL_JSON_V1_REGISTERED_CONSUMERS,
} from "../scripts/review/canonical-json-v1-check.mjs";

// M5.1B — scaffold canonicalization stop-the-bleed.
//
// The M5.0 inventory measured the slice scaffold as the propagation source of
// the legacy group-A serializer (76 copies). These tests pin the repair: the
// scaffold must emit kernels that import the ONE canonical byte contract
// (bizra.canonical-json.v1) instead of embedding a local stableStringify.

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const AGENTS_SCAFFOLD = join(REPO, ".agents/skills/dema-slice-scaffold/scripts/scaffold_slice.mjs");
const CLAUDE_SCAFFOLD = join(REPO, ".claude/skills/dema-slice-scaffold/scripts/scaffold_slice.mjs");

const GATE_ANCHOR = "// scaffold:register-consumer";

function makeStubRepo() {
  const tmp = mkdtempSync(join(tmpdir(), "m51b-scaffold-"));
  const stubs = {
    "scripts/check.mjs": "",
    "packages/core/src/dema-capability-truth-registry.js": "",
    "tests/dema-capability-truth-registry.test.js": "",
    "docs/TESTING.md": "",
    "docs/CURRENT_LIMITS.md": "",
    // Gate stub carries the real anchor so consumer auto-registration is provable.
    "scripts/review/canonical-json-v1-check.mjs":
      `export const CANONICAL_JSON_V1_REGISTERED_CONSUMERS = Object.freeze([\n  ${GATE_ANCHOR}\n]);\n`,
  };
  for (const [rel, body] of Object.entries(stubs)) {
    const abs = join(tmp, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return tmp;
}

function runScaffold(args, opts = {}) {
  return execFileSync("node", [AGENTS_SCAFFOLD, ...args], { encoding: "utf8", ...opts });
}

test("T1 both scaffold copies are byte-identical", () => {
  assert.equal(readFileSync(AGENTS_SCAFFOLD, "utf8"), readFileSync(CLAUDE_SCAFFOLD, "utf8"));
});

test("T2-T4 generated kernel has no inline serializer, imports canon, declares the algorithm", async (t) => {
  const tmp = makeStubRepo();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));

  const out = runScaffold([
    "--id", "M5-DEMO-CANON-1A",
    "--intent", "demo canonical slice",
    "--no-arch",
    "--repo", tmp,
    "--json",
  ]);
  const report = JSON.parse(out);
  assert.equal(report.ok, true);

  const kernelPath = join(tmp, "packages/core/src/m5-demo-canon.js");
  const kernel = readFileSync(kernelPath, "utf8");

  // T2 — no embedded legacy serializer, no direct hashing in the template.
  assert.ok(!kernel.includes("function stableStringify"), "no inline stableStringify");
  assert.ok(!kernel.includes("JSON.stringify"), "no raw JSON.stringify in kernel");
  assert.ok(!kernel.includes("createHash"), "no direct createHash in kernel");

  // T3 — imports the canonical contract.
  assert.ok(kernel.includes("canon/src/sha256-canonical-json-v1.js"), "imports canon sha256 binding");
  assert.ok(kernel.includes("CANONICAL_JSON_V1_ALGORITHM"), "imports the algorithm constant");

  // T4 — generated body declares the canonicalization identity triplet.
  assert.ok(kernel.includes("canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM"));
  assert.ok(kernel.includes('hash_algorithm: "sha256"'));
  assert.ok(kernel.includes('text_encoding: "utf-8"'));

  // Consumer auto-registration wired into the gate stub (anchored insert).
  const gateStub = readFileSync(join(tmp, "scripts/review/canonical-json-v1-check.mjs"), "utf8");
  assert.ok(gateStub.includes('"packages/core/src/m5-demo-canon.js",'), "consumer registered in gate");

  // T5/T6 — execute the generated kernel against the real canon modules by
  // rewriting its relative canon imports to absolute file URLs.
  const patched = kernel
    .replaceAll(
      "../../canon/src/canonical-json-v1.js",
      pathToFileURL(join(REPO, "packages/canon/src/canonical-json-v1.js")).href,
    )
    .replaceAll(
      "../../canon/src/sha256-canonical-json-v1.js",
      pathToFileURL(join(REPO, "packages/canon/src/sha256-canonical-json-v1.js")).href,
    );
  const patchedPath = join(tmp, "m5-demo-canon.patched.mjs");
  writeFileSync(patchedPath, patched);
  const mod = await import(pathToFileURL(patchedPath).href);

  // T6 — ordinary valid fixture: content-addressed, algorithm-declared, deterministic.
  const payload = mod.buildM5DemoCanonPayload({ ok: true, n: 1 });
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.canonicalization_algorithm, "bizra.canonical-json.v1");
  assert.equal(payload.hash_algorithm, "sha256");
  assert.equal(
    mod.buildM5DemoCanonPayload({ ok: true, n: 1 }).content_hash,
    payload.content_hash,
    "deterministic bytes",
  );

  // T5 — unsupported values fail closed via the canon contract.
  assert.throws(() => mod.buildM5DemoCanonPayload({ a: undefined }), (e) => e.code === "value_undefined");
  assert.throws(() => mod.buildM5DemoCanonPayload({ n: NaN }), (e) => e.code === "number_not_finite");
  const sparse = [1, 2, 3];
  delete sparse[1];
  assert.throws(() => mod.buildM5DemoCanonPayload({ arr: sparse }), (e) => e.code === "array_sparse");
});

test("T7 scaffold rejects a path-escaping slice id", () => {
  assert.throws(
    () => runScaffold(["--id", "../EVIL-1A", "--intent", "x", "--repo", tmpdir()], { stdio: "pipe" }),
    (e) => e.status === 1,
  );
});

test("T8 adoption-freeze gate stays strict: every registered consumer is explicit and the gate passes", () => {
  assert.ok(Object.isFrozen(CANONICAL_JSON_V1_REGISTERED_CONSUMERS));
  // Registration is an allowlist of exact reviewed paths — never a wildcard.
  // First (and so far only) registered consumer: the mission corridor (PR #382).
  assert.deepEqual(
    [...CANONICAL_JSON_V1_REGISTERED_CONSUMERS],
    ["packages/mission/src/mission-corridor.js"],
  );
  const result = runCanonicalJsonV1Check();
  assert.equal(result.ok, true, JSON.stringify(result.blocked_by ?? []));
});

test("real gate file carries the scaffold registration anchor", () => {
  const gate = readFileSync(join(REPO, "scripts/review/canonical-json-v1-check.mjs"), "utf8");
  assert.ok(gate.includes(GATE_ANCHOR), "anchored insertion point present");
});
