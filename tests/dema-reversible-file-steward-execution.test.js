import test from "node:test";
import assert from "node:assert/strict";
import fs, { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  verifyStewardRoundTrip,
  sequenceExecuteStewardJob,
  measureStewardDirState,
  demaReversibleFileStewardExecutionBoundary,
  DEMA_REVERSIBLE_FILE_STEWARD_EXECUTE_GO_PHRASE,
} from "../packages/core/src/dema-reversible-file-steward-execution.js";

// DEMA-REVERSIBLE-FILE-STEWARD-1B — proves the whole job round-trips against a
// REAL fs: execute-all then undo-all returns the sandbox's user-file set to
// genesis, with every atom's restoration proven by the shipped gate.

const GO = DEMA_REVERSIBLE_FILE_STEWARD_EXECUTE_GO_PHRASE;
const NOW = "2026-07-19T00:00:00.000Z";

function makeSandbox(files) {
  const root = mkdtempSync(join(tmpdir(), "steward-1b-"));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(root, name), content);
  return root;
}

test("T8 execute-all -> undo-all returns the sandbox to genesis, every undo proven", (t) => {
  const root = makeSandbox({ "note.txt": "hello genesis · بذرة", "draft.md": "world seed" });
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const r = verifyStewardRoundTrip({
    sandboxRoot: root,
    atoms: [
      { from: "note.txt", to: "note.SEALED.txt" },
      { from: "draft.md", to: "draft.final.md" },
    ],
    consent: GO,
    fs,
    now: NOW,
  });

  assert.equal(r.round_trip_ok, true, JSON.stringify(r));
  assert.equal(r.executed_count, 2);
  assert.equal(r.all_undone_proven, true);
  assert.equal(r.genesis_hash, r.final_hash);
  assert.match(r.genesis_hash, /^sha256:[0-9a-f]{64}$/);
});

test("execute renames the user files (mid-state); gate artifacts stay hidden", (t) => {
  const root = makeSandbox({ "a.txt": "aa", "b.txt": "bb" });
  t.after(() => rmSync(root, { recursive: true, force: true }));

  assert.deepEqual(measureStewardDirState({ fs, sandboxRoot: root }).files, ["a.txt", "b.txt"]);
  const exec = sequenceExecuteStewardJob({
    sandboxRoot: root,
    atoms: [{ from: "a.txt", to: "a.done.txt" }, { from: "b.txt", to: "b.done.txt" }],
    consent: GO,
    fs,
    now: NOW,
  });
  assert.equal(exec.ok, true, exec.blocked_by?.join(","));
  assert.equal(exec.executed_count, 2);
  // .node0-backups / .node0-receipts.ndjson are created but excluded from the user set.
  assert.deepEqual(measureStewardDirState({ fs, sandboxRoot: root }).files, ["a.done.txt", "b.done.txt"]);
});

test("fail-closed: wrong consent phrase performs no execution", (t) => {
  const root = makeSandbox({ "a.txt": "aa" });
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const exec = sequenceExecuteStewardJob({ sandboxRoot: root, atoms: [{ from: "a.txt", to: "b.txt" }], consent: "nope", fs, now: NOW });
  assert.equal(exec.ok, false);
  assert.ok(exec.blocked_by.includes("consent_phrase_mismatch"));
  assert.deepEqual(measureStewardDirState({ fs, sandboxRoot: root }).files, ["a.txt"]);
});

test("fail-closed: a missing source stops the sequence before touching later atoms", (t) => {
  const root = makeSandbox({ "a.txt": "aa" }); // no "ghost.txt"
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const exec = sequenceExecuteStewardJob({
    sandboxRoot: root,
    atoms: [{ from: "ghost.txt", to: "x.txt" }, { from: "a.txt", to: "b.txt" }],
    consent: GO,
    fs,
    now: NOW,
  });
  assert.equal(exec.ok, false);
  assert.equal(exec.stopped_at.index, 0);
  // a.txt was never touched — no partial silent run.
  assert.deepEqual(measureStewardDirState({ fs, sandboxRoot: root }).files, ["a.txt"]);
});

test("execution boundary is honest: reversible sandbox mutation, no network/model/mint", () => {
  const b = demaReversibleFileStewardExecutionBoundary();
  assert.equal(b.sandbox_only, true);
  assert.equal(b.reversible, true);
  assert.equal(b.undo_available, true);
  assert.equal(b.network_used, false);
  assert.equal(b.model_invocation_performed, false);
  assert.equal(b.token_minted, false);
  assert.equal(b.wallet_accessed, false);
  assert.equal(b.federation_live, false);
});
