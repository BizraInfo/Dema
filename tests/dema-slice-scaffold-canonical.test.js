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
  // Faithful stubs: each carries the REAL anchor its wiring step targets, so a
  // step that silently no-ops here is a scaffold defect rather than a fixture
  // gap. These were empty strings, which meant five of the six anchored edits
  // reported "anchor not found" on every run while the scaffold still returned
  // ok:true — the fixture was hiding the fail-open it should have caught.
  const stubs = {
    "scripts/check.mjs":
      'const REVIEW = [\n  ["node", ["scripts/review/dema-capability-truth-registry-check.mjs"]],\n];\n',
    "packages/core/src/dema-capability-truth-registry.js":
      'export const REQUIRED_CAPABILITY_IDS = Object.freeze([\n  "STUB_EXISTING_1A",\n]);\n\n' +
      "// Covers the one shipped pre-action spine capabilities.\n" +
      "function defaultCapabilityRows() {\n  return Object.freeze([\n  ]);\n}\n",
    "tests/dema-capability-truth-registry.test.js":
      "// one-capability truth registry\n" +
      "assert.equal(registry.capability_count, 1);\n" +
      "assert.equal(registry.measured_repo_count, 1);\n",
    "docs/TESTING.md":
      "| Test | Purpose |\n| --- | --- |\n| `tests/stub-existing.test.js` | stub |\n\n" +
      "```bash\nnode scripts/review/dema-capability-truth-registry-check.mjs\n```\n",
    "docs/CURRENT_LIMITS.md":
      "| Limit | Evidence |\n| --- | --- |\n| Stdlib-only dependency posture | package.json |\n",
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

test("T8 adoption-freeze gate stays strict: every registered consumer is explicit, exact and load-bearing", () => {
  const consumers = [...CANONICAL_JSON_V1_REGISTERED_CONSUMERS];

  // Registration is an allowlist of exact reviewed paths — never a wildcard.
  //
  // This assertion used to be a deepEqual snapshot pinning the list to its
  // first two entries. That contradicted T2-T4 above, which prove the scaffold
  // APPENDS to this same list at its anchor: the first scaffolded consumer
  // turns the snapshot red, and the only ways back to green are an
  // unregistered importer or a hand-edited test. Four kernels sat unregistered
  // on main for exactly that reason (#401 #402 #403 #405), and the gate — the
  // one that exists to catch unregistered importers — was the thing reporting
  // the failure. A count is not the invariant. These are.
  assert.ok(Object.isFrozen(CANONICAL_JSON_V1_REGISTERED_CONSUMERS));
  assert.equal(new Set(consumers).size, consumers.length, "no duplicate registrations");
  assert.ok(consumers.length > 0, "allowlist is not empty");

  for (const rel of consumers) {
    // Exact repo-relative source path — no wildcard, glob, regex or escape.
    assert.match(
      rel,
      /^(packages|apps|bin|scripts)\/[A-Za-z0-9_./-]+\.(js|mjs|cjs)$/,
      `literal repo-relative path: ${rel}`,
    );
    assert.ok(!rel.includes("*") && !rel.includes(".."), `no wildcard or escape: ${rel}`);

    // Stricter than the old snapshot on substance: a registration must be
    // LOAD-BEARING. The path must exist (readFileSync throws otherwise) and
    // must actually import canon — so the allowlist cannot be widened by
    // accretion with entries that never needed to be on it.
    const src = readFileSync(join(REPO, rel), "utf8");
    assert.ok(
      src.includes("canon/src/canonical-json") || src.includes("canon/src/sha256-canonical-json"),
      `registered consumer must actually import canon: ${rel}`,
    );
  }

  // ...and every canon importer outside tests and the gate is registered.
  const result = runCanonicalJsonV1Check();
  assert.equal(result.ok, true, JSON.stringify(result.blocked_by ?? []));
});

test("T9 scaffold fails closed when an anchored wiring edit cannot apply", (t) => {
  const tmp = makeStubRepo();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));

  // Break exactly one anchor — the canon gate's registration point — and leave
  // the other five intact. Before this test the scaffold printed "Scaffolded
  // M5-WIRE-FAIL-1A", returned ok:true and exited 0, having written five files
  // that nothing was wired to.
  writeFileSync(
    join(tmp, "scripts/review/canonical-json-v1-check.mjs"),
    "export const CANONICAL_JSON_V1_REGISTERED_CONSUMERS = Object.freeze([]);\n",
  );

  let err = null;
  try {
    runScaffold(
      ["--id", "M5-WIRE-FAIL-1A", "--intent", "x", "--no-arch", "--repo", tmp, "--json"],
      { stdio: "pipe" },
    );
  } catch (e) {
    err = e;
  }

  assert.ok(err, "scaffold must not report success when an anchor is missing");
  assert.equal(err.status, 3, "exit code 3 = wiring incomplete");
  const report = JSON.parse(err.stdout);
  assert.equal(report.ok, false);
  assert.ok(
    report.wiring_failures.some((f) => f.includes("canonical-json-v1-check.mjs")),
    JSON.stringify(report.wiring_failures),
  );
});

test("T10 scaffold fails closed when registry count-prose anchor is missing", (t) => {
  const tmp = makeStubRepo();
  t.after(() => rmSync(tmp, { recursive: true, force: true }));

  // Keep REQUIRED_CAPABILITY_IDS and defaultCapabilityRows anchors intact, but
  // remove the count-prose sentence. Before the fix, step 2c recorded nothing
  // on a miss — WIRING_FAILED only saw notes already in `edits` — so the
  // scaffold exited 0 with a required edit silently unapplied.
  writeFileSync(
    join(tmp, "packages/core/src/dema-capability-truth-registry.js"),
    'export const REQUIRED_CAPABILITY_IDS = Object.freeze([\n  "STUB_EXISTING_1A",\n]);\n\n' +
      "// NO count-prose sentence here.\n" +
      "function defaultCapabilityRows() {\n  return Object.freeze([\n  ]);\n}\n",
  );

  let err = null;
  try {
    runScaffold(
      ["--id", "M5-PROSE-MISS-1A", "--intent", "x", "--no-arch", "--repo", tmp, "--json"],
      { stdio: "pipe" },
    );
  } catch (e) {
    err = e;
  }

  assert.ok(err, "scaffold must not report success when count prose is missing");
  assert.equal(err.status, 3, "exit code 3 = wiring incomplete");
  const report = JSON.parse(err.stdout);
  assert.equal(report.ok, false);
  assert.ok(
    report.wiring_failures.some((f) => /count prose anchor not found/.test(f)),
    JSON.stringify(report.wiring_failures),
  );
});

test("real gate file carries the scaffold registration anchor", () => {
  const gate = readFileSync(join(REPO, "scripts/review/canonical-json-v1-check.mjs"), "utf8");
  assert.ok(gate.includes(GATE_ANCHOR), "anchored insertion point present");
});
