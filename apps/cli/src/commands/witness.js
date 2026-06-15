import {
  saveWitnessReceipt,
  buildWitnessAttestation,
  formatWitnessReceipt,
} from "../../../../packages/receipts/src/witness-receipt.js";
import {
  verifyWitnessReceipt,
  findLatestWitness,
  formatWitnessVerification,
} from "../../../../packages/receipts/src/witness-verify.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_witness(ctx) {
  const { argv } = ctx;
  const subCmd = argv[1] ?? "";
  if (subCmd === "verify") {
    const filePath = argValue(argv, "--file") ?? "";
    const wantJsonV = argv.includes("--json") || !process.stdout.isTTY;
    const receiptPath = filePath || (await findLatestWitness());
    if (!receiptPath) {
      console.error(
        'No witness receipt found. Run `dema witness --consent "WITNESS NODE0 STATE"` first.',
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    const vResult = await verifyWitnessReceipt(receiptPath);
    if (wantJsonV) {
      console.log(JSON.stringify(vResult, null, 2));
    } else {
      console.log(formatWitnessVerification(vResult));
    }
    if (vResult.verdict !== "VERIFIED") process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  const consent = argValue(argv, "--consent") ?? "";
  const dryRun = argv.includes("--dry-run");
  const wantJson = argv.includes("--json") || !process.stdout.isTTY;
  if (dryRun && !consent) {
    const att = await buildWitnessAttestation();
    if (wantJson) {
      console.log(
        JSON.stringify(
          { ...att, saved: false, reason: "dry_run", dry_run: true },
          null,
          2,
        ),
      );
    } else {
      console.log(
        formatWitnessReceipt({ ...att, saved: false, reason: "dry_run" }),
      );
    }
    process.exit(process.exitCode ?? 0);
  }
  const result = await saveWitnessReceipt({ consent, dryRun });
  if (wantJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatWitnessReceipt(result));
  }
  if (!result.saved && result.reason !== "dry_run") process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}
