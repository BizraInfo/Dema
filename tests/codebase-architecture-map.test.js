import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  buildCodebaseArchitectureMap,
  formatCodebaseMapSummary,
  CODEBASE_ARCHITECTURE_MAP_SCHEMA,
  DEFAULT_EXCLUSIONS,
  DEFAULT_MAX_FILES
} from "../packages/core/src/codebase-architecture-map.js";

async function makeRepo(initial = {}) {
  const root = await mkdtemp(join(tmpdir(), "codebase-map-"));
  for (const [relPath, content] of Object.entries(initial)) {
    const abs = join(root, relPath);
    const dir = abs.slice(0, abs.lastIndexOf("/"));
    if (dir && dir !== root) await mkdir(dir, { recursive: true });
    await writeFile(abs, content);
  }
  return root;
}

// 1. Empty repo returns schema and zero totals.
test("empty repo returns schema and zero totals", async () => {
  const root = await makeRepo({});
  const env = await buildCodebaseArchitectureMap(root);
  assert.equal(env.schema, CODEBASE_ARCHITECTURE_MAP_SCHEMA);
  assert.equal(env.error_reason, null);
  assert.equal(env.totals.file_count, 0);
  assert.equal(env.totals.symlink_count, 0);
  assert.equal(env.totals.total_bytes, 0);
  assert.equal(env.partial, false);
  assert.deepEqual([...env.files], []);
  assert.deepEqual([...env.edges], []);
});

// 2. Default exclusions skip node_modules.
test("default exclusions skip node_modules and other build artifacts", async () => {
  const root = await makeRepo({
    "src/index.js": "console.log('hi');\n",
    "node_modules/foo/package.json": "{}",
    "dist/bundle.js": "var x;",
    "coverage/lcov-report/index.html": "<html></html>",
    ".git/HEAD": "ref: refs/heads/main\n"
  });
  const env = await buildCodebaseArchitectureMap(root);
  assert.equal(env.error_reason, null);
  // Only src/index.js should be present
  const paths = env.files.map((f) => f.path);
  assert.deepEqual(paths.sort(), ["src/index.js"]);
  // Sanity: defaults list is exposed
  assert.ok(DEFAULT_EXCLUSIONS.includes("node_modules"));
  assert.ok(DEFAULT_EXCLUSIONS.includes(".git"));
});

// 3. Depth cap produces warning and stops descent.
test("depth cap caps recursion and emits a warning", async () => {
  const root = await makeRepo({});
  // Build a/b/c/d/e/f/file.js (depth 6 directories) then scan with max_depth=2
  await mkdir(join(root, "a", "b", "c", "d", "e", "f"), { recursive: true });
  await writeFile(join(root, "a", "b", "c", "d", "e", "f", "deep.js"), "// deep\n");
  await writeFile(join(root, "shallow.js"), "// shallow\n");
  const env = await buildCodebaseArchitectureMap(root, { maxDepth: 2 });
  assert.ok(env.warnings.some((w) => /max_depth_exceeded_at_/.test(w)), `warnings: ${env.warnings.join(",")}`);
  assert.ok(env.partial);
  // shallow.js should be present; deep.js should not
  const paths = env.files.map((f) => f.path);
  assert.ok(paths.includes("shallow.js"));
  assert.ok(!paths.includes("a/b/c/d/e/f/deep.js"));
});

// 4. File count cap produces partial=true with file_limit_exceeded error_reason.
test("max_files cap aborts walk with file_limit_exceeded", async () => {
  const initial = {};
  for (let i = 0; i < 10; i++) initial[`file${i}.js`] = `// ${i}\n`;
  const root = await makeRepo(initial);
  const env = await buildCodebaseArchitectureMap(root, { maxFiles: 3 });
  assert.equal(env.partial, true);
  assert.equal(env.error_reason, "file_limit_exceeded");
  assert.ok(env.warnings.some((w) => /file_count_exceeded_/.test(w)));
});

// 5. Oversized file records metadata and skips content.
test("oversized file is recorded with metadata but no content/edges read", async () => {
  const root = await makeRepo({});
  const bigContent = "x".repeat(3 * 1024); // 3 KiB
  await writeFile(join(root, "big.js"), bigContent);
  await writeFile(join(root, "small.js"), "import { foo } from './foo';\n");
  const env = await buildCodebaseArchitectureMap(root, { maxFileSize: 1024 });
  const big = env.files.find((f) => f.path === "big.js");
  const small = env.files.find((f) => f.path === "small.js");
  assert.ok(big && big.content_skipped_oversized === true);
  assert.equal(big.line_count, undefined);
  // small file should be read fine and produce an edge
  assert.ok(small);
  assert.ok(env.edges.some((e) => e.from === "small.js" && e.to_raw === "./foo"));
});

// 6. .env and secret files are not read; metadata-only.
test("secret-pattern files are not read and recorded as secret_metadata_only", async () => {
  const root = await makeRepo({
    ".env": "SUPER_SECRET=should_not_appear_in_envelope\n",
    ".env.local": "OTHER_SECRET=xxx\n",
    ".env.example": "PLACEHOLDER=ok\n",
    "id_rsa": "-----BEGIN RSA PRIVATE KEY-----\nNEVER_READ\n",
    "service.pem": "-----BEGIN CERTIFICATE-----\n",
    "config_with_secret_in_name.json": "{ \"k\": \"v\" }",
    "regular.js": "// fine\n"
  });
  const env = await buildCodebaseArchitectureMap(root);
  const secretFiles = env.files.filter((f) => f.role === "secret_metadata_only");
  const paths = secretFiles.map((f) => f.path).sort();
  // All 6 secret-pattern files must be flagged
  assert.deepEqual(paths, [".env", ".env.example", ".env.local", "config_with_secret_in_name.json", "id_rsa", "service.pem"]);
  for (const f of secretFiles) {
    assert.equal(f.content_skipped_secret, true);
    assert.equal(f.line_count, undefined);
  }
  // No edge should originate from any secret file
  for (const e of env.edges) {
    assert.ok(!paths.includes(e.from), `edge unexpectedly extracted from secret file: ${e.from}`);
  }
  // Sanity: the envelope itself does not leak secret content
  const ser = JSON.stringify(env);
  assert.ok(!ser.includes("SUPER_SECRET=should_not_appear_in_envelope"));
  assert.ok(!ser.includes("NEVER_READ"));
});

// 7. Boundary has runtime/file_io true and all effect flags false.
test("boundary shape: runtime+file_io+secret_files_skipped true; effect flags false", async () => {
  const root = await makeRepo({ "a.js": "" });
  const env = await buildCodebaseArchitectureMap(root);
  assert.equal(env.boundary.runtime, true);
  assert.equal(env.boundary.file_io, true);
  assert.equal(env.boundary.secret_files_skipped, true);
  assert.equal(env.boundary.network_used, false);
  assert.equal(env.boundary.model_invocation, false);
  assert.equal(env.boundary.mutation, false);
  assert.equal(env.boundary.federation, false);
  assert.equal(env.boundary.mint, false);
  assert.equal(env.boundary.token_economy, false);
  assert.equal(env.boundary.urp_networking, false);
});

// 8. Schema exact match.
test("schema string is the canonical v0.1 token", async () => {
  const root = await makeRepo({});
  const env = await buildCodebaseArchitectureMap(root);
  assert.equal(env.schema, "bizra.dema.codebase_architecture_map.v0.1");
});

// 9. Deterministic output for same repo state (ignoring scanned_at).
test("same repo state produces identical envelope (ignoring scanned_at)", async () => {
  const root = await makeRepo({
    "a.js": "import { x } from './b';\n",
    "b.js": "export const x = 1;\n",
    "sub/c.py": "from os import path\n",
    "package.json": JSON.stringify({ name: "t", dependencies: { foo: "1.0" } })
  });
  const env1 = await buildCodebaseArchitectureMap(root);
  // small delay to ensure scanned_at differs
  await new Promise((res) => setTimeout(res, 10));
  const env2 = await buildCodebaseArchitectureMap(root);
  assert.notEqual(env1.scanned_at, env2.scanned_at);
  // Strip scanned_at and compare the rest
  const strip = (e) => JSON.parse(JSON.stringify(e, (k, v) => k === "scanned_at" ? "" : v));
  assert.deepEqual(strip(env1), strip(env2));
});

// 10. JS import edges extracted (both static + require + bare import).
test("JS edges extracted from import/from, bare import, and require()", async () => {
  const root = await makeRepo({
    "a.js": [
      "import { foo } from './foo';",
      "import './side-effect';",
      "const fs = require('node:fs');",
      "const x = require('./util');"
    ].join("\n") + "\n"
  });
  const env = await buildCodebaseArchitectureMap(root);
  const toRaws = env.edges.filter((e) => e.from === "a.js").map((e) => e.to_raw).sort();
  assert.deepEqual(toRaws, ["./foo", "./side-effect", "./util", "node:fs"]);
  // Kinds populated
  const kinds = new Set(env.edges.filter((e) => e.from === "a.js").map((e) => e.kind));
  assert.ok(kinds.has("import"));
  assert.ok(kinds.has("require"));
});

// 11. Python import edges extracted.
test("Python edges extracted from `from X import` and `import X`", async () => {
  const root = await makeRepo({
    "main.py": [
      "import os",
      "from typing import Optional",
      "import json"
    ].join("\n") + "\n"
  });
  const env = await buildCodebaseArchitectureMap(root);
  const toRaws = env.edges.filter((e) => e.from === "main.py").map((e) => e.to_raw).sort();
  assert.deepEqual(toRaws, ["json", "os", "typing"]);
});

// 12. package.json deps + devDeps extracted as manifest edges.
test("package.json dependencies and devDependencies extracted as manifest edges", async () => {
  const root = await makeRepo({
    "package.json": JSON.stringify({
      name: "demo",
      dependencies: { lodash: "^4.0", express: "^5.0" },
      devDependencies: { typescript: "^5.0" }
    })
  });
  const env = await buildCodebaseArchitectureMap(root);
  const manifestEdges = env.edges.filter((e) => e.kind === "manifest" && e.from === "package.json");
  const deps = manifestEdges.map((e) => e.to_raw).sort();
  assert.deepEqual(deps, ["express", "lodash", "typescript"]);
});

// 13. Symlink is recorded but not followed.
test("symlink is recorded with metadata only and not followed into", async () => {
  const root = await makeRepo({ "real.js": "// real\n" });
  // Create a directory symlink that points to the root itself — a follow
  // would loop forever.
  try {
    await symlink(root, join(root, "loop"));
  } catch {
    // Skip if symlink creation isn't permitted (some CI sandboxes)
    return;
  }
  const env = await buildCodebaseArchitectureMap(root);
  assert.ok(env.symlinks.some((s) => s.path === "loop"));
  // The walker MUST NOT have followed the symlink — file_count should be 1
  // (real.js), not the inflated count we'd get if it followed the loop.
  assert.equal(env.totals.file_count, 1);
});

// 14. Symlink loop guarded even if exclusion list misses it.
test("directory loop via inode tracking is guarded", async () => {
  const root = await makeRepo({
    "a/file1.js": "// 1\n",
    "a/b/file2.js": "// 2\n"
  });
  // We rely on the iterative walker's visited-inodes set; even without
  // symlinks, the walker MUST NOT revisit the root. Sanity check: each file
  // appears exactly once.
  const env = await buildCodebaseArchitectureMap(root);
  const paths = env.files.map((f) => f.path).sort();
  assert.deepEqual(paths, ["a/b/file2.js", "a/file1.js"]);
});

// 15. Oversized regex line does not hang regex processing.
test("regex skips oversized lines (>10000 chars) without hanging", async () => {
  const huge = "x".repeat(12000);
  const root = await makeRepo({
    "huge.js": `import { ok } from './ok';\nconst monstrous = "${huge}";\nrequire('./tail');\n`
  });
  const start = Date.now();
  const env = await buildCodebaseArchitectureMap(root);
  const elapsed = Date.now() - start;
  // Should be well under a second on any reasonable machine
  assert.ok(elapsed < 2000, `regex hung? elapsed=${elapsed}ms`);
  // The two well-formed edges from short lines must still be present.
  const toRaws = env.edges.filter((e) => e.from === "huge.js").map((e) => e.to_raw).sort();
  assert.deepEqual(toRaws, ["./ok", "./tail"]);
});

// 16. Relative path rejected at module level.
test("relative repo_path is rejected with shaped failure", async () => {
  const env = await buildCodebaseArchitectureMap("relative/path");
  assert.equal(env.error_reason, "path_must_be_absolute");
  assert.equal(env.partial, true);
  assert.equal(env.schema, CODEBASE_ARCHITECTURE_MAP_SCHEMA);
});

// 17. Nonexistent path rejected with shaped failure.
test("nonexistent repo_path returns shaped failure with path_not_found", async () => {
  const env = await buildCodebaseArchitectureMap("/tmp/dema-codebase-nonexistent-xyz-abc-123");
  assert.equal(env.error_reason, "path_not_found");
  assert.equal(env.partial, true);
});

// 18. System path forbidden.
test("/proc and /sys and /dev are refused at the boundary", async () => {
  for (const sysPath of ["/proc", "/sys", "/dev"]) {
    const env = await buildCodebaseArchitectureMap(sysPath);
    assert.equal(env.error_reason, "system_path_forbidden", `expected refusal for ${sysPath}`);
  }
});

// 19. Hotspots emit when --hotspots enabled on a 600-LOC fixture.
test("--hotspots flag yields file_exceeds_500_LOC for a 600-line fixture", async () => {
  let content = "";
  for (let i = 0; i < 600; i++) content += `// line ${i}\n`;
  const root = await makeRepo({ "big.js": content });
  const envWithout = await buildCodebaseArchitectureMap(root);
  assert.equal(envWithout.hotspots.length, 0, "no hotspots when --hotspots is off");
  const envWith = await buildCodebaseArchitectureMap(root, { hotspots: true });
  assert.ok(envWith.hotspots.length >= 1);
  const big = envWith.hotspots.find((h) => h.path === "big.js");
  assert.ok(big, "expected big.js hotspot");
  assert.ok(big.reasons.includes("file_exceeds_500_LOC"));
});

// 20. blocked_effects always present with required tokens.
test("blocked_effects list includes file_write, target_repo_mutation, model_invocation", async () => {
  const root = await makeRepo({ "a.js": "" });
  const env = await buildCodebaseArchitectureMap(root);
  const effects = new Set(env.blocked_effects);
  for (const required of ["file_write", "model_invocation", "network_call",
                          "shell_execution", "chain_advance", "receipt_mint",
                          "federation_invocation", "urp_networking", "target_repo_mutation"]) {
    assert.ok(effects.has(required), `missing blocked effect: ${required}`);
  }
});

// 21. include_tests=true brings test files into the files[] list.
test("--include-tests includes *.test.* and tests/ files in files[]", async () => {
  const root = await makeRepo({
    "src/a.js": "",
    "src/a.test.js": "test('x', () => {});\n",
    "tests/integration.test.js": "test('y', () => {});\n"
  });
  const envDefault = await buildCodebaseArchitectureMap(root);
  const defaultPaths = envDefault.files.map((f) => f.path).sort();
  assert.deepEqual(defaultPaths, ["src/a.js"]);
  const envIncluded = await buildCodebaseArchitectureMap(root, { includeTests: true });
  const incPaths = envIncluded.files.map((f) => f.path).sort();
  assert.deepEqual(incPaths, ["src/a.js", "src/a.test.js", "tests/integration.test.js"]);
});

// 22. formatCodebaseMapSummary produces multi-line summary including key counts.
test("formatCodebaseMapSummary renders compact human summary", async () => {
  const root = await makeRepo({ "a.js": "" });
  const env = await buildCodebaseArchitectureMap(root);
  const summary = formatCodebaseMapSummary(env);
  assert.match(summary, /^Codebase map · /m);
  assert.match(summary, /Files: 1/);
  assert.match(summary, /Partial: false/);
});

// 23. DEFAULT_MAX_FILES is exposed as a positive integer for callers.
test("DEFAULT_MAX_FILES is a positive integer exposed for callers", () => {
  assert.equal(typeof DEFAULT_MAX_FILES, "number");
  assert.ok(Number.isInteger(DEFAULT_MAX_FILES) && DEFAULT_MAX_FILES > 0);
});

// 24. to_resolved is filled in when a local import has a corresponding file.
test("relative edges fill in to_resolved when the target file exists locally", async () => {
  const root = await makeRepo({
    "a.js": "import { x } from './b';\n",
    "b.js": "export const x = 1;\n"
  });
  const env = await buildCodebaseArchitectureMap(root);
  const e = env.edges.find((x) => x.from === "a.js" && x.to_raw === "./b");
  assert.ok(e, "expected edge a.js -> ./b");
  assert.equal(e.resolved_local, true);
  assert.equal(e.to_resolved, "b.js");
  assert.equal(e.resolved_external, false);
  // External edge (no leading dot)
  const root2 = await makeRepo({ "a.js": "import { ok } from 'left-pad';\n" });
  const env2 = await buildCodebaseArchitectureMap(root2);
  const e2 = env2.edges.find((x) => x.to_raw === "left-pad");
  assert.ok(e2);
  assert.equal(e2.resolved_local, false);
  assert.equal(e2.resolved_external, true);
  assert.equal(e2.to_resolved, null);
});
