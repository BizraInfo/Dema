import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir, homedir, hostname, userInfo } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { buildProofArtifacts } from "../scripts/node0-local-urp-proof.mjs";
import {
  buildSelfCheckReports,
  REPORT_FILES,
  verifySelfCheckReports,
} from "../scripts/node0-self-check.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const scriptPath = fileURLToPath(
  new URL("../scripts/node0-self-check.mjs", import.meta.url),
);
const proofDir = "artifacts/proofs/node0-local-urp";

async function readReport(name, root = repoRoot) {
  return JSON.parse(await readFile(join(root, proofDir, name), "utf8"));
}

// HERMETIC-BY-DEGRADATION: the host-derived fragments (home dir, hostname, OS
// account name) are the strongest signal — on a real operator machine they catch
// a generator that leaks the actual identity. But `os.userInfo()` reads the OS
// account database, which some sandboxes deny outright (uv_os_get_passwd ENOENT),
// and a privacy test must not FAIL because it could not look up the very string
// it hopes to be absent.
//
// So: collect every host fragment that is obtainable, record the ones that are
// not, and assert below that the host-INDEPENDENT literals still ran. The test
// can degrade in reach on a restricted host; it can never degrade to vacuous.
function collectHostPrivateFragments() {
  const fragments = [];
  const unavailable = [];
  for (const [label, get] of [
    ["homedir", () => homedir()],
    ["hostname", () => hostname()],
    ["userInfo.username", () => userInfo().username],
  ]) {
    try {
      const v = get();
      if (v) fragments.push(v);
    } catch {
      unavailable.push(label);
    }
  }
  return { fragments, unavailable };
}

test("self-check reports exist and verify byte-for-byte", async () => {
  const result = await verifySelfCheckReports({ root: repoRoot });

  assert.equal(result.schema, "bizra.dema.urp_local.self_check_verify.v0.1");
  assert.equal(result.ok, true);
  assert.equal(result.validationPassed, true);
  assert.deepEqual(
    result.files.map((file) => file.path),
    REPORT_FILES,
  );
  assert.ok(result.files.every((file) => file.matches === true));
});

test("self-check report is bounded L2 read-only diagnostic over U1 artifacts", async () => {
  const report = await readReport("self_check_report.json");

  assert.equal(report.schema, "bizra.dema.urp_local.self_check_report.v0.1");
  assert.equal(report.mission_id, "node0.self_check.001");
  assert.equal(report.autonomy_level, "L2");
  assert.deepEqual(report.phases, [
    "UNDERSTAND",
    "PLAN",
    "ACT",
    "VERIFY",
    "SETTLE",
  ]);
  assert.equal(report.boundary.network_used, false);
  assert.equal(report.boundary.runtime_execution, false);
  assert.equal(report.boundary.auto_fix_performed, false);
  assert.equal(
    report.checks.every((check) => check.pass === true),
    true,
  );
});

test("critic report flags review items without mutation or overclaim", async () => {
  const critic = await readReport("critic_report_001.json");

  assert.equal(critic.schema, "bizra.dema.urp_local.critic_report.v0.1");
  assert.equal(critic.agent, "CriticAgent");
  assert.equal(critic.mode, "review_only_no_auto_fix");
  assert.equal(critic.boundary.mutation_performed, false);
  assert.equal(critic.boundary.sat_permit_claimed, false);
  assert.ok(
    critic.findings.some(
      (finding) => finding.code === "sat5.non_canonical_local_seed",
    ),
  );
  assert.ok(
    critic.findings.some(
      (finding) => finding.code === "poi.pending_verification",
    ),
  );
});

test("self-check reports are hash-backed and deterministic", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-self-check-"));
  await buildProofArtifacts({ root, write: true });
  const first = await buildSelfCheckReports({ root, write: true });
  const second = await buildSelfCheckReports({ root, write: true });
  const verify = await verifySelfCheckReports({ root });

  assert.equal(verify.ok, true);
  assert.deepEqual(first.files, second.files);
  assert.equal(
    first.reports.self_check_report.content_sha256,
    second.reports.self_check_report.content_sha256,
  );
  assert.equal(
    first.reports.critic_report_001.content_sha256,
    second.reports.critic_report_001.content_sha256,
  );
});

test("self-check reports avoid raw private data and public claims", async () => {
  const serialized = await Promise.all(
    REPORT_FILES.map((file) =>
      readFile(join(repoRoot, proofDir, file), "utf8"),
    ),
  ).then((parts) => parts.join("\n"));

  const { fragments: hostFragments, unavailable } = collectHostPrivateFragments();
  const hostIndependent = [
    "/home/",
    "public_network_enabled",
    "node1_connected",
    '"cash_value_claim": true',
    '"real_token_value": true',
    '"sat_permit_claimed": true',
  ].filter(Boolean);

  // A restricted host may hide its own identity strings; it may never hide these.
  assert.ok(
    hostIndependent.length >= 4,
    "privacy test degenerated: the host-independent forbidden list is too small",
  );
  const forbiddenFragments = [...hostFragments, ...hostIndependent];
  if (unavailable.length > 0) {
    // Visible, not silent: a reduced-reach run must announce which host signals
    // it could not obtain, so a green result is never mistaken for full reach.
    console.log(`# host private fragments unavailable: ${unavailable.join(", ")}`);
  }

  for (const fragment of forbiddenFragments) {
    assert.equal(
      serialized.includes(fragment),
      false,
      `forbidden fragment leaked: ${fragment}`,
    );
  }
  assert.equal(
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(serialized),
    false,
    "IPv4 address leaked",
  );
  assert.equal(
    /\b[0-9a-f]{2}(?::[0-9a-f]{2}){5}\b/i.test(serialized),
    false,
    "MAC address leaked",
  );
});

test("CLI verify mode reports success for committed self-check reports", async () => {
  const { stdout } = await execFileAsync("node", [scriptPath, "--verify"]);
  const report = JSON.parse(stdout);

  assert.equal(report.schema, "bizra.dema.urp_local.self_check_verify.v0.1");
  assert.equal(report.ok, true);
});
