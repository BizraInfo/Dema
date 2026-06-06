// ARTIFACT-011 ceremony preflight — Dema-side steps (a–d) only.
//
// Read-only witness: setup → setup-check → status → doctor → mission propose
// (without and with exact consent). Does NOT invoke governed Node0 runtime,
// mint ARTIFACT-011, or claim MEASURED diagnostic completion.

import { BOUNDED_DIAGNOSTIC_CONSENT_PHRASE } from "../../core/src/diagnostic-consent.js";

export const ARTIFACT_011_CEREMONY_PREFLIGHT_SCHEMA =
  "bizra.dema.artifact_011_ceremony_preflight.v0.1";

export const ARTIFACT_011_ID = "ARTIFACT-011";

export const ARTIFACT_011_PREFLIGHT_RELEASE_GATE_SCHEMA =
  "bizra.dema.artifact_011_preflight_release_gate.v0.1";

/** @typedef {{ ok: boolean, exitCode: number|null, parsed: object|null, reason: string|null }} StepCapture */

/**
 * Fail-closed release gate for Dema-side ARTIFACT-011 ceremony preflight.
 * CI passes on preview-only posture; does not require operator_runtime_ready.
 *
 * @param {ReturnType<typeof assessArtifact011CeremonyPreflight>} report
 * @returns {{ schema: string, ok: boolean, blockers: Array<{code:string,message:string}> }}
 */
export function validateArtifact011PreflightReleaseGate(report) {
  /** @type {Array<{code:string,message:string}>} */
  const blockers = [];

  if (report?.schema !== ARTIFACT_011_CEREMONY_PREFLIGHT_SCHEMA) {
    blockers.push({
      code: "schema_mismatch",
      message: `expected ${ARTIFACT_011_CEREMONY_PREFLIGHT_SCHEMA}.`,
    });
  }
  if (report?.truth_label === "MEASURED") {
    blockers.push({
      code: "truth_label_measured",
      message: "Dema-side preflight must not claim ARTIFACT-011 MEASURED.",
    });
  }
  if (report?.cleared_for_preview_ceremony !== true) {
    blockers.push({
      code: "preview_ceremony_not_cleared",
      message: "cleared_for_preview_ceremony must be true for release gate.",
    });
  }
  if (report?.cleared_for_runtime_ceremony === true) {
    blockers.push({
      code: "runtime_ceremony_cleared_in_dema",
      message: "cleared_for_runtime_ceremony must remain false in Dema repo.",
    });
  }
  const boundary = report?.boundary ?? {};
  if (boundary.governed_node0_invoked === true) {
    blockers.push({
      code: "governed_node0_invoked",
      message: "governed Node0 must not be invoked from Dema-side preflight.",
    });
  }
  if (boundary.artifact_011_measured === true) {
    blockers.push({
      code: "artifact_011_measured_claim",
      message: "boundary.artifact_011_measured must remain false in Dema repo.",
    });
  }
  if (boundary.dema_mission_executes === true) {
    blockers.push({
      code: "dema_mission_executes",
      message:
        "mission propose must keep executes=false in Dema-side preflight.",
    });
  }
  if (boundary.runtime_executed === true) {
    blockers.push({
      code: "runtime_executed",
      message: "bounded diagnostic runtime must not execute in Dema repo.",
    });
  }
  if (boundary.receipt_minted === true) {
    blockers.push({
      code: "receipt_minted",
      message: "ARTIFACT-011 receipt minting is upstream; Dema must not mint.",
    });
  }

  const steps = report?.steps ?? {};
  const proposeNoConsent = steps.propose_no_consent;
  const proposeWithConsent = steps.propose_with_consent;
  if (proposeNoConsent?.ok !== true || proposeWithConsent?.ok !== true) {
    blockers.push({
      code: "propose_steps_incomplete",
      message: "mission propose steps must succeed for release gate.",
    });
  }

  return {
    schema: ARTIFACT_011_PREFLIGHT_RELEASE_GATE_SCHEMA,
    ok: blockers.length === 0,
    blockers,
  };
}

/**
 * Pure assessment of captured CLI step outputs (ceremony steps b–d).
 *
 * @param {object} opts
 * @param {string} opts.demaHome
 * @param {StepCapture} opts.setup
 * @param {StepCapture} opts.setupCheck
 * @param {StepCapture} opts.status
 * @param {StepCapture} opts.doctor
 * @param {StepCapture} opts.proposeNoConsent
 * @param {StepCapture} opts.proposeWithConsent
 * @param {string|null} [opts.gitCommit]
 */
export function assessArtifact011CeremonyPreflight({
  demaHome,
  setup,
  setupCheck,
  status,
  doctor,
  proposeNoConsent,
  proposeWithConsent,
  gitCommit = null,
} = {}) {
  /** @type {Array<{code:string,message:string}>} */
  const blockers = [];

  if (!setup?.ok) {
    blockers.push({
      code: "setup_failed",
      message: setup?.reason ?? "dema setup did not succeed.",
    });
  } else if (setup.parsed?.schema !== "bizra.dema.setup.v0.1") {
    blockers.push({
      code: "setup_schema_mismatch",
      message: "setup JSON schema is not bizra.dema.setup.v0.1.",
    });
  }

  if (!setupCheck?.ok) {
    blockers.push({
      code: "setup_check_failed",
      message: setupCheck?.reason ?? "dema setup-check did not succeed.",
    });
  } else if (setupCheck.parsed?.verdict !== "INTACT") {
    blockers.push({
      code: "home_not_intact",
      message: `setup-check verdict is ${setupCheck.parsed?.verdict ?? "unknown"}, expected INTACT.`,
    });
  }

  if (!status?.ok) {
    blockers.push({
      code: "status_failed",
      message: status?.reason ?? "dema status:json did not succeed.",
    });
  } else if (typeof status.parsed?.activationGate !== "string") {
    blockers.push({
      code: "status_missing_activation_gate",
      message: "status JSON missing activationGate field.",
    });
  }

  if (!doctor?.ok) {
    blockers.push({
      code: "doctor_failed",
      message:
        doctor?.reason ?? "dema doctor --json did not return parseable JSON.",
    });
  } else {
    if (doctor.parsed?.schema !== "bizra.dema.doctor_dashboard.v0.1") {
      blockers.push({
        code: "doctor_schema_mismatch",
        message: "doctor JSON schema is not bizra.dema.doctor_dashboard.v0.1.",
      });
    }
    const daemonStatus =
      doctor.parsed?.status?.daemonStatus ??
      (Array.isArray(doctor.parsed?.predicates)
        ? doctor.parsed.predicates.find((p) => p.key === "daemonStatus")?.value
        : null);
    if (daemonStatus === "running") {
      blockers.push({
        code: "daemon_running",
        message:
          "daemonStatus is running; bounded diagnostic ceremony requires one-shot path.",
      });
    }
  }

  if (!proposeNoConsent?.ok) {
    blockers.push({
      code: "propose_without_consent_failed",
      message:
        proposeNoConsent?.reason ??
        "dema mission propose --json did not succeed.",
    });
  } else if (proposeNoConsent.parsed?.executes !== false) {
    blockers.push({
      code: "propose_executes_true",
      message: "mission propose without consent must keep executes=false.",
    });
  } else if (proposeNoConsent.parsed?.consent?.accepted === true) {
    blockers.push({
      code: "unexpected_consent_without_phrase",
      message: "mission propose without consent must not accept consent.",
    });
  }

  if (!proposeWithConsent?.ok) {
    blockers.push({
      code: "propose_with_consent_failed",
      message:
        proposeWithConsent?.reason ??
        "dema mission propose --consent did not succeed.",
    });
  } else {
    if (proposeWithConsent.parsed?.executes !== false) {
      blockers.push({
        code: "propose_with_consent_executes_true",
        message: "mission propose with consent must keep executes=false.",
      });
    }
    if (proposeWithConsent.parsed?.consent?.accepted !== true) {
      blockers.push({
        code: "consent_not_accepted",
        message: "exact consent phrase was not accepted in preview.",
      });
    }
    if (
      proposeWithConsent.parsed?.proposal?.allowed === true &&
      proposeWithConsent.parsed?.proposal?.expectedArtifact !== ARTIFACT_011_ID
    ) {
      blockers.push({
        code: "expected_artifact_mismatch",
        message: `proposal expectedArtifact must be ${ARTIFACT_011_ID}.`,
      });
    }
  }

  const clearedForPreviewCeremony = blockers.length === 0;

  const operatorRuntimeReady =
    status?.parsed?.ready === true &&
    status?.parsed?.consoleReady === true &&
    status?.parsed?.activationGate === "EXPLICIT_GO_REQUIRED" &&
    (status?.parsed?.daemonStatus ?? "") !== "running" &&
    doctor?.exitCode === 0;

  return {
    schema: ARTIFACT_011_CEREMONY_PREFLIGHT_SCHEMA,
    truth_label: clearedForPreviewCeremony ? "PREPARED" : "GAP_DETECTED",
    artifact_id: ARTIFACT_011_ID,
    dema_home: demaHome,
    consent_phrase: BOUNDED_DIAGNOSTIC_CONSENT_PHRASE,
    cleared_for_preview_ceremony: clearedForPreviewCeremony,
    operator_runtime_ready: operatorRuntimeReady,
    cleared_for_runtime_ceremony: false,
    git_commit: gitCommit,
    steps: Object.freeze({
      setup: summarizeStep(setup),
      setup_check: summarizeStep(setupCheck),
      status: summarizeStep(status),
      doctor: summarizeStep(doctor),
      propose_no_consent: summarizeStep(proposeNoConsent),
      propose_with_consent: summarizeStep(proposeWithConsent),
    }),
    blockers,
    boundary: Object.freeze({
      runtime_executed: false,
      receipt_minted: false,
      artifact_011_measured: false,
      dema_mission_executes: false,
      governed_node0_invoked: false,
    }),
    recommended_next: clearedForPreviewCeremony
      ? operatorRuntimeReady
        ? "Operator may proceed to governed Node0 runtime ceremony steps e–h outside this repo."
        : "Preview ceremony chain verified. Complete operator preconditions (adapter, gateway, doctor exit 0) before runtime steps e–h."
      : "Resolve blockers and re-run npm run artifact-011:preflight before runtime ceremony.",
  };
}

/** @param {StepCapture|undefined} step */
function summarizeStep(step) {
  return Object.freeze({
    ok: step?.ok === true,
    exit_code: step?.exitCode ?? null,
    reason: step?.reason ?? null,
    schema: step?.parsed?.schema ?? null,
  });
}

/**
 * @param {string} stdout
 * @returns {object|null}
 */
function tryParseJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

/**
 * Capture one CLI invocation as a StepCapture.
 *
 * @param {object} opts
 * @param {import("node:child_process").execFile} opts.execFileFn
 * @param {string} opts.cliPath
 * @param {string} opts.home
 * @param {string[]} opts.args
 * @param {boolean} [opts.acceptNonZeroExit=false]
 */
export async function captureCliStep({
  execFileFn,
  cliPath,
  home,
  args,
  acceptNonZeroExit = false,
}) {
  const env = {
    ...process.env,
    DEMA_HOME: home,
    NO_COLOR: "1",
    NODE_ENV: "test",
    DEMA_NO_TUI: "1",
  };

  try {
    const { stdout } = await execFileFn("node", [cliPath, ...args], {
      env,
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const parsed = tryParseJson(stdout);
    if (!parsed) {
      return {
        ok: false,
        exitCode: 0,
        parsed: null,
        reason: "json_parse_error",
      };
    }
    return { ok: true, exitCode: 0, parsed, reason: null };
  } catch (err) {
    const exitCode =
      typeof err.code === "number"
        ? err.code
        : (err.status ?? err.exitCode ?? null);
    const parsed = tryParseJson(err.stdout ?? "");
    if (parsed && (acceptNonZeroExit || exitCode === 0)) {
      return { ok: true, exitCode, parsed, reason: null };
    }
    return {
      ok: false,
      exitCode,
      parsed,
      reason: err.message?.split("\n")[0] ?? "exec_error",
    };
  }
}

/**
 * Run Dema-side ceremony preflight against an isolated or operator home.
 *
 * @param {object} opts
 * @param {string} opts.demaHome
 * @param {string} opts.cliPath
 * @param {import("node:child_process").execFile} [opts.execFileFn]
 * @param {string|null} [opts.gitCommit]
 */
export async function runArtifact011CeremonyPreflight({
  demaHome,
  cliPath,
  execFileFn = null,
  gitCommit = null,
}) {
  let runExec = execFileFn;
  if (!runExec) {
    const { promisify } = await import("node:util");
    const { execFile } = await import("node:child_process");
    runExec = promisify(execFile);
  }

  const base = { execFileFn: runExec, cliPath, home: demaHome };
  const setup = await captureCliStep({ ...base, args: ["setup", "--json"] });
  const setupCheck = await captureCliStep({
    ...base,
    args: ["setup-check", "--json"],
  });
  const status = await captureCliStep({ ...base, args: ["status:json"] });
  const doctor = await captureCliStep({
    ...base,
    args: ["doctor", "--json"],
    acceptNonZeroExit: true,
  });
  const proposeNoConsent = await captureCliStep({
    ...base,
    args: ["mission", "propose", "--json"],
  });
  const proposeWithConsent = await captureCliStep({
    ...base,
    args: [
      "mission",
      "propose",
      "--consent",
      BOUNDED_DIAGNOSTIC_CONSENT_PHRASE,
      "--json",
    ],
  });

  return assessArtifact011CeremonyPreflight({
    demaHome,
    setup,
    setupCheck,
    status,
    doctor,
    proposeNoConsent,
    proposeWithConsent,
    gitCommit,
  });
}
