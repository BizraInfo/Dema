// `dema mirror` command — NODE0-WOW-REPORT-1A.
//
// Reads the EXISTING local-asset inventory (written by `dema scan` under
// DEMA_HOME, already consented at scan time) and renders an honest "wow mirror":
// what you have, what Dema can do today, and — honestly — what she cannot yet.
// Read-only: no scan, no consent prompt, no model, no file content. The fs read
// of Dema's own inventory artifact lives here; the kernel stays pure.
import { readFile } from "node:fs/promises";
import { buildNode0WowReport } from "../../../../packages/core/src/node0-wow-report.js";
import { defaultLocalAssetInventoryPath } from "../../../../packages/core/src/local-asset-awareness.js";
import {
  wantsJson,
  humanHintLine,
} from "../../../../packages/core/src/output-mode.js";

async function readInventory() {
  try {
    const raw = await readFile(defaultLocalAssetInventoryPath(), "utf8");
    return JSON.parse(raw);
  } catch {
    // Absent or unreadable → the kernel fails closed with a "run dema scan" hint.
    return null;
  }
}

export async function cmd_mirror(ctx) {
  const { argv } = ctx;
  const inventory = await readInventory();
  const report = buildNode0WowReport({ inventory });

  if (wantsJson(argv)) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(process.exitCode ?? 0);
  }

  if (!report.valid) {
    console.log(report.hint.join("\n"));
    process.exit(process.exitCode ?? 0);
  }

  const lines = [
    "DEMA · YOUR HOMEBASE, MIRRORED",
    `You have ${report.totals.records} things here (${report.totals.files} files · ${report.totals.dirs} folders):`,
    ...report.category_story.map((c) => `  • ${c.count} ${c.label}`),
    "  (inferred from file type — I have not read any file's contents.)",
    "",
    "What I can help you with today:",
    ...report.can_help_today.map((l) => `  ✓ ${l}`),
    "",
    "Not yet — and I will not pretend otherwise:",
    ...report.not_yet_available.map((l) => `  ✗ ${l}`),
    humanHintLine("mirror"),
  ];
  console.log(lines.join("\n"));
  process.exit(process.exitCode ?? 0);
}
