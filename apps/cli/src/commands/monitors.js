// dema monitors run — operator-invoked proof-health scan.
// MONITOR-GATHERER-1A (read-only surface collection + pure derivation) piped
// into RECEIPT-MONITOR-PREVIEW-1A (fail-closed findings). One-shot: prints and
// exits. No daemon, no autofix, no receipt write, no authority granted.

import {
  runMonitorGatherer,
  MONITOR_GATHERER_GO_PHRASE,
} from "../../../../packages/core/src/monitor-gatherer.js";
import {
  runReceiptMonitorPreview,
  RECEIPT_MONITOR_PREVIEW_GO_PHRASE,
} from "../../../../packages/core/src/receipt-monitor-preview.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

const USAGE = `dema monitors — operator-invoked proof-health scan (read-only)

  dema monitors run [--json] [--ci-unavailable]
                    Gather git/gate-log/registry/docs/receipt surfaces, derive
                    monitor facts, and report findings with a fail-closed
                    verdict. No daemon, no autofix, no receipt write.`;

export async function cmd_monitors(ctx) {
  const { argv, subcommand } = ctx;
  if (subcommand !== "run") {
    console.log(USAGE);
    process.exit(subcommand ? 1 : 0);
  }

  const { collectMonitorRawFacts } = await import("./monitors-gatherer.js");
  const raw = await collectMonitorRawFacts({
    ciAvailableDeclared: !argv.includes("--ci-unavailable"),
  });

  const gatherer = runMonitorGatherer({ consent: MONITOR_GATHERER_GO_PHRASE, input: raw });
  if (!gatherer.ok) {
    console.error(`monitors: gather refused: ${gatherer.blocked_by.join(", ")}`);
    process.exit(1);
  }
  const monitor = runReceiptMonitorPreview({
    consent: RECEIPT_MONITOR_PREVIEW_GO_PHRASE,
    input: gatherer.monitor_input,
  });
  if (!monitor.ok) {
    console.error(`monitors: monitor refused: ${monitor.blocked_by.join(", ")}`);
    process.exit(1);
  }

  if (wantsJson(argv)) {
    console.log(
      JSON.stringify(
        {
          gatherer: {
            schema: gatherer.schema,
            truth_label: gatherer.truth_label,
            content_hash: gatherer.content_hash,
          },
          monitor,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  const rs = gatherer.monitor_input.repo_state;
  const s = monitor.summary;
  const lines = [
    "DEMA MONITORS · PROOF-HEALTH (read-only · operator-invoked · no daemon)",
    `  repo      ${rs.head_sha} · tree_clean=${rs.tree_clean} · stale_proof=${rs.stale_proof}`,
    `  registry  declared=${gatherer.monitor_input.registry_counts.declared} · required=${gatherer.monitor_input.registry_counts.required_ids}`,
    `  findings  critical=${s.critical_count} · warning=${s.warning_count} · info=${s.info_count}`,
  ];
  for (const f of monitor.findings) {
    lines.push(`    [${f.severity}] ${f.finding} → ${f.allowed_action} (${f.evidence_ref})`);
  }
  lines.push(
    `  verdict   ${s.all_clear ? "ALL CLEAR" : s.proceed_allowed ? "attention needed" : "FAIL CLOSED — criticals present"}`,
    `  monitor   ${monitor.content_hash}`,
    "  boundary  read-only · no autofix · no receipt write · no mint · no authority",
  );
  console.log(lines.join("\n"));
  process.exit(0);
}
