import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { runMumuLoop } from "../scripts/node0-mumu-loop.mjs";
import { verifyReplay } from "../scripts/node0-mumu-replay.mjs";

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "n0-replay-root-"));
  mkdirSync(join(root, "proj"), { recursive: true });
  writeFileSync(join(root, "proj", "package.json"), '{"name":"x"}\n');
  writeFileSync(join(root, "proj", "app.js"), "x\n");
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, "docs", "notes.md"), "note\n");
  return root;
}

function runLoop(root) {
  const out = mkdtempSync(join(tmpdir(), "n0-replay-out-"));
  const r = runMumuLoop({
    root,
    out,
    offline: true,
    metadataOnly: true,
    maxFiles: 50000,
    maxDepth: 8,
    testMode: true,
    autoConsentTest: true,
    consent: null,
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  return out;
}

describe("verifyReplay — clean chain", () => {
  it("verifies a freshly produced loop", () => {
    const root = makeRoot();
    const out = runLoop(root);
    try {
      const rep = verifyReplay({ out_dir: out, outDir: out });
      assert.equal(rep.ok, true, JSON.stringify(rep));
      assert.equal(rep.checks.receipt_chain, true);
      assert.equal(rep.checks.inventory_integrity, true);
      assert.equal(rep.checks.required_artifacts_present, true);
      assert.equal(rep.checks.boundary_flags_safe, true);
      assert.deepEqual(rep.tamper_detected, []);
      assert.ok(rep.receipt_count >= 8);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });
});

describe("verifyReplay — tamper detection", () => {
  it("detects a tampered receipt line", () => {
    const root = makeRoot();
    const out = runLoop(root);
    try {
      const chainPath = join(out, "receipts", "receipt-chain.v0.1.jsonl");
      const lines = readFileSync(chainPath, "utf8")
        .split("\n")
        .filter((l) => l.trim());
      const first = JSON.parse(lines[0]);
      first.event_type = "TAMPERED"; // body changed, receipt_hash now stale
      lines[0] = JSON.stringify(first);
      writeFileSync(chainPath, lines.join("\n") + "\n");
      const rep = verifyReplay({ outDir: out });
      assert.equal(rep.ok, false);
      assert.equal(rep.checks.receipt_chain, false);
      assert.ok(
        rep.tamper_detected.some((t) => t.startsWith("receipt_hash_mismatch")),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("detects a tampered inventory artifact", () => {
    const root = makeRoot();
    const out = runLoop(root);
    try {
      const invPath = join(out, "inventory", "metadata-inventory.v0.1.json");
      const inv = JSON.parse(readFileSync(invPath, "utf8"));
      inv.records.push({
        relative_path: "ghost.md",
        basename: "ghost.md",
        extension: ".md",
        size: 1,
        mtime_iso: "2026-06-12T00:00:00.000Z",
        class: "docs",
        depth: 1,
      });
      writeFileSync(invPath, JSON.stringify(inv, null, 2) + "\n"); // inventory_hash now stale
      const rep = verifyReplay({ outDir: out });
      assert.equal(rep.ok, false);
      assert.equal(rep.checks.inventory_integrity, false);
      assert.ok(rep.tamper_detected.includes("inventory_hash_mismatch"));
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("detects a missing required artifact", () => {
    const root = makeRoot();
    const out = runLoop(root);
    try {
      rmSync(join(out, "quest", "recommended-quest.v0.1.json"), {
        force: true,
      });
      const rep = verifyReplay({ outDir: out });
      assert.equal(rep.ok, false);
      assert.equal(rep.checks.required_artifacts_present, false);
      assert.ok(
        rep.tamper_detected.some((t) => t.startsWith("artifact_missing")),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });
});
