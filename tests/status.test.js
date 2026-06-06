import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
} from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { defaultStatus, formatStatus } from "../packages/core/src/status.js";
import {
  BOUNDED_DIAGNOSTIC_CONSENT_PHRASE,
  previewBoundedDiagnostic,
  proposeBoundedDiagnostic,
} from "../packages/core/src/mission.js";
import { readTodayTick, recordTodayTick } from "../packages/core/src/today.js";
import { evaluateConsent } from "../packages/fate/src/fate.js";
import { runSetup } from "../packages/installer/src/setup.js";
import {
  createNode0Adapter,
  normalizeNode0Status,
  parseCommandLine,
} from "../packages/node-adapter/src/node0-adapter.js";
import {
  listReceipts,
  readReceipt,
} from "../packages/receipts/src/receipt-store.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

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
    runtimePulse: { fired: false },
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
    runtimePulse: { fired: false },
  });
  assert.equal(daemon.allowed, false);
  assert.match(daemon.reason, /Daemon/);

  const pulse = proposeBoundedDiagnostic({
    ready: true,
    consoleReady: true,
    activationGate: "EXPLICIT_GO_REQUIRED",
    daemonStatus: "stopped",
    missionExecuted: false,
    runtimePulse: { fired: true },
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
    runtimePulse: { fired: false },
  };
  const rejected = previewBoundedDiagnostic(status, "GO");
  assert.equal(rejected.executes, false);
  assert.equal(rejected.consent.accepted, false);

  const accepted = previewBoundedDiagnostic(
    status,
    BOUNDED_DIAGNOSTIC_CONSENT_PHRASE,
  );
  assert.equal(accepted.executes, false);
  assert.equal(accepted.consent.accepted, true);
});

test("fate consent requires exact phrase", () => {
  assert.equal(
    evaluateConsent({
      phrase: `${BOUNDED_DIAGNOSTIC_CONSENT_PHRASE} `,
      requiredPhrase: BOUNDED_DIAGNOSTIC_CONSENT_PHRASE,
    }).accepted,
    false,
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

  const profile = JSON.parse(
    await readFile(join(root, "profile.json"), "utf8"),
  );
  assert.equal(profile.hidden_autonomy, false);

  const config = JSON.parse(
    await readFile(join(root, "config.local.json"), "utf8"),
  );
  assert.equal(config.noHiddenDaemon, true);
  assert.equal(config.requireExplicitConsent, true);

  const second = await runSetup(root);
  assert.equal(second.created, false);
  assert.ok(second.existingPaths.includes(join(root, "profile.json")));
});

test("welcome CLI gives non-technical first-run orientation", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "welcome"]);
  assert.match(stdout, /Welcome to Dema/);
  assert.match(stdout, /Local-first/);
  assert.match(stdout, /Consent-bound/);
  assert.match(stdout, /dema setup/);
});

test("setup CLI reports untouched runtime boundaries", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-cli-setup-"));
  const { stdout } = await execFileAsync("node", [cliPath, "setup"], {
    env: { ...process.env, DEMA_HOME: root },
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
  const result = await execFileAsync(
    "node",
    [cliPath, "doctor", "--no-color"],
    { env },
  ).catch((e) => e);
  assert.equal(result.code, 1);
  // Dashboard format: row-based predicates with ❌ icons and Verdict line.
  // Default-status fingerprint: ready=false, consoleReady=false, activationGate=BLOCKED,
  // daemonStatus=unknown (daemon predicate does NOT fail — unknown is ok).
  assert.match(result.stdout, /Verdict: blocked/);
  assert.match(result.stdout, /❌ Ready\s+false/);
  assert.match(result.stdout, /❌ Console ready\s+false/);
  assert.match(result.stdout, /❌ Activation gate\s+BLOCKED/);
});

test("mission propose CLI remains preview-only", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-cli-mission-"));
  const { stdout } = await execFileAsync(
    "node",
    [cliPath, "mission", "propose", "--json"],
    {
      env: { ...process.env, DEMA_HOME: root },
    },
  );
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
      nextAdmissibleAction: "bounded_diagnostic_activation",
    },
  });
  assert.equal(tick.date, "2026-05-04");
  assert.equal(tick.missionExecuted, false);
  assert.equal(tick.runtimePulse.fired, false);
  assert.equal(
    JSON.parse(await readFile(path, "utf8")).activationGate,
    "EXPLICIT_GO_REQUIRED",
  );
  assert.equal((await readTodayTick(root)).nextArtifact, "ARTIFACT-011");
});

test("node0 status normalization preserves measured onboarding seal fields", () => {
  const status = normalizeNode0Status({
    profile: { preferred_name: "Mumu" },
    ready: true,
    dema_console: {
      console_ready: true,
      activation_gate: "EXPLICIT_GO_REQUIRED",
    },
    daemon_status: "stopped",
    mission_executed: false,
    runtime_pulse: { fired: false },
    lm_studio: {
      connected: true,
      loaded_model_ids: ["qwen/qwen3.5-9b"],
      token_present: true,
    },
    rust_bus: { ready: true },
    findings: [],
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
      lm_studio: { loaded_model_ids: malformed },
    });
    assert.deepEqual(
      status.model.loadedModelIds,
      [],
      `expected [] for non-array input ${JSON.stringify(malformed)}`,
    );
  }
});

test("node0 adapter explains malformed command output", async () => {
  const adapter = createNode0Adapter({
    adapterMode: "shellout",
    command: 'node -e "process.stdout.write(`not-json`)"',
  });
  await assert.rejects(
    () => adapter.status(),
    /DEMA_NODE0_STATUS_COMMAND returned non-JSON output/,
  );
});

test("node0 command parser preserves quoted paths with spaces", () => {
  assert.deepEqual(
    parseCommandLine(
      'python -m core.sovereign node0 status --root "/tmp/my node"',
    ),
    [
      "python",
      "-m",
      "core.sovereign",
      "node0",
      "status",
      "--root",
      "/tmp/my node",
    ],
  );
});

test("receipt store lists and reads receipts by artifact id", async () => {
  await withReceiptFixture("dema-receipts-", async (root) => {
    await writeFile(
      join(root, "receipts", "artifact-011.json"),
      JSON.stringify({
        receipt_id: "receipt-1",
        artifact_id: "ARTIFACT-011",
        action: "bounded_diagnostic_activation",
        truth_label: "MEASURED",
        created_at: "2026-05-04T18:20:00.000Z",
      }),
    );

    const receipts = await listReceipts(root);
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].artifact_id, "ARTIFACT-011");

    const receipt = await readReceipt("ARTIFACT-011", root);
    assert.equal(receipt.receipt_id, "receipt-1");

    const byFile = await readReceipt("artifact-011.json", root);
    assert.equal(byFile.artifact_id, "ARTIFACT-011");
  });
});

test("receipt store rejects ambiguous filename selectors", async () => {
  await withReceiptFixture("dema-receipts-", async (root) => {
    await mkdir(join(root, "receipts", "a"), { recursive: true });
    await mkdir(join(root, "receipts", "b"), { recursive: true });
    await writeFile(
      join(root, "receipts", "a", "handoff.json"),
      JSON.stringify({
        receipt_id: "receipt-a",
        artifact_id: "ARTIFACT-A",
        action: "bounded_diagnostic_activation",
        truth_label: "MEASURED",
        created_at: "2026-05-04T18:20:00.000Z",
      }),
    );
    await writeFile(
      join(root, "receipts", "b", "handoff.json"),
      JSON.stringify({
        receipt_id: "receipt-b",
        artifact_id: "ARTIFACT-B",
        action: "bounded_diagnostic_activation",
        truth_label: "MEASURED",
        created_at: "2026-05-04T18:21:00.000Z",
      }),
    );

    await assert.rejects(
      () => readReceipt("handoff.json", root),
      /Ambiguous receipt selector/,
    );
    assert.equal(
      (await readReceipt("ARTIFACT-A", root)).receipt_id,
      "receipt-a",
    );
    assert.equal(
      (await readReceipt("receipt-b", root)).artifact_id,
      "ARTIFACT-B",
    );
  });
});

async function withReceiptFixture(prefix, fn) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  try {
    await mkdir(join(root, "receipts"), { recursive: true });
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function writeReceiptFixture(root, filename, fields = {}) {
  await writeFile(
    join(root, "receipts", filename),
    JSON.stringify({
      receipt_id: `receipt-${filename}`,
      artifact_id: `ARTIFACT-${filename}`,
      action: "bounded_diagnostic_activation",
      truth_label: "MEASURED",
      created_at: "2026-05-04T18:20:00.000Z",
      ...fields,
    }),
  );
}

test("receipt store respects deterministic max file count and pagination", async () => {
  await withReceiptFixture("dema-receipts-limit-", async (root) => {
    await writeReceiptFixture(root, "003.json", {
      artifact_id: "ARTIFACT-003",
    });
    await writeReceiptFixture(root, "001.json", {
      artifact_id: "ARTIFACT-001",
    });
    await writeReceiptFixture(root, "004.json", {
      artifact_id: "ARTIFACT-004",
    });
    await writeReceiptFixture(root, "002.json", {
      artifact_id: "ARTIFACT-002",
    });

    const capped = await listReceipts(root, { maxFiles: 2 });
    assert.deepEqual(
      capped.map((receipt) => receipt.artifact_id),
      ["ARTIFACT-001", "ARTIFACT-002"],
    );

    const page = await listReceipts(root, { limit: 2, offset: 1 });
    assert.deepEqual(
      page.map((receipt) => receipt.artifact_id),
      ["ARTIFACT-002", "ARTIFACT-003"],
    );
  });
});

test("receipt store marks oversized and malformed JSON without crashing", async () => {
  await withReceiptFixture("dema-receipts-safety-", async (root) => {
    await writeReceiptFixture(root, "ok.json", { artifact_id: "ARTIFACT-OK" });
    await writeFile(
      join(root, "receipts", "oversized.json"),
      JSON.stringify({
        receipt_id: "receipt-oversized",
        artifact_id: "ARTIFACT-OVERSIZED",
        payload: "x".repeat(256),
      }),
    );
    await writeFile(join(root, "receipts", "malformed.json"), "{not-json");

    const receipts = await listReceipts(root, { maxJsonBytes: 256 });
    const byFilename = new Map(
      receipts.map((receipt) => [basename(receipt.path), receipt]),
    );

    assert.equal(byFilename.get("ok.json").artifact_id, "ARTIFACT-OK");
    assert.equal(byFilename.get("oversized.json").unreadable, true);
    assert.equal(
      byFilename.get("oversized.json").reason,
      "receipt_json_too_large",
    );
    assert.match(byFilename.get("oversized.json").error, /maxJsonBytes/);
    assert.equal(byFilename.get("malformed.json").unreadable, true);
    assert.equal(byFilename.get("malformed.json").reason, "malformed_json");
  });
});

test("receipt store labels listing as local read/list rather than governed runtime issuance", async () => {
  let fixtureRoot;
  await withReceiptFixture("dema-receipts-boundary-", async (root) => {
    fixtureRoot = root;
    await writeReceiptFixture(root, "artifact-011.json", {
      receipt_id: "receipt-boundary",
      artifact_id: "ARTIFACT-011",
    });

    const [receipt] = await listReceipts(root);
    assert.equal(receipt.store_scope, "local_read_list");
    assert.equal(receipt.operation_boundary, "read_list_only_no_mint");
    assert.equal(receipt.issuer_boundary, "governed_runtime_issues_receipts");
  });

  await assert.rejects(
    () => readFile(join(fixtureRoot, "receipts", "artifact-011.json"), "utf8"),
    /ENOENT/,
  );
});

// v0.1.2 (2026-05-20 · PR #64 review feedback): receipt root containment.
//
// Earlier v0.1.1 restricted DEMA_HOME to homedir() or tmpdir(), which 3
// reviewers flagged as too strict (operator can legitimately declare a
// project-local state root anywhere). v0.1.2 corrects this:
//   1. Any operator-declared DEMA_HOME is honored after path normalization
//   2. Per-entry containment is enforced via path.relative() + realpath() so
//      symlink escapes and traversal beyond the declared root are caught
//   3. Cross-platform safe (path module handles Windows case-folding)
//
// Tests below cover the 7 acceptance criteria from the review-thread closeout
// scope: custom DEMA_HOME · tmpdir fixture · symlink escape · listReceipts
// soft-fail · readReceipt hard-fail · path normalization · traversal collapse.

test("F-3 v0.1.2 · AC-1: custom project-local DEMA_HOME outside home/tmp accepted", async () => {
  // v0.1.1 would have rejected this; v0.1.2 honors operator-declared root.
  // We can't easily write to /opt in tests, so we verify via no-throw +
  // expected fail-soft (no receipts dir there).
  const result = await listReceipts("/opt/dema-nonexistent-project-x");
  assert.deepEqual(
    result,
    [],
    "non-existent operator-declared root returns [] (fail-soft)",
  );
});

test("F-3 v0.1.2 · AC-2: tmpdir fixture pattern still works (backward compat)", async () => {
  await withReceiptFixture("dema-v012-tmpdir-", async (root) => {
    await writeReceiptFixture(root, "x.json", {
      receipt_id: "r",
      artifact_id: "A",
    });
    const receipts = await listReceipts(root);
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].artifact_id, "A");
  });
});

test("F-3 v0.1.2 · AC-3: receipts symlink escaping DEMA_HOME is rejected (skipped during enumeration)", async () => {
  await withReceiptFixture("dema-v012-symlink-", async (root) => {
    // legitimate receipt inside
    await writeReceiptFixture(root, "real.json", {
      receipt_id: "r-real",
      artifact_id: "A-REAL",
    });
    // adversarial: plant a file OUTSIDE the receipts root, then symlink IN
    const outsideDir = await mkdtemp(join(tmpdir(), "dema-v012-outside-"));
    try {
      const outsideFile = join(outsideDir, "evil.json");
      await writeFile(
        outsideFile,
        JSON.stringify({ receipt_id: "r-evil", artifact_id: "A-EVIL" }),
      );
      await symlink(outsideFile, join(root, "receipts", "evil.json"));
      const receipts = await listReceipts(root);
      const hasEvil = receipts.some((r) => r.artifact_id === "A-EVIL");
      assert.equal(
        hasEvil,
        false,
        "symlinked receipt escaping root must NOT appear in listing",
      );
      // real receipt is still surfaced
      assert.equal(
        receipts.some((r) => r.artifact_id === "A-REAL"),
        true,
      );
    } finally {
      await rm(outsideDir, { recursive: true, force: true });
    }
  });
});

test("F-3 v0.1.2 · AC-4: listReceipts soft-fail on nonexistent root returns []", async () => {
  const result = await listReceipts("/tmp/dema-truly-nonexistent-12345");
  assert.deepEqual(result, []);
});

test("F-3 v0.1.2 · AC-5: readReceipt hard-fail on nonexistent receipt throws", async () => {
  await assert.rejects(
    () => readReceipt("nonexistent-id", "/tmp/dema-truly-nonexistent-12345"),
    /Receipt not found/,
    "readReceipt must throw with clear 'not found' error",
  );
});

test("F-3 v0.1.2 · AC-6: traversal segments in DEMA_HOME collapse via resolve()", async () => {
  await withReceiptFixture("dema-v012-traversal-", async (root) => {
    await writeReceiptFixture(root, "t.json", {
      receipt_id: "rt",
      artifact_id: "AT",
    });
    // DEMA_HOME value with `..` segments · resolve() inside safeReceiptsRoot collapses them
    const indirectRoot = join(root, "sub", "..");
    const receipts = await listReceipts(indirectRoot);
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].artifact_id, "AT");
  });
});

test("F-3 v0.1.2 · AC-7: equivalent paths produce equivalent listings (path normalization)", async () => {
  await withReceiptFixture("dema-v012-norm-", async (root) => {
    await writeReceiptFixture(root, "n.json", {
      receipt_id: "rn",
      artifact_id: "AN",
    });
    // Pass root with trailing separator vs without · normalized identically
    const withTrailing = root.endsWith("/") ? root : `${root}/`;
    const a = await listReceipts(root);
    const b = await listReceipts(withTrailing);
    assert.equal(a.length, b.length);
    assert.equal(a[0].artifact_id, b[0].artifact_id);
  });
});

test("dema status:json injects human from profile.json::preferred_name (local-first identity at CLI boundary)", async () => {
  const demaRoot = await mkdtemp(join(tmpdir(), "dema-status-human-"));
  try {
    await writeFile(
      join(demaRoot, "profile.json"),
      JSON.stringify({ preferred_name: "Mumu" }),
    );
    const { stdout } = await execFileAsync("node", [cliPath, "status:json"], {
      env: {
        ...process.env,
        DEMA_HOME: demaRoot,
        DEMA_NODE0_ADAPTER: "",
        DEMA_GATEWAY_URL: "",
        DEMA_NODE0_STATUS_COMMAND: "",
      },
    });
    const status = JSON.parse(stdout);
    assert.equal(status.human, "Mumu");
  } finally {
    await rm(demaRoot, { recursive: true, force: true });
  }
});

test("dema status:json human falls back to null when profile.json absent (graceful, no throw)", async () => {
  const demaRoot = await mkdtemp(join(tmpdir(), "dema-status-no-profile-"));
  try {
    const { stdout } = await execFileAsync("node", [cliPath, "status:json"], {
      env: {
        ...process.env,
        DEMA_HOME: demaRoot,
        DEMA_NODE0_ADAPTER: "",
        DEMA_GATEWAY_URL: "",
        DEMA_NODE0_STATUS_COMMAND: "",
      },
    });
    const status = JSON.parse(stdout);
    assert.equal(status.human, null);
  } finally {
    await rm(demaRoot, { recursive: true, force: true });
  }
});

test("dema status (formatter) renders Human: <preferred_name> when profile populated", async () => {
  const demaRoot = await mkdtemp(join(tmpdir(), "dema-status-fmt-"));
  try {
    await writeFile(
      join(demaRoot, "profile.json"),
      JSON.stringify({ preferred_name: "Mumu" }),
    );
    const { stdout } = await execFileAsync("node", [cliPath, "status"], {
      env: {
        ...process.env,
        DEMA_HOME: demaRoot,
        DEMA_NODE0_ADAPTER: "",
        DEMA_GATEWAY_URL: "",
        DEMA_NODE0_STATUS_COMMAND: "",
      },
    });
    assert.match(stdout, /Human: Mumu/);
  } finally {
    await rm(demaRoot, { recursive: true, force: true });
  }
});
