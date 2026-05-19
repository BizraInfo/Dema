// Genesis Preview Card CLI integration tests — ADR-011 phase-3
//
// Tests the `dema onboard --preview-card` and `dema preview-card show` surfaces
// via subprocess invocations with isolated DEMA_HOME temp dirs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const CLI_PATH = new URL("../apps/cli/src/index.js", import.meta.url).pathname;
const NODE = process.execPath;

async function makeTmpHome() {
  return mkdtemp(join(tmpdir(), "dema-genesis-card-cli-"));
}

async function runCli(args, home) {
  const env = { ...process.env, DEMA_HOME: home, NODE_ENV: "test" };
  try {
    const { stdout, stderr } = await execFileAsync(NODE, [CLI_PATH, ...args], {
      env,
      timeout: 10000,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err) {
    return { stdout: err.stdout ?? "", stderr: err.stderr ?? "", exitCode: err.code ?? 1 };
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test("dema onboard --preview-card with empty DEMA_HOME emits card with schema field", async () => {
  const home = await makeTmpHome();
  try {
    const { stdout } = await runCli(["onboard", "--preview-card", "--json"], home);
    const card = JSON.parse(stdout);
    assert.equal(card.schema, "bizra.dema.genesis_preview_card.v0.1");
    assert.equal(card.mode, "preview_only");
    assert.equal(card.truth_label, "NODE0_LOCAL_SEED");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("dema onboard --preview-card --json contains would_mint_if_consented.receipt_id_preview", async () => {
  const home = await makeTmpHome();
  try {
    const { stdout } = await runCli(["onboard", "--preview-card", "--json"], home);
    const card = JSON.parse(stdout);
    assert.ok(typeof card.would_mint_if_consented.receipt_id_preview === "string");
    assert.match(card.would_mint_if_consented.receipt_id_preview, /^[0-9a-f]{64}$/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("CLI determinism: same profile across two invocations → same receipt_id_preview hash", async () => {
  const home = await makeTmpHome();
  try {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ schema: "bizra.dema.profile.v0.1", language_code: "en", preferred_name: "Test" })
    );

    const { stdout: out1 } = await runCli(["onboard", "--preview-card", "--json"], home);
    const { stdout: out2 } = await runCli(["onboard", "--preview-card", "--json"], home);
    const card1 = JSON.parse(out1);
    const card2 = JSON.parse(out2);
    assert.equal(
      card1.would_mint_if_consented.receipt_id_preview,
      card2.would_mint_if_consented.receipt_id_preview,
      "receipt_id_preview must be stable across consecutive CLI invocations with the same profile"
    );
    // rendered_at may differ between calls; that is expected and correct
    assert.equal(typeof card1.rendered_at, "string");
    assert.equal(typeof card2.rendered_at, "string");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("dema preview-card show with empty state → 'no preview cards stored yet'", async () => {
  const home = await makeTmpHome();
  try {
    const { stdout } = await runCli(["preview-card", "show"], home);
    assert.ok(stdout.includes("no preview cards stored yet"));
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("After running dema onboard --preview-card, preview-card show lists the written card", async () => {
  const home = await makeTmpHome();
  try {
    const { stdout: cardJson } = await runCli(["onboard", "--preview-card", "--json"], home);
    const card = JSON.parse(cardJson);
    const hash = card.would_mint_if_consented.receipt_id_preview;

    const { stdout: listOut } = await runCli(["preview-card", "show"], home);
    assert.ok(listOut.includes(hash), "list output must include the written card's hash");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("dema preview-card show <bad-hash> → graceful 'card not found'", async () => {
  const home = await makeTmpHome();
  try {
    const badHash = "a".repeat(64);
    const { stdout } = await runCli(["preview-card", "show", badHash], home);
    assert.ok(stdout.includes("not found"));
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
