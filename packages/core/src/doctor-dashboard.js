// Doctor dashboard — row-based readiness summary for `dema doctor`.
//
// No new npm deps. ANSI codes hand-rolled.
// NO_COLOR env and --no-color flag both strip all ANSI sequences.

const ANSI_GREEN = "\x1b[32m";
const ANSI_RED = "\x1b[31m";
const ANSI_YELLOW = "\x1b[33m";
const ANSI_RESET = "\x1b[0m";

const ANSI_CYAN = "\x1b[36m";

const ICON_OK = "✅"; // ✅
const ICON_FAIL = "❌"; // ❌
const ICON_WARN = "⚠️"; // ⚠️
const ICON_EXPECTED = "⏸"; // ⏸ — false, and correct that it is false

function colorize(text, code, color) {
  if (!color) return text;
  return `${code}${text}${ANSI_RESET}`;
}

import { resolveOperatorSurfaceI18n } from "./operator-surface-i18n.js";
import { displayWidth, padToWidth } from "./display-width.js";

// Returns an array of predicate objects from a status snapshot.
// Each object: { key, label, value, status: 'ok'|'fail'|'warn', fix? }
export function evaluatePredicates(status, { language_code = null } = {}) {
  const s = status ?? {};
  const i18n = resolveOperatorSurfaceI18n(language_code);
  const d = i18n.strings.doctor;

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

  // Is any Node0 runtime bridged at all? `createNode0Adapter()` with no
  // DEMA_NODE0_ADAPTER / DEMA_GATEWAY_URL / DEMA_NODE0_STATUS_COMMAND returns
  // the legacy-shellout-unavailable payload, which sets `adapter.available`
  // false. Nothing is bridged, so BLOCKED / ready:false / consoleReady:false
  // are not failures — they are the only values a preview-only install CAN
  // report, and printing them red tells a first-time operator their healthy
  // node is broken.
  //
  // Fail-closed on the signal, exactly as gatewayProbe is on `reachable`: only
  // an explicit `false` softens. A gateway-http payload carries no `adapter`
  // field at all, and absent must never read as unbridged — otherwise a real
  // outage would launder itself into "expected".
  const unbridged = s.adapter?.available === false;

  // Shared by the three readiness predicates below. Keeping one note means the
  // operator reads the bridge instructions once, not three times.
  const previewNote = d.note_preview_gate;

  const predicates = [];

  // 1. Activation gate
  predicates.push({
    key: "activationGate",
    label: d.activation_gate,
    value: activationGate,
    status: gateOk
      ? "ok"
      : gateFail
        ? unbridged
          ? "expected"
          : "fail"
        : "warn",
    ...(gateOk
      ? {}
      : gateFail && unbridged
        ? { note: previewNote }
        : {
            // `dema setup` cannot move this gate — defaultStatus() hardcodes
            // BLOCKED and setup never touches it. Only the governed Node0
            // runtime, reached through the operator bridge, reports a real gate.
            fix: gateFail
              ? d.fix_blocked
              : `unexpected gate value ${activationGate}; expected EXPLICIT_GO_REQUIRED`,
          }),
  });

  // 2. Daemon
  predicates.push({
    key: "daemonStatus",
    label: d.daemon,
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
    label: d.ready,
    value: String(ready),
    status: ready ? "ok" : unbridged ? "expected" : "fail",
    ...(ready
      ? {}
      : unbridged
        ? { note: d.note_ready_unbridged }
        : {
            // `ready` mirrors the adapter payload; setup does not set it either.
            fix: "`ready` is reported by the Node0 runtime, not set locally. Bridge a runtime (see the activation gate fix) and re-check with `dema status`.",
          }),
  });

  // 4. Console ready
  const consoleReady = Boolean(s.consoleReady);
  predicates.push({
    key: "consoleReady",
    label: d.console_ready,
    value: String(consoleReady),
    status: consoleReady ? "ok" : unbridged ? "expected" : "fail",
    ...(consoleReady
      ? {}
      : unbridged
        ? { note: d.note_console_no_gateway }
        : {
            fix: "gateway unreachable; if you intend to run governed runtime, confirm it's started (separate repo).",
          }),
  });

  // 5. Gateway probe (warn-only by design)
  predicates.push({
    key: "gatewayProbe",
    label: d.gateway_probe,
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

// Deliberately not "healthy". Nothing is broken, but an unbridged node has not
// earned a health claim — it has earned an accurate description of where it is.
const VERDICT_PREVIEW_ONLY = "preview-only — runtime not bridged";

// Single source of the verdict for both the dashboard and `--json`. Deriving it
// twice let the JSON surface print "ready and consent-gated" for an install
// that had merely not been bridged yet — a readiness claim it had not earned.
export function doctorVerdict(predicates) {
  if (predicates.some((p) => p.status === "fail" || p.status === "warn")) {
    return "blocked";
  }
  return predicates.some((p) => p.status === "expected")
    ? VERDICT_PREVIEW_ONLY
    : "ready and consent-gated";
}

// The machine channel, as typed dimensions rather than a parsed sentence.
//
// One scalar was carrying three questions at once — is anything broken, is a
// runtime connected, is this node operational — and the answers differ. An
// absent runtime is not a defect, but it is also not readiness, and collapsing
// those two into a single green/red is how a false GREEN gets manufactured.
//
//   repair_required          something is actually wrong
//   preview_environment_valid  the local shell is intact (nothing failed)
//   operational              this node can actually do governed work
//
// `operational` is the exit-code authority. It is true only when every
// predicate is ok — an expected-but-absent runtime and a warning both make it
// false, which is what keeps the verdict string and the process exit from ever
// disagreeing again (see the invariant test).
export function doctorState(predicates) {
  const has = (s) => predicates.some((p) => p.status === s);
  const repair_required = has("fail");
  return {
    operational: !repair_required && !has("warn") && !has("expected"),
    preview_environment_valid: !repair_required,
    repair_required,
    reason: repair_required
      ? "predicate_failed"
      : has("warn")
        ? "degraded"
        : has("expected")
          ? "runtime_not_bridged"
          : null,
  };
}

// Formats predicates into a human-readable dashboard string.
export function formatDoctorDashboard(
  predicates,
  { color = true, language_code = null } = {},
) {
  const i18n = resolveOperatorSurfaceI18n(language_code);
  const dLabels = i18n.strings.doctor;
  const dirMark = i18n.script_direction === "rtl" ? "\u200F" : "";
  const lines = [];
  lines.push(`${dirMark}Dema Doctor — Node0 readiness check`);
  lines.push("");

  const failCount = predicates.filter((p) => p.status === "fail").length;
  const warnCount = predicates.filter((p) => p.status === "warn").length;
  const okCount = predicates.filter((p) => p.status === "ok").length;
  const expectedCount = predicates.filter(
    (p) => p.status === "expected",
  ).length;

  // Rendered columns, not code units. Arabic tashkeel are zero-width, so
  // .length over-counts every vocalised label and shifts the value column.
  const maxLabel = Math.max(...predicates.map((p) => displayWidth(p.label)));

  for (const p of predicates) {
    let icon;
    let iconColor;
    if (p.status === "ok") {
      icon = ICON_OK;
      iconColor = ANSI_GREEN;
    } else if (p.status === "fail") {
      icon = ICON_FAIL;
      iconColor = ANSI_RED;
    } else if (p.status === "expected") {
      icon = ICON_EXPECTED;
      iconColor = ANSI_CYAN;
    } else {
      icon = ICON_WARN;
      iconColor = ANSI_YELLOW;
    }

    const iconStr = color ? `${iconColor}${icon}${ANSI_RESET}` : icon;
    lines.push(`  ${iconStr} ${padToWidth(p.label, maxLabel)}   ${p.value}`);

    // A fix is an instruction to repair something broken; a note explains why
    // a false value is the right one. They never coexist on one predicate.
    const detail = p.fix ?? p.note;
    if (detail) {
      const isFix = Boolean(p.fix);
      const arrow = color
        ? colorize("  →", isFix ? ANSI_RED : ANSI_CYAN, true)
        : "  →";
      const detailLines = detail.split(";").map((s) => s.trim());
      lines.push(`     ${arrow} ${isFix ? dLabels.fix_label : dLabels.note_label}: ${detailLines[0]}`);
      for (let i = 1; i < detailLines.length; i++) {
        lines.push(`       ${detailLines[i]}`);
      }
    }
  }

  lines.push("");

  const verdict = doctorVerdict(predicates);
  const previewOnly = verdict === VERDICT_PREVIEW_ONLY;
  const allOk = failCount === 0 && warnCount === 0;
  const verdictColored = color
    ? previewOnly
      ? colorize(verdict, ANSI_CYAN, true)
      : allOk
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
  if (expectedCount > 0)
    summaryParts.push(`${expectedCount} ${dLabels.summary_awaiting}`);
  if (okCount > 0) summaryParts.push(`${okCount} OK`);
  lines.push(`  ${summaryParts.join(" · ")}`);

  // The reassurance belongs on the human channel only. The exit code stays
  // nonzero — this node is not operational — so say both things plainly rather
  // than let a calm screen imply a green machine answer.
  if (previewOnly) {
    lines.push("");
    lines.push(`  ${dLabels.preview_footer_nothing_broken}`);
    lines.push(`  ${dLabels.preview_footer_exit_code}`);
    lines.push(`  ${dLabels.preview_footer_preview_flag}`);
  }

  lines.push("");
  lines.push("Type `dema status` for full status JSON.");
  lines.push(i18n.strings.doctor.explain_hint);
  if (i18n.truth_label === "DECLARED_NEEDS_NATIVE_REVIEW") {
    lines.push(`[${i18n.truth_label}] Arabic doctor labels · awaiting native review`);
  }

  return lines.join("\n");
}
