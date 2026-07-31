import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

function library(args) {
  const result = spawnSync(process.execPath, [CLI, "library", ...args], {
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "test", DEMA_NO_TUI: "1" },
  });
  let json = null;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    /* asserted by each JSON-path test */
  }
  return { ...result, json };
}

function makeDuplicateCorpus() {
  const root = mkdtempSync(join(tmpdir(), "library-dedupe-cli-"));
  mkdirSync(join(root, "a"));
  mkdirSync(join(root, "b"));
  writeFileSync(join(root, "a", "original.txt"), "same immutable bytes\n");
  writeFileSync(join(root, "b", "original-copy.txt"), "same immutable bytes\n");
  writeFileSync(join(root, "unique.txt"), "unique bytes\n");
  return root;
}

function visibleTree(root) {
  const walk = (dir, prefix = "") => {
    const rows = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) rows.push(...walk(join(dir, entry.name), relative));
      else rows.push({ path: relative, content: readFileSync(join(dir, entry.name), "utf8") });
    }
    return rows;
  };
  return walk(root).sort((a, b) => a.path.localeCompare(b.path));
}

test("library dedupe emits measurement only and no executable steward job", () => {
  const root = makeDuplicateCorpus();
  try {
    const before = visibleTree(root);
    const result = library(["dedupe", "--root", root, "--json"]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.ok(result.json, "stdout must be a JSON measurement");
    assert.equal(
      result.json.schema,
      "bizra.dema.node0_library_duplicate_measurement.v0.2",
    );
    assert.equal(
      result.json.truth_label,
      "LOCAL_DUPLICATE_MEASUREMENT_NOT_ACTION_PLAN",
    );
    assert.equal(result.json.status, "BLOCKED_PENDING_AUTHORITATIVE_SAFE_PLAN");
    assert.equal(result.json.mutation_performed, false);
    assert.equal(result.json.duplicate_sets, 1);
    assert.equal(result.json.duplicate_copies, 1);
    assert.ok(result.json.duplicate_bytes_identified > 0);
    assert.equal(
      result.json.next_authority_surface,
      "NODE0_LIBRARY_AUTHORITATIVE_COMPLETION_1A_REQUIRED",
    );
    assert.equal(result.json.boundary.filesystem_mutation, false);
    assert.equal(result.json.boundary.source_path_removed, false);
    assert.equal(result.json.boundary.executable_job_emitted, false);
    assert.equal("steward_job" in result.json, false);
    assert.deepEqual(visibleTree(root), before, "measurement must not mutate the corpus");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("library dedupe no longer requires or advertises a quarantine path", () => {
  const root = makeDuplicateCorpus();
  try {
    const result = library(["dedupe", "--root", root, "--json"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.doesNotMatch(result.stdout, /steward_job|--quarantine/);

    const help = library([]);
    assert.equal(help.status, 0, help.stderr || help.stdout);
    assert.ok(help.json, "help must be JSON");
    assert.doesNotMatch(help.json.subcommands.dedupe, /--quarantine/);
    assert.match(help.json.dedupe_note, /emits no executable move job/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("library dedupe --out writes the same non-executable measurement", () => {
  const root = makeDuplicateCorpus();
  const artifactDir = mkdtempSync(join(tmpdir(), "library-dedupe-artifact-"));
  const out = join(artifactDir, "measurement.json");
  try {
    const result = library(["dedupe", "--root", root, "--out", out, "--json"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(existsSync(out), true);
    const stored = JSON.parse(readFileSync(out, "utf8"));
    assert.deepEqual(stored, result.json);
    assert.equal(stored.boundary.executable_job_emitted, false);
    assert.equal("atoms" in stored, false);
    assert.equal("steward_job" in stored, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(artifactDir, { recursive: true, force: true });
  }
});
