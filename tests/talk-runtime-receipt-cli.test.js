// LOCAL-TALK-RUNTIME-RECEIPT-1A — `dema talk --receipt` CLI smoke tests.
// CI-safe: uses a REFUSING live call (wrong consent → no fetch fired) so no real
// model is ever called, and points DEMA_HOME at a temp dir so nothing touches
// the real ~/.dema. Confirms the receipt is written, content-addressed, and
// stores metadata only — never the raw prompt, never the raw consent phrase.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

function talkReceipt(args, demaHome) {
  try {
    return execFileSync("node", [BIN, "talk", ...args], {
      encoding: "utf8",
      env: { ...process.env, DEMA_HOME: demaHome },
    });
  } catch (e) {
    return (e.stdout || "") + (e.stderr || "");
  }
}

test("--receipt writes a content-addressed runtime receipt under DEMA_HOME/receipts", () => {
  const home = mkdtempSync(join(tmpdir(), "dema-receipt-"));
  try {
    // A WRONG consent phrase → refused → NO fetch (CI-safe), but a receipt is
    // still written recording that the gate fired.
    const out = talkReceipt(
      ["please summarize my day", "--consent", "wrong phrase", "--receipt", "--json"],
      home,
    );
    const d = JSON.parse(out);
    assert.equal(d.invocation_status, "refused");
    assert.ok(d.receipt_path, "a receipt path is reported");

    const files = readdirSync(join(home, "receipts")).filter((f) =>
      f.startsWith("talk-runtime-"),
    );
    assert.equal(files.length, 1, "exactly one receipt written");
    assert.match(files[0], /^talk-runtime-[0-9a-f]{64}\.json$/);

    const receipt = JSON.parse(readFileSync(join(home, "receipts", files[0]), "utf8"));
    assert.equal(receipt.schema, "bizra.dema.talk_runtime_receipt.v0.1");
    assert.equal(receipt.invocation_status, "refused");
    assert.equal(receipt.no_task_executed, true);
    // PRIVACY: the raw prompt and the raw consent phrase must NOT be in the file.
    const raw = JSON.stringify(receipt);
    assert.doesNotMatch(raw, /summarize my day/);
    assert.doesNotMatch(raw, /wrong phrase/);
    // The filename hash matches the content-addressed id.
    assert.equal(files[0], `talk-runtime-${receipt.receipt_id}.json`);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("without --receipt, no receipt is written (no-persistence default preserved)", () => {
  const home = mkdtempSync(join(tmpdir(), "dema-noreceipt-"));
  try {
    talkReceipt(["hi", "--consent", "wrong phrase", "--json"], home);
    let wrote = false;
    try {
      wrote = readdirSync(join(home, "receipts")).length > 0;
    } catch {
      wrote = false; // receipts dir never created
    }
    assert.equal(wrote, false, "no receipt written without --receipt");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
