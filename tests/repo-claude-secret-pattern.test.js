// CONFIG-SLICE-A — secret-shaped content predicate (TASK-038).
//
// The gate this backs (scripts/review/repo-claude-config-check.mjs, gate 35 of
// `npm run check`) fails closed, so a false positive there blinds every gate
// after it. It shipped with no test at all: an unanchored `sk-[A-Za-z0-9]{10}`
// matched "sk-finalizati" inside the ordinary prose "task-finalization".
//
// Both halves are asserted here on purpose. Narrowing a secret pattern is only
// safe if the narrowing is proven not to be a weakening, so the true-positive
// block below is as load-bearing as the false-positive block.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  SECRET_PATTERN,
  hasSecretPattern,
} from "../scripts/review/secret-pattern.js";

// ── false positives: ordinary prose must not read as a credential ────────────

// The exact line that failed the gate, verbatim from
// .claude/agents/project-manager-backlog.md.
const REAL_GATE_LINE =
  "   - `backlog instructions task-finalization` before checking acceptance criteria, writing final summaries, or moving tasks to terminal statuses";

test("hasSecretPattern: the real line that failed gate 35 is not secret-shaped", () => {
  assert.equal(
    hasSecretPattern(REAL_GATE_LINE),
    false,
    `matched: ${JSON.stringify(REAL_GATE_LINE.match(SECRET_PATTERN)?.[0])}`,
  );
});

// Every one of these ends a word with "sk" or "hp" and is followed by a
// separator plus ten or more alphanumerics — the shape that tripped the gate.
for (const word of [
  "task-finalization",
  "risk-management",
  "disk-utilization",
  "task-finalization-guide",
  "brisk-performance",
]) {
  test(`hasSecretPattern: "${word}" is prose, not a credential`, () => {
    assert.equal(hasSecretPattern(word), false);
  });
}

test("hasSecretPattern: empty and nullish input is not secret-shaped", () => {
  assert.equal(hasSecretPattern(""), false);
  assert.equal(hasSecretPattern(null), false);
  assert.equal(hasSecretPattern(undefined), false);
});

// ── true positives: the narrowing must not weaken detection ──────────────────

for (const [label, text] of [
  ["openai project key", "sk-proj-abcdefghij1234567890"],
  ["anthropic key", "sk-ant-api03-abcdefghij1234567890"],
  ["github classic PAT", "ghp_abcdefghij1234567890"],
  ["named env var", "GITHUB_TOKEN=abc123"],
  ["openai env var", "OPENAI_API_KEY: abc123"],
  ["anthropic env var", "ANTHROPIC_API_KEY=abc123"],
  ["pem header", "-----BEGIN RSA PRIVATE KEY-----"],
]) {
  test(`hasSecretPattern: still catches ${label}`, () => {
    assert.equal(hasSecretPattern(text), true);
  });
}

// A real key is always at a token boundary — start of line, after whitespace,
// after `=`, `:`, a quote, or a comma. None of those are alphanumeric, so the
// lookbehind must not suppress any of them.
for (const [label, text] of [
  ["line start", "sk-proj-abcdefghij"],
  ["after equals", "OPENAI_KEY=sk-proj-abcdefghij"],
  ["after colon-space", "key: sk-proj-abcdefghij"],
  ["in double quotes", '{"key":"sk-proj-abcdefghij"}'],
  ["in single quotes", "key='sk-proj-abcdefghij'"],
  ["after comma", "a,sk-proj-abcdefghij"],
  ["after newline", "line one\nsk-proj-abcdefghij"],
  ["export form", "export ANTHROPIC_KEY=sk-ant-abcdefghij"],
]) {
  test(`hasSecretPattern: catches a key at a token boundary — ${label}`, () => {
    assert.equal(hasSecretPattern(text), true, text);
  });
}

test("hasSecretPattern: case-insensitive on the named vars", () => {
  assert.equal(hasSecretPattern("github_token=abc"), true);
  assert.equal(hasSecretPattern("private key"), true);
});

test("SECRET_PATTERN: exported for gate reuse and is a regexp", () => {
  assert.ok(SECRET_PATTERN instanceof RegExp);
  assert.ok(SECRET_PATTERN.flags.includes("i"));
});
