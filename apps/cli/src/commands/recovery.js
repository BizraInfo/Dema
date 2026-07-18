// dema recovery preview — CLI wiring for DEMA-RECOVERY-MISSION-GATHERER-1B
// (ADR-012: space-subcommand, no new kebab CLI name).
//
// argv -> real read-only metadata effect adapter -> gatherer kernel -> prints
// the candidate preview + not_accessed_report + all-false boundary + truth
// label. READ-ONLY, no mutation, NO auto-selection.

import {
  runDemaRecoveryMissionPreview,
  formatDemaRecoveryMissionPreviewText,
} from "../../../../packages/core/src/dema-recovery-mission-cli-adapter.js";
import { gatherRecoveryMissionFiles } from "./dema-recovery-mission-fs-gatherer.js";

const USAGE =
  'dema recovery: read-only Recovery Mission candidate PREVIEW. Subcommands:\n' +
  '  dema recovery preview --root <abs> --mission "<objective>" --consent "<phrase>"\n' +
  "                    [--exclude <abs>]... [--max-files <n>] [--json]";

export async function cmd_recovery(ctx) {
  const { argv } = ctx;
  const sub = argv[1];
  const wantJson = argv.includes("--json");

  if (sub !== "preview") {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const rootIdx = argv.indexOf("--root");
  const root = rootIdx !== -1 ? argv[rootIdx + 1] : undefined;
  const missionIdx = argv.indexOf("--mission");
  const mission = missionIdx !== -1 ? argv[missionIdx + 1] : undefined;
  const consentIdx = argv.indexOf("--consent");
  const consent = consentIdx !== -1 ? argv[consentIdx + 1] : undefined;
  const maxFilesIdx = argv.indexOf("--max-files");
  const maxFilesArg = maxFilesIdx !== -1 ? Number(argv[maxFilesIdx + 1]) : NaN;
  const maxFiles = Number.isInteger(maxFilesArg) && maxFilesArg > 0 ? maxFilesArg : 5000;
  const exclude = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--exclude" && argv[i + 1]) exclude.push(argv[i + 1]);
  }

  const { isAbsolute } = await import("node:path");
  if (!root || !isAbsolute(root)) {
    throw new Error('`dema recovery preview` requires an absolute --root path.');
  }

  const result = runDemaRecoveryMissionPreview({
    consent,
    root,
    mission,
    exclude,
    maxFiles,
    nowIso: new Date().toISOString(),
    gatherFiles: gatherRecoveryMissionFiles,
  });

  if (wantJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatDemaRecoveryMissionPreviewText(result));
  }
  if (!result.ok) process.exitCode = 1;
}
