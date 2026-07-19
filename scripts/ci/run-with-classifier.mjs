// CHECK-EXIT-INTEGRITY-1B — preserve the real exit status of a gated command.
//
// The npm scripts used `cmd 2>&1 | tee log; classifier --log log`: the
// semicolon hands the FINAL exit to the classifier, which reads only TAP, so a
// late NON-TAP gate failure after a green TAP run exited 0 (reproduced by the
// frozen 2026-07-16 audit; audit 2026-07-19 finding rank 2). This runner tees
// the output itself, captures the command's true exit, and forwards it via
// --check-exit so an unexplained nonzero can never pass as green.
//
// Usage: node scripts/ci/run-with-classifier.mjs --log <file> -- <cmd ...>
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { fileURLToPath } from "node:url";

const CLASSIFIER = fileURLToPath(
  new URL("./classify-known-harness-failures.mjs", import.meta.url),
);

function parseArgs(argv) {
  const sep = argv.indexOf("--");
  let log = null;
  const head = sep === -1 ? argv : argv.slice(0, sep);
  for (let i = 0; i < head.length; i++) {
    if (head[i] === "--log" && head[i + 1]) log = head[++i];
  }
  return { log, cmd: sep === -1 ? [] : argv.slice(sep + 1) };
}

const { log, cmd } = parseArgs(process.argv.slice(2));
if (!log || cmd.length === 0) {
  console.error(
    "Usage: node scripts/ci/run-with-classifier.mjs --log <file> -- <cmd ...>",
  );
  process.exit(2);
}

const out = createWriteStream(log);
const child = spawn(cmd[0], cmd.slice(1), {
  stdio: ["inherit", "pipe", "pipe"],
});
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
  process.exit(1);
});
child.on("close", (code) => {
  out.end(() => {
    const classifier = spawn(
      process.execPath,
      [CLASSIFIER, "--log", log, "--check-exit", String(code ?? 1)],
      { stdio: "inherit" },
    );
    classifier.on("error", (err) => {
      console.error(`run-with-classifier: classifier spawn failed: ${err.message}`);
      process.exit(1);
    });
    classifier.on("close", (classifierCode) => {
      process.exit(classifierCode ?? 1);
    });
  });
});
