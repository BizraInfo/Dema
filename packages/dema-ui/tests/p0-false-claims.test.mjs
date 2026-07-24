// P0 false-claims static scan. Pure text checks against source — no imports,
// no execution, no module resolution needed. Run: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

test("diagnostic.ts does not reuse the real shipped FDE kernel id", () => {
  const src = read("src/lib/game/diagnostic.ts");
  assert.equal(
    src.includes("DEMA-FDE-DUAL-DIAGNOSTIC-1A"),
    false,
    "diagnostic.ts must not contain the real shipped kernel id string"
  );
});

test("melae.ts review personas are not branded Node0/Dema", () => {
  const src = read("src/lib/game/melae.ts");
  assert.equal(
    /role:\s*"(Node0|Dema)"/.test(src),
    false,
    "melae.ts ReviewAgent.role must not be the literal string Node0 or Dema"
  );
});

test("store.ts has no Math.random() near hash/receipt/sealed/verified vocabulary", () => {
  const src = read("src/lib/game/store.ts");
  const lines = src.split("\n");
  const forbidden = /\b(hash|receipt|sealed|verified)\b/i;
  const WINDOW = 2;
  const offenders = [];
  lines.forEach((line, i) => {
    if (!/Math\.random\(/.test(line)) return;
    const lo = Math.max(0, i - WINDOW);
    const hi = Math.min(lines.length - 1, i + WINDOW);
    for (let j = lo; j <= hi; j++) {
      if (forbidden.test(lines[j])) {
        offenders.push({ mathRandomLine: i + 1, matchLine: j + 1, text: lines[j].trim() });
        break;
      }
    }
  });
  assert.deepEqual(
    offenders,
    [],
    `Math.random() found within ${WINDOW} lines of hash/receipt/sealed/verified: ${JSON.stringify(offenders)}`
  );
});

test("store.ts no longer has a RANDOM_HASH generator", () => {
  const src = read("src/lib/game/store.ts");
  assert.equal(src.includes("RANDOM_HASH"), false, "RANDOM_HASH must be removed/renamed");
});
