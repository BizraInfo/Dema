// Conversational fallback router for `dema chat` REPL.
// Pure synchronous routing — no I/O, no network, no LLM calls.
// Dependency-inject glossaryFn and suggesterFn for test isolation.

import { CANON_GLOSSARY } from "./canon-glossary.js";
import { suggestCommands } from "./command-suggester.js";

// Tokens stripped before concept/command matching.
const STOPWORDS = new Set([
  "what", "is", "about", "me", "the", "a", "an", "tell", "show",
  "explain", "help", "do", "does", "are", "how", "why", "when",
  "who", "where", "can", "i"
]);

const GREETING_WORDS = new Set([
  "hi", "hello", "hey", "salam", "salaam"
]);

// Top-level tokens the shell's dispatchCommand accepts (mirrors index.js).
const SHELL_REGISTERED_COMMANDS = [
  { command: "status", description: "show Node0 readiness" },
  { command: "status:json", description: "machine-readable status" },
  { command: "state", description: "Node0 state preview" },
  { command: "profiles", description: "profile foundation preview" },
  { command: "consent-card", description: "consent card preview" },
  { command: "mission-loop", description: "full mission lifecycle preview" },
  { command: "evidence-event", description: "evidence chain event preview" },
  { command: "node-registry", description: "node ordinal registry preview" },
  { command: "onboarding-lifecycle", description: "onboarding lifecycle preview" },
  { command: "skill-growth-governor", description: "skill growth governor preview" },
  { command: "project-status", description: "project status preview" },
  { command: "craftsmanship-witness", description: "master-craftsmanship creation preview" },
  { command: "llm-router", description: "local LLM router preview" },
  { command: "process-mining", description: "operator-pattern mirror" },
  { command: "key-maker-check", description: "self-audit reasoning against Key Maker invariants" },
  { command: "llm-invoke", description: "local LLM adapter (preview or live call)" },
  { command: "today", description: "record a local continuity tick" },
  { command: "doctor", description: "validate readiness and consent gate" },
  { command: "ambient", description: "show Ambient Sovereign Execution boundary" },
  { command: "ambient:json", description: "ambient boundary as JSON" },
  { command: "diagnostics", description: "preview self-diagnostics harness" },
  { command: "consent", description: "preview a micro-consent scope" },
  { command: "mission", description: "preview mission draft or propose" },
  { command: "receipts", description: "list or show local receipts" },
  { command: "memory", description: "list or show local memory entries" },
  { command: "models", description: "show local model inventory" },
  { command: "report", description: "preview safety report" },
  { command: "network", description: "preview network blueprint or refusal matrix" },
  { command: "amana", description: "preview Amana contract primitives" },
  { command: "mcp", description: "preview MCP integration contract" },
  { command: "roadmap", description: "preview optimization roadmap" },
  { command: "evidence", description: "preview evidence receipt" },
  { command: "ihsan", description: "preview Ihsan floor check" },
  { command: "behavior", description: "preview behavioral modulation" },
  { command: "design", description: "preview PAT/SAT loop design assumptions" },
  { command: "task", description: "list or run registered tasks" },
  { command: "monetize", description: "show proof-safe first offer boundary" },
  { command: "sovereign", description: "render Sovereign Mission Interface" },
  { command: "welcome", description: "show first-run orientation" },
  { command: "onboard", description: "guided onboarding path" },
  { command: "explain", description: "plain-language definition of a BIZRA/Dema concept (28 known)" },
  { command: "setup", description: "create local Dema folders/profile skeleton" },
  { command: "help", description: "show full command list" },
  { command: "chat", description: "interactive REPL shell" },
  { command: "exit", description: "leave the shell" },
  { command: "quit", description: "leave the shell" }
];

/**
 * Route a REPL line to the appropriate conversational intent.
 *
 * @param {string} input - raw user input line
 * @param {object} [options]
 * @param {Map}    [options.glossary] - CANON_GLOSSARY-compatible Map (injectable for tests)
 * @param {Function} [options.suggester] - suggestCommands-compatible function (injectable for tests)
 * @param {Array}  [options.registeredCommands] - command list (injectable for tests)
 * @returns {{ intent: string, response: string, suggestedCommands: string[] }}
 */
function routeChatInput(input, options = {}) {
  const {
    glossary = CANON_GLOSSARY,
    suggester = suggestCommands,
    registeredCommands = SHELL_REGISTERED_COMMANDS
  } = options;

  // Safely coerce input — never throw on weird types.
  const raw = typeof input === "string" ? input : String(input ?? "");

  // Strip control characters (newlines, tabs) before processing.
  const normalized = raw.replace(/[\t\n\r]/g, " ").trim();

  // (a) Empty / whitespace.
  if (!normalized) {
    return {
      intent: "empty",
      response: "",
      suggestedCommands: []
    };
  }

  // Reject absurdly long input early — 10 KB cap to avoid quadratic Levenshtein.
  if (normalized.length > 10240) {
    return {
      intent: "unknown",
      response: _unknownResponse(normalized.split(/\s+/)[0]),
      suggestedCommands: []
    };
  }

  // Tokenize to lowercase words; filter stopwords.
  const allTokens = normalized.toLowerCase().split(/\s+/).filter(Boolean);
  const contentTokens = allTokens.filter((t) => !STOPWORDS.has(t));
  const firstToken = allTokens[0] ?? "";

  // (b) Greeting detection — check ALL tokens so "hello dema" matches.
  if (allTokens.some((t) => GREETING_WORDS.has(t))) {
    return {
      intent: "greeting",
      response: [
        "I'm here. I'm not a chat agent yet — I'm a strict-command CLI that answers",
        "from local knowledge. Try:",
        "  dema explain dema    — what I am",
        "  dema help            — what I can do",
        "  dema memory          — what I remember"
      ].join("\n"),
      suggestedCommands: ["dema explain dema", "dema help", "dema memory"]
    };
  }

  // (c) Exact registered-command match on first non-stopword token.
  const firstContent = contentTokens[0] ?? firstToken;
  if (firstContent) {
    const exactResult = suggester(firstContent, registeredCommands);
    if (exactResult.matched === "exact") {
      return {
        intent: "registered-command",
        response: `Dispatching \`${firstContent}\`.`,
        suggestedCommands: [`dema ${firstContent}`]
      };
    }
  }

  // (d) Concept-match: check ALL content tokens against the glossary.
  // First match wins — preserves left-to-right natural reading order.
  for (const token of contentTokens) {
    const key = token.replace(/-/g, "-"); // already lowercase
    if (glossary.has(key)) {
      const entry = glossary.get(key);
      return {
        intent: "concept-match",
        concept: key,
        response: _conceptResponse(entry),
        suggestedCommands: [`dema explain ${key}`, `dema memory show ${key}-context`]
      };
    }
  }

  // (e) Command-suggestion (typo): use first content token.
  if (firstContent) {
    const closeResult = suggester(firstContent, registeredCommands);
    if (closeResult.matched === "close") {
      const topCommand = closeResult.suggestions[0].command;
      const lines = [
        `I don't have a \`${firstContent}\` command.`,
        "",
        "Did you mean:"
      ];
      for (const s of closeResult.suggestions) {
        lines.push(`  - dema ${s.command.padEnd(30)} — ${s.description}`);
      }
      lines.push("", "Type `dema help` to see everything I can do.");
      return {
        intent: "command-suggestion",
        response: lines.join("\n"),
        suggestedCommands: closeResult.suggestions.map((s) => `dema ${s.command}`)
      };
    }
  }

  // (f) Unknown.
  return {
    intent: "unknown",
    response: _unknownResponse(firstToken || normalized),
    suggestedCommands: []
  };
}

function _conceptResponse(entry) {
  const lines = [
    "I can answer that from my local knowledge.",
    "",
    `> dema explain ${entry.concept}`,
    `${entry.title}`,
    `  ${entry.short}`,
    ""
  ];

  if (entry.see_also && entry.see_also.length > 0) {
    lines.push("  See also:");
    for (const ref of entry.see_also) {
      lines.push(`    - dema explain ${ref}`);
    }
    lines.push("");
  }

  lines.push(
    "If you want more, type:",
    `  dema explain ${entry.concept}   — the canonical definition`,
    `  dema memory show ${entry.concept}-context   — operator memory about ${entry.title}`
  );
  return lines.join("\n");
}

function _unknownResponse(token) {
  return [
    `I don't know what \`${token}\` means.`,
    "",
    "I couldn't match it to a command or to a BIZRA concept. You can browse:",
    "  dema explain    — list known concepts",
    "  dema help       — list known commands",
    "  dema memory     — list local memory entries"
  ].join("\n");
}

export { routeChatInput, STOPWORDS, GREETING_WORDS, SHELL_REGISTERED_COMMANDS };
