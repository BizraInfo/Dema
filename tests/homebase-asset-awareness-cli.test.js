import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));
const CONSENT = "GO: scan homebase metadata only";

function freshFixture() {
  const root = mkdtempSync(join(tmpdir(), "hb-asset-cli-"));
  mkdirSync(join(root, "proofs"), { recursive: true });
  mkdirSync(join(root, "app"), { recursive: true });
  writeFileSync(join(root, "proofs", "impact-receipt.json"), '{"x":1}\n');
  writeFileSync(join(root, "app", "package.json"), '{"private":true}\n');
  writeFileSync(join(root, ".env"), "SECRET=true\n");
  return root;
}

function scan(args, env = {}) {
  return execFileSync("node", [BIN, "assets", "scan", ...args], {
    encoding: "utf8",
    env: { ...process.env, DEMA_BANNER_INTERACTIVE: "0", DEMA_NO_TUI: "1", ...env },
  });
}

function inventoryExists(home) {
  return existsSync(join(home, "realm", "local-assets", "inventory-v0.1.json"));
}

test("dema assets scan requires consent before scanning or writing inventory", () => {
  const root = freshFixture();
  const home = mkdtempSync(join(tmpdir(), "hb-asset-home-"));
  try {
    const output = JSON.parse(scan(["--root", root, "--json"], { DEMA_HOME: home }));
    assert.equal(output.scan_allowed, false);
    assert.equal(output.scan_performed, false);
    assert.equal(output.scan_result, null);
    assert.equal(output.boundary.homebase_scan_performed, false);
    assert.equal(inventoryExists(home), false);
    const human = scan(["--root", root], { DEMA_HOME: home });
    assert.match(human, /GO: scan homebase metadata only/);
    assert.match(human, /NOT read file contents/i);
    assert.equal(inventoryExists(home), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("wrong assets scan consent exits non-zero without writing inventory", () => {
  const root = freshFixture();
  const home = mkdtempSync(join(tmpdir(), "hb-asset-home-"));
  try {
    assert.throws(
      () => scan(["--root", root, "--consent", "scan please"], { DEMA_HOME: home }),
      (error) => error.status === 1,
    );
    assert.equal(inventoryExists(home), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("exact consent lets assets scan emit awareness and write inventory", () => {
  const root = freshFixture();
  const home = mkdtempSync(join(tmpdir(), "hb-asset-home-"));
  try {
    const out = scan(["--root", root, "--consent", CONSENT, "--json"], {
      DEMA_HOME: home,
    });
    const j = JSON.parse(out);
    assert.equal(j.consent_verified, true);
    assert.equal(j.scan_performed, true);
    assert.equal(j.schema, "bizra.dema.homebase_asset_awareness.v0.1");
    assert.equal(j.truth_label, "DEMA_HOMEBASE_ASSET_AWARENESS_METADATA_ONLY");
    assert.equal(j.boundary.file_content_read, false);
    assert.equal(j.boundary.network_used, false);
    assert.equal(j.boundary.scanned_root_mutated, false);
    assert.ok(Array.isArray(j.clusters));
    assert.ok(Array.isArray(j.hidden_gem_candidates));
    assert.ok(Array.isArray(j.monetization_candidates));
    assert.ok(Array.isArray(j.risk_flags));
    assert.equal(j.inventory_write?.written, true);
    assert.equal(inventoryExists(home), true);
    const raw = JSON.stringify(j);
    assert.equal(raw.includes("SECRET=true"), false);
    assert.equal(raw.includes(".env"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("human summary discloses metadata-only boundary and gem counts", () => {
  const root = freshFixture();
  const home = mkdtempSync(join(tmpdir(), "hb-asset-home-"));
  try {
    const out = scan(["--root", root, "--consent", CONSENT], {
      DEMA_HOME: home,
    });
    assert.match(out, /metadata only/i);
    assert.match(out, /hidden gems/i);
    assert.match(out, /no content/i);
    assert.match(out, /no network/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("missing --root exits non-zero", () => {
  assert.throws(() => scan([]), (err) => err.status !== 0);
});
