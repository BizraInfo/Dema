// Doctor dashboard — row-based readiness summary for `dema doctor`.
//
// No new npm deps. ANSI codes hand-rolled.
// NO_COLOR env and --no-color flag both strip all ANSI sequences.

const ANSI_GREEN = "\x1b[32m";
const ANSI_RED = "\x1b[31m";
const ANSI_YELLOW = "\x1b[33m";
const ANSI_RESET = "\x1b[0m";

const ICON_OK = "✅"; // ✅
const ICON_FAIL = "❌"; // ❌
const ICON_WARN = "⚠️"; // ⚠️

function colorize(text, code, color) {
  if (!color) return text;
  return `${code}${text}${ANSI_RESET}`;
}

// Returns an array of predicate objects from a status snapshot.
// Each object: { key, label, value, status: 'ok'|'fail'|'warn', fix? }
export function evaluatePredicates(status) {
  const s = status ?? {};

  const activationGate = s.activationGate ?? "unknown";
  const gateOk = activationGate === "EXPLICIT_GO_REQUIRED";
  const gateFail = activationGate === "BLOCKED";

  const daemonStatus = s.daemonStatus ?? "unknown";
  const daemonRunning = daemonStatus === "running";

  // Gateway reachability is read from the structured field the adapter
  // populates — never inferred from findings prose. Sniffing free text for
  // "not connected" claimed "reachable" for any payload that worded its
  // failure differently, or carried no findings at all. Fail-closed on the
  // claim: only an explicit `true` may print "reachable".
  const gatewayReachable = s.gateway?.reachable;

  const predicates = [];

  // 1. Activation gate
  predicates.push({
    key: "activationGate",
    label: "Activation gate",
    value: activationGate,
    status: gateOk ? "ok" : gateFail ? "fail" : "warn",
    ...(gateOk
      ? {}
      : {
          // `dema setup` cannot move this gate — defaultStatus() hardcodes
          // BLOCKED and setup never touches it. Only the governed Node0
          // runtime, reached through the operator bridge, reports a real gate.
          fix: gateFail
            ? "activation gate is BLOCKED: no Node0 runtime is reporting a gate. Only a governed runtime can move it — bridge one with DEMA_NODE0_ADAPTER=gateway-http plus DEMA_GATEWAY_URL, or DEMA_NODE0_STATUS_COMMAND (see docs/QUICKSTART.md). For preview-only use, BLOCKED is the correct resting state."
            : `unexpected gate value ${activationGate}; expected EXPLICIT_GO_REQUIRED`,
        }),
  });

  // 2. Daemon
  predicates.push({
    key: "daemonStatus",
    label: "Daemon",
    value:
      daemonStatus === "unknown"
        ? "n/a-via-gateway (no hidden daemon)"
        : daemonStatus,
    status: daemonRunning ? "fail" : "ok",
    ...(daemonRunning
      ? {
          fix: "daemon is running — Dema does not run a daemon; a hidden process has been detected. Investigate before proceeding.",
        }
      : {}),
  });

  // 3. Ready
  const ready = Boolean(s.ready);
  predicates.push({
    key: "ready",
    label: "Ready",
    value: String(ready),
    status: ready ? "ok" : "fail",
    ...(ready
      ? {}
      : {
          // `ready` mirrors the adapter payload; setup does not set it either.
          fix: "`ready` is reported by the Node0 runtime, not set locally. Bridge a runtime (see the activation gate fix) and re-check with `dema status`. For preview-only use, false is expected.",
        }),
  });

  // 4. Console ready
  const consoleReady = Boolean(s.consoleReady);
  predicates.push({
    key: "consoleReady",
    label: "Console ready",
    value: String(consoleReady),
    status: consoleReady ? "ok" : "fail",
    ...(consoleReady
      ? {}
      : {
          fix: "gateway unreachable; if you intend to run governed runtime, confirm it's started (separate repo). For preview-only use, this is expected.",
        }),
  });

  // 5. Gateway probe (warn-only by design)
  predicates.push({
    key: "gatewayProbe",
    label: "Gateway probe",
    // Three states, never two: measured-reachable, measured-unreachable, and
    // not-applicable. The n/a case mirrors the Daemon predicate's
    // "n/a-via-gateway" — it asserts nothing, so a healthy legacy-shellout
    // bridge (which has no gateway concept) can still reach a green verdict
    // without anyone claiming a reachability that was never measured.
    value:
      gatewayReachable === true
        ? "reachable"
        : gatewayReachable === false
          ? "unreachable (by design when no runtime running)"
          : "n/a (no gateway configured)",
    status: gatewayReachable === false ? "warn" : "ok",
  });

  return predicates;
}

// Formats predicates into a human-readable dashboard string.
export function formatDoctorDashboard(predicates, { color = true } = {}) {
  const lines = [];
  lines.push("Dema Doctor — Node0 readiness check");
  lines.push("");

  const failCount = predicates.filter((p) => p.status === "fail").length;
  const warnCount = predicates.filter((p) => p.status === "warn").length;
  const okCount = predicates.filter((p) => p.status === "ok").length;

  const maxLabel = Math.max(...predicates.map((p) => p.label.length));

  for (const p of predicates) {
    let icon;
    let iconColor;
    if (p.status === "ok") {
      icon = ICON_OK;
      iconColor = ANSI_GREEN;
    } else if (p.status === "fail") {
      icon = ICON_FAIL;
      iconColor = ANSI_RED;
    } else {
      icon = ICON_WARN;
      iconColor = ANSI_YELLOW;
    }

    const iconStr = color ? `${iconColor}${icon}${ANSI_RESET}` : icon;
    const padding = " ".repeat(maxLabel - p.label.length);
    lines.push(`  ${iconStr} ${p.label}${padding}   ${p.value}`);

    if (p.fix) {
      const arrow = color ? colorize("  →", ANSI_RED, true) : "  →";
      const fixLines = p.fix.split(";").map((s) => s.trim());
      lines.push(`     ${arrow} Fix: ${fixLines[0]}`);
      for (let i = 1; i < fixLines.length; i++) {
        lines.push(`       ${fixLines[i]}`);
      }
    }
  }

  lines.push("");

  const allOk = failCount === 0 && warnCount === 0;
  const verdict = allOk ? "ready and consent-gated" : "blocked";
  const verdictColored = color
    ? allOk
      ? colorize(verdict, ANSI_GREEN, true)
      : colorize(verdict, ANSI_RED, true)
    : verdict;

  lines.push(`Verdict: ${verdictColored}`);

  const summaryParts = [];
  if (failCount > 0)
    summaryParts.push(
      `${failCount} predicate${failCount > 1 ? "s" : ""} failed`,
    );
  if (warnCount > 0)
    summaryParts.push(`${warnCount} warning${warnCount > 1 ? "s" : ""}`);
  if (okCount > 0) summaryParts.push(`${okCount} OK`);
  lines.push(`  ${summaryParts.join(" · ")}`);

  lines.push("");
  lines.push("Type `dema status` for full status JSON.");
  lines.push("Type `dema explain doctor` for what each predicate means.");

  return lines.join("\n");
}
