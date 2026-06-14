import {
  buildCodebaseArchitectureMap,
  formatCodebaseMapSummary,
} from "../../../../packages/core/src/codebase-architecture-map.js";
import {
  CODEBASE_MAP_SAVE_CONSENT,
  serializeCodebaseMapForSave,
  saveCodebaseMap,
} from "../../../../packages/receipts/src/codebase-map-save.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_codebase(ctx) {
  const { argv } = ctx;
  // v0.1 · read-only codebase architecture map.
  // Usage: dema codebase map <abs-path> [flags]
  const cbSubcommand = argv[1];
  if (cbSubcommand !== "map") {
    process.stderr.write(
      "Usage: dema codebase map <abs-path> [--summary] [--json] [--max-files N] [--max-depth N] [--max-file-size N] [--include-tests] [--hotspots] [--exclude PAT] [--no-default-exclude]\n",
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  const { isAbsolute: cbIsAbsolute } = await import("node:path");
  const cbPath = argv.slice(2).find((a) => !a.startsWith("--"));
  if (!cbPath) {
    process.stderr.write("dema codebase map: <abs-path> is required\n");
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  if (!cbIsAbsolute(cbPath)) {
    process.stderr.write(
      `dema codebase map: <abs-path> must be absolute (got: ${cbPath})\n`,
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  const cbSummary = argv.includes("--summary");
  const cbJsonForce = argv.includes("--json");
  const cbIncludeTests = argv.includes("--include-tests");
  const cbHotspots = argv.includes("--hotspots");
  const cbNoDefaultExclude = argv.includes("--no-default-exclude");
  const cbSaveMap = argv.includes("--save-map");
  // v0.2 (this slice): --save-map cannot combine with --summary unless
  // --json is also passed (saved file must match stdout byte-for-byte;
  // a human summary text saved to codebase-map-<sha>.json is a category
  // error). Fail-closed mirrors PR #85 "--save-invocation-result requires
  // --invoke" early-validation pattern.
  if (cbSaveMap && cbSummary && !cbJsonForce) {
    process.stderr.write(
      "dema codebase map: --save-map requires JSON output; cannot combine with --summary unless --json is also provided\n",
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  const parseIntOrNull = (s) => {
    if (typeof s !== "string") return undefined;
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const cbMaxFiles = parseIntOrNull(argValue(argv, "--max-files"));
  const cbMaxDepth = parseIntOrNull(argValue(argv, "--max-depth"));
  const cbMaxFileSize = parseIntOrNull(argValue(argv, "--max-file-size"));
  const cbExtraExclusions = [];
  for (let i = 0; i < argv.length - 1; i++) {
    if (argv[i] === "--exclude") cbExtraExclusions.push(argv[i + 1]);
  }
  const envelope = await buildCodebaseArchitectureMap(cbPath, {
    maxFiles: cbMaxFiles,
    maxDepth: cbMaxDepth,
    maxFileSize: cbMaxFileSize,
    includeTests: cbIncludeTests,
    hotspots: cbHotspots,
    extraExclusions: cbExtraExclusions,
    useDefaultExclusions: !cbNoDefaultExclude,
  });
  // Single serializer shared by save + stdout (byte-for-byte invariant).
  // pretty=false matches the v0.1 CLI behavior; --pretty is not exposed
  // by codebase-map yet.
  const cbOut = serializeCodebaseMapForSave(envelope, { pretty: false });
  const writeCodebaseStdout = (text) =>
    new Promise((resolve, reject) => {
      process.stdout.write(text, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  // v0.2: save BEFORE any stdout write. If save fails, exit non-zero
  // without polluting stdout.
  if (cbSaveMap) {
    const cbSaveConsent = argValue(argv, "--save-map-consent") ?? null;
    const cbSaveResult = await saveCodebaseMap(envelope, {
      demaHome: process.env.DEMA_HOME,
      consent: cbSaveConsent,
      pretty: false,
    });
    if (!cbSaveResult.saved) {
      if (cbSaveResult.reason === "consent_missing") {
        process.stderr.write(
          `dema codebase map: --save-map requires --save-map-consent "${CODEBASE_MAP_SAVE_CONSENT}"\n`,
        );
      } else if (cbSaveResult.reason === "consent_mismatch") {
        process.stderr.write(
          `dema codebase map: --save-map consent phrase mismatch; required: "${CODEBASE_MAP_SAVE_CONSENT}"\n`,
        );
      } else if (cbSaveResult.reason === "oversized_serialized_envelope") {
        process.stderr.write(
          `dema codebase map: --save-map failed (serialized envelope ${cbSaveResult.serialized_bytes} bytes exceeds ${cbSaveResult.max_saved_bytes} byte cap)\n`,
        );
      } else {
        process.stderr.write(
          `dema codebase map: --save-map failed (${cbSaveResult.reason}): ${cbSaveResult.error_message ?? "unknown"}\n`,
        );
      }
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    process.stderr.write(`saved codebase map to: ${cbSaveResult.path}\n`);
  }
  if (envelope.error_reason) {
    process.stderr.write(
      `dema codebase map: ${envelope.error_reason}${envelope.error_message ? ": " + envelope.error_message : ""}\n`,
    );
    await writeCodebaseStdout(cbOut);
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  if (cbSummary && !cbJsonForce) {
    await writeCodebaseStdout(formatCodebaseMapSummary(envelope) + "\n");
  } else {
    await writeCodebaseStdout(cbOut);
  }
  if (envelope.partial) process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}
