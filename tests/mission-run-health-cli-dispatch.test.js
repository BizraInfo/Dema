import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { HEALTH_MISSION_CONSENT_PHRASE } from "../packages/mission/src/health-snapshot.js";

const repoRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const demaBin = join(repoRoot, "bin", "dema");

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-health-cli-dispatch-"));
}

function runDema(args, { demaHome } = {}) {
  return spawnSync(process.execPath, [demaBin, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(demaHome ? { DEMA_HOME: demaHome } : {}),
    },
  });
}

function parseStdout(result) {
  assert.notEqual(result.stdout.trim(), "", `expected JSON stdout; stderr=${result.stderr}`);
  return JSON.parse(result.stdout);
}

async function receiptNames(home) {
  try {
    return (await readdir(join(home, "receipts"))).filter((name) => name.endsWith(".json"));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

describe("dema mission run health dispatch", () => {
  it("routes a no-consent dry run to the health snapshot path", async () => {
    const home = await freshHome();
    const result = runDema(
      ["mission", "run", "health", "--dry-run", "--json"],
      { demaHome: home },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const body = parseStdout(result);
    assert.equal(body.schema, "bizra.dema.mission_receipt.health_snapshot.v0.1");
    assert.equal(body.saved, false);
    assert.equal(body.reason, "dry_run");
    assert.equal(body.dry_run, true);
    assert.equal((await receiptNames(home)).length, 0);
  });

  it("returns the typed health consent refusal instead of treating health as a file", async () => {
    const home = await freshHome();
    const result = runDema(["mission", "run", "health", "--json"], {
      demaHome: home,
    });

    assert.equal(result.status, 1, result.stderr || result.stdout);
    const body = parseStdout(result);
    assert.equal(body.saved, false);
    assert.equal(body.reason, "consent_phrase_mismatch");
    assert.equal(body.required_phrase, HEALTH_MISSION_CONSENT_PHRASE);
    assert.equal(body.reason_code, undefined);
    assert.equal((await receiptNames(home)).length, 0);
  });

  it("writes exactly one health receipt under exact consent", async () => {
    const home = await freshHome();
    const result = runDema(
      [
        "mission",
        "run",
        "health",
        "--consent",
        HEALTH_MISSION_CONSENT_PHRASE,
        "--json",
      ],
      { demaHome: home },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const body = parseStdout(result);
    assert.equal(body.saved, true);
    assert.equal(body.reason, "consent_verified");
    assert.equal(body.attests.consent_verified, true);
    assert.equal(body.attests.boundary.filesystem_write_performed, true);
    assert.equal(body.attests.boundary.consent_collected, true);
    assert.equal(body.path.startsWith(join(home, "receipts")), true);
    assert.deepEqual(await receiptNames(home), [body.path.split("/").at(-1)]);
  });

  it("preserves the generic mission run file route", async () => {
    const home = await freshHome();
    const fixtureDir = join(home, "fixture");
    const fixturePath = join(fixtureDir, "mission.txt");
    await mkdir(fixtureDir, { recursive: true });
    await writeFile(fixturePath, "bounded local mission\n", "utf8");

    const result = runDema(["mission", "run", fixturePath, "--json"], {
      demaHome: home,
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const body = parseStdout(result);
    assert.equal(body.preview_only, true);
    assert.equal(body.file, fixturePath);
    assert.equal(body.pulse_status, "sealed");
    assert.equal(body.authority_delta, 0);
    assert.equal(body.mint_allowed, false);
    assert.equal(body.saved, undefined);
  });
});
