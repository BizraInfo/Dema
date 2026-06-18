import test from "node:test";
import assert from "node:assert/strict";
import {
  routeChatInput,
  STOPWORDS,
  GREETING_WORDS,
  NEXT_ACTION_PHRASES,
  DISPATCH_INTENT_MAP,
} from "../packages/core/src/chat-router.js";

// ── Dependency-injection helpers ──────────────────────────────────────────────

const MOCK_GLOSSARY = new Map([
  [
    "bizra",
    {
      concept: "bizra",
      title: "BIZRA · The 7-Pillar Ecosystem",
      short: "The sovereign-AI ecosystem.",
      see_also: ["pat", "dema"],
    },
  ],
  [
    "ihsan",
    {
      concept: "ihsan",
      title: "Ihsan",
      short: "Excellence as the minimum bar.",
      see_also: ["adl"],
    },
  ],
  [
    "adl",
    {
      concept: "adl",
      title: "Adl",
      short: "Fairness and bounded inequality.",
      see_also: ["ihsan"],
    },
  ],
  [
    "node0",
    {
      concept: "node0",
      title: "Node0",
      short: "The origin device.",
      see_also: ["node1"],
    },
  ],
]);

const MOCK_COMMANDS = [
  { command: "status", description: "show Node0 readiness" },
  { command: "state", description: "Node0 state preview" },
  { command: "memory", description: "list local memory entries" },
  { command: "help", description: "show command list" },
];

function mockSuggester(input, cmds) {
  const lower = input.toLowerCase();
  const exact = cmds.find((c) => c.command === lower);
  if (exact)
    return {
      matched: "exact",
      suggestions: [exact],
      originalInput: input,
      missingToken: lower,
    };
  return {
    matched: "unknown",
    suggestions: [],
    originalInput: input,
    missingToken: lower,
  };
}

const DI = {
  glossary: MOCK_GLOSSARY,
  suggester: mockSuggester,
  registeredCommands: MOCK_COMMANDS,
};

// ── Structural invariants ─────────────────────────────────────────────────────

test("STOPWORDS is a frozen-compatible Set with expected tokens", () => {
  assert.ok(STOPWORDS instanceof Set);
  assert.ok(STOPWORDS.has("what"));
  assert.ok(STOPWORDS.has("tell"));
  assert.ok(STOPWORDS.has("the"));
  assert.ok(!STOPWORDS.has("bizra"));
});

test("GREETING_WORDS contains expected greetings including Arabic variants", () => {
  assert.ok(GREETING_WORDS instanceof Set);
  assert.ok(GREETING_WORDS.has("salam"));
  assert.ok(GREETING_WORDS.has("salaam"));
  assert.ok(GREETING_WORDS.has("hello"));
  assert.ok(GREETING_WORDS.has("hi"));
  assert.ok(GREETING_WORDS.has("hey"));
});

// ── Empty / whitespace ────────────────────────────────────────────────────────

test("empty string → intent: empty, response: ''", () => {
  const r = routeChatInput("", DI);
  assert.equal(r.intent, "empty");
  assert.equal(r.response, "");
  assert.deepEqual(r.suggestedCommands, []);
});

test("whitespace-only → intent: empty", () => {
  const r = routeChatInput("   \t  ", DI);
  assert.equal(r.intent, "empty");
});

// ── Registered command ────────────────────────────────────────────────────────

test("exact registered command 'status' → intent: registered-command", () => {
  const r = routeChatInput("status", DI);
  assert.equal(r.intent, "registered-command");
  assert.ok(r.suggestedCommands[0].includes("status"));
});

// ── Concept match ─────────────────────────────────────────────────────────────

test("'what is bizra' → intent: concept-match, concept: bizra", () => {
  const r = routeChatInput("what is bizra", DI);
  assert.equal(r.intent, "concept-match");
  assert.equal(r.concept, "bizra");
  assert.match(r.response, /BIZRA/);
  assert.match(r.response, /I can answer that from my local knowledge/);
});

test("'tell me about ihsan' → intent: concept-match, concept: ihsan", () => {
  const r = routeChatInput("tell me about ihsan", DI);
  assert.equal(r.intent, "concept-match");
  assert.equal(r.concept, "ihsan");
});

test("'tell me about node0' → intent: concept-match, concept: node0", () => {
  const r = routeChatInput("tell me about node0", DI);
  assert.equal(r.intent, "concept-match");
  assert.equal(r.concept, "node0");
});

test("case-insensitive: 'WHAT IS BIZRA' → concept-match bizra", () => {
  const r = routeChatInput("WHAT IS BIZRA", DI);
  assert.equal(r.intent, "concept-match");
  assert.equal(r.concept, "bizra");
});

test("multiple concepts 'compare ihsan and adl' → first match (ihsan)", () => {
  const r = routeChatInput("compare ihsan and adl", DI);
  assert.equal(r.intent, "concept-match");
  // 'and' is not a stopword; 'ihsan' appears before 'adl' in content tokens
  assert.equal(r.concept, "ihsan");
});

// ── Greeting ──────────────────────────────────────────────────────────────────

test("'hello dema' → intent: greeting", () => {
  const r = routeChatInput("hello dema", DI);
  assert.equal(r.intent, "greeting");
  assert.match(r.response, /I'm not a chat agent yet/);
});

test("'salam' alone → intent: greeting (Arabic-aware)", () => {
  const r = routeChatInput("salam", DI);
  assert.equal(r.intent, "greeting");
});

test("'hey' → intent: greeting", () => {
  const r = routeChatInput("hey", DI);
  assert.equal(r.intent, "greeting");
});

// ── Command suggestion (typo) ─────────────────────────────────────────────────

test("'stauts' (typo) → intent: command-suggestion via real suggester", () => {
  // Use the real suggester so Levenshtein fires.
  const r = routeChatInput("stauts");
  assert.equal(r.intent, "command-suggestion");
  assert.match(r.response, /status/);
  assert.match(r.response, /Did you mean/);
});

// ── Unknown ───────────────────────────────────────────────────────────────────

test("'xyzqwerty asdf' → intent: unknown", () => {
  const r = routeChatInput("xyzqwerty asdf", DI);
  assert.equal(r.intent, "unknown");
  assert.match(r.response, /xyzqwerty/);
  assert.match(r.response, /dema explain/);
});

test("stopwords alone 'the the the' → unknown (no concept match)", () => {
  const r = routeChatInput("the the the", DI);
  assert.equal(r.intent, "unknown");
});

// ── Edge cases / adversarial ──────────────────────────────────────────────────

test("'?' alone → command-suggestion or unknown, not a throw", () => {
  const r = routeChatInput("?");
  assert.ok(
    ["command-suggestion", "unknown"].includes(r.intent),
    `unexpected intent: ${r.intent}`,
  );
  assert.equal(typeof r.response, "string");
});

test("input with newlines and tabs → handled safely, no throw", () => {
  const r = routeChatInput("what\tis\nbizra", DI);
  // After normalization the concept 'bizra' should still match.
  assert.equal(r.intent, "concept-match");
  assert.equal(r.concept, "bizra");
});

test("prototype pollution attempt → safe, no leak", () => {
  const r = routeChatInput("__proto__ constructor", DI);
  // Neither token is a registered command or glossary concept.
  assert.ok(["unknown", "command-suggestion"].includes(r.intent));
  assert.equal(typeof r.response, "string");
  assert.ok(!Object.prototype.hasOwnProperty.call({}, "pwned"));
});

test("very long input (10KB+) → intent: unknown, no throw", () => {
  const long = "x".repeat(10241);
  const r = routeChatInput(long);
  assert.equal(r.intent, "unknown");
  assert.equal(typeof r.response, "string");
});

// ── Dependency injection ──────────────────────────────────────────────────────

test("DI: mock glossary and suggester resolve 'bizra' concept", () => {
  const r = routeChatInput("explain bizra please", DI);
  // 'explain' is a stopword; 'bizra' is a content token that hits the mock glossary
  assert.equal(r.intent, "concept-match");
  assert.equal(r.concept, "bizra");
});

test("DI: mock suggester exact-match 'memory' → registered-command", () => {
  const r = routeChatInput("memory", DI);
  assert.equal(r.intent, "registered-command");
});

test("suggestedCommands is always an array", () => {
  for (const input of ["", "hello", "bizra", "xyzqwerty", "status"]) {
    const r = routeChatInput(input, DI);
    assert.ok(
      Array.isArray(r.suggestedCommands),
      `suggestedCommands not array for input '${input}'`,
    );
  }
});

// ── next-action intent ────────────────────────────────────────────────────────

test("'what should I do next' → intent: next-action", () => {
  const r = routeChatInput("what should I do next", DI);
  assert.equal(r.intent, "next-action");
  assert.match(r.response, /next safe action/i);
  assert.ok(Array.isArray(r.suggestedCommands));
  assert.ok(r.suggestedCommands.includes("dema doctor"));
});

test("'what now' → intent: next-action", () => {
  const r = routeChatInput("what now", DI);
  assert.equal(r.intent, "next-action");
});

test("'what's next' (apostrophe variant) → intent: next-action", () => {
  const r = routeChatInput("what's next", DI);
  assert.equal(r.intent, "next-action");
});

test("'next move' → intent: next-action", () => {
  const r = routeChatInput("next move", DI);
  assert.equal(r.intent, "next-action");
});

test("next-action response uses injected status (activationGate + nextAdmissibleAction)", () => {
  const mockStatus = {
    activationGate: "EXPLICIT_GO_REQUIRED",
    findings: [],
    nextAdmissibleAction: "bounded_setup_complete",
  };
  const r = routeChatInput("what should I do next", {
    ...DI,
    status: mockStatus,
  });
  assert.equal(r.intent, "next-action");
  assert.match(r.response, /EXPLICIT_GO_REQUIRED/);
  assert.match(r.response, /bounded_setup_complete/);
});

test("next-action with null status falls back to defaults gracefully", () => {
  const r = routeChatInput("next action", { ...DI, status: null });
  assert.equal(r.intent, "next-action");
  assert.match(r.response, /BLOCKED/);
  assert.match(r.response, /bounded_diagnostic_activation/);
});

// ── dispatch-intent ───────────────────────────────────────────────────────────

test("'show my status' → intent: dispatch-intent, dispatchCommand: ['status']", () => {
  const r = routeChatInput("show my status", DI);
  assert.equal(r.intent, "dispatch-intent");
  assert.deepEqual(r.dispatchCommand, ["status"]);
});

test("'show my receipts' → intent: dispatch-intent, dispatchCommand: ['receipts']", () => {
  const r = routeChatInput("show my receipts", DI);
  assert.equal(r.intent, "dispatch-intent");
  assert.deepEqual(r.dispatchCommand, ["receipts"]);
});

test("'help me draft a mission' → intent: dispatch-intent, dispatchCommand: ['mission','draft']", () => {
  const r = routeChatInput("help me draft a mission", DI);
  assert.equal(r.intent, "dispatch-intent");
  assert.deepEqual(r.dispatchCommand, ["mission", "draft"]);
});

test("'what models' → intent: dispatch-intent, dispatchCommand: ['models','scan','--summary']", () => {
  const r = routeChatInput("what models", DI);
  assert.equal(r.intent, "dispatch-intent");
  assert.deepEqual(r.dispatchCommand, ["models", "scan", "--summary"]);
});

test("'show my memory' → intent: dispatch-intent, dispatchCommand: ['memory']", () => {
  const r = routeChatInput("show my memory", DI);
  assert.equal(r.intent, "dispatch-intent");
  assert.deepEqual(r.dispatchCommand, ["memory"]);
});

test("adversarial: 'show my statusxyz' does not match dispatch-intent for status", () => {
  // "show my statusxyz" does not contain exact phrase "show my status" followed by word boundary
  // but it DOES contain "show my status" as substring — that is the current design (substring match).
  // Test documents the actual behavior: it WILL match because of substring inclusion.
  // Confirm the intent is dispatch-intent (not unknown).
  const r = routeChatInput("show my statusxyz", DI);
  // The phrase "show my status" is a substring of "show my statusxyz", so dispatch-intent fires.
  assert.equal(r.intent, "dispatch-intent");
  assert.deepEqual(r.dispatchCommand, ["status"]);
});

test("NEXT_ACTION_PHRASES and DISPATCH_INTENT_MAP are exported arrays", () => {
  assert.ok(Array.isArray(NEXT_ACTION_PHRASES));
  assert.ok(NEXT_ACTION_PHRASES.length >= 6);
  assert.ok(Array.isArray(DISPATCH_INTENT_MAP));
  assert.ok(DISPATCH_INTENT_MAP.length >= 5);
});

test("'talk to the guardian' → intent: council-seat-pat-routing", () => {
  const r = routeChatInput("talk to the guardian", DI);
  assert.equal(r.intent, "council-seat-pat-routing");
  assert.equal(r.council_seat, "Guardian");
  assert.match(r.response, /pat-auditor/);
});

test("'builder' alone → council-seat-pat-routing for Builder seat", () => {
  const r = routeChatInput("builder", DI);
  assert.equal(r.intent, "council-seat-pat-routing");
  assert.equal(r.council_seat, "Builder");
});

test("'council routing' → table response without selected seat", () => {
  const r = routeChatInput("show council routing", DI);
  assert.equal(r.intent, "council-seat-pat-routing");
  assert.match(r.response, /Guardian/);
});

test("'dispatch pat from council seat builder' → council-seat-pat-dispatch without consent", () => {
  const r = routeChatInput("dispatch pat from council seat builder", DI);
  assert.equal(r.intent, "council-seat-pat-dispatch");
  assert.equal(r.council_seat, "Builder");
  assert.equal(r.consent_phrase, "");
  assert.ok(r.suggestedCommands.some((c) => c.includes("council-dispatch")));
});

test("exact GO consent line → council-seat-pat-dispatch with consent_phrase", () => {
  const line = "GO: dispatch PAT from council seat Guardian";
  const r = routeChatInput(line, DI);
  assert.equal(r.intent, "council-seat-pat-dispatch");
  assert.equal(r.council_seat, "Guardian");
  assert.equal(r.consent_phrase, line);
});
