// Dev Roadmap v0.1 — pure + CLI regression tests.
//
// Locks the live-anchor schema, the injectable runGit contract, the
// formatter shape, and the CLI subcommand wiring.

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  ROADMAP_DEV_SCHEMA,
  gatherDevRoadmapState,
  formatDevRoadmapReport
} from "../packages/core/src/roadmap-dev.js";

const execFileAsync = promisify(execFile);
const indexPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

// Canned git stdout for unit tests (avoid touching the real repo).
function fakeRunGit(table) {
  return async (args /*, _opts */) => {
    const key = args.join(" ");
    if (key in table) return table[key];
    if (args[0] === "branch" && args[1] === "--show-current") return "main\n";
    if (args[0] === "rev-parse") return "abc1234\n";
    if (args[0] === "status") return "";
    if (args[0] === "log") return "abc1234 fake commit\n";
    if (args[0] === "for-each-ref") return "";
    if (args[0] === "rev-list") return "0\t0\n";
    return "";
  };
}

test("ROADMAP_DEV_SCHEMA matches v0.1", () => {
  assert.equal(ROADMAP_DEV_SCHEMA, "bizra.dema.roadmap_dev.v0.1");
});

test("gatherDevRoadmapState — clean tree + synced main", async () => {
  const runGit = fakeRunGit({
    "branch --show-current": "main\n",
    "rev-parse --short HEAD": "ab47dbe\n",
    "log -1 --pretty=%s": "feat(cli): add `dema first-run` (5-step entry) + `dema --version` v0.1\n",
    "status --short": "",
    "log main -12 --pretty=%h %s":
      "ab47dbe feat(cli): add dema first-run\n" +
      "d8aa7b9 docs(gate-a): public-face uplift\n" +
      "6fd485d feat(seal): onboarding seal v0.1\n",
    "for-each-ref --count=20 --sort=-committerdate refs/heads/feat/ --format=%(refname:short)|%(committerdate:relative)|%(objectname:short)":
      "feat/dema-a-plus|2 hours ago|e8a4d89\n" +
      "feat/dev-roadmap-v0-1|now|aaaaaaa\n",
    "rev-list --left-right --count main...origin/main": "0\t0\n"
  });
  const state = await gatherDevRoadmapState({ cwd: process.cwd(), runGit });

  assert.equal(state.schema, ROADMAP_DEV_SCHEMA);
  assert.equal(state.git_available, true);
  assert.equal(state.anchor.branch, "main");
  assert.equal(state.anchor.head_sha, "ab47dbe");
  assert.match(state.anchor.head_subject, /first-run/);
  assert.equal(state.anchor.dirty_count, 0);
  assert.equal(state.main_vs_origin.synced, true);
  assert.equal(state.main_vs_origin.ahead_of_origin, 0);
  assert.equal(state.main_vs_origin.behind_origin, 0);
  assert.equal(state.recent_on_main.length, 3);
  assert.equal(state.recent_on_main[0].sha, "ab47dbe");
  assert.equal(state.feat_branches.length, 2);
  assert.equal(state.feat_branches[0].name, "feat/dema-a-plus");
});

test("gatherDevRoadmapState — dirty tree + ahead+behind reflected", async () => {
  const runGit = fakeRunGit({
    "branch --show-current": "feat/something\n",
    "rev-parse --short HEAD": "deadbee\n",
    "log -1 --pretty=%s": "wip\n",
    "status --short": " M docs/ROADMAP.md\n?? new-file.js\n",
    "log main -12 --pretty=%h %s": "ab47dbe last on main\n",
    "for-each-ref --count=20 --sort=-committerdate refs/heads/feat/ --format=%(refname:short)|%(committerdate:relative)|%(objectname:short)": "",
    "rev-list --left-right --count main...origin/main": "2\t3\n"
  });
  const state = await gatherDevRoadmapState({ cwd: process.cwd(), runGit });
  assert.equal(state.anchor.branch, "feat/something");
  assert.equal(state.anchor.dirty_count, 2);
  assert.deepEqual(state.anchor.dirty, [
    "M docs/ROADMAP.md",
    "?? new-file.js"
  ]);
  assert.equal(state.main_vs_origin.synced, false);
  assert.equal(state.main_vs_origin.ahead_of_origin, 2);
  assert.equal(state.main_vs_origin.behind_origin, 3);
});

test("gatherDevRoadmapState — runGit error path marks git_available=false", async () => {
  const runGit = async () => "__GIT_ERROR__: not a git repo";
  const state = await gatherDevRoadmapState({ cwd: process.cwd(), runGit });
  assert.equal(state.git_available, false);
  assert.equal(state.anchor.branch, null);
  assert.equal(state.anchor.head_sha, null);
  assert.equal(state.recent_on_main.length, 0);
  assert.equal(state.feat_branches.length, 0);
});

test("boundary stamp denies network/mint/external_send/urp_runtime/fs_write", async () => {
  const state = await gatherDevRoadmapState({
    cwd: process.cwd(),
    runGit: fakeRunGit({})
  });
  assert.deepEqual(state.boundary, {
    read_only: true,
    network: false,
    mint: false,
    external_send: false,
    urp_runtime: false,
    filesystem_write_performed: false
  });
});

test("state is deep-frozen", async () => {
  const state = await gatherDevRoadmapState({
    cwd: process.cwd(),
    runGit: fakeRunGit({})
  });
  assert.ok(Object.isFrozen(state));
  assert.ok(Object.isFrozen(state.anchor));
  assert.ok(Object.isFrozen(state.recent_on_main));
  assert.ok(Object.isFrozen(state.feat_branches));
  assert.ok(Object.isFrozen(state.anchor_docs));
  assert.ok(Object.isFrozen(state.boundary));
});

test("formatDevRoadmapReport renders anchor + recent + branches + docs", async () => {
  const state = await gatherDevRoadmapState({
    cwd: process.cwd(),
    runGit: fakeRunGit({
      "branch --show-current": "main\n",
      "rev-parse --short HEAD": "ab47dbe\n",
      "log -1 --pretty=%s": "feat(cli) test subject\n",
      "log main -12 --pretty=%h %s": "ab47dbe feat(cli)\nd8aa7b9 docs\n",
      "for-each-ref --count=20 --sort=-committerdate refs/heads/feat/ --format=%(refname:short)|%(committerdate:relative)|%(objectname:short)":
        "feat/something|now|abc\n"
    })
  });
  const text = formatDevRoadmapReport(state);
  assert.match(text, /Dev Roadmap \(live anchor\)/);
  assert.match(text, /Branch:\s+main/);
  assert.match(text, /HEAD:\s+ab47dbe/);
  assert.match(text, /Tree:\s+clean/);
  assert.match(text, /main\/origin: synced/);
  assert.match(text, /Recent on main \(2 commits\)/);
  assert.match(text, /Active feat\/\* branches \(1\)/);
  assert.match(text, /docs\/ROADMAP\.md/);
  assert.match(text, /Next moves & parking lot:/);
  assert.match(text, /Boundary:.*network=false/);
});

test("anchor_docs presence check on real cwd includes the canonical docs", async () => {
  // Run against the real repo cwd; docs were written by this same slice.
  const state = await gatherDevRoadmapState({ cwd: process.cwd(), runGit: fakeRunGit({}) });
  const paths = state.anchor_docs.map((d) => d.path);
  for (const expected of [
    "docs/ROADMAP.md",
    "docs/CURRENT_LIMITS.md",
    "docs/PRODUCT.md",
    "docs/INDEX.md",
    "CHANGELOG.md",
    "README.md"
  ]) {
    assert.ok(paths.includes(expected), `missing ${expected} in anchor_docs`);
  }
});

test("`dema roadmap dev --json` exits 0 and emits the v0.1 envelope", async () => {
  const { stdout } = await execFileAsync(
    "node",
    [indexPath, "roadmap", "dev", "--json"],
    {
      encoding: "utf8",
      env: { ...process.env, DEMA_NO_TUI: "1", NODE_ENV: "test", NO_COLOR: "1" },
      maxBuffer: 8 * 1024 * 1024
    }
  );
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.schema, ROADMAP_DEV_SCHEMA);
  assert.equal(parsed.boundary.network, false);
  assert.ok(parsed.anchor);
  assert.ok(Array.isArray(parsed.anchor_docs));
});

test("`dema roadmap dev` (plain) renders the live anchor block", async () => {
  const { stdout } = await execFileAsync(
    "node",
    [indexPath, "roadmap", "dev"],
    {
      encoding: "utf8",
      env: { ...process.env, DEMA_NO_TUI: "1", NODE_ENV: "test", NO_COLOR: "1" },
      maxBuffer: 8 * 1024 * 1024
    }
  );
  assert.match(stdout, /Dev Roadmap \(live anchor\)/);
  assert.match(stdout, /Anchor:/);
  assert.match(stdout, /Recent on main/);
});

test("`dema roadmap preview` (existing surface) still works unchanged", async () => {
  const { stdout } = await execFileAsync(
    "node",
    [indexPath, "roadmap", "preview", "--json"],
    {
      encoding: "utf8",
      env: { ...process.env, DEMA_NO_TUI: "1", NODE_ENV: "test", NO_COLOR: "1" },
      maxBuffer: 8 * 1024 * 1024
    }
  );
  const parsed = JSON.parse(stdout);
  // The original optimization-roadmap preview schema (back-compat).
  assert.ok(parsed.schema);
  assert.ok(parsed.schema !== ROADMAP_DEV_SCHEMA);
});

test("`dema roadmap unknown` errors with a usage hint", async () => {
  await assert.rejects(
    () =>
      execFileAsync("node", [indexPath, "roadmap", "bogus"], {
        encoding: "utf8",
        env: { ...process.env, DEMA_NO_TUI: "1", NODE_ENV: "test" },
        maxBuffer: 4 * 1024 * 1024
      }),
    (err) => err.code === 1 && /Unknown roadmap command/.test(`${err.stdout ?? ""}${err.stderr ?? ""}`)
  );
});
