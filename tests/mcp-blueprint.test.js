import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

import {
  buildMcpIntegrationBlueprint,
  formatMcpIntegrationBlueprint
} from "../packages/core/src/mcp-blueprint.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const modulePath = fileURLToPath(new URL("../packages/core/src/mcp-blueprint.js", import.meta.url));

test("buildMcpIntegrationBlueprint emits a schema-tagged preview without MCP effects", () => {
  const blueprint = buildMcpIntegrationBlueprint();

  assert.equal(blueprint.schema, "bizra.dema.mcp_integration_blueprint.v0.1");
  assert.equal(blueprint.mode, "PREVIEW_ONLY");
  assert.equal(blueprint.boundary.mcp_call_performed_by_command, false);
  assert.equal(blueprint.boundary.external_api_called_by_command, false);
  assert.equal(blueprint.boundary.secrets_accessed, false);
  assert.equal(blueprint.boundary.credentials_stored, false);
  assert.equal(blueprint.boundary.mcp_mutation_performed, false);
});

test("MCP integration points keep credentials host-managed and mutations forbidden", () => {
  const blueprint = buildMcpIntegrationBlueprint();

  assert.ok(blueprint.integration_points.length >= 2);
  assert.ok(blueprint.integration_points.every((point) => (
    point.credential_source === "host_mcp_configuration" &&
    point.allowed_methods.length > 0 &&
    point.forbidden_methods.some((method) => /secret|mutation|posting/i.test(method))
  )));
});

test("MCP blueprint keeps proof pillars canonical and non-certifying", () => {
  const blueprint = buildMcpIntegrationBlueprint();

  assert.deepEqual(Object.keys(blueprint.proof_of_truth_convergence), [
    "formal",
    "cryptographic",
    "empirical",
    "economic"
  ]);
  assert.ok(Object.values(blueprint.proof_of_truth_convergence).every((pillar) => (
    pillar.certifies === false &&
    pillar.status !== "PERMIT" &&
    pillar.evidence_kind
  )));
});

test("MCP blueprint includes validation, batching, retries, and circuit breakers", () => {
  const blueprint = buildMcpIntegrationBlueprint();

  assert.ok(blueprint.api_discipline.validation.some((item) => /validate/i.test(item)));
  assert.ok(blueprint.api_discipline.batching.some((item) => /batch|bounded/i.test(item)));
  assert.ok(blueprint.api_discipline.retries.some((item) => /idempotent/i.test(item)));
  assert.ok(blueprint.api_discipline.circuit_breakers.some((item) => /auth|rate-limit/i.test(item)));
  assert.ok(blueprint.data_transformations.every((item) => item.redaction));
});

test("buildMcpIntegrationBlueprint is deterministic and returns fresh objects", () => {
  const first = buildMcpIntegrationBlueprint();
  const second = buildMcpIntegrationBlueprint();

  assert.deepEqual(first, second);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);

  first.integration_points[0].server = "mutated";
  first.boundary.secrets_accessed = true;
  const third = buildMcpIntegrationBlueprint();
  assert.notEqual(third.integration_points[0].server, "mutated");
  assert.equal(third.boundary.secrets_accessed, false);
});

test("formatMcpIntegrationBlueprint renders integration controls and boundary", () => {
  const output = formatMcpIntegrationBlueprint(buildMcpIntegrationBlueprint());

  assert.match(output, /DEMA MCP Integration Blueprint/);
  assert.match(output, /Integration points/);
  assert.match(output, /Security controls/);
  assert.match(output, /API discipline/);
  assert.match(output, /Proof-of-Truth Convergence/);
  assert.match(output, /Boundary: preview-only; no MCP call by this command/);
});

test("MCP blueprint module has no network or child process side effects", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(source, /from "node:(net|http|https|tls|dgram|child_process)"/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});

test("dema mcp blueprint prints a human-readable preview", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "mcp", "blueprint"]);

  assert.match(stdout, /DEMA MCP Integration Blueprint/);
  assert.match(stdout, /host_mcp_configuration/);
  assert.match(stdout, /no MCP call by this command/);
});

test("dema mcp blueprint --json emits the schema-tagged blueprint", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "mcp", "blueprint", "--json"]);
  const blueprint = JSON.parse(stdout);

  assert.equal(blueprint.schema, "bizra.dema.mcp_integration_blueprint.v0.1");
  assert.equal(blueprint.mode, "PREVIEW_ONLY");
  assert.equal(blueprint.boundary.credentials_stored, false);
  assert.ok(blueprint.integration_points.some((point) => point.server === "github-mcp-server"));
});

test("dema mcp rejects unknown subcommands", async () => {
  await assert.rejects(
    execFileAsync("node", [cliPath, "mcp", "connect"]),
    /Unknown mcp command/
  );
});
