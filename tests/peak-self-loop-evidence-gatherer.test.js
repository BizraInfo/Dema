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
  resolvePeakSelfLoopRepoRoot,
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
    assert.equal(preview.snr_framework.verified_signal_count, 1);
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
    assert.equal(preview.snr_framework.verified_signal_count, 0);
    assert.equal(preview.autonomous_rsi.merged_verdict, "HOLD_AND_REDUCE_NOISE");
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
  assert.equal(
    parsePeakSelfLoopSignalEventsArg(["--signal-events-json"]).error,
    "signal_events_json_missing",
  );
  const twoToken = parsePeakSelfLoopSignalEventsArg([
    "--signal-events-json",
    "[]",
  ]);
  assert.equal(twoToken.error, null);
  assert.equal(twoToken.provided, true);
  assert.deepEqual(twoToken.events, []);
});

test("PEB-G07 nested cwd still resolves the Dema checkout, not the nested dir", () =>
  withTempRoot(({ base }) => {
    const nested = join(base, "not-a-dema-repo", "nested");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, "proof.txt"), "local decoy\n");
    // Walk-up from nested finds nothing Dema-shaped; module-anchored checkout wins.
    const resolved = resolvePeakSelfLoopRepoRoot({ startDir: nested });
    assert.ok(typeof resolved === "string" && resolved.length > 0);
    assert.notEqual(resolved, nested);
    assert.notEqual(resolved, join(base, "not-a-dema-repo"));
    // Binding without explicit repoRoot must not admit nested decoy as repo evidence.
    const result = bindPeakSelfLoopSignalEvents(
      [
        signal({
          source_ref: "proof.txt",
          source_sha256: sha256(Buffer.from("local decoy\n")),
        }),
      ],
      { startDir: nested },
    );
    assert.equal(result.complete, false);
    assert.equal(result.admitted.length, 0);
    assert.ok(
      result.rejected.some((row) =>
        ["source_unreadable_or_missing", "source_hash_mismatch"].includes(row.reason),
      ),
    );
  }));

test("PEB-G08 duplicate id or source target fails the batch closed", () =>
  withTempRoot(({ repoRoot }) => {
    const bytes = Buffer.from("one file\n");
    writeFileSync(join(repoRoot, "proof.txt"), bytes);
    const digest = sha256(bytes);

    const dupId = bindPeakSelfLoopSignalEvents(
      [
        signal({ id: "same", source_ref: "proof.txt", source_sha256: digest }),
        signal({ id: "same", source_ref: "proof.txt", source_sha256: digest }),
      ],
      { repoRoot },
    );
    assert.equal(dupId.complete, false);
    assert.equal(dupId.admitted.length, 0);
    assert.ok(dupId.rejected.some((row) => row.reason === "duplicate_event_id"));

    writeFileSync(join(repoRoot, "other.txt"), bytes);
    const dupTarget = bindPeakSelfLoopSignalEvents(
      [
        signal({ id: "a", source_ref: "proof.txt", source_sha256: digest }),
        signal({ id: "b", source_ref: "proof.txt", source_sha256: digest }),
      ],
      { repoRoot },
    );
    assert.equal(dupTarget.complete, false);
    assert.equal(dupTarget.admitted.length, 0);
    assert.ok(
      dupTarget.rejected.some((row) => row.reason === "duplicate_source_target"),
    );
  }));

test("PEB-G09 fail-closed shape, root, and read paths", () =>
  withTempRoot(({ base, repoRoot }) => {
    assert.equal(
      bindPeakSelfLoopSignalEvents(null, { repoRoot }).rejected[0].reason,
      "signal_events_not_array",
    );

    const unreadableRoot = bindPeakSelfLoopSignalEvents([], {
      repoRoot,
      realpathImpl: () => {
        throw new Error("nope");
      },
    });
    assert.equal(unreadableRoot.rejected[0].reason, "repo_root_unreadable");

    assert.equal(
      bindPeakSelfLoopSignalEvents([], {
        resolveRootImpl: () => null,
      }).rejected[0].reason,
      "repo_root_unresolvable",
    );

    const fakeModule = join(base, "orphan-module.mjs");
    writeFileSync(fakeModule, "// not a dema checkout anchor\n");
    const orphanUrl = `file://${fakeModule}`;

    const namedRoot = join(base, "named-dema");
    mkdirSync(join(namedRoot, "apps", "cli"), { recursive: true });
    mkdirSync(join(namedRoot, "packages", "core"), { recursive: true });
    mkdirSync(join(namedRoot, "nested"), { recursive: true });
    writeFileSync(
      join(namedRoot, "package.json"),
      JSON.stringify({ name: "@bizra/dema-root" }),
    );
    assert.equal(
      resolvePeakSelfLoopRepoRoot({
        startDir: join(namedRoot, "nested"),
        moduleUrl: orphanUrl,
      }),
      namedRoot,
    );

    const shapeRoot = join(base, "shape-dema");
    mkdirSync(join(shapeRoot, "apps", "cli"), { recursive: true });
    mkdirSync(join(shapeRoot, "packages", "core"), { recursive: true });
    mkdirSync(join(shapeRoot, "nested"), { recursive: true });
    writeFileSync(join(shapeRoot, "package.json"), JSON.stringify({ name: "other" }));
    assert.equal(
      resolvePeakSelfLoopRepoRoot({
        startDir: join(shapeRoot, "nested"),
        moduleUrl: orphanUrl,
      }),
      shapeRoot,
    );

    const badPkgDir = join(base, "bad-json-root");
    mkdirSync(badPkgDir);
    writeFileSync(join(badPkgDir, "package.json"), "{not-json");
    assert.equal(
      resolvePeakSelfLoopRepoRoot({
        startDir: badPkgDir,
        moduleUrl: orphanUrl,
      }),
      null,
    );

    const shapeRejects = bindPeakSelfLoopSignalEvents(
      [
        null,
        { id: "a" },
        { id: "b", source_ref: "/abs.txt", source_sha256: "a".repeat(64) },
        { id: "c", source_ref: "x", source_sha256: "zz" },
      ],
      { repoRoot },
    );
    assert.equal(shapeRejects.complete, false);
    assert.equal(shapeRejects.admitted.length, 0);
    assert.ok(shapeRejects.rejected.some((r) => r.reason === "event_not_object"));
    assert.ok(shapeRejects.rejected.some((r) => r.reason === "source_ref_missing"));
    assert.ok(
      shapeRejects.rejected.some((r) => r.reason === "source_ref_absolute_forbidden"),
    );
    assert.ok(
      shapeRejects.rejected.some(
        (r) => r.reason === "source_sha256_missing_or_malformed",
      ),
    );

    const bytes = Buffer.from("readable\n");
    writeFileSync(join(repoRoot, "proof.txt"), bytes);
    const digest = sha256(bytes);
    const readFail = bindPeakSelfLoopSignalEvents(
      [signal({ source_ref: "proof.txt", source_sha256: digest })],
      {
        repoRoot,
        readFileImpl: () => {
          throw new Error("read boom");
        },
      },
    );
    assert.equal(readFail.rejected[0].reason, "source_unreadable_or_missing");
    assert.equal(readFail.admitted.length, 0);

    assert.equal(
      parsePeakSelfLoopSignalEventsArg(["--signal-events-json", "--other"]).error,
      "signal_events_json_missing",
    );
    assert.equal(
      parsePeakSelfLoopSignalEventsArg([
        "--signal-events-json",
        "[]",
        "--signal-events-json=[]",
      ]).error,
      "signal_events_arg_duplicate",
    );
  }));
