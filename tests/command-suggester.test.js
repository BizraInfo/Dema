import test from "node:test";
import assert from "node:assert/strict";
import { suggestCommands } from "../packages/core/src/command-suggester.js";

const COMMANDS = [
  { command: "status", description: "show Node0 readiness" },
  { command: "state", description: "Node0 state preview" },
  { command: "receipts", description: "list local receipts" },
  { command: "memory", description: "list local memory entries" },
  { command: "profiles", description: "profile foundation" },
  { command: "help", description: "show command list" },
  { command: "setup", description: "create local folders" },
  { command: "doctor", description: "validate readiness" },
  { command: "today", description: "record continuity tick" },
  { command: "models", description: "show local models" }
];

test("empty input → matched: unknown, no suggestions", () => {
  const result = suggestCommands("", COMMANDS);
  assert.equal(result.matched, "unknown");
  assert.deepEqual(result.suggestions, []);
  assert.equal(result.missingToken, "");
});

test("whitespace-only input → matched: unknown", () => {
  const result = suggestCommands("   ", COMMANDS);
  assert.equal(result.matched, "unknown");
  assert.equal(result.missingToken, "");
});

test("exact match 'status' → matched: exact, top suggestion = status", () => {
  const result = suggestCommands("status", COMMANDS);
  assert.equal(result.matched, "exact");
  assert.equal(result.suggestions[0].command, "status");
});

test("case-insensitive exact match 'STATUS' → matched: exact", () => {
  const result = suggestCommands("STATUS", COMMANDS);
  assert.equal(result.matched, "exact");
  assert.equal(result.suggestions[0].command, "status");
});

test("1-char typo 'staus' → matched: close, top suggestion = status", () => {
  const result = suggestCommands("staus", COMMANDS);
  assert.equal(result.matched, "close");
  assert.equal(result.suggestions[0].command, "status");
});

test("2-char typo 'recipts' → matched: close, top suggestion = receipts", () => {
  const result = suggestCommands("recipts", COMMANDS);
  assert.equal(result.matched, "close");
  assert.equal(result.suggestions[0].command, "receipts");
});

test("natural language 'tell me what is bizra' → matched: natural-language", () => {
  const result = suggestCommands("tell me what is bizra", COMMANDS);
  assert.equal(result.matched, "natural-language");
  const commands = result.suggestions.map((s) => s.command);
  assert.ok(commands.includes("memory show bizra-context"), "missing memory show bizra-context");
  assert.ok(commands.includes("help"), "missing help");
});

test("question mark detection 'what is bizra?' → matched: natural-language", () => {
  const result = suggestCommands("what is bizra?", COMMANDS);
  assert.equal(result.matched, "natural-language");
  const commands = result.suggestions.map((s) => s.command);
  assert.ok(commands.includes("memory show bizra-context"));
});

test("gibberish 'xyzqwerty' → matched: unknown, no suggestions", () => {
  const result = suggestCommands("xyzqwerty", COMMANDS);
  assert.equal(result.matched, "unknown");
  assert.deepEqual(result.suggestions, []);
});

test("trimmed whitespace '  status  ' → matched: exact", () => {
  const result = suggestCommands("  status  ", COMMANDS);
  assert.equal(result.matched, "exact");
  assert.equal(result.suggestions[0].command, "status");
});

test("partial prefix 'stat' → matched: close, includes status and state", () => {
  // 'stat' vs 'status' = dist 2; 'stat' vs 'state' = dist 1
  const result = suggestCommands("stat", COMMANDS);
  assert.equal(result.matched, "close");
  const cmds = result.suggestions.map((s) => s.command);
  assert.ok(cmds.includes("state"), "should include state");
  assert.ok(cmds.includes("status"), "should include status");
});

test("top 3 max: many close matches still returns at most 3 suggestions", () => {
  // Build a registry with 5 entries all distance 1 from 'x'
  const many = ["xa", "xb", "xc", "xd", "xe"].map((c) => ({ command: c, description: c }));
  const result = suggestCommands("x", many);
  assert.ok(result.suggestions.length <= 3, "must not exceed 3 suggestions");
});

test("natural-language starter 'how' → matched: natural-language", () => {
  const result = suggestCommands("how do I do this", COMMANDS);
  assert.equal(result.matched, "natural-language");
});

test("missingToken is the first whitespace-split word", () => {
  const result = suggestCommands("tell me what", COMMANDS);
  assert.equal(result.missingToken, "tell");
});

test("originalInput is the trimmed full string", () => {
  const result = suggestCommands("  staus  ", COMMANDS);
  assert.equal(result.originalInput, "staus");
});
