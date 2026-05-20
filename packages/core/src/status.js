export function defaultStatus() {
  return {
    schema: "bizra.dema.status.v0.1",
    node: "Node0",
    human: null,
    ready: false,
    consoleReady: false,
    activationGate: "BLOCKED",
    daemonStatus: "unknown",
    missionExecuted: false,
    runtimePulse: { fired: false },
    findings: ["Node0 adapter not connected"],
    model: { connected: false, loadedModelIds: [], tokenPresent: false },
    rustBus: { ready: false },
    proof: { nextArtifact: "ARTIFACT-011" },
    nextAdmissibleAction: "complete_setup"
  };
}

export function isReadyForBoundedDiagnostic(status) {
  return Boolean(
    status?.ready &&
      status?.consoleReady &&
      status?.activationGate === "EXPLICIT_GO_REQUIRED" &&
      status?.daemonStatus !== "running" &&
      status?.missionExecuted !== true &&
      status?.runtimePulse?.fired !== true
  );
}

export function shouldUseColor(opts = {}) {
  if (opts.color === true) return true;
  if (opts.color === false) return false;
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.TERM === "dumb") return false;
  return true;
}

const ANSI = {
  reset: "\x1b[0m",
  boldCyan: "\x1b[1;36m",
  boldYellow: "\x1b[1;33m",
  boldRed: "\x1b[1;31m",
  boldGreen: "\x1b[1;32m"
};

function colorize(text, code, useColor) {
  if (!useColor) return text;
  return `${code}${text}${ANSI.reset}`;
}

export function formatStatus(status, opts = {}) {
  const useColor = shouldUseColor(opts);
  const runtimePulseFired = Boolean(status.runtimePulse?.fired);
  const lines = ["DEMA — Sovereign AI Node Companion"];

  lines.push("");
  lines.push(colorize("Identity", ANSI.boldCyan, useColor));
  lines.push(`  Node: ${status.node ?? "unknown"}`);
  lines.push(`  Human: ${status.human ?? "unknown"}`);

  lines.push("");
  lines.push(colorize("Readiness", ANSI.boldYellow, useColor));
  lines.push(`  Ready: ${Boolean(status.ready)}`);
  lines.push(`  Console ready: ${Boolean(status.consoleReady)}`);
  lines.push(`  Activation gate: ${status.activationGate ?? "unknown"}`);
  lines.push(`  Daemon: ${status.daemonStatus ?? "unknown"}`);
  lines.push(`  Mission executed: ${Boolean(status.missionExecuted)}`);
  lines.push(`  Runtime pulse fired: ${runtimePulseFired}`);
  lines.push(`  Model connected: ${Boolean(status.model?.connected)}`);
  lines.push(`  Loaded models: ${(status.model?.loadedModelIds ?? []).join(", ") || "none"}`);
  lines.push(`  Model token visible: ${Boolean(status.model?.tokenPresent)}`);
  lines.push(`  Rust Bus: ${status.rustBus?.ready ? "READY" : "not ready"}`);
  lines.push(`  Next artifact: ${status.proof?.nextArtifact ?? "unknown"}`);
  lines.push(`  Next action: ${status.nextAdmissibleAction ?? "none"}`);

  lines.push("");
  if (status.findings?.length) {
    lines.push(colorize("Findings", ANSI.boldRed, useColor));
    for (const finding of status.findings) lines.push(`  - ${finding}`);
  } else {
    lines.push(colorize("Findings: none", ANSI.boldGreen, useColor));
  }

  lines.push("");
  lines.push("Boundary: no action without explicit consent.");
  return lines.join("\n");
}
