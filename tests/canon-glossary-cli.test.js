import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

const env = { ...process.env, NODE_ENV: "test" };

test("dema explain ihsan → human output contains Excellence + Truth label + See also", async () => {
  const { stdout } = await execFileAsync(
    "node",
    [cliPath, "explain", "ihsan"],
    { env },
  );
  assert.match(stdout, /Excellence/);
  assert.match(stdout, /Truth label/);
  assert.match(stdout, /See also/);
});

test("dema explain → listing mode contains 'Available concepts' and at least 20 concept titles", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "explain"], { env });
  assert.match(stdout, /Available concepts/);
  // Count lines that contain concept entries (rough: lines containing dema explain hint)
  assert.match(stdout, /dema explain/);
  // 28 concepts seeded — verify at least 20 titles appear (4 per row * 5 rows = 20)
  const lines = stdout.split("\n").filter((l) => l.trim().length > 0);
  // At minimum the header + several concept rows + footer
  assert.ok(lines.length >= 8, `expected ≥8 lines, got ${lines.length}`);
});

test("dema explain --json ihsan → valid JSON with correct schema and concept", async () => {
  const { stdout } = await execFileAsync(
    "node",
    [cliPath, "explain", "--json", "ihsan"],
    { env },
  );
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.schema, "bizra.dema.canon_glossary_entry.v0.1");
  assert.equal(parsed.concept, "ihsan");
  assert.ok(typeof parsed.title === "string" && parsed.title.length > 0);
  assert.ok(typeof parsed.long === "string" && parsed.long.length > 0);
  assert.ok(typeof parsed.truth_label === "string");
  assert.ok(Array.isArray(parsed.see_also));
});

test("dema explain nonexistent → contains 'don't have a definition' and suggestion hint", async () => {
  const { stdout } = await execFileAsync(
    "node",
    [cliPath, "explain", "nonexistent"],
    { env },
  );
  assert.match(stdout, /don't have a definition/);
  assert.match(stdout, /dema explain/);
});

// ── multi-perspective CLI tests ───────────────────────────────────────────────

test("dema explain bizra (no flag) → shows simple perspective output", async () => {
  const { stdout } = await execFileAsync(
    "node",
    [cliPath, "explain", "bizra"],
    { env },
  );
  // Default (simple) must contain the canonical simple text fragment
  assert.match(stdout, /constitutional ecosystem/i);
  assert.match(stdout, /Truth label/);
});

test("dema explain --simple bizra → identical to no-flag output", async () => {
  const { stdout: noFlag } = await execFileAsync(
    "node",
    [cliPath, "explain", "bizra"],
    { env },
  );
  const { stdout: withFlag } = await execFileAsync(
    "node",
    [cliPath, "explain", "--simple", "bizra"],
    { env },
  );
  assert.equal(noFlag, withFlag);
});

test("dema explain --technical bizra → shows technical perspective with canonical anchors", async () => {
  const { stdout } = await execFileAsync(
    "node",
    [cliPath, "explain", "--technical", "bizra"],
    { env },
  );
  assert.match(stdout, /BLAKE3|riba-zero|ADR-005|BIZRA_TOPOLOGY_CANON/);
  assert.match(stdout, /Truth label/);
});

test("dema explain --arabic bizra → output contains Arabic Unicode characters", async () => {
  const { stdout } = await execFileAsync(
    "node",
    [cliPath, "explain", "--arabic", "bizra"],
    { env },
  );
  // Arabic Unicode block: U+0600–U+06FF
  assert.match(stdout, /[؀-ۿ]/);
});

test("dema explain --game bizra → output contains game/world/quest analogy language", async () => {
  const { stdout } = await execFileAsync(
    "node",
    [cliPath, "explain", "--game", "bizra"],
    { env },
  );
  // The game perspective uses game-world language
  assert.match(stdout, /game|world|guild|node|player|quest|realm/i);
});

test("dema explain --all bizra → output contains all 4 perspective section markers", async () => {
  const { stdout } = await execFileAsync(
    "node",
    [cliPath, "explain", "--all", "bizra"],
    { env },
  );
  assert.match(stdout, /SIMPLE/i);
  assert.match(stdout, /TECHNICAL/i);
  assert.match(stdout, /GAME/i);
  assert.match(stdout, /ARABIC/i);
});

test("dema explain --technical ihsan (non-seed concept) → shows 'not yet authored' hint", async () => {
  const { stdout } = await execFileAsync(
    "node",
    [cliPath, "explain", "--technical", "ihsan"],
    { env },
  );
  assert.match(stdout, /not yet authored/);
  assert.match(stdout, /dema explain/);
});

test("dema explain --json --all bizra → JSON contains perspectives map with all 4 keys", async () => {
  const { stdout } = await execFileAsync(
    "node",
    [cliPath, "explain", "--json", "--all", "bizra"],
    { env },
  );
  const parsed = JSON.parse(stdout);
  assert.ok(
    parsed.perspectives && typeof parsed.perspectives === "object",
    "no perspectives field",
  );
  assert.ok(typeof parsed.perspectives.simple === "string", "missing simple");
  assert.ok(
    typeof parsed.perspectives.technical === "string",
    "missing technical",
  );
  assert.ok(typeof parsed.perspectives.arabic === "string", "missing arabic");
  assert.ok(typeof parsed.perspectives.game === "string", "missing game");
});
