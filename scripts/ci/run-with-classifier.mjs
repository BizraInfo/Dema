// CHECK-EXIT-INTEGRITY-1B — preserve the real exit status of a gated command.
//
// The npm scripts used `cmd 2>&1 | tee log; classifier --log log`: the
// semicolon hands the FINAL exit to the classifier, which reads only TAP, so a
// late NON-TAP gate failure after a green TAP run exited 0 (reproduced by the
// frozen 2026-07-16 audit; audit 2026-07-19 finding rank 2). This runner tees
// the output itself, captures the command's true exit, and forwards it via
// --check-exit so an unexplained nonzero can never pass as green.
//
// Check-owner mode also opens a bounded fd-3 side channel so structured child
// exits cannot be lost or forged by ordinary stdout/stderr framing:
//   node scripts/ci/run-with-classifier.mjs --require-check-gate-evidence \
//     --log <file> -- node scripts/check.mjs
import { spawn } from "node:child_process";
import { createWriteStream, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CHECK_GATE_EVIDENCE_FD_ENV } from "./check-gate-evidence.mjs";

const CLASSIFIER = fileURLToPath(
  new URL("./classify-known-harness-failures.mjs", import.meta.url),
);

function parseArgs(argv) {
  const sep = argv.indexOf("--");
  let log = null;
  let useTempLog = false;
  let requireCheckGateEvidence = false;
  const head = sep === -1 ? argv : argv.slice(0, sep);
  for (let i = 0; i < head.length; i++) {
    if (head[i] === "--log" && head[i + 1]) log = head[++i];
    else if (head[i] === "--temp-log") useTempLog = true;
    else if (head[i] === "--require-check-gate-evidence") {
      requireCheckGateEvidence = true;
    }
  }
  return {
    log,
    useTempLog,
    requireCheckGateEvidence,
    cmd: sep === -1 ? [] : argv.slice(sep + 1),
  };
}

const parsed = parseArgs(process.argv.slice(2));
let { log } = parsed;
const { useTempLog, requireCheckGateEvidence, cmd } = parsed;
if ((log && useTempLog) || (!log && !useTempLog) || cmd.length === 0) {
  console.error(
    "Usage: node scripts/ci/run-with-classifier.mjs [--require-check-gate-evidence] (--log <file> | --temp-log) -- <cmd ...>",
  );
  process.exit(2);
}

let tempLogDir = null;
if (useTempLog) {
  tempLogDir = mkdtempSync(join(tmpdir(), "bizra-classifier-log-"));
  log = join(tempLogDir, "run.log");
}
function cleanupTempLog() {
  if (tempLogDir) rmSync(tempLogDir, { recursive: true, force: true });
}

const out = createWriteStream(log);
const childEnv = { ...process.env };
delete childEnv[CHECK_GATE_EVIDENCE_FD_ENV];
if (requireCheckGateEvidence) childEnv[CHECK_GATE_EVIDENCE_FD_ENV] = "3";
const child = spawn(cmd[0], cmd.slice(1), {
  stdio: requireCheckGateEvidence
    ? ["inherit", "pipe", "pipe", "pipe"]
    : ["inherit", "pipe", "pipe"],
  env: childEnv,
});
const MAX_GATE_EVIDENCE_BYTES = 64 * 1024;
const gateEvidenceChunks = [];
let gateEvidenceBytes = 0;
let gateEvidenceOverflow = false;
let gateEvidenceError = null;
if (requireCheckGateEvidence) {
  child.stdio[3].on("data", (chunk) => {
    gateEvidenceBytes += chunk.length;
    if (gateEvidenceBytes <= MAX_GATE_EVIDENCE_BYTES) {
      gateEvidenceChunks.push(chunk);
    } else {
      gateEvidenceOverflow = true;
    }
  });
  child.stdio[3].on("error", (error) => {
    gateEvidenceError = error;
  });
}
child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  out.write(chunk);
});
child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
  out.write(chunk);
});
child.on("error", (err) => {
  console.error(`run-with-classifier: failed to spawn command: ${err.message}`);
  cleanupTempLog();
  process.exit(1);
});
child.on("close", (code, signal) => {
  out.end(() => {
    if (signal) {
      console.error(
        `[G8 EXIT] gated command terminated by ${signal}; failing closed.`,
      );
      cleanupTempLog();
      process.exit(1);
      return;
    }
    if (gateEvidenceOverflow || gateEvidenceError) {
      console.error(
        `[G8 GATE EXIT EVIDENCE] side channel ${
          gateEvidenceOverflow ? "exceeded 64 KiB" : "failed"
        }; failing closed.`,
      );
      cleanupTempLog();
      process.exit(1);
      return;
    }
    const classifierArgs = [
      CLASSIFIER,
      "--log",
      log,
      "--check-exit",
      String(code ?? 1),
    ];
    if (requireCheckGateEvidence) {
      classifierArgs.push(
        "--require-check-gate-evidence",
        "--check-gate-evidence",
        Buffer.concat(gateEvidenceChunks).toString("utf8"),
      );
    }
    const classifier = spawn(
      process.execPath,
      classifierArgs,
      { stdio: "inherit" },
    );
    classifier.on("error", (err) => {
      console.error(`run-with-classifier: classifier spawn failed: ${err.message}`);
      cleanupTempLog();
      process.exit(1);
    });
    classifier.on("close", (classifierCode) => {
      cleanupTempLog();
      process.exit(classifierCode ?? 1);
    });
  });
});
