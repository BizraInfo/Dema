import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

function freshFixture() {
  const root = mkdtempSync(join(tmpdir(), "poi-draft-cli-"));
  mkdirSync(join(root, "proofs"), { recursive: true });
  mkdirSync(join(root, "app"), { recursive: true });
  mkdirSync(join(root, "family"), { recursive: true });
  writeFileSync(join(root, "proofs", "impact-receipt.json"), '{"x":1}\n');
  writeFileSync(join(root, "app", "package.json"), '{"private":true}\n');
  writeFileSync(join(root, "family", "photo.jpg"), "fake\n");
  writeFileSync(join(root, ".env"), "SECRET=true\n");
  return root;
}

function receiptDraft(args, env = {}) {
  return execFileSync("node", [BIN, "contribute", "receipt-draft", ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      DEMA_BANNER_INTERACTIVE: "0",
      DEMA_NO_TUI: "1",
      ...env,
    },
  });
}

test("dema contribute receipt-draft --json emits draft schema and boundary", () => {
  const root = freshFixture();
  try {
    const out = receiptDraft(["--root", root, "--json"]);
    const j = JSON.parse(out);
    assert.equal(j.schema, "bizra.dema.poi_receipt_draft.v0.1");
    assert.equal(j.truth_label, "POI_RECEIPT_DRAFT_UNSIGNED_PREVIEW_ONLY");
    assert.equal(j.boundary.file_content_read, false);
    assert.equal(j.boundary.signature_emitted, false);
    assert.equal(j.boundary.poi_receipt_minted, false);
    assert.equal(j.unsigned_body.signature_status, "UNSIGNED");
    assert.ok(Array.isArray(j.resource_drafts));
    const raw = JSON.stringify(j);
    assert.equal(raw.includes("SECRET=true"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("dema contribute receipt-draft human output discloses unsigned preview", () => {
  const root = freshFixture();
  try {
    const out = receiptDraft(["--root", root]);
    assert.match(out, /UNSIGNED/i);
    assert.match(out, /PREVIEW ONLY/i);
    assert.match(out, /no sign/i);
    assert.match(out, /no PoI mint/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("dema contribute receipt-draft defaults root to cwd", () => {
  const root = freshFixture();
  const prev = process.cwd();
  try {
    process.chdir(root);
    const out = receiptDraft(["--json"]);
    const j = JSON.parse(out);
    assert.equal(j.schema, "bizra.dema.poi_receipt_draft.v0.1");
    assert.equal(j.valid, true);
  } finally {
    process.chdir(prev);
    rmSync(root, { recursive: true, force: true });
  }
});
