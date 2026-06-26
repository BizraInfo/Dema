import { wantsJson } from "../../../../packages/core/src/output-mode.js";
import {
  buildNode0KillerDemoValueLoopCli,
  formatNode0KillerDemoValueLoopCli,
  verifyNode0KillerDemoValueLoopCli,
} from "../../../../packages/core/src/node0-killer-demo-value-loop-cli.js";
import {
  runNode0KillerDemoValueLoopProofConvergence,
  formatNode0KillerDemoValueLoopProofConvergence,
} from "../../../../packages/core/src/node0-killer-demo-value-loop-proof-convergence.js";
import { gatherProofSnapshotAudit } from "../proof-snapshot-audit-gatherer.js";

export async function cmd_demo(ctx) {
  const { argv } = ctx;
  const sub = argv[1] ?? "";
  const action = argv[2] ?? "";
  const wantJson = wantsJson(argv);

  if (sub === "node0-value-loop") {
    if (action === "convergence") {
      const proof_snapshot_audit = gatherProofSnapshotAudit({ hermetic: false });
      const result = runNode0KillerDemoValueLoopProofConvergence({ proof_snapshot_audit });
      const composed = result.composed;
      console.log(
        wantJson
          ? JSON.stringify(composed, null, 2)
          : formatNode0KillerDemoValueLoopProofConvergence(composed),
      );
      process.exitCode = result.ok ? 0 : 1;
      process.exit(process.exitCode ?? 0);
    }

    const envelope = buildNode0KillerDemoValueLoopCli();
    const verified = verifyNode0KillerDemoValueLoopCli(envelope);
    console.log(
      wantJson ? JSON.stringify(envelope, null, 2) : formatNode0KillerDemoValueLoopCli(envelope),
    );
    process.exitCode = verified.ok ? 0 : 1;
    process.exit(process.exitCode ?? 0);
  }

  console.error("unknown demo subcommand (node0-value-loop [convergence])");
  process.exit(1);
}
