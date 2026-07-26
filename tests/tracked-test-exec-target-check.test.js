import test from "node:test";
import assert from "node:assert/strict";

import { scanExecTargets } from "../scripts/review/tracked-test-exec-target-check.mjs";

/**
 * TRACKED-TEST-EXEC-TARGET-GUARD-1A.
 *
 * The defect this guards: a tracked test builds a repository-local path with
 * `new URL("../x", import.meta.url)` and hands it to a child process. If `x`
 * is never committed, the test passes in a dirty working tree and dies in a
 * clean checkout. Measured instance: tests/node0-library-safe-plan.test.js ->
 * scripts/review/node0-library-safe-plan-replay.mjs, six failures, repaired
 * by c51467e.
 */

const url = (spec) => `const T = new URL("${spec}", import.meta.url);`;

// probe: relative path -> "file" | "dir" | "absent"
const scan = (source, tracked, probe) =>
  scanExecTargets({
    tests: [{ path: "tests/x.test.js", source }],
    tracked: new Set(tracked),
    probe: (rel) => probe[rel] ?? "absent",
  });

test("a tracked target passes", () => {
  const r = scan(url("../scripts/review/ok.mjs"), ["scripts/review/ok.mjs"], {
    "scripts/review/ok.mjs": "file",
  });
  assert.equal(r.ok, true);
  assert.equal(r.tracked_targets, 1);
  assert.deepEqual(r.untracked_targets, []);
});

test("a target present on disk but untracked FAILS — the measured defect", () => {
  const r = scan(url("../scripts/review/replay.mjs"), [], {
    "scripts/review/replay.mjs": "file",
  });
  assert.equal(r.ok, false);
  assert.deepEqual(r.untracked_targets, [
    { test: "tests/x.test.js", target: "scripts/review/replay.mjs" },
  ]);
});

test("a target absent from disk FAILS", () => {
  const r = scan(url("../scripts/review/gone.mjs"), [], {});
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing_targets, [
    { test: "tests/x.test.js", target: "scripts/review/gone.mjs" },
  ]);
});

test("a directory target is skipped — git tracks files, not directories", () => {
  const r = scan(url("../apps/cli/src/commands"), [], {
    "apps/cli/src/commands": "dir",
  });
  assert.equal(r.ok, true);
  assert.equal(r.directory_targets, 1);
  assert.equal(r.file_edges, 0);
});

test("the repository root is skipped", () => {
  const r = scan(url(".."), [], {});
  assert.equal(r.ok, true);
  assert.equal(r.file_edges, 0);
});

test("a target outside the repository is skipped, not failed", () => {
  const r = scan(url("../../../elsewhere/thing.mjs"), [], {});
  assert.equal(r.ok, true);
  assert.equal(r.file_edges, 0);
  assert.equal(r.external_targets, 1);
});

test("a bare specifier is not a path and is ignored", () => {
  const r = scan(`const T = new URL("https://example.test/x", import.meta.url);`, [], {});
  assert.equal(r.ok, true);
  assert.equal(r.file_edges, 0);
});

test("regression: the node0-library-safe-plan shape is caught", () => {
  const source = [
    `const REPLAY = fileURLToPath(new URL("../scripts/review/node0-library-safe-plan-replay.mjs", import.meta.url));`,
    `execFileSync("node", [REPLAY, "--root", root]);`,
  ].join("\n");
  const r = scan(source, [], {
    "scripts/review/node0-library-safe-plan-replay.mjs": "file",
  });
  assert.equal(r.ok, false);
  assert.equal(r.untracked_targets[0].target, "scripts/review/node0-library-safe-plan-replay.mjs");
});

test("the same target twice is reported once per occurrence, deterministically", () => {
  const source = [url("../scripts/review/a.mjs"), url("../scripts/review/a.mjs")].join("\n");
  const probe = { "scripts/review/a.mjs": "file" };
  const first = scan(source, [], probe);
  const second = scan(source, [], probe);
  assert.deepEqual(first, second);
  assert.equal(first.untracked_targets.length, 2);
});

test("many tests aggregate into one verdict", () => {
  const r = scanExecTargets({
    tests: [
      { path: "tests/a.test.js", source: url("../scripts/review/ok.mjs") },
      { path: "tests/b.test.js", source: url("../scripts/review/bad.mjs") },
    ],
    tracked: new Set(["scripts/review/ok.mjs"]),
    probe: (rel) => (rel === "scripts/review/bad.mjs" ? "file" : "file"),
  });
  assert.equal(r.ok, false);
  assert.equal(r.tracked_targets, 1);
  assert.equal(r.untracked_targets.length, 1);
  assert.equal(r.untracked_targets[0].test, "tests/b.test.js");
});

test("the report is a read-only audit and claims no mutation", () => {
  const r = scan(url("../scripts/review/ok.mjs"), ["scripts/review/ok.mjs"], {
    "scripts/review/ok.mjs": "file",
  });
  assert.equal(r.schema, "bizra.dema.review.tracked_test_exec_target.v0.1");
  assert.deepEqual(r.boundary, {
    read_only_audit: true,
    runtime_execution_performed: false,
    mutation_performed: false,
    network_performed: false,
    staging_performed: false,
  });
});
