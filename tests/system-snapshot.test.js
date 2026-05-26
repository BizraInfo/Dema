import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  buildSystemSnapshot,
  formatSystemSnapshot,
} from "../packages/core/src/system-snapshot.js";
import { isCanonicalBoundaryShape } from "../packages/core/src/preview-boundary.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXED_NOW = new Date("2026-05-26T12:00:00Z");

function makeDemaHome() {
  return mkdtempSync(join(tmpdir(), "dema-snapshot-"));
}

function makeReceiptsDir(home) {
  mkdirSync(join(home, "receipts"), { recursive: true });
  return join(home, "receipts");
}

function writeReceipt(dir, filename, schema) {
  writeFileSync(
    join(dir, filename),
    JSON.stringify({ schema, generated_at: "2026-05-26T00:00:00Z" }),
  );
}

describe("system-snapshot", () => {
  describe("buildSystemSnapshot", () => {
    it("returns correct schema", () => {
      const home = makeDemaHome();
      const snap = buildSystemSnapshot({
        now: FIXED_NOW,
        demaHome: home,
      });
      assert.equal(snap.schema, "bizra.dema.system_snapshot.v0.1");
    });

    it("mode is PREVIEW_ONLY", () => {
      const home = makeDemaHome();
      const snap = buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      assert.equal(snap.mode, "PREVIEW_ONLY");
    });

    it("node id is Node0", () => {
      const home = makeDemaHome();
      const snap = buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      assert.equal(snap.node.id, "Node0");
      assert.equal(snap.node.truth_label, "LOCAL_OBSERVED");
    });

    it("harness verdict is CLEAN on real repo", () => {
      const home = makeDemaHome();
      const snap = buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      assert.equal(snap.harness.verdict, "CLEAN");
      assert.equal(snap.harness.truth_label, "COMPOSED_FROM_HARNESS");
    });

    it("boundary has canonical shape and is all false", () => {
      const home = makeDemaHome();
      const snap = buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      assert.ok(isCanonicalBoundaryShape(snap.boundary));
      for (const [key, value] of Object.entries(snap.boundary)) {
        assert.equal(value, false, `boundary.${key} should be false`);
      }
    });

    it("snapshot_inputs lists all composition sources", () => {
      const home = makeDemaHome();
      const snap = buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      assert.equal(snap.snapshot_inputs.harness_summary, true);
      assert.equal(snap.snapshot_inputs.receipt_directory, true);
      assert.equal(snap.snapshot_inputs.proof_loop_sources, true);
      assert.equal(snap.snapshot_inputs.locked_layers_static_policy, true);
    });

    it("is frozen", () => {
      const home = makeDemaHome();
      const snap = buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      assert.ok(Object.isFrozen(snap));
      assert.ok(Object.isFrozen(snap.node));
      assert.ok(Object.isFrozen(snap.harness));
      assert.ok(Object.isFrozen(snap.proof_loops));
      assert.ok(Object.isFrozen(snap.receipts));
      assert.ok(Object.isFrozen(snap.locked_layers));
    });
  });

  describe("proof_loops", () => {
    it("real repo has all mission sources present", () => {
      const home = makeDemaHome();
      const snap = buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      assert.equal(snap.proof_loops.mission.all_sources_present, true);
      assert.equal(snap.proof_loops.mission.truth_label, "SOURCE_PRESENT");
      assert.ok(snap.proof_loops.mission.sources.length >= 2);
    });

    it("real repo has all think sources present", () => {
      const home = makeDemaHome();
      const snap = buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      assert.equal(snap.proof_loops.think.all_sources_present, true);
      assert.equal(snap.proof_loops.think.truth_label, "SOURCE_PRESENT");
      assert.ok(snap.proof_loops.think.sources.length >= 4);
    });

    it("per-source presence is granular", () => {
      const home = makeDemaHome();
      const snap = buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      for (const s of snap.proof_loops.mission.sources) {
        assert.ok(typeof s.id === "string");
        assert.equal(typeof s.present, "boolean");
      }
      for (const s of snap.proof_loops.think.sources) {
        assert.ok(typeof s.id === "string");
        assert.equal(typeof s.present, "boolean");
      }
    });

    it("missing source degrades to SOURCE_MISSING", () => {
      const fakeRoot = mkdtempSync(join(tmpdir(), "dema-snap-fake-"));
      const home = makeDemaHome();
      const snap = buildSystemSnapshot({
        now: FIXED_NOW,
        repoRoot: fakeRoot,
        demaHome: home,
      });
      assert.equal(snap.proof_loops.mission.truth_label, "SOURCE_MISSING");
      assert.equal(snap.proof_loops.think.truth_label, "SOURCE_MISSING");
      assert.equal(snap.proof_loops.mission.all_sources_present, false);
      assert.equal(snap.proof_loops.think.all_sources_present, false);
    });
  });

  describe("receipts", () => {
    it("empty DEMA_HOME returns zero counts", () => {
      const home = makeDemaHome();
      const snap = buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      assert.equal(snap.receipts.total_count, 0);
      assert.equal(snap.receipts.mission_count, 0);
      assert.equal(snap.receipts.think_count, 0);
      assert.equal(snap.receipts.corrupt_count, 0);
      assert.equal(snap.receipts.truth_label, "LOCAL_OBSERVED");
    });

    it("classifies think receipt by schema", () => {
      const home = makeDemaHome();
      const dir = makeReceiptsDir(home);
      writeReceipt(dir, "think-abc123.json", "bizra.dema.think_receipt.v0.1");
      const snap = buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      assert.equal(snap.receipts.total_count, 1);
      assert.equal(snap.receipts.think_count, 1);
    });

    it("classifies mission receipt by schema", () => {
      const home = makeDemaHome();
      const dir = makeReceiptsDir(home);
      writeReceipt(
        dir,
        "mission-abc123.json",
        "bizra.dema.health_snapshot_receipt.v0.1",
      );
      const snap = buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      assert.equal(snap.receipts.mission_count, 1);
    });

    it("classifies route receipt by schema", () => {
      const home = makeDemaHome();
      const dir = makeReceiptsDir(home);
      writeReceipt(
        dir,
        "route-abc123.json",
        "bizra.dema.local_model_route_receipt.v0.1",
      );
      const snap = buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      assert.equal(snap.receipts.route_count, 1);
    });

    it("mixed receipts counted correctly", () => {
      const home = makeDemaHome();
      const dir = makeReceiptsDir(home);
      writeReceipt(dir, "think-1.json", "bizra.dema.think_receipt.v0.1");
      writeReceipt(dir, "think-2.json", "bizra.dema.think_live.v0.1");
      writeReceipt(
        dir,
        "mission-1.json",
        "bizra.dema.health_snapshot_receipt.v0.1",
      );
      writeReceipt(
        dir,
        "route-1.json",
        "bizra.dema.local_model_route_receipt.v0.1",
      );
      const snap = buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      assert.equal(snap.receipts.total_count, 4);
      assert.equal(snap.receipts.think_count, 2);
      assert.equal(snap.receipts.mission_count, 1);
      assert.equal(snap.receipts.route_count, 1);
    });

    it("corrupt receipt increments corrupt_count and adds warning", () => {
      const home = makeDemaHome();
      const dir = makeReceiptsDir(home);
      writeFileSync(join(dir, "bad-receipt.json"), "NOT VALID JSON {{{");
      const snap = buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      assert.equal(snap.receipts.corrupt_count, 1);
      assert.ok(snap.receipts.warnings.length >= 1);
      assert.ok(snap.receipts.warnings[0].includes("bad-receipt.json"));
      assert.ok(
        !snap.receipts.warnings[0].includes("NOT VALID"),
        "warning must not expose raw content",
      );
    });

    it("does not crash on corrupt receipt alongside valid ones", () => {
      const home = makeDemaHome();
      const dir = makeReceiptsDir(home);
      writeReceipt(dir, "think-ok.json", "bizra.dema.think_receipt.v0.1");
      writeFileSync(join(dir, "broken.json"), "}{bad");
      const snap = buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      assert.equal(snap.receipts.total_count, 2);
      assert.equal(snap.receipts.think_count, 1);
      assert.equal(snap.receipts.corrupt_count, 1);
    });
  });

  describe("locked_layers", () => {
    it("lists 5 locked layers", () => {
      const home = makeDemaHome();
      const snap = buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      assert.equal(snap.locked_layers.length, 5);
      for (const layer of snap.locked_layers) {
        assert.equal(layer.status, "LOCKED");
        assert.equal(layer.truth_label, "LOCKED");
      }
    });

    it("includes federation and token_economy", () => {
      const home = makeDemaHome();
      const snap = buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      const ids = snap.locked_layers.map((l) => l.id);
      assert.ok(ids.includes("federation"));
      assert.ok(ids.includes("token_economy"));
    });
  });

  describe("no mutation", () => {
    it("does not write to DEMA_HOME", () => {
      const home = makeDemaHome();
      const before = existsSync(join(home, "receipts"))
        ? readdirSync(join(home, "receipts"))
        : [];
      buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      const after = existsSync(join(home, "receipts"))
        ? readdirSync(join(home, "receipts"))
        : [];
      assert.deepEqual(before, after);
    });
  });

  describe("formatSystemSnapshot", () => {
    it("renders plain text with key sections", () => {
      const home = makeDemaHome();
      const snap = buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      const text = formatSystemSnapshot(snap);
      assert.ok(text.includes("DEMA System Snapshot v0.1"));
      assert.ok(text.includes("Harness:"));
      assert.ok(text.includes("Proof Loops:"));
      assert.ok(text.includes("Receipts:"));
      assert.ok(text.includes("Locked Layers:"));
      assert.ok(text.includes("read-only snapshot"));
    });

    it("shows COMPLETE for real repo proof loops", () => {
      const home = makeDemaHome();
      const snap = buildSystemSnapshot({ now: FIXED_NOW, demaHome: home });
      const text = formatSystemSnapshot(snap);
      assert.ok(text.includes("mission: COMPLETE"));
      assert.ok(text.includes("think: COMPLETE"));
    });

    it("shows INCOMPLETE for fake repo", () => {
      const fakeRoot = mkdtempSync(join(tmpdir(), "dema-snap-fake-"));
      const home = makeDemaHome();
      const snap = buildSystemSnapshot({
        now: FIXED_NOW,
        repoRoot: fakeRoot,
        demaHome: home,
      });
      const text = formatSystemSnapshot(snap);
      assert.ok(text.includes("INCOMPLETE"));
    });

    it("returns error string when snapshot has error", () => {
      const text = formatSystemSnapshot({ error: "snapshot failed" });
      assert.equal(text, "snapshot failed");
    });
  });
});
