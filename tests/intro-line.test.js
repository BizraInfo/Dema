import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  shouldShowIntro,
  renderIntroLine,
  recordIntroSeen,
} from "../packages/core/src/intro-line.js";

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-intro-test-"));
}

async function cleanup(home) {
  await rm(home, { recursive: true, force: true });
}

async function writeCounter(home, data) {
  await mkdir(join(home, "state"), { recursive: true });
  await writeFile(
    join(home, "state", "intro-seen-count.json"),
    JSON.stringify(data, null, 2) + "\n",
    "utf8",
  );
}

async function writeProfile(home, data) {
  await writeFile(
    join(home, "profile.json"),
    JSON.stringify(data, null, 2) + "\n",
    "utf8",
  );
}

test("first-time: no counter, no receipts → shouldShowIntro returns true", async () => {
  const home = await freshHome();
  try {
    const result = await shouldShowIntro({ home, now: new Date() });
    assert.equal(result, true);
  } finally {
    await cleanup(home);
  }
});

test("counter at 3 (SUPPRESS_AFTER) → shouldShowIntro returns false", async () => {
  const home = await freshHome();
  try {
    await writeCounter(home, {
      schema: "bizra.dema.intro_state.v0.1",
      seenCount: 3,
      lastSeen: new Date().toISOString(),
      suppressedBy: "count-cap",
    });
    const result = await shouldShowIntro({ home, now: new Date() });
    assert.equal(result, false);
  } finally {
    await cleanup(home);
  }
});

test("counter.suppressedBy='user-explain' → shouldShowIntro returns false", async () => {
  const home = await freshHome();
  try {
    await writeCounter(home, {
      schema: "bizra.dema.intro_state.v0.1",
      seenCount: 1,
      lastSeen: new Date().toISOString(),
      suppressedBy: "user-explain",
    });
    const result = await shouldShowIntro({ home, now: new Date() });
    assert.equal(result, false);
  } finally {
    await cleanup(home);
  }
});

test("young profile (within 7 days) + no counter → shouldShowIntro returns true", async () => {
  const home = await freshHome();
  try {
    // Write a receipt so the 0-receipt shortcut doesn't fire alone
    await mkdir(join(home, "receipts"), { recursive: true });
    await writeFile(join(home, "receipts", "r1.json"), "{}", "utf8");
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    await writeProfile(home, {
      preferred_name: "Tester",
      created_at: recentDate.toISOString(),
    });
    const result = await shouldShowIntro({ home, now: new Date() });
    assert.equal(result, true);
  } finally {
    await cleanup(home);
  }
});

test("old profile (>7 days) + counter at 3 → shouldShowIntro returns false", async () => {
  const home = await freshHome();
  try {
    const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    await writeProfile(home, {
      preferred_name: "Tester",
      created_at: oldDate.toISOString(),
    });
    await writeCounter(home, {
      schema: "bizra.dema.intro_state.v0.1",
      seenCount: 3,
      lastSeen: new Date().toISOString(),
      suppressedBy: "count-cap",
    });
    const result = await shouldShowIntro({ home, now: new Date() });
    assert.equal(result, false);
  } finally {
    await cleanup(home);
  }
});

test("recordIntroSeen creates the counter file with proper schema", async () => {
  const home = await freshHome();
  try {
    const now = new Date("2026-05-19T10:00:00.000Z");
    await recordIntroSeen({ home, now });
    const raw = await readFile(
      join(home, "state", "intro-seen-count.json"),
      "utf8",
    );
    const parsed = JSON.parse(raw);
    assert.equal(parsed.schema, "bizra.dema.intro_state.v0.1");
    assert.equal(parsed.seenCount, 1);
    assert.equal(parsed.lastSeen, "2026-05-19T10:00:00.000Z");
    assert.equal(typeof parsed.suppressedBy, "object"); // null
  } finally {
    await cleanup(home);
  }
});

test("counter already at 3 → recordIntroSeen increments to 4, shouldShowIntro still false", async () => {
  const home = await freshHome();
  try {
    await writeCounter(home, {
      schema: "bizra.dema.intro_state.v0.1",
      seenCount: 3,
      lastSeen: new Date().toISOString(),
      suppressedBy: "count-cap",
    });
    await recordIntroSeen({ home, now: new Date() });
    const raw = await readFile(
      join(home, "state", "intro-seen-count.json"),
      "utf8",
    );
    const parsed = JSON.parse(raw);
    assert.equal(parsed.seenCount, 4);
    const show = await shouldShowIntro({ home, now: new Date() });
    assert.equal(show, false);
  } finally {
    await cleanup(home);
  }
});

test("malformed counter file → graceful default: shouldShowIntro returns true", async () => {
  const home = await freshHome();
  try {
    await mkdir(join(home, "state"), { recursive: true });
    await writeFile(
      join(home, "state", "intro-seen-count.json"),
      "NOT JSON }{",
      "utf8",
    );
    const result = await shouldShowIntro({ home, now: new Date() });
    assert.equal(result, true);
  } finally {
    await cleanup(home);
  }
});

test("renderIntroLine returns the three canonical intro lines", () => {
  const text = renderIntroLine();
  assert.ok(text.includes("local-first sovereign-AI node companion"));
  assert.ok(text.includes("what is true, what is safe, what is blocked"));
  assert.ok(text.includes("`dema explain dema`"));
  const lines = text.split("\n");
  assert.equal(lines.length, 3);
});
