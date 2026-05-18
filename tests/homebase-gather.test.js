import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, utimes } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { gather } from "../packages/core/src/homebase-gather.js";

async function makeHome(seed = {}) {
  const home = await mkdtemp(join(tmpdir(), "dema-homebase-gather-"));
  if (seed.profile !== undefined) {
    await writeFile(join(home, "profile.json"), JSON.stringify(seed.profile));
  }
  if (seed.memoryFiles) {
    await mkdir(join(home, "memory"), { recursive: true });
    for (const [name, body, mtimeMs] of seed.memoryFiles) {
      const path = join(home, "memory", name);
      await writeFile(path, typeof body === "string" ? body : JSON.stringify(body));
      if (mtimeMs != null) {
        const t = new Date(mtimeMs);
        await utimes(path, t, t);
      }
    }
  }
  return home;
}

async function tearDown(home) {
  await rm(home, { recursive: true, force: true });
}

test("TDD-15: gather() resolves with valid GatherResult when ~/.dema/ does not exist", async () => {
  const home = join(tmpdir(), `dema-homebase-gather-missing-${process.pid}-${Date.now()}`);
  const result = await gather({ home });
  assert.equal(result.schema_version, "bizra.dema.homebase_gather.v0.1");
  assert.equal(result.profile.source_present, false);
  assert.equal(result.profile.name, null);
  assert.equal(result.profile.node, "Node0");
  assert.deepEqual(result.memory_recent, []);
  assert.equal(Array.isArray(result.warnings), true);
  assert.ok(result.ts instanceof Date);
});

test("TDD-16: gather() respects DEMA_HOME via opts.home + reads profile.name", async () => {
  const home = await makeHome({ profile: { name: "Mumu", node: "Node0" } });
  try {
    const result = await gather({ home });
    assert.equal(result.profile.source_present, true);
    assert.equal(result.profile.name, "Mumu");
    assert.equal(result.profile.node, "Node0");
  } finally {
    await tearDown(home);
  }
});

test("TDD-17: gather() with 50 memory entries returns exactly 3 in memory_recent (most recent by mtime)", async () => {
  const base = Date.now() - 60 * 60 * 1000;
  const memoryFiles = [];
  for (let i = 0; i < 50; i++) {
    memoryFiles.push([
      `entry-${String(i).padStart(2, "0")}.json`,
      { summary: `entry ${i}` },
      base + i * 1000,
    ]);
  }
  const home = await makeHome({ memoryFiles });
  try {
    const result = await gather({ home });
    assert.equal(result.memory_recent.length, 3);
    assert.equal(result.memory_recent[0].name, "entry-49");
    assert.equal(result.memory_recent[1].name, "entry-48");
    assert.equal(result.memory_recent[2].name, "entry-47");
    assert.equal(result.memory_recent[0].summary, "entry 49");
    assert.ok(
      result.memory_recent[0].mtime_ms >= result.memory_recent[1].mtime_ms,
      "memory_recent must be sorted by mtime descending",
    );
  } finally {
    await tearDown(home);
  }
});

test("TDD-18: gather() with malformed JSON in memory returns partial: true and warnings non-empty", async () => {
  const home = await makeHome({
    memoryFiles: [
      ["good.json", { summary: "ok" }, Date.now()],
      ["broken.json", "{not valid json", Date.now() - 1000],
    ],
  });
  try {
    const result = await gather({ home });
    assert.equal(result.partial, true);
    assert.ok(result.warnings.length > 0, "warnings must be non-empty when memory entry is malformed");
    assert.ok(
      result.warnings.some((w) => w.includes("broken.json") || w.toLowerCase().includes("json")),
      "warning must reference the malformed file or json error",
    );
    assert.equal(result.memory_recent.length, 1, "only the valid entry surfaces");
    assert.equal(result.memory_recent[0].name, "good");
  } finally {
    await tearDown(home);
  }
});

test("TDD-19: gather() never throws · always returns · regardless of disk chaos", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-homebase-gather-chaos-"));
  await writeFile(join(home, "profile.json"), "{not valid json either");
  await writeFile(join(home, "memory"), "this is a file, not a directory");
  try {
    const result = await gather({ home });
    assert.equal(result.schema_version, "bizra.dema.homebase_gather.v0.1");
    assert.equal(result.partial, true);
    assert.ok(Array.isArray(result.warnings));
    assert.deepEqual(result.memory_recent, []);
    assert.ok(result.env_flags && typeof result.env_flags.tty === "boolean");
  } finally {
    await tearDown(home);
  }
});

test("ISSUE-2: gather() surfaces real receipts populated under <home>/receipts/", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-homebase-gather-receipts-"));
  await mkdir(join(home, "receipts"), { recursive: true });
  await writeFile(
    join(home, "receipts", "01_alpha.json"),
    JSON.stringify({ receipt_id: "alpha-001", artifact_id: "art-1", action: "test", created_at: "2026-05-18T00:00:00Z" }),
  );
  await writeFile(
    join(home, "receipts", "02_beta.json"),
    JSON.stringify({ receipt_id: "beta-002", artifact_id: "art-2", action: "test", created_at: "2026-05-18T01:00:00Z" }),
  );
  try {
    const result = await gather({ home });
    assert.equal(result.receipts.count, 2);
    assert.equal(result.receipts.last_id, "beta-002");
    assert.equal(result.receipts.gateway_issued, 0);
  } finally {
    await tearDown(home);
  }
});

test("ISSUE-1: gather() warns + sets partial when receipts path exists but is not a directory", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-homebase-gather-receipts-bad-"));
  await writeFile(join(home, "receipts"), "this is a file, not a directory");
  try {
    const result = await gather({ home });
    assert.equal(result.partial, true);
    assert.ok(
      result.warnings.some((w) => w.toLowerCase().includes("receipts")),
      `expected a receipts warning · got: ${JSON.stringify(result.warnings)}`,
    );
    assert.equal(result.receipts.count, 0);
    assert.equal(result.receipts.last_id, null);
  } finally {
    await tearDown(home);
  }
});

test("ISSUE-5: gather() pushes informational warning when ~/.dema/memory directory is missing", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-homebase-gather-no-mem-"));
  await writeFile(join(home, "profile.json"), JSON.stringify({ name: "Mumu" }));
  try {
    const result = await gather({ home });
    assert.ok(
      result.warnings.some((w) => w.includes("no ~/.dema/memory directory")),
      `expected memory-missing warning · got: ${JSON.stringify(result.warnings)}`,
    );
    assert.deepEqual(result.memory_recent, []);
  } finally {
    await tearDown(home);
  }
});
