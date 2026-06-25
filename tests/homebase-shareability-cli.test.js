import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

function freshFixture() {
  const root = mkdtempSync(join(tmpdir(), "hb-share-cli-"));
  mkdirSync(join(root, "proofs"), { recursive: true });
  mkdirSync(join(root, "app"), { recursive: true });
  mkdirSync(join(root, "family"), { recursive: true });
  writeFileSync(join(root, "proofs", "impact-receipt.json"), '{"x":1}\n');
  writeFileSync(join(root, "app", "package.json"), '{"private":true}\n');
  writeFileSync(join(root, "family", "photo.jpg"), "fake\n");
  writeFileSync(join(root, ".env"), "SECRET=true\n");
  return root;
}

function shareability(args, env = {}) {
  return execFileSync("node", [BIN, "assets", "shareability", ...args], {
    encoding: "utf8",
    env: { ...process.env, DEMA_BANNER_INTERACTIVE: "0", DEMA_NO_TUI: "1", ...env },
  });
}

test("dema assets shareability --json emits shareability schema and boundary", () => {
  const root = freshFixture();
  try {
    const out = shareability(["--root", root, "--json"]);
    const j = JSON.parse(out);
    assert.equal(j.schema, "bizra.dema.homebase_shareability.v0.1");
    assert.equal(j.truth_label, "DEMA_HOMEBASE_SHAREABILITY_METADATA_ONLY");
    assert.equal(j.boundary.file_content_read, false);
    assert.equal(j.boundary.network_used, false);
    assert.equal(j.boundary.urp_submission_performed, false);
    assert.ok(Array.isArray(j.cluster_assessments));
    assert.ok(j.shareability_summary);
    assert.ok(Array.isArray(j.shareability_summary.global_do_not_share));
    const raw = JSON.stringify(j);
    assert.equal(raw.includes("SECRET=true"), false);
    assert.equal(raw.includes(".env"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("dema assets shareability human output discloses metadata-only boundary", () => {
  const root = freshFixture();
  try {
    const out = shareability(["--root", root]);
    assert.match(out, /SHAREABILITY/);
    assert.match(out, /metadata-only/i);
    assert.match(out, /no URP submission/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("dema assets shareability missing --root exits non-zero", () => {
  assert.throws(
    () => shareability([]),
    (err) => err.status !== 0,
  );
});
