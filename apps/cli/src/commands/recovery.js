// dema recovery preview — CLI wiring for DEMA-RECOVERY-MISSION-GATHERER-1B
// (ADR-012: space-subcommand, no new kebab CLI name).
//
// argv -> real read-only metadata effect adapter -> gatherer kernel -> prints
// the candidate preview + not_accessed_report + all-false boundary + truth
// label. READ-ONLY, no mutation, NO auto-selection.

import {
  runDemaRecoveryMissionPreviewProof,
  formatDemaRecoveryMissionPreviewText,
} from "../../../../packages/core/src/dema-recovery-mission-cli-adapter.js";
import { gatherRecoveryMissionFiles } from "./dema-recovery-mission-fs-gatherer.js";

const USAGE =
  'dema recovery: read-only Recovery Mission candidate PREVIEW. Subcommands:\n' +
  '  dema recovery preview --root <abs> --mission "<objective>" --consent "<phrase>"\n' +
  "                    [--exclude <abs>]... [--max-files <n>] [--json | --proof-json]\n" +
  "  --json emits the human/CLI preview envelope; --proof-json emits the exact\n" +
  "  internally verified canonical payload (independently re-verifiable). The two\n" +
  "  flags are mutually exclusive and fail closed when combined.";

export async function cmd_recovery(ctx) {
  const { argv } = ctx;
  const sub = argv[1];
  const wantJson = argv.includes("--json");
  const wantProofJson = argv.includes("--proof-json");

  if (wantJson && wantProofJson) {
    console.error("dema recovery preview: --json and --proof-json are mutually exclusive.");
    process.exitCode = 1;
    return;
  }

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

  // ONE BUILD: a single kernel execution backs every output mode; --json and
  // --proof-json are projections of the same verified result, never rebuilds.
  const { proof_payload, preview } = runDemaRecoveryMissionPreviewProof({
    consent,
    root,
    mission,
    exclude,
    maxFiles,
    nowIso: new Date().toISOString(),
    gatherFiles: gatherRecoveryMissionFiles,
  });

  if (wantProofJson) {
    // Emit the exact internally verified payload, or the fail-closed envelope
    // (never a success-shaped proof object) when verification did not pass.
    console.log(JSON.stringify(proof_payload ?? preview, null, 2));
  } else if (wantJson) {
    console.log(JSON.stringify(preview, null, 2));
  } else {
    console.log(formatDemaRecoveryMissionPreviewText(preview));
  }
  if (!preview.ok) process.exitCode = 1;
}
