import { runVerificationPipeline } from "../../../../packages/core/src/multi-agent-orchestrator.js";
import {
  PIPELINE_RESULT_SAVE_CONSENT,
  serializePipelineResultForSave,
  savePipelineResult,
} from "../../../../packages/receipts/src/pipeline-result-save.js";
import {
  readEnvelopeFromFile,
  resolveLatestInvocationPath,
} from "../../../../packages/core/src/routed-invocation-verifier.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_orchestrator(ctx) {
  const { argv } = ctx;
  // v0.1 · SAT-1..5 pipeline exposure. Reads a saved invocation envelope
  // and pipes it through the existing runVerificationPipeline() from
  // multi-agent-orchestrator.js. NOT chain-bound mint. NOT PAT execution.
  // No model invocation. No network.
  const orcSub = argv[1];
  if (orcSub !== "verify") {
    process.stderr.write(
      'Usage: dema orchestrator verify [--invocation-file <abs-path> | --latest] [--pretty] [--save-pipeline-result --save-pipeline-consent "GO: save local orchestrator pipeline result"]\n',
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  const { isAbsolute: orcIsAbsolute } = await import("node:path");
  const orcFile = argValue(argv, "--invocation-file") ?? null;
  const orcLatest = argv.includes("--latest");
  const orcPretty = argv.includes("--pretty");
  const orcSave = argv.includes("--save-pipeline-result");

  if (orcFile && orcLatest) {
    process.stderr.write(
      "dema orchestrator verify: --invocation-file and --latest are mutually exclusive\n",
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  if (!orcFile && !orcLatest) {
    process.stderr.write(
      "dema orchestrator verify: one of --invocation-file <abs-path> or --latest is required\n",
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  let orcTargetPath;
  if (orcFile) {
    if (!orcIsAbsolute(orcFile)) {
      process.stderr.write(
        `dema orchestrator verify: --invocation-file path must be absolute (got: ${orcFile})\n`,
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    orcTargetPath = orcFile;
  } else {
    const latest = await resolveLatestInvocationPath({
      demaHome: process.env.DEMA_HOME,
    });
    if (!latest) {
      process.stderr.write(
        "dema orchestrator verify: no invocation-*.json files found in $DEMA_HOME/receipts/\n",
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    orcTargetPath = latest;
  }

  let orcReadResult;
  try {
    orcReadResult = await readEnvelopeFromFile(orcTargetPath);
  } catch (err) {
    if (err?.code === "ENOENT") {
      process.stderr.write(
        `dema orchestrator verify: envelope file not found: ${orcTargetPath}\n`,
      );
    } else if (err instanceof SyntaxError) {
      process.stderr.write(
        `dema orchestrator verify: malformed envelope JSON at ${orcTargetPath}: ${err.message}\n`,
      );
    } else {
      process.stderr.write(
        `dema orchestrator verify: envelope read failed at ${orcTargetPath}: ${err?.message ?? err}\n`,
      );
    }
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  const pipeline = runVerificationPipeline({
    artifact: orcReadResult.envelope,
  });
  // Attach source linkage (Q8: preserve source artifact hash) without
  // mutating the frozen pipeline object — wrap via a fresh frozen shape.
  const pipelineWithSource = Object.freeze({
    ...pipeline,
    source: Object.freeze({
      path: orcTargetPath,
      source_invocation_result_hash: orcReadResult.sourceHash,
    }),
  });

  const pipelineOut = serializePipelineResultForSave(pipelineWithSource, {
    pretty: orcPretty,
  });

  if (orcSave) {
    const orcSaveConsent = argValue(argv, "--save-pipeline-consent") ?? null;
    const saveResult = await savePipelineResult(pipelineWithSource, {
      demaHome: process.env.DEMA_HOME,
      consent: orcSaveConsent,
      pretty: orcPretty,
    });
    if (!saveResult.saved) {
      if (saveResult.reason === "consent_missing") {
        process.stderr.write(
          `dema orchestrator verify: --save-pipeline-result requires --save-pipeline-consent "${PIPELINE_RESULT_SAVE_CONSENT}"\n`,
        );
      } else if (saveResult.reason === "consent_mismatch") {
        process.stderr.write(
          `dema orchestrator verify: --save-pipeline-result consent phrase mismatch; required: "${PIPELINE_RESULT_SAVE_CONSENT}"\n`,
        );
      } else {
        process.stderr.write(
          `dema orchestrator verify: --save-pipeline-result failed (${saveResult.reason}): ${saveResult.error_message ?? "unknown"}\n`,
        );
      }
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    process.stderr.write(`saved pipeline result to: ${saveResult.path}\n`);
  }

  process.stdout.write(pipelineOut);
  if (!pipelineWithSource.passed) process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}
