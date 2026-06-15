import {
  runAttestCli,
  ATTEST_CONSENT_PHRASE,
} from "../../../../packages/receipts/src/verdict-attest-command.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_attest(ctx) {
  const { argv } = ctx;
  const wantJsonA2 = wantsJson(argv);
  const rule = argValue(argv, "--rule");
  const inputPath = argValue(argv, "--input");
  const consent = argValue(argv, "--consent") ?? "";
  const outPath = argValue(argv, "--out");
  const result = await runAttestCli({
    rule,
    inputPath,
    consent,
    outPath,
  });
  if (wantJsonA2) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.attested) {
    console.log("Verdict Receipt Attested");
    console.log("=".repeat(40));
    console.log(`  Rule:       ${result.body.rule_id}`);
    console.log(`  Verdict:    ${result.body.verdict}`);
    console.log(`  Input hash: ${result.body.input_hash}`);
    console.log(`  Receipt:    ${result.receipt_path}`);
    if (result.out_path) console.log(`  Bundle:     ${result.out_path}`);
  } else if (result.error === "consent_required") {
    console.error(
      `Consent required. Use: --consent "${ATTEST_CONSENT_PHRASE}"`,
    );
  } else if (
    result.error === "missing_rule" ||
    result.error === "missing_input"
  ) {
    console.error(
      `Usage: dema attest --rule <id> --input <path> --consent "${ATTEST_CONSENT_PHRASE}" [--out <bundle.json>] [--json]`,
    );
  } else {
    console.error(`Attest failed: ${result.error}`);
  }
  if (!result.attested) process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}
