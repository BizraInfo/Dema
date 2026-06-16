import {
  buildProofPassport,
  formatProofPassport,
} from "../../../../packages/receipts/src/proof-passport.js";
import {
  verifyProofPassportFile,
  formatProofPassportVerification,
} from "../../../../packages/receipts/src/proof-passport-verify.js";
import { verifyProofPassportDeep } from "../../../../packages/receipts/src/proof-passport-deep-verify.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";
import { runProofConvergence } from "./proof-convergence.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_proof(ctx) {
  const { argv } = ctx;
  const proofSub = argv[1] ?? "";
  const wantJsonP = wantsJson(argv);

  if (proofSub === "convergence") {
    return runProofConvergence(ctx);
  }

  if (proofSub === "passport" && argv[2] === "verify") {
    const positional = argv.slice(3).filter((a) => !a.startsWith("--"));
    const passportPath = positional[0];
    const deep = argv.includes("--deep");
    const receiptsDir = argValue(argv, "--receipts-dir");

    if (!passportPath) {
      console.error(
        "Usage: dema proof passport verify <passport.json> [--deep] [--receipts-dir <dir>] [--json]",
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }

    if (deep) {
      const { readFile } = await import("node:fs/promises");
      let passport;
      try {
        passport = JSON.parse(await readFile(passportPath, "utf8"));
      } catch {
        const err = {
          verified: false,
          verdict: "FAILED",
          error: "cannot_read_passport",
          passport_path: passportPath,
        };
        console.log(
          wantJsonP
            ? JSON.stringify(err, null, 2)
            : `FAILED: cannot read ${passportPath}`,
        );
        process.exitCode = 1;
        process.exit(process.exitCode ?? 0);
      }
      const { join: joinPath } = await import("node:path");
      const { homedir: getHome } = await import("node:os");
      const envHome = process.env.DEMA_HOME;
      const resolvedDir =
        receiptsDir ??
        joinPath(envHome ?? joinPath(getHome(), ".dema"), "receipts");
      const deepResult = await verifyProofPassportDeep(passport, {
        receiptsDir: resolvedDir,
      });
      if (wantJsonP) {
        console.log(JSON.stringify(deepResult, null, 2));
      } else {
        const lines = [
          `Proof Passport Deep Verification: ${deepResult.verdict}`,
          `  Scope:    ${deepResult.verification_scope}`,
          `  Receipts: ${deepResult.receipt_results.length}`,
        ];
        const failed = deepResult.receipt_results.filter((r) => !r.verified);
        if (failed.length > 0) {
          lines.push(`  Failed:   ${failed.length}`);
          for (const r of failed) {
            lines.push(
              `    - ${r.receipt_filename}: ${r.error ?? "metadata_mismatch"}`,
            );
          }
        }
        lines.push(`  Truth:    ${deepResult.truth_label}`);
        console.log(lines.join("\n"));
      }
      if (!deepResult.verified) process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }

    const result = await verifyProofPassportFile(passportPath);
    if (wantJsonP) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatProofPassportVerification(result));
    }
    if (!result.verified) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  if (proofSub === "passport") {
    const passport = await buildProofPassport();
    if (wantJsonP) {
      console.log(JSON.stringify(passport, null, 2));
    } else {
      console.log(formatProofPassport(passport));
    }
    if (
      passport.aggregate.verdict === "EMPTY" ||
      passport.aggregate.verdict === "NONE_VERIFIED"
    ) {
      process.exitCode = 1;
    }
    process.exit(process.exitCode ?? 0);
  }
  console.error(
    "Usage: dema proof passport [--json] | dema proof passport verify <path>",
  );
  process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}
