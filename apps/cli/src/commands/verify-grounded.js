import { runVerifyGroundedCli } from "../../../../packages/receipts/src/verdict-verify-command.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_verify_grounded(ctx) {
  const { argv } = ctx;
  const wantJsonV2 = wantsJson(argv);
  const bundlePath = argv[1] && !argv[1].startsWith("--") ? argv[1] : null;
  const pubkeyPath = argValue(argv, "--pubkey");
  const ruleId = argValue(argv, "--rule");
  const result = await runVerifyGroundedCli({
    bundlePath,
    pubkeyPath,
    ruleId,
  });
  if (wantJsonV2) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.verified) {
    console.log(
      `VERIFIED · rule=${result.rule_id} · verdict=${result.verdict}`,
    );
  } else {
    console.error(`REJECTED:${result.reason}`);
  }
  if (!result.verified) process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}
