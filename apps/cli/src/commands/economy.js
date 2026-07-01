import { readFile } from "node:fs/promises";

import {
  previewPoiMintDecision,
  renderPoiMintPreview,
} from "../../../../packages/core/src/dual-token-poi-economy.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function fail(argv, message, code = 1) {
  const wantJson = wantsJson(argv);
  const payload = {
    schema: "bizra.dema.economy_cli_error.v0.1",
    truth_label: "ECONOMY_PREVIEW_ERROR",
    error: message,
  };
  console.error(
    wantJson
      ? JSON.stringify(payload, null, 2)
      : `Dema economy: ${message}`,
  );
  process.exitCode = code;
  process.exit(process.exitCode ?? code);
}

export async function cmd_economy(ctx) {
  const { argv } = ctx;
  const sub = argv[1] ?? "";
  const wantJson = wantsJson(argv);

  if (sub === "poi-mint-preview") {
    const receiptPath = argValue(argv, "--impact-receipt");
    if (!receiptPath) {
      fail(
        argv,
        "Usage: dema economy poi-mint-preview --impact-receipt <path> [--json]",
      );
    }

    let impactReceipt;
    try {
      impactReceipt = JSON.parse(await readFile(receiptPath, "utf8"));
    } catch {
      fail(argv, `cannot_read_impact_receipt:${receiptPath}`);
    }

    const report = previewPoiMintDecision({
      impactReceipt,
      requestedLiveMint: argv.includes("--live"),
    });

    console.log(
      wantJson ? JSON.stringify(report, null, 2) : renderPoiMintPreview(report),
    );
    process.exitCode = 0;
    process.exit(process.exitCode);
  }

  fail(
    argv,
    "Usage: dema economy poi-mint-preview --impact-receipt <path> [--json]",
  );
}
