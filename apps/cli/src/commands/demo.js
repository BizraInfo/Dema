import { wantsJson } from "../../../../packages/core/src/output-mode.js";
import {
  buildNode0KillerDemoValueLoopCli,
  formatNode0KillerDemoValueLoopCli,
  verifyNode0KillerDemoValueLoopCli,
} from "../../../../packages/core/src/node0-killer-demo-value-loop-cli.js";

export async function cmd_demo(ctx) {
  const { argv } = ctx;
  const sub = argv[1] ?? "";
  const wantJson = wantsJson(argv);

  if (sub === "node0-value-loop") {
    const envelope = buildNode0KillerDemoValueLoopCli();
    const verified = verifyNode0KillerDemoValueLoopCli(envelope);
    console.log(
      wantJson ? JSON.stringify(envelope, null, 2) : formatNode0KillerDemoValueLoopCli(envelope),
    );
    process.exitCode = verified.ok ? 0 : 1;
    process.exit(process.exitCode ?? 0);
  }

  console.error("unknown demo subcommand (node0-value-loop)");
  process.exit(1);
}
