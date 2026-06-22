import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  listReceipts,
  listReceiptsPage,
  formatReceiptList,
} from "../packages/receipts/src/receipt-store.js";

function makeDemaHome() {
  return mkdtempSync(join(tmpdir(), "dema-receipt-fmt-"));
}

function makeReceiptsDir(home) {
  const dir = join(home, "receipts");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeReceipt(dir, filename, data) {
  writeFileSync(join(dir, filename), JSON.stringify(data));
}

describe("receipt-store formatting", () => {
  describe("listReceipts enhanced fields", () => {
    it("includes schema field from receipt JSON", async () => {
      const home = makeDemaHome();
      const dir = makeReceiptsDir(home);
      writeReceipt(dir, "think-abc.json", {
        schema: "bizra.dema.think_receipt.v0.1",
        saved_at: "2026-05-26T10:00:00Z",
      });
      const receipts = await listReceipts(home);
      assert.equal(receipts.length, 1);
      assert.equal(receipts[0].schema, "bizra.dema.think_receipt.v0.1");
    });

    it("falls back to generated_at when created_at is missing", async () => {
      const home = makeDemaHome();
      const dir = makeReceiptsDir(home);
      writeReceipt(dir, "think-gen.json", {
        schema: "bizra.dema.think_receipt.v0.1",
        generated_at: "2026-05-26T09:00:00Z",
      });
      const receipts = await listReceipts(home);
      assert.equal(receipts[0].created_at, "2026-05-26T09:00:00Z");
    });

    it("falls back to saved_at when created_at and generated_at are missing", async () => {
      const home = makeDemaHome();
      const dir = makeReceiptsDir(home);
      writeReceipt(dir, "think-saved.json", {
        schema: "bizra.dema.think_receipt.v0.1",
        saved_at: "2026-05-26T08:00:00Z",
      });
      const receipts = await listReceipts(home);
      assert.equal(receipts[0].created_at, "2026-05-26T08:00:00Z");
    });

    it("returns null when no timestamp fields exist", async () => {
      const home = makeDemaHome();
      const dir = makeReceiptsDir(home);
      writeReceipt(dir, "bare.json", { schema: "unknown" });
      const receipts = await listReceipts(home);
      assert.equal(receipts[0].created_at, null);
    });
  });

  describe("formatReceiptList", () => {
    it("returns 'No receipts found.' for empty list", () => {
      assert.equal(formatReceiptList([]), "No receipts found.");
    });

    it("classifies think receipt by schema", async () => {
      const home = makeDemaHome();
      const dir = makeReceiptsDir(home);
      writeReceipt(dir, "think-abc.json", {
        schema: "bizra.dema.think_receipt.v0.1",
        saved_at: "2026-05-26T10:00:00Z",
      });
      const receipts = await listReceipts(home);
      const text = formatReceiptList(receipts);
      assert.ok(text.includes("think"));
      assert.ok(text.includes("think-abc.json"));
    });

    it("classifies mission receipt by schema", async () => {
      const home = makeDemaHome();
      const dir = makeReceiptsDir(home);
      writeReceipt(dir, "mission-xyz.json", {
        schema: "bizra.dema.health_snapshot_receipt.v0.1",
        created_at: "2026-05-26T09:00:00Z",
      });
      const receipts = await listReceipts(home);
      const text = formatReceiptList(receipts);
      assert.ok(text.includes("mission"));
    });

    it("classifies route receipt by schema", async () => {
      const home = makeDemaHome();
      const dir = makeReceiptsDir(home);
      writeReceipt(dir, "route-xyz.json", {
        schema: "bizra.dema.local_model_route_receipt.v0.1",
        created_at: "2026-05-26T08:00:00Z",
      });
      const receipts = await listReceipts(home);
      const text = formatReceiptList(receipts);
      assert.ok(text.includes("route"));
    });

    it("falls back to filename for unrecognized schema", async () => {
      const home = makeDemaHome();
      const dir = makeReceiptsDir(home);
      writeReceipt(dir, "think-fallback.json", { schema: "unknown.schema" });
      const receipts = await listReceipts(home);
      const text = formatReceiptList(receipts);
      assert.ok(text.includes("think"));
    });

    it("sorts newest first", async () => {
      const home = makeDemaHome();
      const dir = makeReceiptsDir(home);
      writeReceipt(dir, "old.json", {
        schema: "bizra.dema.think_receipt.v0.1",
        saved_at: "2026-01-01T00:00:00Z",
      });
      writeReceipt(dir, "new.json", {
        schema: "bizra.dema.think_receipt.v0.1",
        saved_at: "2026-12-31T00:00:00Z",
      });
      const receipts = await listReceipts(home);
      const text = formatReceiptList(receipts);
      const newIdx = text.indexOf("new.json");
      const oldIdx = text.indexOf("old.json");
      assert.ok(newIdx < oldIdx, "newer receipt should appear first");
    });

    it("shows corrupt receipt as CORRUPT with warning", async () => {
      const home = makeDemaHome();
      const dir = makeReceiptsDir(home);
      writeFileSync(join(dir, "broken.json"), "NOT VALID JSON {{{");
      const receipts = await listReceipts(home);
      const text = formatReceiptList(receipts);
      assert.ok(text.includes("corrupt") || text.includes("CORRUPT"));
      assert.ok(text.includes("broken.json"));
    });

    it("does not expose raw receipt content", async () => {
      const home = makeDemaHome();
      const dir = makeReceiptsDir(home);
      writeReceipt(dir, "secret.json", {
        schema: "bizra.dema.think_receipt.v0.1",
        output_preview: "SECRET MODEL OUTPUT HERE",
        saved_at: "2026-05-26T10:00:00Z",
      });
      const receipts = await listReceipts(home);
      const text = formatReceiptList(receipts);
      assert.ok(
        !text.includes("SECRET MODEL OUTPUT"),
        "raw content must not appear in formatted list",
      );
    });

    it("mixed receipts counted and typed correctly", async () => {
      const home = makeDemaHome();
      const dir = makeReceiptsDir(home);
      writeReceipt(dir, "t1.json", {
        schema: "bizra.dema.think_receipt.v0.1",
        saved_at: "2026-05-26T10:00:00Z",
      });
      writeReceipt(dir, "m1.json", {
        schema: "bizra.dema.health_snapshot_receipt.v0.1",
        created_at: "2026-05-26T09:00:00Z",
      });
      writeReceipt(dir, "r1.json", {
        schema: "bizra.dema.local_model_route_receipt.v0.1",
        created_at: "2026-05-26T08:00:00Z",
      });
      const receipts = await listReceipts(home);
      const text = formatReceiptList(receipts);
      assert.ok(text.includes("Receipts (3)"));
      assert.ok(text.includes("think"));
      assert.ok(text.includes("mission"));
      assert.ok(text.includes("route"));
    });

    it("includes boundary statement", async () => {
      const home = makeDemaHome();
      const dir = makeReceiptsDir(home);
      writeReceipt(dir, "a.json", { schema: "test" });
      const receipts = await listReceipts(home);
      const text = formatReceiptList(receipts);
      assert.ok(text.includes("read-only"));
      assert.ok(text.includes("no mint"));
    });

    it("shows truth_label when present", async () => {
      const home = makeDemaHome();
      const dir = makeReceiptsDir(home);
      writeReceipt(dir, "labeled.json", {
        schema: "bizra.dema.health_snapshot_receipt.v0.1",
        truth_label: "LOCAL_OPERATOR_MISSION",
        created_at: "2026-05-26T10:00:00Z",
      });
      const receipts = await listReceipts(home);
      const text = formatReceiptList(receipts);
      assert.ok(text.includes("LOCAL_OPERATOR_MISSION"));
    });
  });
});

// AUDIT P2: listReceipts returns a bare array with no completeness signal, so a
// caller showing the first page can't tell receipts were left out. listReceiptsPage
// surfaces total_scanned / truncated; listReceipts stays a plain array (back-compat).
describe("listReceiptsPage (truncation completeness)", () => {
  function seed(count) {
    const home = makeDemaHome();
    const dir = makeReceiptsDir(home);
    for (let i = 0; i < count; i++) {
      writeReceipt(dir, `r${String(i).padStart(3, "0")}.json`, {
        schema: "bizra.dema.test_receipt.v0.1",
        receipt_id: `id-${i}`,
        artifact_id: `art-${i}`,
        action: "test",
        truth_label: "TESTED_LOCAL",
      });
    }
    return home;
  }

  it("reports truncated:true with total_scanned when a page omits receipts", async () => {
    const home = seed(5);
    const page = await listReceiptsPage(home, { limit: 2, offset: 0 });
    assert.equal(page.items.length, 2);
    assert.equal(page.total_scanned, 5);
    assert.equal(page.truncated, true);
    assert.equal(page.offset, 0);
    assert.equal(page.limit, 2);
  });

  it("reports truncated:false when the page covers every receipt", async () => {
    const home = seed(3);
    const page = await listReceiptsPage(home, { limit: 50 });
    assert.equal(page.items.length, 3);
    assert.equal(page.total_scanned, 3);
    assert.equal(page.truncated, false);
  });

  it("flags capped:true when the scan hits maxFiles (more may exist on disk)", async () => {
    const home = seed(5);
    const page = await listReceiptsPage(home, { maxFiles: 3, limit: 3 });
    assert.equal(page.total_scanned, 3);
    assert.equal(page.capped, true);
    assert.equal(page.truncated, true);
  });

  it("offset pages forward through the scanned set", async () => {
    const home = seed(5);
    const page = await listReceiptsPage(home, { limit: 2, offset: 4 });
    assert.equal(page.items.length, 1);
    assert.equal(page.truncated, false);
  });

  it("listReceipts returns exactly the same items as listReceiptsPage.items", async () => {
    const home = seed(4);
    const arr = await listReceipts(home);
    const page = await listReceiptsPage(home);
    assert.deepEqual(
      arr.map((r) => r.receipt_id),
      page.items.map((r) => r.receipt_id),
    );
  });
});
