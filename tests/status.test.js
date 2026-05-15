import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { defaultStatus, formatStatus } from "../packages/core/src/status.js";
import {
  BOUNDED_DIAGNOSTIC_CONSENT_PHRASE,
  previewBoundedDiagnostic,
  proposeBoundedDiagnostic
} from "../packages/core/src/mission.js";
import { readTodayTick, recordTodayTick } from "../packages/core/src/today.js";
import { evaluateConsent } from "../packages/fate/src/fate.js";
import { runSetup } from "../packages/installer/src/setup.js";
import {
  createNode0Adapter,
  normalizeNode0Status,
  parseCommandLine
} from "../packages/node-adapter/src/node0-adapter.js";
import { listReceipts, readReceipt } from "../packages/receipts/src/receipt-store.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

test("default status is safe and blocked", () => {
  const status = defaultStatus();
  assert.equal(status.ready, false);
  assert.equal(status.activationGate, "BLOCKED");
  assert.equal(status.human, null);
});

test("status formatting includes consent boundary", () => {
  const output = formatStatus(defaultStatus());
  assert.match(output, /Boundary: no action without explicit consent/);
  assert.match(output, /Runtime pulse fired: false/);
});

test("bounded diagnostic requires ready node and explicit gate", () => {
  const proposal = proposeBoundedDiagnostic({
    ready: true,
    consoleReady: true,
    activationGate: "EXPLICIT_GO_REQUIRED",
    daemonStatus: "stopped",
    missionExecuted: false,
    runtimePulse: { fired: false }
  });
  assert.equal(proposal.allowed, true);
  assert.equal(proposal.expectedArtifact, "ARTIFACT-011");
});

test("bounded diagnostic blocks hidden daemon and previous runtime pulse", () => {
  const daemon = proposeBoundedDiagnostic({
    ready: true,
    consoleReady: true,
    activationGate: "EXPLICIT_GO_REQUIRED",
    daemonStatus: "running",
    missionExecuted: false,
    runtimePulse: { fired: false }
  });
  assert.equal(daemon.allowed, false);
  assert.match(daemon.reason, /Daemon/);

  const pulse = proposeBoundedDiagnostic({
    ready: true,
    consoleReady: true,
    activationGate: "EXPLICIT_GO_REQUIRED",
    daemonStatus: "stopped",
    missionExecuted: false,
    runtimePulse: { fired: true }
  });
  assert.equal(pulse.allowed, false);
  assert.match(pulse.reason, /Runtime pulse/);
});

test("mission preview does not execute runtime and requires exact consent", () => {
  const status = {
    ready: true,
    consoleReady: true,
    activationGate: "EXPLICIT_GO_REQUIRED",
    daemonStatus: "stopped",
    missionExecuted: false,
    runtimePulse: { fired: false }
  };
  const rejected = previewBoundedDiagnostic(status, "GO");
  assert.equal(rejected.executes, false);
  assert.equal(rejected.consent.accepted, false);

  const accepted = previewBoundedDiagnostic(status, BOUNDED_DIAGNOSTIC_CONSENT_PHRASE);
  assert.equal(accepted.executes, false);
  assert.equal(accepted.consent.accepted, true);
});

test("fate consent requires exact phrase", () => {
  assert.equal(
    evaluateConsent({
      phrase: `${BOUNDED_DIAGNOSTIC_CONSENT_PHRASE} `,
      requiredPhrase: BOUNDED_DIAGNOSTIC_CONSENT_PHRASE
    }).accepted,
    false
  );
});

test("setup creates local profile and config without daemon activation", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-setup-"));
  const result = await runSetup(root);
  assert.equal(result.root, root);
  assert.equal(result.created, true);
  assert.ok(result.createdPaths.includes(join(root, "profile.json")));
  assert.ok(result.untouched.includes("mission runtime"));
  assert.equal(result.boundaries.noHiddenDaemon, true);
  assert.equal(result.boundaries.missionExecuted, false);
  assert.equal(result.boundaries.artifact011Issued, false);

  const profile = JSON.parse(await readFile(join(root, "profile.json"), "utf8"));
  assert.equal(profile.hidden_autonomy, false);

  const config = JSON.parse(await readFile(join(root, "config.local.json"), "utf8"));
  assert.equal(config.noHiddenDaemon, true);
  assert.equal(config.requireExplicitConsent, true);

  const second = await runSetup(root);
  assert.equal(second.created, false);
  assert.ok(second.existingPaths.includes(join(root, "profile.json")));
});

test("welcome CLI gives non-technical first-run orientation", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "welcome"]);
  assert.match(stdout, /Welcome to Dema/);
  assert.match(stdout, /local-first/);
  assert.match(stdout, /consent-bound/);
  assert.match(stdout, /Run setup/);
});

test("setup CLI reports untouched runtime boundaries", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-cli-setup-"));
  const { stdout } = await execFileAsync("node", [cliPath, "setup"], {
    env: { ...process.env, DEMA_HOME: root }
  });
  const output = JSON.parse(stdout);
  assert.equal(output.paths.home, root);
  assert.equal(output.boundaries.noHiddenDaemon, true);
  assert.equal(output.boundaries.missionExecuted, false);
  assert.equal(output.boundaries.artifact011Issued, false);
  assert.ok(output.untouched.includes("runtime pulse"));
});

test("doctor CLI lists specific failing predicates when gateway is not configured", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-cli-doctor-"));
  const env = { ...process.env, DEMA_HOME: root };
  delete env.DEMA_NODE0_ADAPTER;
  delete env.DEMA_NODE0_STATUS_COMMAND;
  const result = await execFileAsync("node", [cliPath, "doctor"], { env }).catch((e) => e);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /Dema doctor: blocked — /);
  // Default-status fingerprint: ready=false, consoleReady=false, activationGate=BLOCKED,
  // daemonStatus=unknown (so daemon predicate does NOT fail).
  assert.match(result.stdout, /not ready/);
  assert.match(result.stdout, /console not ready/);
  assert.match(result.stdout, /activation gate is BLOCKED \(expected EXPLICIT_GO_REQUIRED\)/);
});

test("mission propose CLI remains preview-only", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-cli-mission-"));
  const { stdout } = await execFileAsync("node", [cliPath, "mission", "propose"], {
    env: { ...process.env, DEMA_HOME: root }
  });
  const output = JSON.parse(stdout);
  assert.equal(output.executes, false);
  assert.equal(output.action, "bounded_diagnostic_activation");
});

test("today tick records continuity without mission execution", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-today-"));
  const { tick, path } = await recordTodayTick({
    root,
    now: new Date("2026-05-04T18:20:00.000Z"),
    status: {
      ready: true,
      consoleReady: true,
      activationGate: "EXPLICIT_GO_REQUIRED",
      daemonStatus: "stopped",
      proof: { nextArtifact: "ARTIFACT-011" },
      nextAdmissibleAction: "bounded_diagnostic_activation"
    }
  });
  assert.equal(tick.date, "2026-05-04");
  assert.equal(tick.missionExecuted, false);
  assert.equal(tick.runtimePulse.fired, false);
  assert.equal(JSON.parse(await readFile(path, "utf8")).activationGate, "EXPLICIT_GO_REQUIRED");
  assert.equal((await readTodayTick(root)).nextArtifact, "ARTIFACT-011");
});

test("node0 status normalization preserves measured onboarding seal fields", () => {
  const status = normalizeNode0Status({
    profile: { preferred_name: "Mumu" },
    ready: true,
    dema_console: { console_ready: true, activation_gate: "EXPLICIT_GO_REQUIRED" },
    daemon_status: "stopped",
    mission_executed: false,
    runtime_pulse: { fired: false },
    lm_studio: {
      connected: true,
      loaded_model_ids: ["qwen/qwen3.5-9b"],
      token_present: true
    },
    rust_bus: { ready: true },
    findings: []
  });

  assert.equal(status.human, "Mumu");
  assert.equal(status.ready, true);
  assert.equal(status.consoleReady, true);
  assert.equal(status.daemonStatus, "stopped");
  assert.equal(status.model.connected, true);
  assert.deepEqual(status.model.loadedModelIds, ["qwen/qwen3.5-9b"]);
  assert.equal(status.rustBus.ready, true);
});

test("node0 status normalization does not default to a private human name", () => {
  const status = normalizeNode0Status({});
  assert.equal(status.human, null);
});

test("node0 status normalization coerces non-array loaded_model_ids to []", () => {
  // Adapter input is untrusted (CLAUDE.md invariant 6). A malformed payload
  // like `loaded_model_ids: "phi-2"` must not crash `.join(", ")` downstream.
  for (const malformed of ["phi-2", 42, true, { id: "x" }]) {
    const status = normalizeNode0Status({
      lm_studio: { loaded_model_ids: malformed }
    });
    assert.deepEqual(
      status.model.loadedModelIds,
      [],
      `expected [] for non-array input ${JSON.stringify(malformed)}`
    );
  }
});

test("node0 adapter explains malformed command output", async () => {
  const adapter = createNode0Adapter({
    adapterMode: "shellout",
    command: 'node -e "process.stdout.write(`not-json`)"'
  });
  await assert.rejects(
    () => adapter.status(),
    /DEMA_NODE0_STATUS_COMMAND returned non-JSON output/
  );
});

test("node0 command parser preserves quoted paths with spaces", () => {
  assert.deepEqual(
    parseCommandLine('python -m core.sovereign node0 status --root "/tmp/my node"'),
    ["python", "-m", "core.sovereign", "node0", "status", "--root", "/tmp/my node"]
  );
});

test("receipt store lists and reads receipts by artifact id", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-receipts-"));
  await mkdir(join(root, "receipts"), { recursive: true });
  await writeFile(join(root, "receipts", "artifact-011.json"), JSON.stringify({
    receipt_id: "receipt-1",
    artifact_id: "ARTIFACT-011",
    action: "bounded_diagnostic_activation",
    truth_label: "MEASURED",
    created_at: "2026-05-04T18:20:00.000Z"
  }));

  const receipts = await listReceipts(root);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].artifact_id, "ARTIFACT-011");

  const receipt = await readReceipt("ARTIFACT-011", root);
  assert.equal(receipt.receipt_id, "receipt-1");

  const byFile = await readReceipt("artifact-011.json", root);
  assert.equal(byFile.artifact_id, "ARTIFACT-011");
});


test("receipt store rejects ambiguous filename selectors", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-receipts-"));
  await mkdir(join(root, "receipts", "a"), { recursive: true });
  await mkdir(join(root, "receipts", "b"), { recursive: true });
  await writeFile(join(root, "receipts", "a", "handoff.json"), JSON.stringify({
    receipt_id: "receipt-a",
    artifact_id: "ARTIFACT-A",
    action: "bounded_diagnostic_activation",
    truth_label: "MEASURED",
    created_at: "2026-05-04T18:20:00.000Z"
  }));
  await writeFile(join(root, "receipts", "b", "handoff.json"), JSON.stringify({
    receipt_id: "receipt-b",
    artifact_id: "ARTIFACT-B",
    action: "bounded_diagnostic_activation",
    truth_label: "MEASURED",
    created_at: "2026-05-04T18:21:00.000Z"
  }));

  await assert.rejects(
    () => readReceipt("handoff.json", root),
    /Ambiguous receipt selector/
  );
  assert.equal((await readReceipt("ARTIFACT-A", root)).receipt_id, "receipt-a");
  assert.equal((await readReceipt("receipt-b", root)).artifact_id, "ARTIFACT-B");
});
