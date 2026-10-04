import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import { mkdtemp, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

// Python skip-guard (matches tests/proof-forge-scripts.test.js canon).
// MC-A spawns python3 subprocess; if python3 is unavailable or too old,
// these tests skip rather than failing, so npm test stays portable on
// environments without python3 >= 3.10 (CI, contributor machines, etc.).
const pythonStatus = spawnSync(
  "python3",
  ["-c", "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)"],
  { encoding: "utf8" },
);
const pythonSkip =
  pythonStatus.status === 0 ? false : "python3 >= 3.10 is required";

test("dema memory --help exits 0 with usage", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "memory", "--help"]);
  assert.match(stdout, /memory/i);
  assert.match(stdout, /query/i);
});

async function makeFakeWrapper() {
  const dir = await mkdtemp(join(tmpdir(), "dema-mem-wrap-"));
  const wrapper = join(dir, "agent-db-query");
  const canned = {
    schema: "bizra.dema.memory_query_result.v0.1.wrapper",
    tool_version: "agent-db-query-v0.1",
    query: "TESTQ",
    top: 3,
    hits: [{ id: "h0", score: 0.9, snippet: "test hit content", metadata: {} }],
    hits_count: 1,
    omega_root_used: "/fake",
  };
  const script = `#!/usr/bin/env python3
import sys, json, argparse
p = argparse.ArgumentParser()
p.add_argument("--query"); p.add_argument("--top", type=int, default=3); p.add_argument("--json", action="store_true")
p.parse_args()
print(json.dumps(${JSON.stringify(canned)}))
`;
  await writeFile(wrapper, script);
  await chmod(wrapper, 0o755);
  return wrapper;
}

test(
  "dema memory query → Dema envelope wraps wrapper output",
  { skip: pythonSkip },
  async () => {
    const wrapper = await makeFakeWrapper();
    const { stdout } = await execFileAsync(
      "node",
      [cliPath, "memory", "query", "TESTQ", "--json"],
      {
        env: { ...process.env, DEMA_AGENT_DB_QUERY_PATH: wrapper },
      },
    );
    const env = JSON.parse(stdout);
    assert.equal(env.schema, "bizra.dema.memory_query_result.v0.1");
    assert.equal(env.query, "TESTQ");
    assert.equal(env.wrapper_invoked, wrapper);
    assert.equal(env.wrapper_exit_code, 0);
  },
);

test(
  "dema memory query envelope passes through wrapper hits",
  { skip: pythonSkip },
  async () => {
    const wrapper = await makeFakeWrapper();
    const { stdout } = await execFileAsync(
      "node",
      [cliPath, "memory", "query", "TESTQ", "--json"],
      {
        env: { ...process.env, DEMA_AGENT_DB_QUERY_PATH: wrapper },
      },
    );
    const env = JSON.parse(stdout);
    assert.equal(env.hits.length, 1);
    assert.equal(env.hits[0].id, "h0");
  },
);

test(
  "dema memory query envelope has honest Dema-side boundary",
  { skip: pythonSkip },
  async () => {
    const wrapper = await makeFakeWrapper();
    const { stdout } = await execFileAsync(
      "node",
      [cliPath, "memory", "query", "TESTQ", "--json"],
      {
        env: { ...process.env, DEMA_AGENT_DB_QUERY_PATH: wrapper },
      },
    );
    const env = JSON.parse(stdout);
    assert.equal(
      env.boundary.runtime_execution_performed,
      true,
      "subprocess fired",
    );
    assert.equal(env.boundary.network_used, false);
    assert.equal(env.boundary.receipt_mint_performed, false);
    assert.equal(env.memory_domain_boundary.public_safe, false);
    assert.equal(env.consent.consent_mode, "typed_command_read_only");
    assert.equal(env.consent.consent_level, "C0_OPERATOR_LOCAL_READ");
  },
);

test(
  "dema memory query --top N passed to wrapper",
  { skip: pythonSkip },
  async () => {
    const wrapper = await makeFakeWrapper();
    const { stdout } = await execFileAsync(
      "node",
      [cliPath, "memory", "query", "Q", "--top", "5", "--json"],
      { env: { ...process.env, DEMA_AGENT_DB_QUERY_PATH: wrapper } },
    );
    const env = JSON.parse(stdout);
    assert.equal(env.top, 5);
  },
);

test(
  "dema memory query → wrapper missing → exit 1 with clear error envelope",
  { skip: pythonSkip },
  async () => {
    const res = await execFileAsync(
      "node",
      [cliPath, "memory", "query", "Q", "--json"],
      {
        env: {
          ...process.env,
          DEMA_AGENT_DB_QUERY_PATH: "/nonexistent/wrapper-xyz",
        },
      },
    ).catch((e) => ({ stdout: e.stdout, code: e.code }));
    const env = JSON.parse(res.stdout);
    assert.equal(env.wrapper_exit_code, -1);
    assert.match(env.error, /wrapper not found/);
  },
);

test(
  "dema memory query → degraded substrate renders MEMORY_DEGRADED verdict, never raw constructor leak",
  { skip: pythonSkip },
  async () => {
    const res = await execFileAsync(
      "node",
      [cliPath, "memory", "query", "Q"],
      {
        env: {
          ...process.env,
          DEMA_AGENT_DB_QUERY_PATH: "/nonexistent/wrapper-xyz",
        },
      },
    ).catch((e) => ({ stdout: e.stdout, stderr: e.stderr, code: e.code }));
    const combined = (res.stdout || "") + (res.stderr || "");
    assert.match(combined, /MEMORY_DEGRADED/);
    assert.match(combined, /reason:/);
    assert.match(combined, /still works:/);
    assert.doesNotMatch(combined, /0 hit.s./, "must not print a success line above a failure");
    assert.notEqual(res.code, 0);
  },
);

test(
  "dema memory query → wrapper non-zero exit captured in envelope AND propagated to Dema exit code",
  { skip: pythonSkip },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "dema-mem-fail-"));
    const wrapper = join(dir, "agent-db-query-fail");
    await writeFile(
      wrapper,
      `#!/usr/bin/env python3
import sys
print('{"error":"simulated failure","schema":"bizra.dema.memory_query_result.v0.1.wrapper"}')
sys.exit(3)
`,
    );
    await chmod(wrapper, 0o755);
    const res = await execFileAsync(
      "node",
      [cliPath, "memory", "query", "Q", "--json"],
      { env: { ...process.env, DEMA_AGENT_DB_QUERY_PATH: wrapper } },
    ).catch((e) => ({ stdout: e.stdout, code: e.code }));
    const env = JSON.parse(res.stdout);
    assert.equal(env.wrapper_exit_code, 3);
    // Dema must exit non-zero when wrapper exits non-zero — silent-success was
    // the Copilot finding fixed in the v0.1 fixup commit.
    assert.notEqual(res.code, 0, "Dema must propagate wrapper non-zero exit");
    assert.match(env.error, /simulated failure|wrapper exited with code/);
  },
);

test(
  "dema memory query → snippets truncated to 200 chars even if wrapper returns longer",
  { skip: pythonSkip },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "dema-mem-bigsnip-"));
    const wrapper = join(dir, "agent-db-query-big");
    // Wrapper that returns a 500-char snippet, deliberately exceeding the
    // 200-char memory_domain_boundary.snippet_max_chars cap.
    const bigSnippet = "x".repeat(500);
    const wrapperOut = {
      schema: "bizra.dema.memory_query_result.v0.1.wrapper",
      hits: [{ id: "big", score: 0.5, snippet: bigSnippet, metadata: {} }],
      hits_count: 1,
      omega_root_used: "/fake",
    };
    await writeFile(
      wrapper,
      `#!/usr/bin/env python3
import json, sys
print(json.dumps(${JSON.stringify(wrapperOut)}))
`,
    );
    await chmod(wrapper, 0o755);
    const { stdout } = await execFileAsync(
      "node",
      [cliPath, "memory", "query", "Q", "--json"],
      { env: { ...process.env, DEMA_AGENT_DB_QUERY_PATH: wrapper } },
    );
    const env = JSON.parse(stdout);
    assert.equal(env.hits.length, 1);
    assert.equal(
      env.hits[0].snippet.length,
      200,
      "Dema must defensively truncate snippets to 200 chars",
    );
  },
);

test("dema memory query → --top non-integer rejected", async () => {
  const res = await execFileAsync("node", [
    cliPath,
    "memory",
    "query",
    "Q",
    "--top",
    "abc",
  ]).catch((e) => ({ stdout: e.stdout, stderr: e.stderr, code: e.code }));
  assert.notEqual(res.code, 0, "Dema must reject non-integer --top");
  assert.match(res.stderr ?? "", /top out of range/i);
});

test("dema memory query → --top out of range [1, 20] rejected", async () => {
  const res = await execFileAsync("node", [
    cliPath,
    "memory",
    "query",
    "Q",
    "--top",
    "50",
  ]).catch((e) => ({ stdout: e.stdout, stderr: e.stderr, code: e.code }));
  assert.notEqual(res.code, 0, "Dema must reject --top > 20");
  assert.match(res.stderr ?? "", /top out of range/i);
});

test(
  "dema memory query → boundary.tool_executed is false (canon: RUNTIME_EMISSION_STRICTLY_FALSE_KEYS)",
  { skip: pythonSkip },
  async () => {
    const wrapper = await makeFakeWrapper();
    const { stdout } = await execFileAsync(
      "node",
      [cliPath, "memory", "query", "Q", "--json"],
      { env: { ...process.env, DEMA_AGENT_DB_QUERY_PATH: wrapper } },
    );
    const env = JSON.parse(stdout);
    assert.equal(
      env.boundary.tool_executed,
      false,
      "tool_executed is in RUNTIME_EMISSION_STRICTLY_FALSE_KEYS per packages/core/src/preview-boundary.js:129; runtime_execution_performed alone signals subprocess fired",
    );
    assert.equal(env.boundary.runtime_execution_performed, true);
  },
);

test("dema memory query → wrapper missing emits human-readable error to stderr in non-JSON mode", async () => {
  const res = await execFileAsync("node", [cliPath, "memory", "query", "Q"], {
    env: {
      ...process.env,
      DEMA_AGENT_DB_QUERY_PATH: "/nonexistent/wrapper-xyz",
    },
  }).catch((e) => ({ stdout: e.stdout, stderr: e.stderr, code: e.code }));
  assert.notEqual(res.code, 0);
  assert.match(res.stderr ?? "", /wrapper not found/);
  // Non-JSON mode should NOT print the full JSON envelope to stdout
  assert.doesNotMatch(res.stdout ?? "", /"schema":/);
});
