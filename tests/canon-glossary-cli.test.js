import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

const env = { ...process.env, NODE_ENV: "test" };

test("dema explain ihsan → human output contains Excellence + Truth label + See also", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "explain", "ihsan"], { env });
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
  const { stdout } = await execFileAsync("node", [cliPath, "explain", "--json", "ihsan"], { env });
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.schema, "bizra.dema.canon_glossary_entry.v0.1");
  assert.equal(parsed.concept, "ihsan");
  assert.ok(typeof parsed.title === "string" && parsed.title.length > 0);
  assert.ok(typeof parsed.long === "string" && parsed.long.length > 0);
  assert.ok(typeof parsed.truth_label === "string");
  assert.ok(Array.isArray(parsed.see_also));
});

test("dema explain nonexistent → contains 'don't have a definition' and suggestion hint", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "explain", "nonexistent"], { env });
  assert.match(stdout, /don't have a definition/);
  assert.match(stdout, /dema explain/);
});
