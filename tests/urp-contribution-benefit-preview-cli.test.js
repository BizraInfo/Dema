import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

function freshFixture() {
  const root = mkdtempSync(join(tmpdir(), "urp-benefit-cli-"));
  mkdirSync(join(root, "proofs"), { recursive: true });
  mkdirSync(join(root, "app"), { recursive: true });
  mkdirSync(join(root, "family"), { recursive: true });
  writeFileSync(join(root, "proofs", "impact-receipt.json"), '{"x":1}\n');
  writeFileSync(join(root, "app", "package.json"), '{"private":true}\n');
  writeFileSync(join(root, "family", "photo.jpg"), "fake\n");
  writeFileSync(join(root, ".env"), "SECRET=true\n");
  return root;
}

function preview(args, env = {}) {
  return execFileSync("node", [BIN, "contribute", "preview", ...args], {
    encoding: "utf8",
    env: { ...process.env, DEMA_BANNER_INTERACTIVE: "0", DEMA_NO_TUI: "1", ...env },
  });
}

test("dema contribute preview --json emits benefit preview schema and boundary", () => {
  const root = freshFixture();
  try {
    const out = preview(["--root", root, "--json"]);
    const j = JSON.parse(out);
    assert.equal(j.schema, "bizra.dema.urp_contribution_benefit_preview.v0.1");
    assert.equal(j.truth_label, "URP_CONTRIBUTION_BENEFIT_PREVIEW_ONLY");
    assert.equal(j.boundary.file_content_read, false);
    assert.equal(j.boundary.network_used, false);
    assert.equal(j.boundary.urp_submission_performed, false);
    assert.equal(j.boundary.token_minted, false);
    assert.equal(j.boundary.wallet_accessed, false);
    assert.ok(Array.isArray(j.resource_previews));
    assert.ok(j.historical_reward_preview);
    const raw = JSON.stringify(j);
    assert.equal(raw.includes("SECRET=true"), false);
    assert.equal(raw.includes(".env"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("dema contribute preview human output discloses preview-only boundary", () => {
  const root = freshFixture();
  try {
    const out = preview(["--root", root]);
    assert.match(out, /PREVIEW ONLY/i);
    assert.match(out, /no token mint/i);
    assert.match(out, /no URP submission/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("dema contribute preview defaults root to cwd", () => {
  const out = preview(["--json"]);
  const j = JSON.parse(out);
  assert.equal(j.schema, "bizra.dema.urp_contribution_benefit_preview.v0.1");
  assert.equal(j.valid, true);
});
