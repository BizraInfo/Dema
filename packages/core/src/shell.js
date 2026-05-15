// Minimal interactive shell for `dema` (no-args invocation).
// Honest, terse, non-magical. No history, no tab-completion, no multi-line.
// One prompt per turn. Each typed line dispatches to the same CLI surface
// that `node apps/cli/src/index.js <args>` would handle.
//
// Why this shape:
//   - L0/L2 only. The shell does not run actions; it only invokes the
//     existing CLI subcommands which themselves carry the consent gates.
//   - Ctrl+C and Ctrl+D both exit cleanly without leaving terminal in
//     raw mode. No signal handlers we have to remember to undo.
//   - Tests can drive it via injected stdin/stdout streams.

import { createInterface } from "node:readline";

const PROMPT = "dema> ";

const HELP = [
  "Interactive Dema shell — same commands as the dema CLI.",
  "",
  "Start:",
  "  onboard              guided first-run path",
  "  welcome              first-run orientation",
  "",
  "Readiness:",
  "  status               show Node0 status",
  "  status:json          machine-readable status",
  "  today                continuity tick + memory summary",
  "  doctor               readiness check",
  "",
  "Preview planning:",
  "  ambient              show ambient execution boundary",
  "  diagnostics plan     preview self-diagnostics harness",
  "  consent plan TEXT    preview a micro-consent scope",
  "  mission draft TEXT   preview mission draft + consent plan",
  "",
  "Local evidence:",
  "  receipts             list local receipts",
  "  memory               list memory entries",
  "  memory show NAME     show one memory entry",
  "  models               show local model inventory",
  "  report safety        preview safety report, proof gaps, and boundaries",
  "  network blueprint    preview Node1/Node2 readiness without connecting",
  "",
  "Tasks:",
  "  task NAME            run a registered task (read-only in v0.3.0)",
  "  help                 this list",
  "  exit | quit          leave the shell",
  ""
].join("\n");

export async function runShell({
  input = process.stdin,
  output = process.stdout,
  dispatchCommand,
  greeting = "(no greeting)",
  installSigintHandler
} = {}) {
  if (typeof dispatchCommand !== "function") {
    throw new Error("runShell requires a dispatchCommand(argv) function.");
  }
  // Default: install the SIGINT handler only when reading from the real
  // process.stdin (i.e. an interactive operator). Tests inject a stream
  // and should not have process-level signal handlers interfering.
  const shouldInstallSigint = installSigintHandler ?? input === process.stdin;

  output.write(`${greeting}\n\n`);
  output.write(HELP);

  const rl = createInterface({ input, output, prompt: PROMPT, terminal: false });

  let sigintCount = 0;
  let sigintTimer = null;
  const onSigint = () => {
    sigintCount++;
    if (sigintCount >= 2) {
      output.write("\nGoodbye.\n");
      rl.close();
      return;
    }
    output.write("\n(Ctrl+C again to exit cleanly, or type `exit`.)\n");
    rl.prompt();
    if (sigintTimer) clearTimeout(sigintTimer);
    sigintTimer = setTimeout(() => {
      sigintCount = 0;
    }, 2000);
  };
  if (shouldInstallSigint) {
    process.on("SIGINT", onSigint);
  }

  return await new Promise((resolve) => {
    rl.prompt();

    rl.on("line", async (rawLine) => {
      const line = rawLine.trim();
      sigintCount = 0;
      if (line === "") {
        rl.prompt();
        return;
      }
      if (line === "exit" || line === "quit") {
        output.write("Goodbye.\n");
        rl.close();
        return;
      }
      if (line === "help") {
        output.write(HELP);
        rl.prompt();
        return;
      }

      let argv;
      try {
        argv = tokenize(line);
      } catch (err) {
        output.write(`error: ${err?.message ?? String(err)}\n`);
        rl.prompt();
        return;
      }
      try {
        await dispatchCommand(argv);
      } catch (err) {
        output.write(`error: ${err?.message ?? String(err)}\n`);
      }
      rl.prompt();
    });

    rl.on("close", () => {
      if (shouldInstallSigint) {
        process.removeListener("SIGINT", onSigint);
      }
      if (sigintTimer) clearTimeout(sigintTimer);
      resolve({ exited: true });
    });
  });
}

// Minimal shell-style tokenizer — supports double-quoted strings and
// backslash escapes inside quotes. Keeps the same shape as the existing
// node-adapter parseCommandLine() but inlined here to avoid import cycles.
export function tokenize(line) {
  const tokens = [];
  let current = "";
  let quote = null;
  let escaping = false;
  for (const ch of line) {
    if (escaping) {
      current += ch;
      escaping = false;
      continue;
    }
    if (ch === "\\") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (escaping) current += "\\";
  if (quote) throw new Error("Unclosed quote");
  if (current) tokens.push(current);
  return tokens;
}
