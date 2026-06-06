import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

function runCli(args, { stdin = null, timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "node",
      [cliPath, ...args],
      {
        env: { ...process.env, DEMA_BANNER_INTERACTIVE: "0", NODE_ENV: "test" },
        timeout,
      },
      (err, stdout, stderr) => {
        if (err && err.killed) {
          reject(
            new Error(`Process timed out. stdout=${stdout} stderr=${stderr}`),
          );
          return;
        }
        resolve({
          stdout,
          stderr,
          exitCode: err?.code ?? 0,
        });
      },
    );
    if (stdin !== null) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}

test("'dema model-broker route --task synthesis' (no registry) → exit 0; placeholder discipline returns selected_model_id=null", async () => {
  const { stdout, exitCode } = await runCli([
    "model-broker",
    "route",
    "--task",
    "synthesis",
  ]);
  assert.equal(exitCode, 0, "expected exit 0");
  const receipt = JSON.parse(stdout);
  assert.equal(receipt.schema, "bizra.dema.local_model_route_receipt.v0.1");
  assert.equal(receipt.selected_model_id, null);
  assert.equal(receipt.reason, "no_acceptable_candidate");
  // Every sample placeholder should appear in rejected_candidates with source_pending reason.
  assert.ok(receipt.rejected_candidates.length >= 1);
  const placeholderRejection = receipt.rejected_candidates.find(
    (r) => typeof r.model_id === "string" && r.model_id.includes("placeholder"),
  );
  assert.ok(
    placeholderRejection,
    "expected at least one placeholder rejection",
  );
  assert.match(placeholderRejection.reason, /source_pending/);
});

test("'dema model-broker route --task synthesis --registry-stdin' with operator dema_face on stdin → routes to operator entry", async () => {
  const operatorFixture = JSON.stringify({
    entries: [
      {
        id: "operator-real-dema-face",
        provider: "ollama",
        model_name: "operator-real-dema-face",
        role: "dema_face",
        size_class: "32B",
        locality: "local",
        allowed_tasks: ["synthesis"],
        max_concurrency: 1,
        context_limit: 32768,
        status: "active",
      },
    ],
  });
  const { stdout, exitCode } = await runCli(
    ["model-broker", "route", "--task", "synthesis", "--registry-stdin"],
    { stdin: operatorFixture },
  );
  assert.equal(exitCode, 0);
  const receipt = JSON.parse(stdout);
  assert.equal(receipt.selected_model_id, "operator-real-dema-face");
  assert.equal(receipt.selected_model_role, "dema_face");
  assert.equal(receipt.selected_model_locality, "local");
});

test("'dema model-broker route' (no --task and no --required-role) → exit non-zero with helpful error on stderr", async () => {
  const { stdout, stderr, exitCode } = await runCli(["model-broker", "route"]);
  assert.notEqual(exitCode, 0, "expected non-zero exit");
  assert.equal(stdout, "", "expected empty stdout when erroring");
  assert.match(stderr, /--task|--required-role/);
});

test("'dema model-broker bogus' (unknown action) → exit non-zero", async () => {
  const { stderr, exitCode } = await runCli(["model-broker", "bogus"]);
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /unknown action/);
  assert.match(stderr, /expected: route/);
});

test("'--pretty' flag produces indented JSON (contains newlines)", async () => {
  const { stdout, exitCode } = await runCli([
    "model-broker",
    "route",
    "--task",
    "synthesis",
    "--pretty",
  ]);
  assert.equal(exitCode, 0);
  // Indented JSON has newlines BETWEEN keys.
  const lines = stdout.trim().split("\n");
  assert.ok(
    lines.length > 5,
    `expected multi-line pretty output, got ${lines.length} lines`,
  );
  // Still parseable.
  const receipt = JSON.parse(stdout);
  assert.equal(receipt.schema, "bizra.dema.local_model_route_receipt.v0.1");
});

test("default (non-pretty) output is single-line JSON", async () => {
  const { stdout, exitCode } = await runCli([
    "model-broker",
    "route",
    "--task",
    "synthesis",
  ]);
  assert.equal(exitCode, 0);
  // Single-line JSON has no internal newlines (trailing newline from process.stdout.write is the only one).
  const lines = stdout.split("\n").filter((s) => s.length > 0);
  assert.equal(
    lines.length,
    1,
    `expected single-line JSON, got ${lines.length} lines`,
  );
  // Still parseable.
  JSON.parse(stdout);
});

test("'--no-local-only' permits a remote operator fixture to be selected", async () => {
  const remoteFixture = JSON.stringify({
    entries: [
      {
        id: "operator-remote-pat",
        provider: "openai",
        model_name: "operator-remote-pat",
        role: "pat_worker",
        size_class: "7B",
        locality: "remote",
        allowed_tasks: ["planning"],
        max_concurrency: 4,
        context_limit: 16384,
        status: "active",
      },
    ],
  });
  // First confirm local-only rejects this entry.
  const localOnly = await runCli(
    ["model-broker", "route", "--task", "planning", "--registry-stdin"],
    { stdin: remoteFixture },
  );
  const rejectedReceipt = JSON.parse(localOnly.stdout);
  assert.equal(rejectedReceipt.selected_model_id, null);
  // Then confirm --no-local-only routes to it.
  const allowRemote = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "planning",
      "--no-local-only",
      "--registry-stdin",
    ],
    { stdin: remoteFixture },
  );
  assert.equal(allowRemote.exitCode, 0);
  const acceptedReceipt = JSON.parse(allowRemote.stdout);
  assert.equal(acceptedReceipt.selected_model_id, "operator-remote-pat");
  assert.ok(
    acceptedReceipt.warnings.includes("local_only_disabled"),
    "expected warning when local_only is disabled",
  );
});

test("malformed --registry-stdin JSON exits non-zero gracefully (no crash)", async () => {
  const { stdout, stderr, exitCode } = await runCli(
    ["model-broker", "route", "--task", "synthesis", "--registry-stdin"],
    { stdin: "{not valid json" },
  );
  assert.notEqual(exitCode, 0);
  assert.equal(stdout, "", "expected empty stdout on malformed input");
  assert.match(stderr, /malformed|JSON/i);
});

test("receipt boundary declares zero effects (no model_invocation, no network, no federation, no mint, no token_economy, no urp_networking)", async () => {
  const { stdout, exitCode } = await runCli([
    "model-broker",
    "route",
    "--task",
    "synthesis",
  ]);
  assert.equal(exitCode, 0);
  const receipt = JSON.parse(stdout);
  assert.equal(receipt.boundary.runtime, false);
  assert.equal(receipt.boundary.model_invocation, false);
  assert.equal(receipt.boundary.network_used, false);
  assert.equal(receipt.boundary.federation, false);
  assert.equal(receipt.boundary.mint, false);
  assert.equal(receipt.boundary.token_economy, false);
  assert.equal(receipt.boundary.urp_networking, false);
  assert.equal(receipt.boundary.prompt_invocation_allowed, false);
});

test("'--required-role sat_validator' for claim_review task selects sat_validator from operator fixture", async () => {
  const fixture = JSON.stringify({
    entries: [
      {
        id: "operator-sat-validator-4b",
        provider: "ollama",
        model_name: "operator-sat-validator-4b",
        role: "sat_validator",
        size_class: "4B",
        locality: "local",
        allowed_tasks: ["claim_review"],
        max_concurrency: 1,
        context_limit: 8192,
        status: "active",
      },
    ],
  });
  const { stdout, exitCode } = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "claim_review",
      "--required-role",
      "sat_validator",
      "--registry-stdin",
    ],
    { stdin: fixture },
  );
  assert.equal(exitCode, 0);
  const receipt = JSON.parse(stdout);
  assert.equal(receipt.selected_model_id, "operator-sat-validator-4b");
  assert.equal(receipt.selected_model_role, "sat_validator");
});
