import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

function freshFixture() {
  const root = mkdtempSync(join(tmpdir(), "poi-seal-cli-"));
  mkdirSync(join(root, "proofs"), { recursive: true });
  mkdirSync(join(root, "app"), { recursive: true });
  writeFileSync(join(root, "proofs", "impact-receipt.json"), '{"x":1}\n');
  writeFileSync(join(root, "app", "package.json"), '{"private":true}\n');
  writeFileSync(join(root, ".env"), "SECRET=true\n");
  return root;
}

function receiptSealPreview(args, env = {}) {
  return execFileSync(
    "node",
    [BIN, "contribute", "receipt-seal-preview", ...args],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        DEMA_BANNER_INTERACTIVE: "0",
        DEMA_NO_TUI: "1",
        ...env,
      },
    },
  );
}

test("dema contribute receipt-seal-preview --json emits schema and boundary", () => {
  const root = freshFixture();
  try {
    const out = receiptSealPreview(["--root", root, "--json"]);
    const j = JSON.parse(out);
    assert.equal(j.schema, "bizra.dema.poi_receipt_seal_preview.v0.1");
    assert.equal(j.truth_label, "POI_RECEIPT_SEAL_PREVIEW_ONLY");
    assert.equal(j.boundary.seal_performed, false);
    assert.equal(j.boundary.signature_emitted, false);
    assert.equal(j.seal_performed, false);
    assert.ok(Array.isArray(j.seal_blockers));
    assert.ok(j.consent_phrase);
    const raw = JSON.stringify(j);
    assert.equal(raw.includes("SECRET=true"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("dema contribute receipt-seal-preview human output discloses not sealed", () => {
  const root = freshFixture();
  try {
    const out = receiptSealPreview(["--root", root]);
    assert.match(out, /NOT SEALED/i);
    assert.match(out, /no seal/i);
    assert.match(out, /consent phrase/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("dema contribute receipt-seal-preview defaults root via small fixture cwd", () => {
  const root = freshFixture();
  const prev = process.cwd();
  try {
    process.chdir(root);
    const out = receiptSealPreview(["--json"]);
    const j = JSON.parse(out);
    assert.equal(j.schema, "bizra.dema.poi_receipt_seal_preview.v0.1");
    assert.equal(j.valid, true);
  } finally {
    process.chdir(prev);
    rmSync(root, { recursive: true, force: true });
  }
});
