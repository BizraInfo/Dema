import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, it, test } from "node:test";
import {
  assessFaceCorrespondence,
  formatReadyForFace,
  verifyFaceCorrespondence,
  FACE_CORRESPONDENCE_SCHEMA,
} from "../packages/core/src/face-correspondence.js";
import {
  evaluatePredicates,
  doctorVerdict,
  doctorState,
} from "../packages/core/src/doctor-dashboard.js";
import { formatStatus } from "../packages/core/src/status.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

function okRuntime() {
  return {
    ready: true,
    consoleReady: true,
    activationGate: "EXPLICIT_GO_REQUIRED",
    daemonStatus: "stopped",
    findings: [],
    gateway: { reachable: true },
  };
}

describe("FACE-CORRESPONDENCE-1A", () => {
  it("refuses runtime Ready + PARTIAL_NODE as a ready face", () => {
    const c = assessFaceCorrespondence({
      runtime_ready: true,
      node_state: "PARTIAL_NODE",
    });
    assert.equal(c.schema, FACE_CORRESPONDENCE_SCHEMA);
    assert.equal(c.ok, false);
    assert.equal(c.face_ready, false);
    assert.equal(c.ceiling_label, "RUNTIME_READY_FACE_INCOMPLETE");
    assert.ok(c.reasons.includes("runtime_ready_with_incomplete_profile"));
  });

  it("allows FACE_READY only when runtime ready and EXISTING_NODE", () => {
    const c = assessFaceCorrespondence({
      runtime_ready: true,
      node_state: "EXISTING_NODE",
    });
    assert.equal(c.ok, true);
    assert.equal(c.face_ready, true);
    assert.equal(c.ceiling_label, "FACE_READY");
  });

  it("UNBOUND when node_state omitted — does not invent completeness", () => {
    const c = assessFaceCorrespondence({ runtime_ready: true });
    assert.equal(c.binding, "UNBOUND");
    assert.equal(c.face_ready, false);
  });

  it("fails closed on an unknown profile state", () => {
    const c = assessFaceCorrespondence({
      runtime_ready: false,
      node_state: "UNRECOGNIZED_NODE",
    });
    assert.equal(c.ok, false);
    assert.equal(c.face_ready, false);
    assert.equal(c.ceiling_label, "FACE_CORRESPONDENCE_UNKNOWN");
    assert.deepEqual(c.reasons, ["unknown_node_state:UNRECOGNIZED_NODE"]);
  });

  it("does not make a complete profile ready when runtime is not ready", () => {
    const c = assessFaceCorrespondence({
      runtime_ready: false,
      node_state: "EXISTING_NODE",
    });
    assert.equal(c.ok, true);
    assert.equal(c.face_ready, false);
    assert.equal(c.ceiling_label, "PROFILE_OK_RUNTIME_NOT_READY");
  });

  it("keeps runtime and incomplete-profile failures separate", () => {
    const c = assessFaceCorrespondence({
      runtime_ready: false,
      node_state: "PARTIAL_NODE",
    });
    assert.equal(c.face_ready, false);
    assert.equal(c.ceiling_label, "FACE_AND_RUNTIME_INCOMPLETE");
  });

  it("doctor never verdicts ready-and-consent-gated under PARTIAL_NODE", () => {
    const preds = evaluatePredicates(okRuntime(), {
      node_state: "PARTIAL_NODE",
    });
    const profile = preds.find((p) => p.key === "operatorProfile");
    assert.equal(profile.status, "fail");
    assert.equal(profile.value, "PARTIAL_NODE");
    assert.match(doctorVerdict(preds), /profile incomplete/i);
    assert.notEqual(doctorVerdict(preds), "ready and consent-gated");
    assert.equal(doctorState(preds).operational, false);
    assert.equal(doctorState(preds).reason, "profile_incomplete");
    assert.equal(doctorState(preds).preview_environment_valid, true);
  });

  it("legacy evaluatePredicates without node_state stays all-ok for ok runtime", () => {
    const preds = evaluatePredicates(okRuntime());
    assert.equal(
      preds.some((p) => p.key === "operatorProfile"),
      false,
    );
    assert.equal(doctorVerdict(preds), "ready and consent-gated");
  });

  it("formatStatus qualifies Ready when profile is PARTIAL_NODE", () => {
    const out = formatStatus(
      { ...okRuntime(), human: "Mumu", node: "Node0" },
      { color: false, node_state: "PARTIAL_NODE" },
    );
    assert.match(out, /Profile: PARTIAL_NODE/);
    assert.match(out, /Ready: true \(runtime only — profile PARTIAL_NODE/);
    assert.doesNotMatch(out, /^  Ready: true$/m);
  });

  it("formatReadyForFace stays plain true when unbound", () => {
    assert.equal(
      formatReadyForFace({ runtime_ready: true, node_state: null }),
      "true",
    );
  });

  it("formats FACE_READY only for an existing profile and ready runtime", () => {
    assert.equal(
      formatReadyForFace({
        runtime_ready: true,
        node_state: "EXISTING_NODE",
      }),
      "true",
    );
  });

  it("doctor fails operatorProfile when node_state is explicitly empty", () => {
    const preds = evaluatePredicates(okRuntime(), { node_state: "" });
    const profile = preds.find((p) => p.key === "operatorProfile");
    assert.equal(profile.status, "fail");
    assert.notEqual(doctorVerdict(preds), "ready and consent-gated");
    assert.equal(doctorState(preds).operational, false);
  });

  it("doctorState exposes concurrent runtime failure over sole profile reason", () => {
    const preds = evaluatePredicates(
      {
        ...okRuntime(),
        ready: false,
        consoleReady: false,
        gateway: { reachable: false },
      },
      { node_state: "PARTIAL_NODE" },
    );
    assert.equal(
      preds.find((p) => p.key === "operatorProfile")?.status,
      "fail",
    );
    assert.equal(doctorState(preds).reason, "predicate_failed");
  });

  it("verifyFaceCorrespondence accepts a clean re-derived result", () => {
    const input = { runtime_ready: true, node_state: "EXISTING_NODE" };
    const clean = assessFaceCorrespondence(input);
    assert.equal(verifyFaceCorrespondence(clean, input).ok, true);
  });

  it("verifyFaceCorrespondence rejects forged face_ready and ceiling_label", () => {
    const input = { runtime_ready: true, node_state: "EXISTING_NODE" };
    const clean = assessFaceCorrespondence(input);
    const forgedReady = { ...clean, face_ready: false };
    const forgedCeiling = {
      ...clean,
      ceiling_label: "RUNTIME_READY_FACE_INCOMPLETE",
    };
    assert.equal(verifyFaceCorrespondence(forgedReady, input).ok, false);
    assert.ok(
      verifyFaceCorrespondence(forgedReady, input).blocked_by.includes(
        "field_mismatch:face_ready",
      ),
    );
    assert.equal(verifyFaceCorrespondence(forgedCeiling, input).ok, false);
    assert.ok(
      verifyFaceCorrespondence(forgedCeiling, input).blocked_by.includes(
        "field_mismatch:ceiling_label",
      ),
    );
  });

  it("verifyFaceCorrespondence rejects forged-clean boundary (PARTIAL claimed FACE_READY)", () => {
    const input = { runtime_ready: true, node_state: "PARTIAL_NODE" };
    const forged = {
      ...assessFaceCorrespondence(input),
      ok: true,
      face_ready: true,
      profile_complete: true,
      ceiling_label: "FACE_READY",
      reasons: [],
    };
    const v = verifyFaceCorrespondence(forged, input);
    assert.equal(v.ok, false);
    assert.ok(v.blocked_by.includes("field_mismatch:face_ready"));
  });
});

test("status JSON and first-run bind runtime Ready to the profile face", async () => {
  const demaHome = await mkdtemp(join(tmpdir(), "dema-face-correspondence-"));
  try {
    await writeFile(
      join(demaHome, "profile.json"),
      JSON.stringify({
        schema: "bizra.dema.profile.v0.1",
        preferred_name: null,
        language_code: "en",
      }),
    );
    const adapterPath = join(demaHome, "status.mjs");
    const adapterPayload = {
      ready: true,
      console_ready: true,
      activation_gate: "EXPLICIT_GO_REQUIRED",
      daemon_status: "stopped",
      mission_executed: false,
      runtime_pulse: { fired: false },
      findings: [],
    };
    await writeFile(
      adapterPath,
      `process.stdout.write(${JSON.stringify(JSON.stringify(adapterPayload))})`,
    );
    const env = {
      ...process.env,
      DEMA_HOME: demaHome,
      DEMA_NO_TUI: "1",
      NODE_ENV: "test",
      DEMA_NODE0_ADAPTER: "",
      DEMA_GATEWAY_URL: "",
      DEMA_NODE0_STATUS_COMMAND: `node ${JSON.stringify(adapterPath)}`,
    };

    const statusResult = await execFileAsync(
      "node",
      [cliPath, "status:json"],
      { env },
    );
    const status = JSON.parse(statusResult.stdout);
    assert.equal(status.ready, true, "legacy field remains runtime readiness");
    assert.equal(status.node_state, "PARTIAL_NODE");
    assert.equal(status.face_correspondence.runtime_ready, true);
    assert.equal(status.face_correspondence.face_ready, false);
    assert.equal(
      status.face_correspondence.ceiling_label,
      "RUNTIME_READY_FACE_INCOMPLETE",
    );

    const firstRun = await execFileAsync(
      "node",
      [cliPath, "first-run", "--dry-run", "--json", "--no-color"],
      { env },
    );
    const firstRunStatus = JSON.parse(firstRun.stdout).status;
    assert.equal(firstRunStatus.node_state, "PARTIAL_NODE");
    assert.equal(firstRunStatus.face_correspondence.face_ready, false);
    assert.match(
      firstRun.stderr,
      /Ready: true \(runtime only — profile PARTIAL_NODE; face not ready\)/,
    );
    assert.match(
      firstRun.stderr,
      /Verdict: profile incomplete — repair before claiming a ready face/,
    );

    const humanEnv = { ...env, TERM: "xterm-256color" };
    delete humanEnv.NO_COLOR;
    const humanFirstRun = await execFileAsync(
      "node",
      [cliPath, "first-run", "--dry-run"],
      { env: humanEnv },
    );
    assert.match(
      humanFirstRun.stdout,
      /Ready: true \(runtime only — profile PARTIAL_NODE; face not ready\)/,
    );

    await writeFile(
      adapterPath,
      `process.stdout.write(${JSON.stringify(JSON.stringify({ ...adapterPayload, ready: false }))})`,
    );
    const unreadyStatusResult = await execFileAsync(
      "node",
      [cliPath, "status:json"],
      { env },
    );
    const unreadyStatus = JSON.parse(unreadyStatusResult.stdout);
    assert.equal(unreadyStatus.ready, false);
    assert.equal(unreadyStatus.face_correspondence.runtime_ready, false);
    assert.equal(unreadyStatus.face_correspondence.face_ready, false);
    assert.equal(
      unreadyStatus.face_correspondence.ceiling_label,
      "FACE_AND_RUNTIME_INCOMPLETE",
    );

    const unreadyFirstRun = await execFileAsync(
      "node",
      [cliPath, "first-run", "--dry-run", "--json", "--no-color"],
      { env },
    );
    assert.match(unreadyFirstRun.stderr, /Ready: false/);
    assert.match(
      unreadyFirstRun.stderr,
      /Verdict: profile incomplete — repair before claiming a ready face/,
    );
  } finally {
    await rm(demaHome, { recursive: true, force: true });
  }
});
