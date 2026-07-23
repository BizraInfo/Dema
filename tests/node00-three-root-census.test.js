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
  runNode00ThreeRootCensus,
  censusRoots,
  admitCensusRoots,
  deriveCensusTopology,
  hashText,
  foldDigest,
  DIGEST_FOLD_WIDTH,
  CensusRootAdmissionError,
  COMPLETENESS_COMPLETE,
  COMPLETENESS_BOUNDED_PARTIAL,
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
} from "../scripts/review/node00-three-root-census-check.mjs";
import {
  planProofOutput,
  writeCensusProof,
  censusFsAdapter,
  PROOF_ROOT_SUBSTITUTION_RESISTANCE,
} from "../apps/cli/src/commands/node00-three-root-census.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Reachability is a property of CODE, not of prose. Both modules deliberately NAME
// the forbidden APIs in their headers to document the boundary; scanning raw text
// would flag that documentation as a violation. Strip comments first so the assertion
// binds to what actually executes.
function codeOnly(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
}

const KERNEL_SRC = readFileSync(join(REPO_ROOT, "packages/core/src/node00-three-root-census.js"), "utf8");
const ADAPTER_SRC = readFileSync(join(REPO_ROOT, "apps/cli/src/commands/node00-three-root-census.js"), "utf8");
const KERNEL_CODE = codeOnly(KERNEL_SRC);
const ADAPTER_CODE = codeOnly(ADAPTER_SRC);

// Collect every STRING VALUE in a structure. A privacy leak is data escaping, so the
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

// Every real Downloads-side name in the fixture. None of these may ever escape.
const PRIVATE_NAMES = ["photo.jpg", "shortcut", "locked", "hidden.txt", "/fx/downloads"];

// --------------------------------------------------------------------------
// Proof contract (consent, content addressing, body-bound verification)
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
  assert.deepEqual(
    Object.keys(payload.boundary).sort(),
    [
      "daemon_started",
      "execution_allowed",
      "file_mutation_performed",
      "live_execution_performed",
      "model_invocation_performed",
      "network_used",
      "token_minted",
      "wallet_accessed",
    ],
  );
  assert.ok(Object.values(payload.boundary).every((v) => v === false));

  // A payload missing a boundary key, or carrying an extra one, must be refused.
  const { execution_allowed, ...missing } = payload.boundary;
  assert.equal(verifyNode00ThreeRootCensus({ ...payload, boundary: missing }).ok, false);
  assert.equal(
    verifyNode00ThreeRootCensus({ ...payload, boundary: { ...payload.boundary, extra_key: false } }).ok,
    false,
  );
});

test("verify accepts a freshly built payload", () => {
  assert.equal(verifyNode00ThreeRootCensus(buildNode00ThreeRootCensusPayload(census())).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildNode00ThreeRootCensusPayload(census());
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyNode00ThreeRootCensus(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  // Internal-consistency only. The harder launder — change a field AND recompute the
  // hash — is NOT defended here: that needs an independent anchor (a signature or an
  // externally measured state hash), which this slice does not have. No
  // launder-resistance is claimed.
  const payload = buildNode00ThreeRootCensusPayload(census());
  assert.equal(verifyNode00ThreeRootCensus({ ...payload, truth_label: "FORGED" }).ok, false);
  const bumped = { ...payload, totals: { ...payload.totals, entries: payload.totals.entries + 1 } };
  assert.equal(verifyNode00ThreeRootCensus(bumped).ok, false);
});

test("verify rejects COMPLETE carrying a truncation reason", () => {
  const payload = buildNode00ThreeRootCensusPayload(census());
  const lying = { ...payload, completeness: COMPLETENESS_COMPLETE, truncation_reason: "max_entries" };
  assert.equal(verifyNode00ThreeRootCensus(lying).ok, false);
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runNode00ThreeRootCensusCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, NODE00_THREE_ROOT_CENSUS_SCHEMA);
  assert.equal(result.truth_label, NODE00_THREE_ROOT_CENSUS_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runNode00ThreeRootCensus({
    consent: NODE00_THREE_ROOT_CENSUS_GO_PHRASE,
    input: fixtureInput(),
  });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

// --------------------------------------------------------------------------
// Determinism — argument ordering, run id, timestamp, PID, temp path
// --------------------------------------------------------------------------

test("root argument ordering changes neither ownership nor the body hash", () => {
  const forward = fixtureRoots();
  const reversed = [...forward].reverse();
  const rotated = [forward[1], forward[2], forward[0]];
  const hashes = [forward, reversed, rotated].map((roots) => {
    const result = censusRoots({ roots, adapter: makeMemoryAdapter(fixtureTree()) });
    return buildNode00ThreeRootCensusPayload(result).content_hash;
  });
  assert.equal(hashes[0], hashes[1]);
  assert.equal(hashes[0], hashes[2]);

  const ownership = [forward, reversed, rotated].map((roots) =>
    censusRoots({ roots, adapter: makeMemoryAdapter(fixtureTree()) }).entries.map(
      (e) => `${e.root_id}:${e.relative_path ?? e.relative_path_hash}`,
    ),
  );
  assert.deepEqual(ownership[0], ownership[1]);
  assert.deepEqual(ownership[0], ownership[2]);
});

test("the same frozen snapshot yields the same body hash across independent runs", () => {
  const a = buildNode00ThreeRootCensusPayload(census());
  const b = buildNode00ThreeRootCensusPayload(census());
  assert.equal(a.content_hash, b.content_hash);
});

test("no volatile run metadata (run id, timestamp, pid, temp path) leaks into the hashed body", () => {
  const payload = buildNode00ThreeRootCensusPayload(census());
  const serialized = JSON.stringify(payload);
  for (const volatile of ["run_id", "runId", "timestamp", "generated_at", "pid", "tmp", "temp_dir"]) {
    assert.ok(!serialized.includes(volatile), `volatile field ${volatile} leaked into body`);
  }
  // Clock movement must not move the hash.
  const slow = censusRoots({
    roots: fixtureRoots(),
    adapter: makeMemoryAdapter(fixtureTree(), { startMillis: 1_700_000_000_000, tickMillis: 7 }),
  });
  assert.equal(buildNode00ThreeRootCensusPayload(slow).content_hash, payload.content_hash);
});

test("collection digests survive past the canonical 1024-element array cap", () => {
  // Found by the first REAL run: `sha256CanonicalJsonV1(entries)` threw
  // `array_length_exceeded: array length 626461 exceeds 1024`. The canonical byte
  // contract caps arrays on purpose, so collections must be folded, never inlined.
  const rows = Array.from({ length: 5000 }, (_, i) => ({ root_id: "R", n: i }));
  const digest = foldDigest(rows);
  assert.match(digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(digest, foldDigest(rows.map((r) => ({ ...r }))), "fold must be deterministic");
  assert.notEqual(digest, foldDigest([...rows].reverse()), "fold must bind row order");
  assert.notEqual(digest, foldDigest(rows.slice(0, -1)), "fold must bind row count");
  assert.match(foldDigest([]), /^sha256:[0-9a-f]{64}$/);
  // Exactly at, and one past, a fold boundary.
  for (const n of [DIGEST_FOLD_WIDTH, DIGEST_FOLD_WIDTH + 1, DIGEST_FOLD_WIDTH * DIGEST_FOLD_WIDTH + 1]) {
    if (n > 300000) continue;
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
  const result = censusRoots({ roots, adapter: makeMemoryAdapter(tree) });
  assert.equal(result.entries.length, 2500);
  const payload = buildNode00ThreeRootCensusPayload(result);
  assert.equal(verifyNode00ThreeRootCensus(payload).ok, true);
  assert.equal(
    payload.content_hash,
    buildNode00ThreeRootCensusPayload(censusRoots({ roots, adapter: makeMemoryAdapter(tree) })).content_hash,
  );
});

// --------------------------------------------------------------------------
// Ownership law — most-specific root, delegation, zero double count
// --------------------------------------------------------------------------

test("a nested root is delegated, not descended: its subtree is never enumerated by the parent", () => {
  const result = census();
  const downloads = result.entries.filter((e) => e.root_id === "DOWNLOADS");
  const marker = downloads.find((e) => e.delegated_root === "DEMA_REPO");
  assert.ok(marker, "expected a delegation marker for the nested root");
  assert.equal(marker.entry_type, "directory");

  // The parent root must not hold any entry from inside the child root. DOWNLOADS is
  // private, so this is asserted through path HASHES — never raw paths.
  for (const inner of ["Dema/readme.md", "Dema/src", "Dema/src/kernel.js"]) {
    const forbidden = hashText(inner);
    assert.ok(
      !downloads.some((e) => e.relative_path_hash === forbidden),
      `DOWNLOADS enumerated ${inner}, which DEMA_REPO owns`,
    );
  }
  // And the child root does own them.
  const dema = result.entries.filter((e) => e.root_id === "DEMA_REPO").map((e) => e.relative_path);
  assert.deepEqual([...dema].sort(), ["readme.md", "src", "src/kernel.js"]);
});

test("nested-root double count is zero: no filesystem identity is owned twice", () => {
  const result = census();
  const owned = result.entries.filter((e) => e.delegated_root === null);
  const identities = owned.map((e) => `${e.device}:${e.inode}`);
  assert.equal(new Set(identities).size, identities.length, "an identity was counted under two roots");
});

test("observed topology — not an assumed one — drives delegation", () => {
  // Same three root IDs, but DEMA_REPO relocated OUTSIDE Downloads. Nothing may
  // delegate, because containment is measured, not presumed.
  const tree = fixtureTree();
  tree["/fx"].children = ["downloads", "lake", "Dema"];
  tree["/fx/downloads"].children = ["photo.jpg", "shortcut", "locked"];
  tree["/fx/Dema"] = { type: "directory", device: 1, inode: 20, children: ["readme.md"] };
  tree["/fx/Dema/readme.md"] = { type: "file", device: 1, inode: 21, size_bytes: 512 };
  delete tree["/fx/downloads/Dema"];
  delete tree["/fx/downloads/Dema/readme.md"];
  delete tree["/fx/downloads/Dema/src"];
  delete tree["/fx/downloads/Dema/src/kernel.js"];

  const roots = [
    { id: "DOWNLOADS", path: "/fx/downloads", visibility: "private" },
    { id: "DEMA_REPO", path: "/fx/Dema", visibility: "public" },
    { id: "DATA_LAKE_REPO", path: "/fx/lake", visibility: "public" },
  ];
  const result = censusRoots({ roots, adapter: makeMemoryAdapter(tree) });
  assert.equal(result.entries.filter((e) => e.delegated_root !== null).length, 0);

  const topology = deriveCensusTopology(result.admitted);
  assert.deepEqual(topology.containment, []);
  assert.equal(topology.disjoint.length, 3);
});

test("measured topology of the canonical fixture: DOWNLOADS contains DEMA_REPO, DATA_LAKE_REPO disjoint from both", () => {
  const topology = deriveCensusTopology(census().admitted);
  assert.deepEqual(
    topology.containment.map((c) => `${c.parent}>${c.child}`),
    ["DOWNLOADS>DEMA_REPO"],
  );
  assert.deepEqual(
    topology.disjoint.map((pair) => pair.join("|")).sort(),
    ["DATA_LAKE_REPO|DEMA_REPO", "DATA_LAKE_REPO|DOWNLOADS"],
  );
});

// --------------------------------------------------------------------------
// Root admission — fail closed
// --------------------------------------------------------------------------

test("root admission refuses a symlink root, a symlink ancestor, a missing root and a non-directory", () => {
  const cases = [
    [{ "/": { type: "directory", device: 1, inode: 1 }, "/link": { type: "symlink", device: 1, inode: 2 } }, "/link", "root_is_symlink"],
    [
      {
        "/": { type: "directory", device: 1, inode: 1 },
        "/via": { type: "symlink", device: 1, inode: 2 },
        "/via/real": { type: "directory", device: 1, inode: 3, children: [] },
      },
      "/via/real",
      "root_ancestor_symlink",
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
  // An alias directory entry that reports the SAME device+inode as /fx/lake.
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

test("a root whose identity changes during the scan can never be reported COMPLETE", () => {
  const tree = fixtureTree();
  let calls = 0;
  const base = makeMemoryAdapter(tree);
  const adapter = {
    ...base,
    lstat(path) {
      const stat = base.lstat(path);
      // Substitute /fx/lake's inode only on the post-traversal revalidation.
      if (path === "/fx/lake") {
        calls += 1;
        if (calls > 1) return { ...stat, inode: stat.inode + 999 };
      }
      return stat;
    },
  };
  const result = censusRoots({ roots: fixtureRoots(), adapter });
  assert.equal(result.completeness, COMPLETENESS_BOUNDED_PARTIAL);
  assert.ok(result.warnings.some((w) => w.code === "ROOT_SUBSTITUTED_DURING_SCAN"));
});

// --------------------------------------------------------------------------
// Symlink, device and bounds laws
// --------------------------------------------------------------------------

test("a symlink is recorded as metadata and never resolved or descended", () => {
  const result = census();
  const links = result.entries.filter((e) => e.entry_type === "symlink");
  assert.equal(links.length, 1);
  assert.equal(links[0].root_id, "DOWNLOADS");
  // Nothing beneath the link was enumerated, and no resolution API exists in the kernel.
  assert.ok(!/realpath|readlink/.test(KERNEL_CODE));
});

test("a cross-device entry is recorded as a boundary failure and never descended", () => {
  const result = census();
  const crossing = result.entries.find((e) => e.device_boundary === true);
  assert.ok(crossing, "expected a device-boundary entry");
  assert.equal(crossing.root_id, "DATA_LAKE_REPO");
  assert.ok(result.warnings.some((w) => w.code === "DEVICE_BOUNDARY_NOT_CROSSED"));
  // The subtree behind the mount is absent.
  assert.ok(!result.entries.some((e) => e.relative_path === "mnt/elsewhere.bin"));
});

test("hitting a bound yields BOUNDED_PARTIAL, never COMPLETE", () => {
  for (const bounds of [{ max_entries: 3 }, { max_depth: 1 }, { max_millis: 1 }]) {
    const adapter = makeMemoryAdapter(fixtureTree(), { tickMillis: 5 });
    const result = censusRoots({ roots: fixtureRoots(), adapter, bounds });
    assert.equal(result.completeness, COMPLETENESS_BOUNDED_PARTIAL, JSON.stringify(bounds));
    assert.ok(result.truncation_reason, "a bound hit must name its reason");
    assert.equal(buildNode00ThreeRootCensusPayload(result).completeness, COMPLETENESS_BOUNDED_PARTIAL);
  }
});

test("an unbounded run over the fixture is COMPLETE with a null truncation reason", () => {
  const result = census();
  assert.equal(result.completeness, COMPLETENESS_COMPLETE);
  assert.equal(result.truncation_reason, null);
});

test("unreadable and vanished entries stay explicit evidence, never silent omissions", () => {
  const result = census();
  assert.ok(result.warnings.some((w) => w.code === "DIRECTORY_UNREADABLE"));

  const tree = fixtureTree();
  tree["/fx/lake/corpus/notes.md"] = { type: "file", device: 2, inode: 32, unreadable_stat: true };
  const withVanished = censusRoots({ roots: fixtureRoots(), adapter: makeMemoryAdapter(tree) });
  const vanished = withVanished.warnings.find((w) => w.code === "ENTRY_VANISHED_OR_UNREADABLE");
  assert.ok(vanished, "a vanished entry must be reported, not dropped");
  assert.equal(vanished.error_code, "EACCES");
});

// --------------------------------------------------------------------------
// Privacy contract
// --------------------------------------------------------------------------

test("private-root filenames never appear in any serialized artifact", () => {
  const result = runNode00ThreeRootCensus({
    consent: NODE00_THREE_ROOT_CENSUS_GO_PHRASE,
    input: fixtureInput(),
  });
  // The artifacts that actually ship: manifest.json, entries.jsonl, warnings.jsonl.
  const values = [
    ...stringValues(result.payload),
    ...stringValues(result.entries),
    ...stringValues(result.warnings),
  ];
  for (const name of PRIVATE_NAMES) {
    const leak = values.find((v) => v.includes(name));
    assert.equal(leak, undefined, `private name "${name}" leaked as the value "${leak}"`);
  }
  // Belt and braces: the only DOWNLOADS-side strings that escape are hashes and the
  // permitted extension/coarse-type vocabulary.
  const downloadsStrings = new Set(stringValues(result.entries.filter((e) => e.root_id === "DOWNLOADS")));
  for (const value of downloadsStrings) {
    assert.ok(
      /^sha256:[0-9a-f]{64}$/.test(value) ||
        ["DOWNLOADS", "directory", "file", "symlink", "other", "none", "media", "DEMA_REPO", ""].includes(value) ||
        /^\.[a-z0-9]+$/.test(value),
      `unexpected string "${value}" escaped a private root`,
    );
  }
});

test("private-root entries and warnings carry only a path hash, extension and coarse type", () => {
  const result = census();
  for (const row of result.entries.filter((e) => e.root_id === "DOWNLOADS")) {
    assert.equal(row.relative_path, null);
    assert.equal(row.basename, null);
    assert.match(row.relative_path_hash, /^sha256:[0-9a-f]{64}$/);
  }
  for (const row of result.warnings.filter((w) => w.root_id === "DOWNLOADS")) {
    assert.equal(row.relative_path, null);
    assert.equal(row.basename, null);
  }
  // extension + coarse_type ARE permitted for private roots.
  const photo = result.entries.find(
    (e) => e.root_id === "DOWNLOADS" && e.relative_path_hash === hashText("photo.jpg"),
  );
  assert.equal(photo.extension, ".jpg");
  assert.equal(photo.coarse_type, "media");
});

test("a private root never discloses its absolute path in the manifest", () => {
  const payload = buildNode00ThreeRootCensusPayload(census());
  const downloads = payload.per_root.find((r) => r.root_id === "DOWNLOADS");
  assert.equal(downloads.path, null);
  assert.match(downloads.normalized_path_hash, /^sha256:[0-9a-f]{64}$/);
  // verify() enforces this too — a forged manifest disclosing it must be refused.
  const leaked = {
    ...payload,
    per_root: payload.per_root.map((r) => (r.root_id === "DOWNLOADS" ? { ...r, path: "/fx/downloads" } : r)),
  };
  assert.equal(verifyNode00ThreeRootCensus(leaked).ok, false);
});

test("a PUBLIC root nested inside a PRIVATE root discloses no path — its own would leak the parent's", () => {
  const payload = buildNode00ThreeRootCensusPayload(census());
  const dema = payload.per_root.find((r) => r.root_id === "DEMA_REPO");
  assert.equal(dema.visibility, "public");
  assert.equal(dema.path, null, "a public root under a private one must not emit its absolute path");
  assert.match(dema.normalized_path_hash, /^sha256:[0-9a-f]{64}$/);

  // The disjoint public root is unaffected — it discloses its path normally.
  const lake = payload.per_root.find((r) => r.root_id === "DATA_LAKE_REPO");
  assert.equal(lake.path, "/fx/lake");

  // verify() enforces the rule, so a forged manifest re-disclosing it is refused.
  const leaked = {
    ...payload,
    per_root: payload.per_root.map((r) => (r.root_id === "DEMA_REPO" ? { ...r, path: "/fx/downloads/Dema" } : r)),
  };
  const verdict = verifyNode00ThreeRootCensus(leaked);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.reasons.includes("nested_root_discloses_private_parent_path"));
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
    assert.ok(!err.message.includes("secret-folder-name"), `error leaked a private path: ${err.message}`);
    assert.equal(err.message, "root_not_found:DOWNLOADS");
  }
});

test("relative paths are emitted only for roots explicitly declared public", () => {
  const result = census();
  for (const row of result.entries) {
    const root = result.admitted.find((r) => r.id === row.root_id);
    if (root.visibility === "public") assert.ok(typeof row.relative_path === "string");
    else assert.equal(row.relative_path, null);
  }
  const dema = result.entries.filter((e) => e.root_id === "DEMA_REPO");
  assert.ok(dema.some((e) => e.relative_path === "src/kernel.js"));
});

// --------------------------------------------------------------------------
// Reachability — no content read, no mutation, no signer
// --------------------------------------------------------------------------

test("the kernel is pure: no fs import and no content-reading or mutating API is reachable", () => {
  assert.ok(!/from\s+"node:fs"/.test(KERNEL_CODE), "kernel must not import node:fs");
  const forbidden = [
    "readFile", "createReadStream", "writeFile", "rename",
    "mkdir", "chmod", "unlink", "copyFile", "realpath",
  ];
  for (const api of forbidden) {
    assert.ok(!new RegExp(`\\b${api}\\b`).test(KERNEL_CODE), `kernel reaches forbidden API ${api}`);
  }
  // `stat` and `open` only ever appear as lstat/readdir in the injected contract.
  assert.ok(!/\bstatSync\b|\bopenSync\b|\bfs\.open\b/.test(KERNEL_CODE));
});

test("the effect adapter exposes exactly lstat, readdir and now — no wider surface", () => {
  const adapter = censusFsAdapter();
  assert.deepEqual(Object.keys(adapter).sort(), ["lstat", "now", "readdir"]);
  // lstatSync never statSync: a symlink is described, never dereferenced.
  assert.ok(/lstatSync/.test(ADAPTER_CODE));
  assert.ok(!/\bstatSync\(/.test(ADAPTER_CODE.replace(/lstatSync\(/g, "")));
});

test("no scanned-root mutator is reachable: the writer mutates only under the proof root", () => {
  // Every mutating call in the adapter module is routed through the injected writer
  // fs and targets a path built from the proof root, never a scanned path.
  const mutators = ADAPTER_CODE.match(/\b(mkdirSync|writeFileSync|renameSync)\(/g) ?? [];
  const routed = ADAPTER_CODE.match(/\bfs\.(mkdirSync|writeFileSync|renameSync)\(/g) ?? [];
  // The only unrouted occurrences are the DEFAULT_WRITER_FS declarations themselves.
  assert.equal(mutators.length, routed.length, "an unrouted mutation call exists in the adapter");
  for (const call of ADAPTER_CODE.matchAll(/fs\.(mkdirSync|writeFileSync|renameSync)\(([^,)]+)/g)) {
    assert.ok(
      /tempDir|finalDir/.test(call[2]),
      `mutation ${call[1]} targets ${call[2]}, which is not a proof-root path`,
    );
  }
});

test("the real signer path is never resolved or referenced by this slice", () => {
  for (const src of [KERNEL_CODE, ADAPTER_CODE]) {
    assert.ok(!/signer|signing|private_key|privateKey|ed25519|authorship/i.test(src));
  }
});

// --------------------------------------------------------------------------
// External proof writer — refusal rules
// --------------------------------------------------------------------------

function fakeWriterFs(tree, { gitDirs = [] } = {}) {
  return {
    lstatSync(path) {
      const node = tree[path];
      if (!node) {
        const err = new Error("ENOENT");
        err.code = "ENOENT";
        throw err;
      }
      return {
        dev: node.device,
        ino: node.inode,
        mode: node.mode ?? 0o40750,
        isSymbolicLink: () => node.type === "symlink",
        isDirectory: () => node.type === "directory",
        isFile: () => node.type === "file",
      };
    },
    existsSync: (path) => gitDirs.includes(path) || Boolean(tree[path]),
    mkdirSync() {},
    writeFileSync() {},
    renameSync() {},
  };
}

const PROOF_TREE = {
  "/": { type: "directory", device: 1, inode: 1 },
  "/data": { type: "directory", device: 1, inode: 2 },
  "/data/proofs": { type: "directory", device: 1, inode: 3, mode: 0o40755 },
  "/data/proofs/run": { type: "directory", device: 1, inode: 4 },
};

test("the proof writer refuses every unsafe output location with a NAMED block", () => {
  const cases = [
    [{ proofRoot: "relative/path" }, "output_path_not_absolute"],
    [{ proofRoot: "/data/proofs/absent" }, "output_root_missing"],
    [{ proofRoot: "/data/proofs/run", scannedRoots: [{ path: "/data/proofs" }] }, "output_inside_scanned_root"],
    [{ proofRoot: "/data/proofs/run", demaHome: "/data/proofs" }, "output_beneath_dema_home"],
  ];
  for (const [args, expected] of cases) {
    const plan = planProofOutput({ ...args, fs: fakeWriterFs(PROOF_TREE) });
    assert.equal(plan.ok, false, expected);
    assert.ok(plan.blocked_by.includes(expected), `${expected} not in ${plan.blocked_by.join(", ")}`);
  }
});

test("the proof writer refuses a symbolic output root and a symbolic ancestor", () => {
  const linkRoot = { ...PROOF_TREE, "/data/proofs/run": { type: "symlink", device: 1, inode: 4 } };
  assert.ok(
    planProofOutput({ proofRoot: "/data/proofs/run", fs: fakeWriterFs(linkRoot) }).blocked_by.includes(
      "output_root_is_symlink",
    ),
  );
  const linkAncestor = { ...PROOF_TREE, "/data/proofs": { type: "symlink", device: 1, inode: 3 } };
  assert.ok(
    planProofOutput({ proofRoot: "/data/proofs/run", fs: fakeWriterFs(linkAncestor) }).blocked_by.includes(
      "output_root_ancestor_symlink",
    ),
  );
});

test("the proof writer refuses any location inside a repository worktree", () => {
  const plan = planProofOutput({
    proofRoot: "/data/proofs/run",
    fs: fakeWriterFs(PROOF_TREE, { gitDirs: ["/data/proofs/.git"] }),
  });
  assert.equal(plan.ok, false);
  assert.ok(plan.blocked_by.includes("output_inside_repository_worktree"));
});

test("the proof writer refuses a world-writable (attacker-writable) parent", () => {
  const hostile = { ...PROOF_TREE, "/data/proofs": { type: "directory", device: 1, inode: 3, mode: 0o40777 } };
  const plan = planProofOutput({ proofRoot: "/data/proofs/run", fs: fakeWriterFs(hostile) });
  assert.ok(plan.blocked_by.includes("output_parent_attacker_writable"));
  // A sticky world-writable parent (/tmp semantics) is permitted.
  const sticky = { ...PROOF_TREE, "/data/proofs": { type: "directory", device: 1, inode: 3, mode: 0o41777 } };
  assert.ok(!planProofOutput({ proofRoot: "/data/proofs/run", fs: fakeWriterFs(sticky) }).blocked_by.includes("output_parent_attacker_writable"));
});

test("a proof-root identity change between plan and promotion blocks final promotion", () => {
  const result = runNode00ThreeRootCensusCheck();
  let statCalls = 0;
  const base = fakeWriterFs(PROOF_TREE);
  const shifting = {
    ...base,
    lstatSync(path) {
      const stat = base.lstatSync(path);
      if (path === "/data/proofs/run") {
        statCalls += 1;
        if (statCalls > 1) return { ...stat, ino: stat.ino + 1 };
      }
      return stat;
    },
    existsSync: (path) => (path.includes("RUN-1") ? false : base.existsSync(path)),
  };
  const written = writeCensusProof({
    proofRoot: "/data/proofs/run",
    runId: "RUN-1",
    result,
    scannedRoots: [],
    fs: shifting,
  });
  assert.equal(written.ok, false);
  assert.ok(written.blocked_by.includes("proof_root_identity_changed_before_promotion"));
});

test("the writer promotes by SAME-PARENT rename, so promotion can never cross a device", () => {
  const result = runNode00ThreeRootCensusCheck();
  const calls = [];
  const base = fakeWriterFs(PROOF_TREE);
  const recorder = {
    ...base,
    existsSync: (path) => (path.includes("RUN-2") ? false : base.existsSync(path)),
    mkdirSync: (p) => calls.push(["mkdir", p]),
    writeFileSync: (p) => calls.push(["write", p]),
    renameSync: (from, to) => calls.push(["rename", from, to]),
  };
  const written = writeCensusProof({
    proofRoot: "/data/proofs/run",
    runId: "RUN-2",
    result,
    scannedRoots: [],
    fs: recorder,
  });
  assert.equal(written.ok, true, written.blocked_by?.join(", "));
  const rename = calls.find((c) => c[0] === "rename");
  assert.ok(rename, "expected an atomic promotion rename");
  assert.equal(rename[1].slice(0, rename[1].lastIndexOf("/")), rename[2].slice(0, rename[2].lastIndexOf("/")));

  const written_names = calls.filter((c) => c[0] === "write").map((c) => c[1].split("/").pop()).sort();
  assert.deepEqual(written_names, ["entries.jsonl", "manifest.json", "manifest.sha256", "receipt.json", "warnings.jsonl"]);
});

test("hostile concurrent parent substitution is DECLARED UNPROVEN, not claimed defeated", () => {
  assert.equal(PROOF_ROOT_SUBSTITUTION_RESISTANCE, "NOT_PROVEN_AGAINST_HOSTILE_CONCURRENT_MUTATOR");
  assert.ok(
    /NOT_PROVEN_AGAINST_HOSTILE_CONCURRENT_MUTATOR/.test(ADAPTER_SRC),
    "the declared limit must be stated in the writer source",
  );
  assert.ok(!/openat2|descriptor-relative containment (is )?(proven|guaranteed)/i.test(ADAPTER_SRC.replace(/does NOT provide[^.]*\./g, "")));
});

// --------------------------------------------------------------------------
// Slice isolation — this branch touches no quarantined task file
// --------------------------------------------------------------------------

test("this slice changes no TASK-029, TASK-030, TASK-031 or TASK-032 file", () => {
  const changed = execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  const quarantined = changed.filter((f) => /task-0(29|30|31|32)/i.test(f));
  assert.deepEqual(quarantined, [], `slice touched quarantined task files: ${quarantined.join(", ")}`);
});
