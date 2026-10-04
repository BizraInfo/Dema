import test from "node:test";
import assert from "node:assert/strict";
import {
  stripTrailingWhitespaceOnLines, applyReversibleContentPatch, undoReversibleContentPatch,
  REVERSIBLE_PATCH_SCHEMA,
} from "../packages/core/src/dema-reversible-content-patch.js";

// in-memory io for the executor
function memIo(files) {
  return {
    readFile: (p) => { if (!(p in files)) throw new Error("ENOENT"); return files[p]; },
    writeFile: (p, s) => { files[p] = s; },
  };
}

// ── RCP-01 pure strip touches ONLY the named lines ────────────────────────────
test("RCP-01: strip removes trailing whitespace only on the given lines", () => {
  const text = "a  \nb\t\nc   \n";           // lines 1,2,3 have trailing ws
  const r = stripTrailingWhitespaceOnLines(text, [1, 3]);
  assert.equal(r.changed, 2);
  assert.equal(r.text, "a\nb\t\nc\n");        // line 2 (not named) is untouched
});

// ── RCP-02 no-op is refused (no vacuous patch) ────────────────────────────────
test("RCP-02: a line with no trailing whitespace yields no change; executor refuses", () => {
  assert.equal(stripTrailingWhitespaceOnLines("clean\n", [1]).changed, 0);
  const files = { "f.md": "clean\n" };
  const r = applyReversibleContentPatch({ file: "f.md", lines: [1], backupPath: "f.bak", ...memIo(files), now: "T" });
  assert.equal(r.ok, false);
  assert.equal(r.error, "no_change_refused");
});

// ── RCP-03 apply backs up original, writes stripped, receipts both hashes ──────
test("RCP-03: apply backs up the original and writes the stripped content", () => {
  const files = { "doc.md": "x   \ny\n" };
  const r = applyReversibleContentPatch({ file: "doc.md", lines: [1], backupPath: "doc.bak", ...memIo(files), now: "2026-08-13T10:00:00Z" });
  assert.equal(r.schema, REVERSIBLE_PATCH_SCHEMA);
  assert.equal(r.ok, true);
  assert.equal(r.lines_changed, 1);
  assert.equal(files["doc.md"], "x\ny\n");     // file stripped
  assert.equal(files["doc.bak"], "x   \ny\n"); // backup is the ORIGINAL
  assert.match(r.content_hash_before, /^sha256:/);
  assert.equal(r.bytes_delta, -3);
});

// ── RCP-04 undo restores EXACTLY the original bytes ───────────────────────────
test("RCP-04: undo restores the original from the backup, hash-verified", () => {
  const files = { "doc.md": "x   \ny\n" };
  const io = memIo(files);
  const r = applyReversibleContentPatch({ file: "doc.md", lines: [1], backupPath: "doc.bak", ...io, now: "T" });
  const u = undoReversibleContentPatch({ receipt: r, ...io });
  assert.equal(u.ok, true);
  assert.equal(files["doc.md"], "x   \ny\n");  // exactly the original
});

// ── RCP-05 undo fails closed on a tampered/absent backup ──────────────────────
test("RCP-05: undo refuses a tampered backup (hash mismatch) and a bad receipt", () => {
  const files = { "doc.md": "x   \n" };
  const io = memIo(files);
  const r = applyReversibleContentPatch({ file: "doc.md", lines: [1], backupPath: "doc.bak", ...io, now: "T" });
  files["doc.bak"] = "TAMPERED";
  assert.equal(undoReversibleContentPatch({ receipt: r, ...io }).error, "backup_hash_mismatch");
  assert.equal(undoReversibleContentPatch({ receipt: { schema: "x" }, ...io }).error, "receipt_invalid");
});

// ── RCP-06 io is required (fail-closed) ───────────────────────────────────────
test("RCP-06: the executor fails closed without injected io", () => {
  assert.equal(applyReversibleContentPatch({ file: "f", lines: [1] }).error, "io_required");
});
