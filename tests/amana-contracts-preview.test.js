import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildAmanaContractsPreview,
  formatAmanaContractsPreview
} from "../packages/core/src/amana-contracts-preview.js";
import { runShell } from "../packages/core/src/shell.js";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const modulePath = fileURLToPath(new URL("../packages/core/src/amana-contracts-preview.js", import.meta.url));
const shellPath = fileURLToPath(new URL("../packages/core/src/shell.js", import.meta.url));

function makeOutputSink() {
  let output = "";
  return {
    output: new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      }
    }),
    text: () => output
  };
}

test("buildAmanaContractsPreview emits a schema-tagged preview without authority", () => {
  const preview = buildAmanaContractsPreview();

  assert.equal(preview.schema, "bizra.dema.amana_contracts_preview.v0.1");
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.truth_label, "DECLARED");
  assert.equal(preview.step7_status, "BLOCKED_PRE_AMANA");
  assert.equal(preview.unblocks_step7, false);
  assert.equal(preview.source_policy.external_code_imported, false);
  assert.equal(preview.source_policy.external_code_invoked, false);
  assert.equal(preview.source_policy.implementation_copied, false);
  assert.equal(preview.boundary.runtime_execution, false);
  assert.equal(preview.boundary.execution_enabled, false);
  assert.equal(preview.boundary.mutation_performed, false);
  assert.equal(preview.boundary.filesystem_write_performed, false);
  assert.equal(preview.boundary.capability_minted, false);
  assert.equal(preview.boundary.receipt_minted, false);
  assert.equal(preview.boundary.network_connection_attempted, false);
  assert.equal(preview.boundary.federation_initiated, false);
  assert.equal(preview.boundary.node_handshake_performed, false);
  assert.equal(preview.boundary.step7_mint_performed, false);
});

test("Amana primitives cover expected external audit candidates and blocked actions", () => {
  const preview = buildAmanaContractsPreview();
  const ids = preview.primitives.map((primitive) => primitive.id);

  assert.deepEqual(ids, [
    "consent_hash_table",
    "effect_cap_decision",
    "evidence_chain",
    "impact_event",
    "claim_ledger_checker",
    "journey_preview"
  ]);
  for (const primitive of preview.primitives) {
    assert.ok(primitive.blocked_actions.includes("runtime_start"));
    assert.ok(primitive.blocked_actions.includes("federation"));
    assert.ok(primitive.blocked_actions.includes("step7_mint"));
    assert.ok(primitive.blocked_actions.includes("receipt_mint"));
    assert.ok(primitive.required_proof.length > 0);
  }
});

test("Amana registry is deterministic, JSON-safe, and returns fresh objects", () => {
  const first = buildAmanaContractsPreview();
  const second = buildAmanaContractsPreview();

  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);

  first.primitives[0].blocked_actions.push("mutated");
  first.boundary.execution_enabled = true;

  const third = buildAmanaContractsPreview();
  assert.equal(third.primitives[0].blocked_actions.includes("mutated"), false);
  assert.equal(third.boundary.execution_enabled, false);
});

test("current repo overlap paths exist", () => {
  const preview = buildAmanaContractsPreview();

  for (const primitive of preview.primitives) {
    assert.ok(Array.isArray(primitive.current_repo_overlap));
    for (const relativePath of primitive.current_repo_overlap) {
      assert.equal(existsSync(join(repoRoot, relativePath)), true, `${relativePath} should exist`);
    }
  }
});

test("external source hints stay descriptive and non-addressable", () => {
  const preview = buildAmanaContractsPreview();
  const forbidden = /:\/\/|(?:^|[\s.])(?:com|org|io)\b|sha256:|\bcommit\b|[a-f0-9]{40}|[\\/]|@\w+/i;

  for (const primitive of preview.primitives) {
    assert.doesNotMatch(primitive.external_source_hint, forbidden);
  }
});

test("Amana registry module imports no external implementation or side-effect APIs", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /\brequire\s*\(/);
  assert.doesNotMatch(source, /\bimport\s*\(/);
  assert.doesNotMatch(source, /\bcreateRequire\b/);
  assert.doesNotMatch(source, /from "node:(?:fs|fs\/promises|net|http|https|http2|tls|dgram|dns|child_process|worker_threads|vm|cluster|repl)"/);
  assert.doesNotMatch(source, /\b(?:eval|Function)\s*\(/);
  assert.doesNotMatch(source, /\b(?:writeFile|appendFile|mkdir|rename|unlink|createWriteStream)\b/);
});

test("Amana registry module does not define copied primitive implementations", async () => {
  const source = await readFile(modulePath, "utf8");
  const implementationNames = [
    "ConsentHashTable",
    "EffectCap",
    "EffectCapDecision",
    "EvidenceChain",
    "ImpactEvent",
    "ClaimLedger",
    "ClaimLedgerChecker",
    "Journey",
    "JourneyPreview"
  ].join("|");
  const definitionPattern = new RegExp(
    `\\b(?:class|function)\\s+(?:${implementationNames})\\b|\\b(?:const|let|var)\\s+(?:${implementationNames})\\s*=`
  );

  assert.doesNotMatch(source, definitionPattern);
});

test("formatAmanaContractsPreview renders registry, gates, and no-mint boundary", () => {
  const output = formatAmanaContractsPreview(buildAmanaContractsPreview());

  assert.match(output, /DEMA Amana Contract Registry Preview/);
  assert.match(output, /consent_hash_table/);
  assert.match(output, /effect_cap_decision/);
  assert.match(output, /Proof gates/);
  assert.match(output, /no external code import/);
  assert.match(output, /no Step 7 mint/);
});

test("dema amana contracts preview prints a human-readable registry", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "amana", "contracts", "preview"]);

  assert.match(stdout, /DEMA Amana Contract Registry Preview/);
  assert.match(stdout, /Step 7: BLOCKED_PRE_AMANA/);
  assert.match(stdout, /no external code import/);
});

test("dema amana contracts preview --json emits the schema-tagged registry", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "amana", "contracts", "preview", "--json"]);
  const preview = JSON.parse(stdout);

  assert.equal(preview.schema, "bizra.dema.amana_contracts_preview.v0.1");
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.unblocks_step7, false);
  assert.equal(preview.boundary.receipt_minted, false);
  assert.equal(preview.boundary.network_connection_attempted, false);
});

test("dema amana rejects unknown subcommands", async () => {
  const result = await execFileAsync("node", [cliPath, "amana", "contracts", "mint"]).catch((error) => error);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /Unknown amana command/);
});

test("interactive shell advertises and dispatches the Amana registry command", async () => {
  const shellSource = await readFile(shellPath, "utf8");
  assert.match(shellSource, /amana contracts preview/);

  const dispatched = [];
  const sink = makeOutputSink();
  await runShell({
    input: Readable.from(["amana contracts preview\nexit\n"]),
    output: sink.output,
    greeting: "test",
    installSigintHandler: false,
    dispatchCommand(argv) {
      dispatched.push(argv);
    }
  });

  assert.deepEqual(dispatched, [["amana", "contracts", "preview"]]);
  assert.match(sink.text(), /amana contracts preview/);
});
