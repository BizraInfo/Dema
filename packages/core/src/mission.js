import { evaluateConsent } from "../../fate/src/fate.js";
import { isReadyForBoundedDiagnostic } from "./status.js";
import { BOUNDED_DIAGNOSTIC_CONSENT_PHRASE } from "./diagnostic-consent.js";

// Re-export so existing callers (tests, CLI dispatchers) keep working
// without import-path changes. The canonical source is the leaf module
// `./diagnostic-consent.js`; this file forwards it.
export { BOUNDED_DIAGNOSTIC_CONSENT_PHRASE };

export const BOUNDED_DIAGNOSTIC_FORBIDDEN = Object.freeze([
  "node1_activation",
  "public_demo",
  "external_provider_routing",
  "economic_token_claim",
  "unbounded_daemon_autonomy",
]);

export function proposeBoundedDiagnostic(status) {
  if (!status.ready) {
    return {
      allowed: false,
      reason: "Node is not ready.",
      nextAction: status.nextAdmissibleAction ?? "complete_setup",
    };
  }

  if (!status.consoleReady) {
    return {
      allowed: false,
      reason: "Dema Console is not ready.",
      nextAction: "run_dema_status",
    };
  }

  if (status.activationGate !== "EXPLICIT_GO_REQUIRED") {
    return {
      allowed: false,
      reason: "Activation gate is not explicit-consent gated.",
      nextAction: "inspect_gate",
    };
  }

  if (status.daemonStatus === "running") {
    return {
      allowed: false,
      reason:
        "Daemon is already running; bounded diagnostic requires a one-shot consent path.",
      nextAction: "stop_daemon_or_use_one_shot_service",
    };
  }

  if (status.missionExecuted === true || status.runtimePulse?.fired === true) {
    return {
      allowed: false,
      reason: "Runtime pulse or mission execution has already been recorded.",
      nextAction: "inspect_receipts",
    };
  }

  return {
    allowed: isReadyForBoundedDiagnostic(status),
    missionType: "bounded_diagnostic",
    consentPhrase: BOUNDED_DIAGNOSTIC_CONSENT_PHRASE,
    forbidden: [...BOUNDED_DIAGNOSTIC_FORBIDDEN],
    expectedArtifact: "ARTIFACT-011",
  };
}

export function previewBoundedDiagnostic(status, phrase = "") {
  const proposal = proposeBoundedDiagnostic(status);
  const consent = evaluateConsent({
    phrase,
    requiredPhrase: BOUNDED_DIAGNOSTIC_CONSENT_PHRASE,
  });

  return {
    schema: "bizra.dema.mission_preview.v0.1",
    action: "bounded_diagnostic_activation",
    executes: false,
    proposal,
    consent,
    next:
      proposal.allowed && consent.accepted
        ? "Consent phrase accepted. Use the governed Node0 one-shot runtime path to create ARTIFACT-011."
        : "No runtime action executed. Resolve readiness and provide the exact consent phrase first.",
  };
}
