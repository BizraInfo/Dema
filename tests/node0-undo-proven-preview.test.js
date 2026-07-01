import test from "node:test";
import assert from "node:assert/strict";
import * as nodeFs from "node:fs";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildNode0UndoProvenPreview,
  verifyNode0UndoProvenPreview,
  runNode0UndoProvenPreviewGate,
  NODE0_UNDO_PROVEN_PREVIEW_SCHEMA,
  NODE0_UNDO_PROVEN_PREVIEW_TRUTH_LABEL,
} from "../packages/core/src/node0-undo-proven-preview.js";
import {
  NODE0_REVERSIBLE_EXECUTE_GATE_PROBE,
  runNode0ReversibleExecuteGate,
} from "../packages/core/src/node0-reversible-execute-gate.js";

const NOW = "2026-06-30T12:00:00.000Z";

test("UP-01: undo-proven preview binds to measured gate with hash", () => {
  const sandboxRoot = mkdtempSync(join(tmpdir(), "node0-undo-proven-"));
  try {
    writeFileSync(
      join(sandboxRoot, NODE0_REVERSIBLE_EXECUTE_GATE_PROBE),
      "undo proven payload\n",
    );
    const gate = runNode0ReversibleExecuteGate({ fs: nodeFs, sandboxRoot, now: NOW });
    const preview = buildNode0UndoProvenPreview({ gate_result: gate });
    assert.equal(preview.schema, NODE0_UNDO_PROVEN_PREVIEW_SCHEMA);
    assert.equal(preview.truth_label, NODE0_UNDO_PROVEN_PREVIEW_TRUTH_LABEL);
    assert.equal(preview.undo_proven, true);
    assert.equal(preview.restored_hash, preview.backup_hash);
    assert.match(preview.preview_hash, /^sha256:[0-9a-f]{64}$/);
    const verified = verifyNode0UndoProvenPreview(preview);
    assert.equal(verified.ok, true);
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
});

test("UP-02: verify rejects tampered undo_proven flag", () => {
  const sandboxRoot = mkdtempSync(join(tmpdir(), "node0-undo-proven-tamper-"));
  try {
    writeFileSync(
      join(sandboxRoot, NODE0_REVERSIBLE_EXECUTE_GATE_PROBE),
      "undo proven payload\n",
    );
    const gate = runNode0ReversibleExecuteGate({ fs: nodeFs, sandboxRoot, now: NOW });
    const preview = buildNode0UndoProvenPreview({ gate_result: gate });
    const tampered = { ...preview, undo_proven: false };
    const verified = verifyNode0UndoProvenPreview(tampered);
    assert.equal(verified.ok, false);
    assert.ok(verified.blocked_by.includes("preview_hash_mismatch"));
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
});

test("UP-03: runNode0UndoProvenPreviewGate passes in sandbox", () => {
  const sandboxRoot = mkdtempSync(join(tmpdir(), "node0-undo-proven-gate-"));
  try {
    writeFileSync(
      join(sandboxRoot, NODE0_REVERSIBLE_EXECUTE_GATE_PROBE),
      "undo proven gate payload\n",
    );
    const result = runNode0UndoProvenPreviewGate({ fs: nodeFs, sandboxRoot, now: NOW });
    assert.equal(result.ok, true);
    assert.equal(result.undo_proven, true);
    assert.deepEqual(result.blocked_by, []);
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
});

test("UP-04: all preview boundaries remain false", () => {
  const sandboxRoot = mkdtempSync(join(tmpdir(), "node0-undo-proven-boundary-"));
  try {
    writeFileSync(
      join(sandboxRoot, NODE0_REVERSIBLE_EXECUTE_GATE_PROBE),
      "boundary payload\n",
    );
    const gate = runNode0ReversibleExecuteGate({ fs: nodeFs, sandboxRoot, now: NOW });
    const preview = buildNode0UndoProvenPreview({ gate_result: gate });
    for (const [key, value] of Object.entries(preview.boundary)) {
      assert.equal(value, false, `${key} must remain false`);
    }
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
});
