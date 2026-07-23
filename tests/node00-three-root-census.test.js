import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  planNode00ThreeRootCensus,
  buildNode00ThreeRootCensusPayload,
  verifyNode00ThreeRootCensus,
  verifyPortableArtifacts,
  runNode00ThreeRootCensus,
  censusRoots,
  admitCensusRoots,
  deriveCensusTopology,
  hashText,
  foldDigest,
  sizeBucket,
  mtimeBucket,
  DIGEST_FOLD_WIDTH,
  CensusRootAdmissionError,
  COMPLETENESS_COMPLETE,
  COMPLETENESS_BOUNDED_PARTIAL,
  PRIVACY_PRIVATE_AGGREGATE,
  PRIVACY_PUBLIC_PATHS,
  SCAN_NOT_STARTED,
  SCAN_COMPLETE,
  SCAN_PARTIAL,
  PRIVATE_FORBIDDEN_ENTRY_FIELDS,
  NODE00_THREE_ROOT_CENSUS_SCHEMA,
  NODE00_THREE_ROOT_CENSUS_TRUTH_LABEL,
  NODE00_THREE_ROOT_CENSUS_GO_PHRASE,
} from "../packages/core/src/node00-three-root-census.js";
import {
  runNode00ThreeRootCensusCheck,
  makeMemoryAdapter,
  fixtureTree,
  fixtureRoots,
  fixtureInput,
  FIXTURE_REFERENCE_TIME_MS,
} from "../scripts/review/node00-three-root-census-check.mjs";
import {
  planProofOutput,
  writeCensusProof,
  censusFsAdapter,
  replaceableByOthers,
  RUN_MARKER_FILENAME,
  PROOF_ROOT_SUBSTITUTION_RESISTANCE,
} from "../apps/cli/src/commands/node00-three-root-census.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Reachability is a property of CODE, not prose. Both modules deliberately NAME the
// forbidden APIs in their headers to document the boundary; scanning raw text would
// flag that documentation as a violation. Strip comments so the assertion binds to
// what actually executes.
function codeOnly(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
}

const KERNEL_SRC = readFileSync(join(REPO_ROOT, "packages/core/src/node00-three-root-census.js"), "utf8");
const ADAPTER_SRC = readFileSync(join(REPO_ROOT, "apps/cli/src/commands/node00-three-root-census.js"), "utf8");
const KERNEL_CODE = codeOnly(KERNEL_SRC);
const ADAPTER_CODE = codeOnly(ADAPTER_SRC);

// Collect every STRING VALUE in a structure. A privacy leak is DATA escaping, so the
// assertion must look at values — a structural key like `blocked_by` merely CONTAINS
// the substring "locked" and is not a disclosure.
function stringValues(node, out = []) {
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) for (const item of node) stringValues(item, out);
  else if (node && typeof node === "object") for (const value of Object.values(node)) stringValues(value, out);
  return out;
}

function census(overrides = {}) {
  return censusRoots(fixtureInput(overrides));
}

function fullRun(overrides = {}) {
  return runNode00ThreeRootCensus({
    consent: NODE00_THREE_ROOT_CENSUS_GO_PHRASE,
    input: fixtureInput(overrides),
  });
}

// Every real name that exists under the PRIVATE fixture root.
const PRIVATE_NAMES = ["photo.jpg", "shortcut", "locked", "hidden.txt", "/fx/downloads"];
// Exact private metadata that must never escape (from fixtureTree()).
const PRIVATE_EXACT = { size: 2048, inode: 11, device: 1, mode: 0o755 };

// --------------------------------------------------------------------------
// Proof contract
// --------------------------------------------------------------------------

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planNode00ThreeRootCensus({ consent: "wrong", input: fixtureInput() });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planNode00ThreeRootCensus({
    consent: NODE00_THREE_ROOT_CENSUS_GO_PHRASE,
    input: fixtureInput(),
  });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("plan positively validates roots, adapter and bounds — absence of a block is not validation", () => {
  const cases = [
    [{ roots: [], adapter: makeMemoryAdapter({}) }, "roots_not_declared"],
    [{ roots: [{ id: "A", path: "relative", visibility: "public" }], adapter: makeMemoryAdapter({}) }, "root_path_not_absolute"],
    [{ roots: [{ id: "A", path: "/a", visibility: "secret" }], adapter: makeMemoryAdapter({}) }, "root_visibility_undeclared"],
    [{ roots: [{ id: "A", path: "/a", visibility: "public" }, { id: "A", path: "/b", visibility: "public" }], adapter: makeMemoryAdapter({}) }, "root_id_duplicated"],
    [{ roots: [{ id: "A", path: "/a", visibility: "public" }] }, "adapter_missing"],
    [{ ...fixtureInput(), bounds: { max_depth: 0 } }, "bounds_max_depth_invalid"],
    // A private root reports mtime BUCKETS, so a declared reference time is required.
    [{ roots: fixtureRoots(), adapter: makeMemoryAdapter(fixtureTree()) }, "reference_time_ms_required_for_private_root"],
    // A root demanding provenance must carry an explicit binding.
    [
      {
        roots: [{ id: "DEMA_REPO", path: "/fx/lake", visibility: "public", requires_binding: true }],
        adapter: makeMemoryAdapter(fixtureTree()),
      },
      "root_binding_unresolved",
    ],
  ];
  for (const [input, expected] of cases) {
    const plan = planNode00ThreeRootCensus({ consent: NODE00_THREE_ROOT_CENSUS_GO_PHRASE, input });
    assert.equal(plan.eligible, false, `expected block ${expected}`);
    assert.ok(plan.blocked_by.includes(expected), `${expected} not in ${plan.blocked_by.join(", ")}`);
  }
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildNode00ThreeRootCensusPayload(census());
  assert.equal(payload.schema, NODE00_THREE_ROOT_CENSUS_SCHEMA);
  assert.equal(payload.truth_label, NODE00_THREE_ROOT_CENSUS_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("boundary check is non-vacuous: exact canonical key set, every value strictly false", () => {
  const payload = buildNode00ThreeRootCensusPayload(census());
  assert.deepEqual(Object.keys(payload.boundary).sort(), [
    "daemon_started", "execution_allowed", "file_mutation_performed", "live_execution_performed",
    "model_invocation_performed", "network_used", "token_minted", "wallet_accessed",
  ]);
  assert.ok(Object.values(payload.boundary).every((v) => v === false));
  const { execution_allowed, ...missing } = payload.boundary;
  assert.equal(verifyNode00ThreeRootCensus({ ...payload, boundary: missing }).ok, false);
  assert.equal(verifyNode00ThreeRootCensus({ ...payload, boundary: { ...payload.boundary, extra: false } }).ok, false);
});

test("verify accepts a fresh payload and rejects tamper, stale-hash forgery and lying completeness", () => {
  const payload = buildNode00ThreeRootCensusPayload(census());
  assert.equal(verifyNode00ThreeRootCensus(payload).ok, true);
  // Internal-consistency only. The harder launder — change a field AND recompute the
  // hash — is NOT defended: that needs an independent anchor this slice does not have.
  assert.equal(verifyNode00ThreeRootCensus({ ...payload, content_hash: `sha256:${"0".repeat(64)}` }).ok, false);
  assert.equal(verifyNode00ThreeRootCensus({ ...payload, truth_label: "FORGED" }).ok, false);
  assert.equal(
    verifyNode00ThreeRootCensus({ ...payload, completeness: COMPLETENESS_COMPLETE, truncation_reason: "max_entries" }).ok,
    false,
  );
});

test("review gate closes the loop: build -> verify -> portable-privacy -> tamper-reject", () => {
  const result = runNode00ThreeRootCensusCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, NODE00_THREE_ROOT_CENSUS_SCHEMA);
  assert.equal(result.truth_label, NODE00_THREE_ROOT_CENSUS_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = fullRun();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

// --------------------------------------------------------------------------
// PRIVATE_AGGREGATE — mandated tests 1, 2, 3, 4
// --------------------------------------------------------------------------

test("M1 no private per-entry row is serialized", () => {
  const result = fullRun();
  const privateIds = result.payload.per_root
    .filter((r) => r.privacy_mode === PRIVACY_PRIVATE_AGGREGATE)
    .map((r) => r.root_id);
  assert.ok(privateIds.includes("DOWNLOADS"));

  const privateRows = result.entries.filter((e) => privateIds.includes(e.root_id));
  // The ONLY permitted private row is a delegation marker with exactly four fields.
  for (const row of privateRows) {
    assert.equal(row.entry_type, "delegated_root");
    assert.deepEqual(Object.keys(row).sort(), ["delegated_to", "entry_type", "ownership_state", "root_id"]);
  }
  assert.equal(privateRows.filter((r) => r.entry_type !== "delegated_root").length, 0);

  // The fixture has 4 private-root objects; none becomes an ordinary row.
  const summary = result.payload.per_root.find((r) => r.root_id === "DOWNLOADS").summary;
  assert.ok(summary.files_count + summary.directories_count + summary.symlinks_count > privateRows.length);

  // verifyPortableArtifacts is the enforcement point, not just generation.
  const smuggled = [...result.entries, { root_id: "DOWNLOADS", relative_path: "photo.jpg", entry_type: "file" }];
  const verdict = verifyPortableArtifacts({ payload: result.payload, entries: smuggled, warnings: result.warnings });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.reasons.includes("private_per_entry_row_emitted"));
});

test("M2 dictionary guesses of private filenames match no token in any portable artifact", () => {
  const result = fullRun();
  const tokens = new Set([
    ...stringValues(result.payload),
    ...stringValues(result.entries),
    ...stringValues(result.warnings),
  ]);

  // A guesser knows the candidate names AND the hash function. Neither the raw name
  // nor its unsalted hash may appear — the hash oracle is exactly what the corrective
  // round removed.
  for (const name of [...PRIVATE_NAMES, "Dema/readme.md", "locked/hidden.txt"]) {
    assert.ok(!tokens.has(name), `raw private name "${name}" present`);
    assert.ok(!tokens.has(hashText(name)), `unsalted hash of "${name}" present`);
    for (const token of tokens) {
      assert.ok(!token.includes(name), `private name "${name}" embedded in "${token}"`);
    }
  }
  // No sha256 token of ANY kind is attributable to a private root's contents.
  const privateStrings = new Set(
    stringValues(result.entries.filter((e) => e.root_id === "DOWNLOADS")).concat(
      stringValues(result.payload.per_root.find((r) => r.root_id === "DOWNLOADS")),
    ),
  );
  for (const value of privateStrings) {
    assert.ok(!/^sha256:/.test(value), `private root emitted a hash token: ${value}`);
  }
});

test("M3 exact private sizes, timestamps, inode, device and mode never escape", () => {
  const result = fullRun();
  const downloads = result.payload.per_root.find((r) => r.root_id === "DOWNLOADS");
  for (const field of ["path", "normalized_path_hash", "device", "inode", "mode"]) {
    assert.equal(downloads[field], null, `private root disclosed ${field}`);
  }
  // No forbidden per-entry field on any private row.
  for (const row of result.entries.filter((e) => e.root_id === "DOWNLOADS")) {
    for (const field of PRIVATE_FORBIDDEN_ENTRY_FIELDS) {
      assert.equal(row[field], undefined, `private row carried ${field}`);
    }
  }
  // No exact private numeric metadata anywhere in the private projection.
  const numbers = [];
  (function collect(node) {
    if (typeof node === "number") numbers.push(node);
    else if (Array.isArray(node)) node.forEach(collect);
    else if (node && typeof node === "object") Object.values(node).forEach(collect);
  })({ per_root: downloads, entries: result.entries.filter((e) => e.root_id === "DOWNLOADS") });
  assert.ok(!numbers.includes(PRIVATE_EXACT.size), "exact private file size escaped");
  assert.ok(!numbers.includes(PRIVATE_EXACT.inode), "private inode escaped");
  assert.ok(!numbers.includes(FIXTURE_REFERENCE_TIME_MS), "an exact private timestamp escaped");

  // What IS permitted: bucketed distributions over a declared vocabulary.
  assert.ok(Object.keys(downloads.summary.size_bucket_distribution).length > 0);
  assert.ok(Object.keys(downloads.summary.mtime_bucket_distribution).length > 0);
  assert.equal(sizeBucket(2048), "1KiB_10KiB");
  assert.equal(mtimeBucket(0, FIXTURE_REFERENCE_TIME_MS), "over_3y");
  assert.equal(mtimeBucket(Number.NaN, FIXTURE_REFERENCE_TIME_MS), "unknown");

  // verify() refuses a manifest that re-discloses a private root's identity.
  const leaked = {
    ...result.payload,
    per_root: result.payload.per_root.map((r) => (r.root_id === "DOWNLOADS" ? { ...r, inode: 10 } : r)),
  };
  const verdict = verifyNode00ThreeRootCensus(leaked);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.reasons.includes("private_root_inode_disclosed"));
});

test("M4 aggregate counts are deterministic and independent of root argument order", () => {
  const forward = fixtureRoots();
  const orders = [forward, [...forward].reverse(), [forward[1], forward[2], forward[0]]];
  const hashes = orders.map(
    (roots) => buildNode00ThreeRootCensusPayload(censusRoots(fixtureInput({ roots }))).content_hash,
  );
  assert.equal(hashes[0], hashes[1]);
  assert.equal(hashes[0], hashes[2]);

  const summaries = orders.map(
    (roots) => censusRoots(fixtureInput({ roots })).summaries.DOWNLOADS,
  );
  assert.deepEqual(summaries[0], summaries[1]);
  assert.deepEqual(summaries[0], summaries[2]);

  // Clock movement must not move the hash; volatile fields stay out of the body.
  const slow = censusRoots(fixtureInput({ adapter: makeMemoryAdapter(fixtureTree(), { startMillis: 9e11, tickMillis: 7 }) }));
  assert.equal(buildNode00ThreeRootCensusPayload(slow).content_hash, hashes[0]);
  const serialized = JSON.stringify(buildNode00ThreeRootCensusPayload(census()));
  for (const volatile of ["run_id", "runId", "generated_at", "pid", "temp_dir"]) {
    assert.ok(!serialized.includes(volatile), `volatile field ${volatile} leaked into body`);
  }
});

// --------------------------------------------------------------------------
// Root binding — mandated tests 5, 6
// --------------------------------------------------------------------------

test("M5 the implementation worktree is refused as a census subject", () => {
  const implPath = "/fx/downloads/Dema";
  const plan = planNode00ThreeRootCensus({
    consent: NODE00_THREE_ROOT_CENSUS_GO_PHRASE,
    input: fixtureInput({ implementation_worktree: implPath }),
  });
  assert.equal(plan.eligible, false);
  assert.ok(
    plan.blocked_by.includes("dema_repo_subject_equals_implementation_worktree"),
    plan.blocked_by.join(", "),
  );
  // Trailing-separator and non-normalised spellings must not evade the check.
  for (const spelling of [`${implPath}/`, `${implPath}/./`, `/fx/downloads/../downloads/Dema`]) {
    const p = planNode00ThreeRootCensus({
      consent: NODE00_THREE_ROOT_CENSUS_GO_PHRASE,
      input: fixtureInput({ implementation_worktree: spelling }),
    });
    assert.ok(
      p.blocked_by.includes("dema_repo_subject_equals_implementation_worktree"),
      `spelling ${spelling} evaded the check`,
    );
  }
  // A subject that is NOT the build environment is accepted.
  assert.equal(
    planNode00ThreeRootCensus({
      consent: NODE00_THREE_ROOT_CENSUS_GO_PHRASE,
      input: fixtureInput({ implementation_worktree: "/build/elsewhere" }),
    }).eligible,
    true,
  );
});

test("M6 real nested delegation is exercised: the subject is owned by its own root, never double counted", () => {
  const result = census();
  const topology = deriveCensusTopology(result.admitted);
  assert.deepEqual(topology.containment.map((c) => `${c.parent}>${c.child}`), ["DOWNLOADS>DEMA_REPO"]);

  const marker = result.entries.find((e) => e.root_id === "DOWNLOADS" && e.entry_type === "delegated_root");
  assert.ok(marker, "expected a delegation marker");
  assert.equal(marker.delegated_to, "DEMA_REPO");
  assert.equal(marker.ownership_state, "DELEGATED_ROOT");

  // The child's subtree belongs to the child, and only to the child.
  const dema = result.entries.filter((e) => e.root_id === "DEMA_REPO").map((e) => e.relative_path);
  assert.deepEqual([...dema].sort(), ["readme.md", "src", "src/kernel.js"]);
  assert.equal(result.summaries.DOWNLOADS.delegated_root_count, 1);

  // Zero double count across owned rows.
  const owned = result.entries.filter((e) => e.entry_type !== "delegated_root");
  const identities = owned.map((e) => `${e.device}:${e.inode}`);
  assert.equal(new Set(identities).size, identities.length);
});

test("observed topology — not an assumed one — drives delegation", () => {
  const tree = fixtureTree();
  tree["/fx"].children = ["downloads", "lake", "Dema"];
  tree["/fx/downloads"].children = ["photo.jpg", "shortcut", "locked"];
  tree["/fx/Dema"] = { type: "directory", device: 1, inode: 20, children: ["readme.md"] };
  tree["/fx/Dema/readme.md"] = { type: "file", device: 1, inode: 21, size_bytes: 512 };
  for (const k of ["/fx/downloads/Dema", "/fx/downloads/Dema/readme.md", "/fx/downloads/Dema/src", "/fx/downloads/Dema/src/kernel.js"]) delete tree[k];

  const roots = [
    { id: "DOWNLOADS", path: "/fx/downloads", visibility: "private" },
    { id: "DEMA_REPO", path: "/fx/Dema", visibility: "public" },
    { id: "DATA_LAKE_REPO", path: "/fx/lake", visibility: "public" },
  ];
  const result = censusRoots(fixtureInput({ roots, adapter: makeMemoryAdapter(tree) }));
  assert.equal(result.entries.filter((e) => e.entry_type === "delegated_root").length, 0);
  assert.deepEqual(deriveCensusTopology(result.admitted).containment, []);
  assert.equal(deriveCensusTopology(result.admitted).disjoint.length, 3);
});

// --------------------------------------------------------------------------
// Visitation truth — mandated tests 9, 10
// --------------------------------------------------------------------------

test("M9 a root never visited is NOT_STARTED with a reason, never a successful empty root", () => {
  // max_entries is consumed by the first root in canonical order.
  const result = censusRoots(fixtureInput({ bounds: { max_entries: 2 } }));
  const states = new Map(result.scan_states.map((s) => [s.root_id, s]));
  const unvisited = [...states.values()].filter((s) => s.scan_state === SCAN_NOT_STARTED);
  assert.ok(unvisited.length > 0, "expected at least one unvisited root");
  for (const s of unvisited) {
    assert.equal(s.reason, "GLOBAL_BOUND_EXHAUSTED");
    assert.equal(s.visited_entries, 0);
  }
  assert.equal(result.completeness, COMPLETENESS_BOUNDED_PARTIAL);

  const payload = buildNode00ThreeRootCensusPayload(result);
  // An unvisited root can never be laundered into a global COMPLETE.
  const lying = { ...payload, completeness: COMPLETENESS_COMPLETE, truncation_reason: null };
  const verdict = verifyNode00ThreeRootCensus(lying);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.reasons.includes("complete_with_non_complete_root"));
});

test("M10 each non-complete root carries its own reason and coverage counters", () => {
  const result = censusRoots(fixtureInput({ bounds: { max_entries: 3 } }));
  for (const s of result.scan_states) {
    assert.ok([SCAN_NOT_STARTED, SCAN_COMPLETE, SCAN_PARTIAL].includes(s.scan_state), s.scan_state);
    if (s.scan_state !== SCAN_COMPLETE) assert.ok(s.reason, `${s.root_id} lacks a reason`);
    assert.equal(typeof s.visited_entries, "number");
  }
  const payload = buildNode00ThreeRootCensusPayload(result);
  for (const r of payload.per_root) {
    assert.ok(r.scan_state);
    if (r.scan_state !== SCAN_COMPLETE) assert.ok(r.scan_reason);
  }
  // verify() refuses a non-complete root with no reason.
  const stripped = {
    ...payload,
    per_root: payload.per_root.map((r) => (r.scan_state === SCAN_COMPLETE ? r : { ...r, scan_reason: null })),
  };
  assert.ok(verifyNode00ThreeRootCensus(stripped).reasons.includes("non_complete_root_without_reason"));
});

test("G4 max_depth is PER-ROOT: a shallow disjoint root is still scanned", () => {
  // Previously max_depth wrote into the census-wide truncation state, so one deep root
  // marked every later disjoint root NOT_STARTED/GLOBAL_BOUND_EXHAUSTED even when they
  // were shallow enough to scan.
  const tree = {
    "/": { type: "directory", device: 1, inode: 1, children: ["deep", "shallow"] },
    "/deep": { type: "directory", device: 1, inode: 2, children: ["a"] },
    "/deep/a": { type: "directory", device: 1, inode: 3, children: ["b"] },
    "/deep/a/b": { type: "directory", device: 1, inode: 4, children: ["c"] },
    "/deep/a/b/c": { type: "directory", device: 1, inode: 5, children: ["f.txt"] },
    "/deep/a/b/c/f.txt": { type: "file", device: 1, inode: 6, size_bytes: 10 },
    "/shallow": { type: "directory", device: 1, inode: 7, children: ["s.txt"] },
    "/shallow/s.txt": { type: "file", device: 1, inode: 8, size_bytes: 5 },
  };
  const roots = [
    { id: "DEEP", path: "/deep", visibility: "public" },
    { id: "SHALLOW", path: "/shallow", visibility: "public" },
  ];
  const result = censusRoots({ roots, adapter: makeMemoryAdapter(tree), bounds: { max_depth: 2 }, reference_time_ms: 0 });
  const byId = new Map(result.scan_states.map((s) => [s.root_id, s]));

  assert.equal(byId.get("DEEP").scan_state, SCAN_PARTIAL);
  assert.equal(byId.get("DEEP").reason, "max_depth");
  // The shallow disjoint root must be fully scanned, NOT skipped.
  assert.equal(byId.get("SHALLOW").scan_state, SCAN_COMPLETE, "a shallow disjoint root was skipped by another root's depth limit");
  assert.equal(byId.get("SHALLOW").reason, null);
  assert.ok(byId.get("SHALLOW").visited_entries > 0);
  assert.ok(result.entries.some((e) => e.root_id === "SHALLOW" && e.relative_path === "s.txt"));

  // The census as a whole is still honestly BOUNDED_PARTIAL.
  assert.equal(result.completeness, COMPLETENESS_BOUNDED_PARTIAL);
  assert.equal(verifyNode00ThreeRootCensus(buildNode00ThreeRootCensusPayload(result)).ok, true);
});

test("an unbounded fixture run is COMPLETE with every root COMPLETE", () => {
  const result = census();
  assert.equal(result.completeness, COMPLETENESS_COMPLETE);
  assert.equal(result.truncation_reason, null);
  assert.ok(result.scan_states.every((s) => s.scan_state === SCAN_COMPLETE));
});

// --------------------------------------------------------------------------
// Admission, symlink, device, warnings
// --------------------------------------------------------------------------

test("root admission refuses symlink root, symlink ancestor, missing root and non-directory", () => {
  const cases = [
    [{ "/": { type: "directory", device: 1, inode: 1 }, "/link": { type: "symlink", device: 1, inode: 2 } }, "/link", "root_is_symlink"],
    [
      { "/": { type: "directory", device: 1, inode: 1 }, "/via": { type: "symlink", device: 1, inode: 2 },
        "/via/real": { type: "directory", device: 1, inode: 3, children: [] } },
      "/via/real", "root_ancestor_symlink",
    ],
    [{ "/": { type: "directory", device: 1, inode: 1 } }, "/nope", "root_not_found"],
    [{ "/": { type: "directory", device: 1, inode: 1 }, "/f": { type: "file", device: 1, inode: 2 } }, "/f", "root_not_directory"],
  ];
  for (const [tree, path, code] of cases) {
    assert.throws(
      () => admitCensusRoots({ roots: [{ id: "R", path, visibility: "public" }], adapter: makeMemoryAdapter(tree) }),
      (err) => err instanceof CensusRootAdmissionError && err.code === code,
      `expected ${code} for ${path}`,
    );
  }
});

test("two roots resolving to the same observed identity fail closed rather than double-count", () => {
  const tree = fixtureTree();
  tree["/fx"].children = ["downloads", "lake", "alias"];
  tree["/fx/alias"] = { type: "directory", device: 2, inode: 30, children: [] };
  assert.throws(
    () =>
      admitCensusRoots({
        roots: [
          { id: "DATA_LAKE_REPO", path: "/fx/lake", visibility: "public" },
          { id: "ALIAS", path: "/fx/alias", visibility: "public" },
        ],
        adapter: makeMemoryAdapter(tree),
      }),
    (err) => err instanceof CensusRootAdmissionError && err.code === "duplicate_root_identity",
  );
});

test("a root whose identity changes during the scan is FAILED and never COMPLETE", () => {
  const tree = fixtureTree();
  let calls = 0;
  const base = makeMemoryAdapter(tree);
  const adapter = {
    ...base,
    lstat(path) {
      const stat = base.lstat(path);
      if (path === "/fx/lake") {
        calls += 1;
        if (calls > 1) return { ...stat, inode: stat.inode + 999 };
      }
      return stat;
    },
  };
  const result = censusRoots(fixtureInput({ adapter }));
  assert.equal(result.completeness, COMPLETENESS_BOUNDED_PARTIAL);
  const lake = result.scan_states.find((s) => s.root_id === "DATA_LAKE_REPO");
  assert.equal(lake.scan_state, "FAILED");
  assert.equal(lake.reason, "ROOT_SUBSTITUTED_DURING_SCAN");
});

test("a symlink is recorded as metadata and never resolved or descended", () => {
  const result = census();
  assert.equal(result.summaries.DOWNLOADS.symlinks_count, 1);
  assert.ok(!/realpath|readlink/.test(KERNEL_CODE));
});

test("a cross-device entry is recorded as a boundary failure and never descended", () => {
  const result = census();
  assert.equal(result.summaries.DATA_LAKE_REPO.device_boundary_count, 1);
  assert.ok(result.warnings.some((w) => w.code === "DEVICE_BOUNDARY_NOT_CROSSED"));
  assert.ok(!result.entries.some((e) => e.relative_path === "mnt/elsewhere.bin"));
});

test("unreadable and vanished entries stay explicit evidence — aggregated for private roots", () => {
  const result = census();
  assert.equal(result.summaries.DOWNLOADS.inaccessible_count, 1);
  const privateWarning = result.warnings.find((w) => w.root_id === "DOWNLOADS");
  assert.ok(privateWarning, "private inaccessible entry must still be reported");
  assert.equal(privateWarning.aggregate, true);
  assert.equal(privateWarning.relative_path, undefined);
  assert.ok(privateWarning.count >= 1);

  const tree = fixtureTree();
  tree["/fx/lake/corpus/notes.md"] = { type: "file", device: 2, inode: 32, unreadable_stat: true };
  const withVanished = censusRoots(fixtureInput({ adapter: makeMemoryAdapter(tree) }));
  const vanished = withVanished.warnings.find((w) => w.code === "ENTRY_VANISHED_OR_UNREADABLE");
  assert.ok(vanished);
  assert.equal(vanished.error_code, "EACCES");
});

test("public roots may emit repository-relative paths; a public root under a private one may not emit its own path", () => {
  const payload = buildNode00ThreeRootCensusPayload(census());
  const lake = payload.per_root.find((r) => r.root_id === "DATA_LAKE_REPO");
  assert.equal(lake.path, "/fx/lake");
  assert.equal(lake.privacy_mode, PRIVACY_PUBLIC_PATHS);

  const dema = payload.per_root.find((r) => r.root_id === "DEMA_REPO");
  assert.equal(dema.path, null, "its own path would disclose the private parent as a prefix");

  const leaked = {
    ...payload,
    per_root: payload.per_root.map((r) => (r.root_id === "DEMA_REPO" ? { ...r, path: "/fx/downloads/Dema" } : r)),
  };
  assert.ok(verifyNode00ThreeRootCensus(leaked).reasons.includes("nested_root_discloses_private_parent_path"));
});

test("private-root filenames never appear in thrown errors", () => {
  const tree = { "/": { type: "directory", device: 1, inode: 1 }, "/fx": { type: "directory", device: 1, inode: 2 } };
  try {
    admitCensusRoots({
      roots: [{ id: "DOWNLOADS", path: "/fx/secret-folder-name", visibility: "private" }],
      adapter: makeMemoryAdapter(tree),
    });
    assert.fail("expected admission to fail");
  } catch (err) {
    assert.ok(err instanceof CensusRootAdmissionError);
    assert.equal(err.message, "root_not_found:DOWNLOADS");
  }
});

// --------------------------------------------------------------------------
// Scale
// --------------------------------------------------------------------------

test("collection digests survive past the canonical 1024-element array cap", () => {
  // Found by the first REAL run: sha256CanonicalJsonV1(entries) threw
  // `array_length_exceeded: array length 626461 exceeds 1024`.
  const rows = Array.from({ length: 5000 }, (_, i) => ({ root_id: "R", n: i }));
  const digest = foldDigest(rows);
  assert.match(digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(digest, foldDigest(rows.map((r) => ({ ...r }))));
  assert.notEqual(digest, foldDigest([...rows].reverse()), "fold must bind row order");
  assert.notEqual(digest, foldDigest(rows.slice(0, -1)), "fold must bind row count");
  assert.match(foldDigest([]), /^sha256:[0-9a-f]{64}$/);
  for (const n of [DIGEST_FOLD_WIDTH, DIGEST_FOLD_WIDTH + 1]) {
    assert.match(foldDigest(Array.from({ length: n }, (_, i) => ({ n: i }))), /^sha256:[0-9a-f]{64}$/);
  }
});

test("a census larger than the array cap builds, verifies and stays deterministic", () => {
  const tree = { "/": { type: "directory", device: 1, inode: 1, children: ["big"] } };
  const children = [];
  for (let i = 0; i < 2500; i += 1) {
    const name = `f${i}.txt`;
    children.push(name);
    tree[`/big/${name}`] = { type: "file", device: 1, inode: 100 + i, size_bytes: i };
  }
  tree["/big"] = { type: "directory", device: 1, inode: 2, children };
  const roots = [{ id: "BIG", path: "/big", visibility: "public" }];
  const input = { roots, adapter: makeMemoryAdapter(tree), reference_time_ms: FIXTURE_REFERENCE_TIME_MS };
  const result = censusRoots(input);
  assert.equal(result.entries.length, 2500);
  const payload = buildNode00ThreeRootCensusPayload(result);
  assert.equal(verifyNode00ThreeRootCensus(payload).ok, true);
  assert.equal(payload.content_hash, buildNode00ThreeRootCensusPayload(censusRoots(input)).content_hash);
});

// --------------------------------------------------------------------------
// Reachability
// --------------------------------------------------------------------------

test("the kernel is pure: no fs import and no content-reading or mutating API is reachable", () => {
  assert.ok(!/from\s+"node:fs"/.test(KERNEL_CODE), "kernel must not import node:fs");
  for (const api of ["readFile", "createReadStream", "writeFile", "rename", "mkdir", "chmod", "unlink", "copyFile", "realpath"]) {
    assert.ok(!new RegExp(`\\b${api}\\b`).test(KERNEL_CODE), `kernel reaches forbidden API ${api}`);
  }
  assert.ok(!/\bstatSync\b|\bopenSync\b|\bfs\.open\b/.test(KERNEL_CODE));
});

test("the effect adapter exposes exactly lstat, readdir and now — no wider surface", () => {
  assert.deepEqual(Object.keys(censusFsAdapter()).sort(), ["lstat", "now", "readdir"]);
  assert.ok(/lstatSync/.test(ADAPTER_CODE));
  assert.ok(!/\bstatSync\(/.test(ADAPTER_CODE.replace(/lstatSync\(/g, "")));
});

test("M11-source no scanned-root mutator is reachable: every writer mutation targets a proof-root path", () => {
  const mutators = ADAPTER_CODE.match(/\b(mkdirSync|writeFileSync|renameSync|rmSync)\(/g) ?? [];
  const routed = ADAPTER_CODE.match(/\bfs\.(mkdirSync|writeFileSync|renameSync|rmSync)\(/g) ?? [];
  assert.equal(mutators.length, routed.length, "an unrouted mutation call exists in the adapter");
  for (const call of ADAPTER_CODE.matchAll(/fs\.(mkdirSync|writeFileSync|renameSync|rmSync)\(([^,)]+)/g)) {
    assert.ok(/tempDir|finalDir/.test(call[2]), `mutation ${call[1]} targets ${call[2]}, not a proof-root path`);
  }
});

test("M-signer the real signer path is never resolved or referenced by this slice", () => {
  for (const src of [KERNEL_CODE, ADAPTER_CODE]) {
    assert.ok(!/signer|signing|private_key|privateKey|ed25519|authorship/i.test(src));
  }
});

// --------------------------------------------------------------------------
// External proof writer — mandated tests 7, 8, 11, 12, 13
// --------------------------------------------------------------------------

function fakeWriterFs(tree, { gitDirs = [], files = {} } = {}) {
  const state = { tree: { ...tree }, files: { ...files }, removed: [], wrote: [], made: [], renamed: [] };
  const api = {
    state,
    lstatSync(path) {
      const node = state.tree[path];
      if (!node) {
        const err = new Error("ENOENT");
        err.code = "ENOENT";
        throw err;
      }
      return {
        dev: node.device, ino: node.inode, mode: node.mode ?? 0o40700, uid: node.uid ?? 1000,
        isSymbolicLink: () => node.type === "symlink",
        isDirectory: () => node.type === "directory",
        isFile: () => node.type === "file",
      };
    },
    existsSync: (p) => gitDirs.includes(p) || Boolean(state.tree[p]) || Object.hasOwn(state.files, p),
    readFileSync: (p) => {
      if (!Object.hasOwn(state.files, p)) {
        const err = new Error("ENOENT");
        err.code = "ENOENT";
        throw err;
      }
      return state.files[p];
    },
    mkdirSync: (p) => { state.made.push(p); state.tree[p] = { type: "directory", device: 1, inode: 999, uid: 1000 }; },
    writeFileSync: (p, data) => { state.wrote.push(p); state.files[p] = data; },
    renameSync: (from, to) => { state.renamed.push([from, to]); },
    rmSync: (p) => { state.removed.push(p); delete state.tree[p]; },
  };
  return api;
}

// A SAFE chain: every ancestor owner-only writable, owned by uid 1000.
const SAFE_TREE = {
  "/": { type: "directory", device: 1, inode: 1, mode: 0o40755, uid: 0 },
  "/data": { type: "directory", device: 1, inode: 2, mode: 0o40755, uid: 1000 },
  "/data/proofs": { type: "directory", device: 1, inode: 3, mode: 0o40755, uid: 1000 },
  "/data/proofs/run": { type: "directory", device: 1, inode: 4, mode: 0o40700, uid: 1000 },
};

test("M7 a non-sticky GROUP-writable ancestor is refused BEFORE any write", () => {
  const hostile = { ...SAFE_TREE, "/data/proofs": { type: "directory", device: 1, inode: 3, mode: 0o40775, uid: 1000 } };
  const fs = fakeWriterFs(hostile);
  const plan = planProofOutput({ proofRoot: "/data/proofs/run", fs, currentUid: 1000 });
  assert.equal(plan.ok, false);
  assert.ok(plan.blocked_by.includes("proof_root_ancestor_group_writable"), plan.blocked_by.join(", "));

  // And no write may occur.
  const result = runNode00ThreeRootCensusCheck();
  const written = writeCensusProof({ proofRoot: "/data/proofs/run", runId: "R1", result, scannedRoots: [], fs, currentUid: 1000 });
  assert.equal(written.ok, false);
  assert.deepEqual(fs.state.made, [], "a directory was created despite an unsafe ancestor");
  assert.deepEqual(fs.state.wrote, [], "a file was written despite an unsafe ancestor");

  // World-writable is likewise refused; sticky is exempt because only an entry's
  // owner may rename or remove it.
  const world = { ...SAFE_TREE, "/data/proofs": { type: "directory", device: 1, inode: 3, mode: 0o40777, uid: 1000 } };
  assert.ok(
    planProofOutput({ proofRoot: "/data/proofs/run", fs: fakeWriterFs(world), currentUid: 1000 }).blocked_by
      .includes("proof_root_ancestor_world_writable"),
  );
  // Sticky owned by US is exempt; sticky owned by a FOREIGN principal is not, because
  // in a sticky directory the DIRECTORY OWNER may still rename or remove our entry.
  const stickyOurs = { ...SAFE_TREE, "/data/proofs": { type: "directory", device: 1, inode: 3, mode: 0o41777, uid: 1000 } };
  assert.equal(planProofOutput({ proofRoot: "/data/proofs/run", fs: fakeWriterFs(stickyOurs), currentUid: 1000 }).ok, true);
  assert.equal(replaceableByOthers(0o40775, 1000, 1000), true);
  assert.equal(replaceableByOthers(0o41777, 1000, 1000), false);
  assert.equal(replaceableByOthers(0o41777, 0, 1000), false, "root-owned sticky is trusted");
  assert.equal(replaceableByOthers(0o40755, 1000, 1000), false);
  // Unknown ownership must fail closed.
  assert.equal(replaceableByOthers(0o41777), true);
});

test("G2 a sticky ancestor owned by a FOREIGN principal is refused — its owner can still replace our entry", () => {
  const foreignSticky = { ...SAFE_TREE, "/data/proofs": { type: "directory", device: 1, inode: 3, mode: 0o41777, uid: 4242 } };
  const fs = fakeWriterFs(foreignSticky);
  const plan = planProofOutput({ proofRoot: "/data/proofs/run", fs, currentUid: 1000 });
  assert.equal(plan.ok, false);
  assert.ok(plan.blocked_by.includes("proof_root_ancestor_sticky_foreign_owned"), plan.blocked_by.join(", "));
  assert.equal(replaceableByOthers(0o41777, 4242, 1000), true);

  const written = writeCensusProof({
    proofRoot: "/data/proofs/run", runId: "RUN-G2", result: runNode00ThreeRootCensusCheck(),
    scannedRoots: [], fs, currentUid: 1000,
  });
  assert.equal(written.ok, false);
  assert.deepEqual(fs.state.made, [], "a directory was created under a foreign-owned sticky ancestor");
});

test("the writer refuses every other unsafe output location with a NAMED block", () => {
  const cases = [
    [{ proofRoot: "relative/path" }, "output_path_not_absolute", SAFE_TREE],
    [{ proofRoot: "/data/proofs/absent" }, "output_root_missing", SAFE_TREE],
    [{ proofRoot: "/data/proofs/run", scannedRoots: [{ path: "/data/proofs" }] }, "output_inside_scanned_root", SAFE_TREE],
    [{ proofRoot: "/data/proofs/run", demaHome: "/data/proofs" }, "output_beneath_dema_home", SAFE_TREE],
    [{ proofRoot: "/data/proofs/run" }, "output_root_is_symlink",
      { ...SAFE_TREE, "/data/proofs/run": { type: "symlink", device: 1, inode: 4, uid: 1000 } }],
    [{ proofRoot: "/data/proofs/run" }, "output_root_ancestor_symlink",
      { ...SAFE_TREE, "/data/proofs": { type: "symlink", device: 1, inode: 3, uid: 1000 } }],
    [{ proofRoot: "/data/proofs/run" }, "output_root_not_owned_by_current_uid",
      { ...SAFE_TREE, "/data/proofs/run": { type: "directory", device: 1, inode: 4, mode: 0o40700, uid: 4242 } }],
  ];
  for (const [args, expected, tree] of cases) {
    const plan = planProofOutput({ ...args, fs: fakeWriterFs(tree), currentUid: 1000 });
    assert.equal(plan.ok, false, expected);
    assert.ok(plan.blocked_by.includes(expected), `${expected} not in ${plan.blocked_by.join(", ")}`);
  }
  const gitPlan = planProofOutput({
    proofRoot: "/data/proofs/run",
    fs: fakeWriterFs(SAFE_TREE, { gitDirs: ["/data/proofs/.git"] }),
    currentUid: 1000,
  });
  assert.ok(gitPlan.blocked_by.includes("output_inside_repository_worktree"));
});

test("M8 no artifact is created beneath a substituted proof root", () => {
  const result = runNode00ThreeRootCensusCheck();
  const fs = fakeWriterFs(SAFE_TREE);
  let statCalls = 0;
  const baseLstat = fs.lstatSync;
  fs.lstatSync = (p) => {
    const stat = baseLstat(p);
    if (p === "/data/proofs/run") {
      statCalls += 1;
      if (statCalls > 1) return { ...stat, ino: stat.ino + 1 }; // substituted mid-flight
    }
    return stat;
  };
  fs.state.files[join("/data/proofs/run", ".tmp-RUN-8", RUN_MARKER_FILENAME)] = JSON.stringify({
    run_id: "RUN-8", marker: RUN_MARKER_FILENAME,
  });
  const written = writeCensusProof({ proofRoot: "/data/proofs/run", runId: "RUN-8", result, scannedRoots: [], fs, currentUid: 1000 });
  assert.equal(written.ok, false);
  assert.ok(written.blocked_by.includes("proof_root_identity_changed_before_promotion"), written.blocked_by.join(", "));
  assert.deepEqual(fs.state.renamed, [], "promotion happened despite a substituted root");
  // The half-written run directory was reclaimed, not left behind.
  assert.ok(fs.state.removed.includes("/data/proofs/run/.tmp-RUN-8"));
});

test("M11 a failed write returns a NAMED envelope — no raw fs exception escapes", () => {
  const result = runNode00ThreeRootCensusCheck();
  const fs = fakeWriterFs(SAFE_TREE);
  fs.writeFileSync = (p) => {
    if (p.endsWith("entries.jsonl")) throw Object.assign(new Error("ENOSPC"), { code: "ENOSPC" });
    fs.state.wrote.push(p);
    fs.state.files[p] = "";
  };
  let written;
  assert.doesNotThrow(() => {
    written = writeCensusProof({ proofRoot: "/data/proofs/run", runId: "RUN-11", result, scannedRoots: [], fs, currentUid: 1000 });
  });
  assert.equal(written.ok, false);
  assert.ok(written.blocked_by.includes("proof_write_failed"), written.blocked_by.join(", "));
  assert.equal(written.run_dir, null);
});

test("M12 current-run temporary output is safely reclaimed, and the same run id retries cleanly", () => {
  const result = runNode00ThreeRootCensusCheck();
  const fs = fakeWriterFs(SAFE_TREE);
  let failOnce = true;
  const realWrite = fs.writeFileSync;
  fs.writeFileSync = (p, d) => {
    if (failOnce && p.endsWith("receipt.json")) throw Object.assign(new Error("EIO"), { code: "EIO" });
    realWrite(p, d);
  };
  const first = writeCensusProof({ proofRoot: "/data/proofs/run", runId: "RUN-12", result, scannedRoots: [], fs, currentUid: 1000 });
  assert.equal(first.ok, false);
  // The temp dir this invocation created was revalidated and removed — no poisoning.
  assert.ok(fs.state.removed.includes("/data/proofs/run/.tmp-RUN-12"));
  assert.equal(fs.state.tree["/data/proofs/run/.tmp-RUN-12"], undefined);

  failOnce = false;
  const retry = writeCensusProof({ proofRoot: "/data/proofs/run", runId: "RUN-12", result, scannedRoots: [], fs, currentUid: 1000 });
  assert.equal(retry.ok, true, retry.blocked_by?.join(", "));
  assert.ok(!retry.blocked_by.includes("EEXIST"));
});

test("M13 an unrelated or unverifiable temporary path is never removed", () => {
  const result = runNode00ThreeRootCensusCheck();
  // A pre-existing temp dir from ANOTHER process is evidence, not garbage.
  const tree = { ...SAFE_TREE, "/data/proofs/run/.tmp-RUN-13": { type: "directory", device: 1, inode: 77, uid: 1000 } };
  const fs = fakeWriterFs(tree);
  const written = writeCensusProof({ proofRoot: "/data/proofs/run", runId: "RUN-13", result, scannedRoots: [], fs, currentUid: 1000 });
  assert.equal(written.ok, false);
  assert.ok(written.blocked_by.includes("STALE_TEMP_RUN_REQUIRES_OPERATOR_RECOVERY"), written.blocked_by.join(", "));
  assert.equal(written.stale_temp_dir, "/data/proofs/run/.tmp-RUN-13");
  assert.deepEqual(fs.state.removed, [], "a foreign temp directory was deleted");
  assert.deepEqual(fs.state.made, [], "a temp directory was created over a stale one");

  // A temp dir that was SUBSTITUTED since we created it is reported, never removed —
  // deleting it would destroy someone else's directory.
  const fs2 = fakeWriterFs(SAFE_TREE);
  let statCount = 0;
  const baseLstat2 = fs2.lstatSync;
  fs2.lstatSync = (p) => {
    const st = baseLstat2(p);
    if (p === "/data/proofs/run/.tmp-RUN-13B") {
      statCount += 1;
      if (statCount > 1) return { ...st, ino: st.ino + 5000 }; // swapped under us
    }
    return st;
  };
  fs2.writeFileSync = (p, d) => {
    if (p.endsWith("manifest.json")) throw Object.assign(new Error("EIO"), { code: "EIO" });
    fs2.state.wrote.push(p);
    fs2.state.files[p] = d;
  };
  const out = writeCensusProof({ proofRoot: "/data/proofs/run", runId: "RUN-13B", result, scannedRoots: [], fs: fs2, currentUid: 1000 });
  assert.equal(out.ok, false);
  assert.ok(out.blocked_by.includes("RECOVERABLE_TEMP_ARTIFACT_REQUIRES_HUMAN"), out.blocked_by.join(", "));
  assert.ok(out.blocked_by.includes("temp_dir_substituted_since_creation"));
  assert.deepEqual(fs2.state.removed, [], "a substituted directory was deleted");
});

test("G3 a failed MARKER write does not strand the temp dir — cleanup binds to identity, not the marker", () => {
  // Previously cleanup required reading the marker, so a marker-write failure left the
  // directory behind and every same-run-id retry returned STALE_TEMP…
  const result = runNode00ThreeRootCensusCheck();
  const fs = fakeWriterFs(SAFE_TREE);
  let failMarker = true;
  const realWrite = fs.writeFileSync;
  fs.writeFileSync = (p, d) => {
    if (failMarker && p.endsWith(RUN_MARKER_FILENAME)) throw Object.assign(new Error("EIO"), { code: "EIO" });
    realWrite(p, d);
  };
  const first = writeCensusProof({ proofRoot: "/data/proofs/run", runId: "RUN-G3", result, scannedRoots: [], fs, currentUid: 1000 });
  assert.equal(first.ok, false);
  assert.ok(first.blocked_by.includes("proof_write_failed"), first.blocked_by.join(", "));
  assert.ok(fs.state.removed.includes("/data/proofs/run/.tmp-RUN-G3"), "temp dir was stranded by a marker failure");
  assert.ok(!first.blocked_by.includes("RECOVERABLE_TEMP_ARTIFACT_REQUIRES_HUMAN"));

  failMarker = false;
  const retry = writeCensusProof({ proofRoot: "/data/proofs/run", runId: "RUN-G3", result, scannedRoots: [], fs, currentUid: 1000 });
  assert.equal(retry.ok, true, retry.blocked_by?.join(", "));
  assert.ok(!retry.blocked_by.includes("STALE_TEMP_RUN_REQUIRES_OPERATOR_RECOVERY"));
});

test("the writer promotes by SAME-PARENT rename and emits the full artifact set", () => {
  const result = runNode00ThreeRootCensusCheck();
  const fs = fakeWriterFs(SAFE_TREE);
  const written = writeCensusProof({ proofRoot: "/data/proofs/run", runId: "RUN-OK", result, scannedRoots: [], fs, currentUid: 1000 });
  assert.equal(written.ok, true, written.blocked_by?.join(", "));
  const [from, to] = fs.state.renamed[0];
  assert.equal(from.slice(0, from.lastIndexOf("/")), to.slice(0, to.lastIndexOf("/")));
  assert.deepEqual(
    fs.state.wrote.map((p) => p.split("/").pop()).sort(),
    [RUN_MARKER_FILENAME, "entries.jsonl", "manifest.json", "manifest.sha256", "receipt.json", "warnings.jsonl"].sort(),
  );
});

test("the writer refuses to emit artifacts that violate the private-aggregate contract", () => {
  const result = runNode00ThreeRootCensusCheck();
  const poisoned = {
    ...result,
    entries: [...result.entries, { root_id: "DOWNLOADS", relative_path: "photo.jpg", entry_type: "file" }],
  };
  const fs = fakeWriterFs(SAFE_TREE);
  const written = writeCensusProof({ proofRoot: "/data/proofs/run", runId: "RUN-P", result: poisoned, scannedRoots: [], fs, currentUid: 1000 });
  assert.equal(written.ok, false);
  assert.ok(written.blocked_by.includes("private_per_entry_row_emitted"));
  assert.deepEqual(fs.state.wrote, [], "artifacts were written despite a privacy violation");
});

test("hostile concurrent parent substitution is DECLARED UNPROVEN, not claimed defeated", () => {
  assert.equal(PROOF_ROOT_SUBSTITUTION_RESISTANCE, "NOT_PROVEN_AGAINST_HOSTILE_CONCURRENT_MUTATOR");
  assert.ok(/NOT_PROVEN_AGAINST_HOSTILE_CONCURRENT_MUTATOR/.test(ADAPTER_SRC));
});

// --------------------------------------------------------------------------
// Slice isolation
// --------------------------------------------------------------------------

test("this slice changes no TASK-029, TASK-030, TASK-031 or TASK-032 file", () => {
  // CI checks out at fetch-depth 1, so `origin/main` does NOT resolve there — the
  // first version used `git diff origin/main...HEAD` and threw on CI (exact-head run
  // at f47f4a5: `not ok 4793`). Resolve a base ref if one exists; otherwise fall back
  // to the always-available working tree, and say which scope was used.
  const git = (args) => execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
  const resolves = (ref) => {
    try {
      git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
      return true;
    } catch {
      return false;
    }
  };
  const base = ["origin/main", "main"].find(resolves) ?? null;
  const changed = base
    ? git(["diff", "--name-only", `${base}...HEAD`]).split("\n").filter(Boolean)
    : git(["status", "--porcelain"]).split("\n").filter(Boolean).map((l) => l.slice(3));
  const quarantined = changed.filter((f) => /task-0(29|30|31|32)/i.test(f));
  assert.deepEqual(
    quarantined,
    [],
    `slice touched quarantined task files (scope=${base ? `diff vs ${base}` : "working tree"}): ${quarantined.join(", ")}`,
  );
});
