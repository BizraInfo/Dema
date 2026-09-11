import {
  buildPeakSelfLoopPreview,
  renderPeakSelfLoopPreview,
} from "../../../../packages/core/src/peak-self-loop-preview.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";
import { shouldUseColor } from "../../../../packages/core/src/status.js";
import {
  bindPeakSelfLoopSignalEvents,
  parsePeakSelfLoopSignalEventsArg,
} from "./peak-self-loop-evidence-gatherer.js";

export async function cmd_peak_self_loop(ctx) {
  const { argv } = ctx;
  const ciBlocked =
    argv.includes("--ci-advisory-blocked") ||
    process.env.DEMA_LOCAL_PROOF_LANE === "GITHUB_ACTIONS_BILLING_LOCK";

  const parsedSignals = parsePeakSelfLoopSignalEventsArg(argv);
  let signalEvents;
  let evidenceBindingDiagnostic = null;

  if (parsedSignals.provided) {
    if (parsedSignals.error) {
      evidenceBindingDiagnostic = Object.freeze({
        complete: false,
        admitted_count: 0,
        rejected: Object.freeze([
          Object.freeze({ id: null, reason: parsedSignals.error }),
        ]),
      });
      signalEvents = [];
      process.exitCode = 1;
    } else {
      const binding = bindPeakSelfLoopSignalEvents(parsedSignals.events);
      evidenceBindingDiagnostic = Object.freeze({
        complete: binding.complete,
        admitted_count: binding.admitted.length,
        rejected: binding.rejected,
      });
      // Atomic admission: one binding failure collapses the supplied batch to
      // zero signal. A partial-valid subset may not conceal forged evidence.
      signalEvents = binding.complete ? binding.admitted : [];
      if (!binding.complete) process.exitCode = 1;
    }
  }

  const preview = buildPeakSelfLoopPreview({
    ci_advisory_blocked: ciBlocked,
    companion_device_connected: argv.includes("--companion-connected"),
    ...(parsedSignals.provided ? { signal_events: signalEvents } : {}),
  });

  const output = evidenceBindingDiagnostic
    ? Object.freeze({ ...preview, caller_evidence_binding: evidenceBindingDiagnostic })
    : preview;

  if (
    wantsJson(argv) ||
    !process.stdout.isTTY ||
    process.env.DEMA_NO_TUI === "1"
  ) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(
      renderPeakSelfLoopPreview(preview, { useColor: shouldUseColor() }),
    );
    if (evidenceBindingDiagnostic) {
      console.log(
        `Caller evidence binding: ${evidenceBindingDiagnostic.complete ? "PASS" : "HOLD"} · admitted ${evidenceBindingDiagnostic.admitted_count} · rejected ${evidenceBindingDiagnostic.rejected.length}`,
      );
    }
  }
  process.exit(process.exitCode ?? 0);
}
