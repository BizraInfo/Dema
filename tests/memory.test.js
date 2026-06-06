import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  listMemoryEntries,
  readMemoryEntry,
  summarizeMemory,
} from "../packages/memory/src/memory-store.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

async function makeMemoryRoot() {
  const root = await mkdtemp(join(tmpdir(), "dema-memory-"));
  await mkdir(join(root, "memory"), { recursive: true });
  return root;
}

test("listMemoryEntries returns empty when nothing is populated", async () => {
  const root = await makeMemoryRoot();
  const entries = await listMemoryEntries(root);
  assert.deepEqual(entries, []);
});

test("listMemoryEntries surfaces profile + memory entries, sorted, excludes today.json", async () => {
  const root = await makeMemoryRoot();
  await writeFile(
    join(root, "profile.json"),
    JSON.stringify({
      schema: "bizra.dema.profile.v0.1",
      preferred_name: "Mumu",
    }),
  );
  await writeFile(
    join(root, "memory", "bizra-context.json"),
    JSON.stringify({ schema: "bizra.dema.project_memory.v0.1" }),
  );
  await writeFile(
    join(root, "memory", "space-env.json"),
    JSON.stringify({ schema: "bizra.dema.environment.v0.1" }),
  );
  await writeFile(
    join(root, "memory", "today.json"),
    JSON.stringify({ schema: "bizra.dema.today_tick.v0.1" }),
  );

  const entries = await listMemoryEntries(root);
  const names = entries.map((e) => e.name);
  assert.deepEqual(names, ["bizra-context", "profile", "space-env"]);
  assert.ok(!names.includes("today"));
});

test("readMemoryEntry returns the parsed JSON for a named entry", async () => {
  const root = await makeMemoryRoot();
  await writeFile(
    join(root, "memory", "bizra-context.json"),
    JSON.stringify({ project: "BIZRA Node0", stage: "SEED" }),
  );

  const entry = await readMemoryEntry("bizra-context", root);
  assert.equal(entry.project, "BIZRA Node0");
  assert.equal(entry.stage, "SEED");
});

test("readMemoryEntry resolves 'profile' to ~/.dema/profile.json", async () => {
  const root = await makeMemoryRoot();
  await writeFile(
    join(root, "profile.json"),
    JSON.stringify({
      schema: "bizra.dema.profile.v0.1",
      preferred_name: "Mumu",
    }),
  );

  const entry = await readMemoryEntry("profile", root);
  assert.equal(entry.preferred_name, "Mumu");
});

test("readMemoryEntry throws a clear error for missing entries", async () => {
  const root = await makeMemoryRoot();
  await assert.rejects(
    () => readMemoryEntry("nope", root),
    /Memory entry not found: nope/,
  );
});

test("readMemoryEntry rejects empty/non-string names", async () => {
  await assert.rejects(
    () => readMemoryEntry(""),
    /Memory entry name is required/,
  );
  await assert.rejects(
    () => readMemoryEntry(undefined),
    /Memory entry name is required/,
  );
});

test("readMemoryEntry rejects unsafe names (path traversal, separators, special chars)", async () => {
  const root = await makeMemoryRoot();
  const unsafe = [
    "../../../etc/passwd",
    "foo/bar",
    "foo\\bar",
    "..",
    ".hidden",
    "name with spaces",
    "name.with.dots",
    "name;injection",
    "/absolute/path",
  ];
  for (const name of unsafe) {
    await assert.rejects(
      () => readMemoryEntry(name, root),
      /Memory entry name must contain only letters, digits, hyphens, or underscores/,
      `expected unsafe name to be rejected: ${JSON.stringify(name)}`,
    );
  }
});

test("summarizeMemory returns a schema-tagged index", async () => {
  const root = await makeMemoryRoot();
  await writeFile(
    join(root, "memory", "bizra-context.json"),
    JSON.stringify({ x: 1 }),
  );

  const summary = await summarizeMemory(root);
  assert.equal(summary.schema, "bizra.dema.memory_index.v0.1");
  assert.equal(summary.root, root);
  assert.equal(summary.count, 1);
  assert.equal(summary.entries[0].name, "bizra-context");
});

test("dema memory CLI lists schema-tagged index when no subcommand given", async () => {
  const root = await makeMemoryRoot();
  await writeFile(
    join(root, "memory", "space-env.json"),
    JSON.stringify({ platform: "linux" }),
  );

  const { stdout } = await execFileAsync("node", [cliPath, "memory"], {
    env: { ...process.env, DEMA_HOME: root },
  });
  const output = JSON.parse(stdout);
  assert.equal(output.schema, "bizra.dema.memory_index.v0.1");
  assert.ok(output.entries.find((e) => e.name === "space-env"));
});

test("dema memory show CLI returns the named entry", async () => {
  const root = await makeMemoryRoot();
  await writeFile(
    join(root, "memory", "bizra-context.json"),
    JSON.stringify({ project: "BIZRA Node0", stage: "SEED" }),
  );

  const { stdout } = await execFileAsync(
    "node",
    [cliPath, "memory", "show", "bizra-context"],
    {
      env: { ...process.env, DEMA_HOME: root },
    },
  );
  const output = JSON.parse(stdout);
  assert.equal(output.project, "BIZRA Node0");
  assert.equal(output.stage, "SEED");
});

test("dema today CLI now includes a memory summary alongside the tick", async () => {
  const root = await makeMemoryRoot();
  await writeFile(
    join(root, "profile.json"),
    JSON.stringify({
      schema: "bizra.dema.profile.v0.1",
      preferred_name: "Mumu",
    }),
  );
  await writeFile(
    join(root, "memory", "bizra-context.json"),
    JSON.stringify({ project: "BIZRA Node0" }),
  );

  const { stdout } = await execFileAsync("node", [cliPath, "today", "--json"], {
    env: { ...process.env, DEMA_HOME: root },
  });
  const output = JSON.parse(stdout);
  assert.equal(output.tick.schema, "bizra.dema.today_tick.v0.1");
  assert.equal(output.memory.schema, "bizra.dema.memory_index.v0.1");
  const names = output.memory.entries.map((e) => e.name);
  assert.ok(names.includes("profile"));
  assert.ok(names.includes("bizra-context"));
});
