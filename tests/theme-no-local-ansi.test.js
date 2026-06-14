import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const FILES = [
  "packages/core/src/dema-realm-world-map.js",
  "packages/core/src/dema-realm-board.js",
  "packages/core/src/dema-realm-status.js",
];

describe("theme drift guard", () => {
  for (const rel of FILES) {
    it(`${rel} defines no local truecolor and imports theme.js`, () => {
      const src = readFileSync(join(here, "..", rel), "utf8");
      // Match the LITERAL characters `\x1b[38;2;` as they appear in source text
      // (escaped backslash), not the 0x1B escape byte — source files store the
      // sequence as the 4 chars \ x 1 b, so a byte-class regex would never fire.
      assert.doesNotMatch(
        src,
        /\\x1b\[38;2;/,
        "found a hardcoded truecolor escape",
      );
      assert.doesNotMatch(src, /const ANSI\s*=/, "found a local ANSI block");
      assert.match(src, /from "\.\/theme\.js"/, "missing theme.js import");
    });
  }
});
