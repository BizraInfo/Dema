import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

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
    omega_root_used: "/fake"
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

test("dema memory query → Dema envelope wraps wrapper output", async () => {
  const wrapper = await makeFakeWrapper();
  const { stdout } = await execFileAsync("node", [cliPath, "memory", "query", "TESTQ", "--json"], {
    env: { ...process.env, DEMA_AGENT_DB_QUERY_PATH: wrapper }
  });
  const env = JSON.parse(stdout);
  assert.equal(env.schema, "bizra.dema.memory_query_result.v0.1");
  assert.equal(env.query, "TESTQ");
  assert.equal(env.wrapper_invoked, wrapper);
  assert.equal(env.wrapper_exit_code, 0);
});

test("dema memory query envelope passes through wrapper hits", async () => {
  const wrapper = await makeFakeWrapper();
  const { stdout } = await execFileAsync("node", [cliPath, "memory", "query", "TESTQ", "--json"], {
    env: { ...process.env, DEMA_AGENT_DB_QUERY_PATH: wrapper }
  });
  const env = JSON.parse(stdout);
  assert.equal(env.hits.length, 1);
  assert.equal(env.hits[0].id, "h0");
});

test("dema memory query envelope has honest Dema-side boundary", async () => {
  const wrapper = await makeFakeWrapper();
  const { stdout } = await execFileAsync("node", [cliPath, "memory", "query", "TESTQ", "--json"], {
    env: { ...process.env, DEMA_AGENT_DB_QUERY_PATH: wrapper }
  });
  const env = JSON.parse(stdout);
  assert.equal(env.boundary.runtime_execution_performed, true, "subprocess fired");
  assert.equal(env.boundary.network_used, false);
  assert.equal(env.boundary.receipt_mint_performed, false);
  assert.equal(env.memory_domain_boundary.public_safe, false);
  assert.equal(env.consent.consent_mode, "typed_command_read_only");
  assert.equal(env.consent.consent_level, "C0_OPERATOR_LOCAL_READ");
});

test("dema memory query --top N passed to wrapper", async () => {
  const wrapper = await makeFakeWrapper();
  const { stdout } = await execFileAsync("node",
    [cliPath, "memory", "query", "Q", "--top", "5", "--json"],
    { env: { ...process.env, DEMA_AGENT_DB_QUERY_PATH: wrapper }}
  );
  const env = JSON.parse(stdout);
  assert.equal(env.top, 5);
});

test("dema memory query → wrapper missing → exit 1 with clear error envelope", async () => {
  const res = await execFileAsync("node",
    [cliPath, "memory", "query", "Q", "--json"],
    { env: { ...process.env, DEMA_AGENT_DB_QUERY_PATH: "/nonexistent/wrapper-xyz" }}
  ).catch((e) => ({ stdout: e.stdout, code: e.code }));
  const env = JSON.parse(res.stdout);
  assert.equal(env.wrapper_exit_code, -1);
  assert.match(env.error, /wrapper not found/);
});

test("dema memory query → wrapper non-zero exit captured in envelope", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dema-mem-fail-"));
  const wrapper = join(dir, "agent-db-query-fail");
  await writeFile(wrapper, `#!/usr/bin/env python3
import sys
print('{"error":"simulated failure","schema":"bizra.dema.memory_query_result.v0.1.wrapper"}')
sys.exit(3)
`);
  await chmod(wrapper, 0o755);
  const res = await execFileAsync("node",
    [cliPath, "memory", "query", "Q", "--json"],
    { env: { ...process.env, DEMA_AGENT_DB_QUERY_PATH: wrapper }}
  ).catch((e) => ({ stdout: e.stdout, code: e.code }));
  const env = JSON.parse(res.stdout);
  assert.equal(env.wrapper_exit_code, 3);
});
