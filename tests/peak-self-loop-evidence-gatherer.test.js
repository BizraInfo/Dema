import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  bindPeakSelfLoopSignalEvents,
  parsePeakSelfLoopSignalEventsArg,
} from "../apps/cli/src/commands/peak-self-loop-evidence-gatherer.js";
import { buildPeakSelfLoopPreview } from "../packages/core/src/peak-self-loop-preview.js";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function signal({ id = "bound-signal", source_ref, source_sha256 }) {
  return {
    id,
    type: "gate_passed",
    weight: 1,
    label: id,
    truth_label: "MEASURED",
    source_ref,
    source_sha256,
  };
}

function withTempRoot(fn) {
  const base = mkdtempSync(join(tmpdir(), "dema-peak-evidence-"));
  const repoRoot = join(base, "repo");
  mkdirSync(repoRoot);
  try {
    return fn({ base, repoRoot });
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

test("PEB-G01 matching repo-contained source bytes are admitted", () =>
  withTempRoot(({ repoRoot }) => {
    const bytes = Buffer.from("measured proof\n");
    const source = join(repoRoot, "proof.txt");
    writeFileSync(source, bytes);

    const result = bindPeakSelfLoopSignalEvents(
      [
        signal({
          source_ref: "proof.txt",
          source_sha256: sha256(bytes),
        }),
      ],
      { repoRoot },
    );

    assert.equal(result.complete, true);
    assert.equal(result.admitted.length, 1);
    assert.deepEqual(result.rejected, []);

    const preview = buildPeakSelfLoopPreview({ signal_events: result.admitted });
    assert.equal(preview.evidence_binding.verified_signal_count, 1);
  }));

test("PEB-G02 nonexistent source is rejected and cannot raise SNR", () =>
  withTempRoot(({ repoRoot }) => {
    const forged = Array.from({ length: 9 }, (_, i) =>
      signal({
        id: `forged-${i}`,
        source_ref: `missing-${i}.json`,
        source_sha256: "a".repeat(64),
      }),
    );

    const result = bindPeakSelfLoopSignalEvents(forged, { repoRoot });
    assert.equal(result.complete, false);
    assert.equal(result.admitted.length, 0);
    assert.equal(result.rejected.length, 9);
    assert.ok(
      result.rejected.every((row) => row.reason === "source_unreadable_or_missing"),
    );

    // Caller-side atomic admission passes zero events on any binding failure.
    const preview = buildPeakSelfLoopPreview({ signal_events: [] });
    assert.equal(preview.evidence_binding.verified_signal_count, 0);
    assert.equal(preview.merged_verdict, "HOLD_FOR_VERIFICATION");
  }));

test("PEB-G03 hash mismatch is rejected rather than silently repaired", () =>
  withTempRoot(({ repoRoot }) => {
    writeFileSync(join(repoRoot, "proof.txt"), "actual bytes");
    const result = bindPeakSelfLoopSignalEvents(
      [signal({ source_ref: "proof.txt", source_sha256: "b".repeat(64) })],
      { repoRoot },
    );

    assert.equal(result.complete, false);
    assert.equal(result.admitted.length, 0);
    assert.equal(result.rejected[0].reason, "source_hash_mismatch");
  }));

test("PEB-G04 lexical parent escape is rejected", () =>
  withTempRoot(({ base, repoRoot }) => {
    const bytes = Buffer.from("outside");
    writeFileSync(join(base, "outside.txt"), bytes);
    const result = bindPeakSelfLoopSignalEvents(
      [
        signal({
          source_ref: "../outside.txt",
          source_sha256: sha256(bytes),
        }),
      ],
      { repoRoot },
    );

    assert.equal(result.complete, false);
    assert.equal(result.admitted.length, 0);
    assert.equal(result.rejected[0].reason, "source_outside_repo");
  }));

test("PEB-G05 symlink escape is rejected after realpath resolution", () =>
  withTempRoot(({ base, repoRoot }) => {
    const bytes = Buffer.from("outside through symlink");
    const outside = join(base, "outside.txt");
    writeFileSync(outside, bytes);
    symlinkSync(outside, join(repoRoot, "link.txt"));

    const result = bindPeakSelfLoopSignalEvents(
      [
        signal({
          source_ref: "link.txt",
          source_sha256: sha256(bytes),
        }),
      ],
      { repoRoot },
    );

    assert.equal(result.complete, false);
    assert.equal(result.admitted.length, 0);
    assert.equal(result.rejected[0].reason, "source_outside_repo");
  }));

test("PEB-G06 signal-events-json parser is explicit and fail-closed", () => {
  assert.equal(parsePeakSelfLoopSignalEventsArg([]).provided, false);
  assert.equal(
    parsePeakSelfLoopSignalEventsArg(["--signal-events-json={bad"]).error,
    "signal_events_json_invalid",
  );
  assert.equal(
    parsePeakSelfLoopSignalEventsArg([
      "--signal-events-json=[]",
      "--signal-events-json=[]",
    ]).error,
    "signal_events_arg_duplicate",
  );
  assert.equal(
    parsePeakSelfLoopSignalEventsArg(["--signal-events-json={}"]).error,
    "signal_events_json_not_array",
  );
});
