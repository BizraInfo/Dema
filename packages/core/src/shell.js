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
import { routeChatInput } from "./chat-router.js";
import { buildChatBanner } from "./chat-banner.js";
import { readOperatorPreferredName } from "./operator-profile.js";

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
  "  ambient --manifest   preview zero-trust capability manifest",
  "  ambient audit        preview ambient sovereign execution audit",
  "  journey TEXT         preview the sovereign journey OS path",
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
  "  network blueprint    preview Node1/Node2 and phase-gated readiness",
  "  network fixture preview",
  "                       preview offline 5-slot fixture without sockets",
  "  network refusal preview",
  "                       preview partition/rejoin refusal matrix without sockets",
  "  amana contracts preview",
  "                       preview Amana contracts without importing external code",
  "",
  "Spine preview surfaces (canonical 16-key boundary · NODE0_LOCAL_SEED):",
  "  state                Node0 state preview; runtime/federation/mint=false",
  "  profiles             User/PAT/SAT/Mission/ContextCapsule (--summary supported)",
  "  consent-card         allowed/blocked effects + decision options",
  "  mission-loop         lifecycle preview; preview_lifecycle_status pinned HOLD",
  "  evidence-event       EvidenceChain event preview; chain_advance=false",
  "  llm-router           local LLM router; routing_allowed=false; abstain default",
  "  process-mining       operator-pattern mirror; surfaces ring_advancement_status",
  "  key-maker-check      audits reasoning against 5 Key Maker invariants",
  "  llm-invoke           C1 local LLM adapter; preview by default · --invoke gated",
  "  node-registry        Node ordinal registry (v0.1e+f); counts + URP inventory",
  "  onboarding-lifecycle 7-stage flow: language→tech-level→...→first-mission",
  "  skill-growth-governor proof-governed growth · 5 gates + 8 refusals",
  "  project-status       PMBOK 7th-edition aligned · stakeholders + risks + value",
  "  craftsmanship-witness master craftsmanship creation · proactive self-harness +",
  "                       micro-consent + RSI process-mining-of-self + 10 invariants",
  "",
  "Tasks:",
  "  task NAME            run a registered task (read-only in this release)",
  "  help                 this list",
  "  exit | quit          leave the shell",
  "",
].join("\n");

export async function runShell({
  input = process.stdin,
  output = process.stdout,
  dispatchCommand,
  greeting = "(no greeting)",
  installSigintHandler,
  noBanner = false,
  statusProvider = null,
} = {}) {
  if (typeof dispatchCommand !== "function") {
    throw new Error("runShell requires a dispatchCommand(argv) function.");
  }
  // Default: install the SIGINT handler only when reading from the real
  // process.stdin (i.e. an interactive operator). Tests inject a stream
  // and should not have process-level signal handlers interfering.
  const shouldInstallSigint = installSigintHandler ?? input === process.stdin;

  // Banner suppressed under non-TTY, --no-banner flag, or DEMA_BANNER_INTERACTIVE=0.
  const isTTY = Boolean(output?.isTTY);
  const suppressBanner =
    noBanner ||
    !isTTY ||
    process.argv.includes("--no-banner") ||
    process.env.DEMA_BANNER_INTERACTIVE === "0";

  let chatBannerShown = false;
  if (!suppressBanner) {
    const human = await readOperatorPreferredName();
    const banner = buildChatBanner({ human, suppressed: false });
    if (banner) {
      output.write(banner + "\n\n");
      chatBannerShown = true;
    }
  }

  // The chat banner is a strict superset of the legacy `greeting`
  // (formatBanner) block — operator name, node, gateway state, etc. all
  // already appear in the bordered chat banner. Skip the greeting when
  // the chat banner was rendered to avoid the stacked-banner duplication.
  if (!chatBannerShown) {
    output.write(`${greeting}\n\n`);
  }
  output.write(HELP);

  const rl = createInterface({
    input,
    output,
    prompt: PROMPT,
    terminal: false,
  });

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

      // Conversational fallback: route through chat-router before dispatch.
      // If the input is a BIZRA concept, a greeting, a typo suggestion, or
      // unknown, respond conversationally and skip the CLI dispatcher.
      const currentStatus = statusProvider ? await statusProvider() : null;
      const chatResult = routeChatInput(line, { status: currentStatus });
      const PASS_THROUGH_INTENTS = new Set(["empty", "registered-command"]);

      if (chatResult.intent === "next-action") {
        output.write(chatResult.response + "\n");
        rl.prompt();
        return;
      }

      if (chatResult.intent === "dispatch-intent") {
        const cmd = chatResult.dispatchCommand ?? [];
        output.write(`Routing your request to: dema ${cmd.join(" ")}\n`);
        try {
          await dispatchCommand(cmd);
        } catch (err) {
          output.write(`error: ${err?.message ?? String(err)}\n`);
        }
        rl.prompt();
        return;
      }

      if (!PASS_THROUGH_INTENTS.has(chatResult.intent)) {
        output.write(chatResult.response + "\n");
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
