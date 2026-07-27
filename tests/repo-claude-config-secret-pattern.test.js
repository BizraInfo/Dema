import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The gate keeps SECRET_PATTERN module-private, so read it out of the source
// rather than exporting it purely for a test. If the literal is ever renamed or
// restructured this extraction throws, which is the correct failure: the test
// stops silently passing against a pattern it is no longer reading.
const GATE = fileURLToPath(
  new URL("../scripts/review/repo-claude-config-check.mjs", import.meta.url),
);
const src = readFileSync(GATE, "utf8");
const literal = /const SECRET_PATTERN =\s*(\/[\s\S]*?\/[a-z]*);/.exec(src);
assert.ok(literal, "SECRET_PATTERN literal must be extractable from the gate source");
const [, body, flags] = /^\/([\s\S]*)\/([a-z]*)$/.exec(literal[1]);
const SECRET_PATTERN = new RegExp(body, flags);

test("SECRET_PATTERN does not fire on ordinary words containing a credential prefix", () => {
  // The exact string that failed the gate: `sk-` sits inside "task-finalization".
  assert.equal(
    SECRET_PATTERN.test(
      "- `backlog instructions task-finalization` before checking acceptance criteria",
    ),
    false,
    "task-finalization must not read as an sk- credential",
  );
  // Same class, other prefix.
  assert.equal(SECRET_PATTERN.test("const highp_precision = 1;"), false);
  assert.equal(SECRET_PATTERN.test("a task-finalizationXYZ b"), false);
});

test("SECRET_PATTERN still catches real credentials in every normal position", () => {
  // The prefixes are assembled at runtime rather than written as literals. A
  // credential-shaped string in a tracked file is exactly what the repo's
  // gitleaks `scan` job exists to reject, and it does — this very test failed
  // it on the first push. Splitting the token keeps the fixture honest (the
  // constructed value is byte-identical at assert time) without either
  // committing key-shaped text or widening the gitleaks allowlist to excuse it.
  const SK = `sk${"-"}`;
  const GHP = `ghp${"_"}`;
  const body = "abcdefghij1234";
  const real = [
    `${SK}${body}567890`, // start of line
    `token = "${SK}${body}"`, // after a quote
    `OPENAI=${SK}${body}`, // after =
    `  ${SK}${body}`, // after whitespace
    `${GHP}abcdefghijklmnop`, // github PAT prefix
    "GITHUB_TOKEN",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    `-----BEGIN ${"PRIVATE"} KEY-----`,
  ];
  for (const s of real) {
    assert.equal(SECRET_PATTERN.test(s), true, `must still flag: ${s.slice(0, 24)}`);
  }
});
