// RTR — recovery-proof torn read.
//
// Deterministic causal isolation of RCA-02. Fresh extraction A of candidate
// a5f8a77a failed RCA-02 with "Unexpected end of JSON input"; byte-identical
// extraction B passed; the same test passed 6/6 in isolation. Rather than
// estimate the incidence of that race, these tests pin the two invariants whose
// violation makes it possible at all — so the contradiction becomes a decided
// question instead of a statistic.
//
//   ATOMIC_PUBLISH : a reader sees the complete old file or the complete new
//                    one, never a prefix.
//   FAIL_CLOSED_READ: a mid-publication artifact reads as not-ready, never as
//                    an exception out of a poll loop.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  writeFactsAtomic,
  readFactsWhenComplete,
} from "../scripts/proof/atomic-facts-io.mjs";

function scratch() {
  return mkdtempSync(join(tmpdir(), "rtr-"));
}

// The exact shape the recovery driver polls: a pretty-printed fact file, cut
// mid-token the way a partially-flushed writeFileSync leaves it.
const FACTS = { role: "worker-a", pid: 4242, mission: "genesis", state: "ESTABLISHED" };
const COMPLETE = `${JSON.stringify(FACTS, null, 2)}\n`;
const TRUNCATED = COMPLETE.slice(0, Math.floor(COMPLETE.length / 2));

// The causal mechanism itself, made executable and permanent. This is the exact
// reader lambda that stood at node0-recovery-proof.mjs:49 and is what turned a
// half-written worker-a.json into a process-killing throw out of the 25ms poll
// loop. Pinned so the defect can never be described as hypothetical again.
test("RTR-00: the pre-repair reader shape throws on a mid-publication artefact", () => {
  const dir = scratch();
  try {
    const preRepairRead = (f) =>
      existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;

    // The exact historical signature. writeFileSync TRUNCATES an existing file
    // to zero before writing it, so a 25ms poller that lands inside that window
    // parses "" — which is why the recorded error is "Unexpected end of JSON
    // input" and not a mid-token complaint. This is the sharpest form of the
    // race: the file exists, so existsSync passes, and it is empty.
    const zero = join(dir, "truncate-window.json");
    writeFileSync(zero, "");
    assert.throws(() => preRepairRead(zero), /Unexpected end of JSON input/);

    // Any other cut point also throws; the message is Node-version dependent,
    // so the invariant pinned here is "it throws", not a literal string.
    const partial = join(dir, "worker-a.json");
    writeFileSync(partial, TRUNCATED);
    assert.throws(() => preRepairRead(partial), SyntaxError);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("RTR-01: a mid-publication artefact reads as not-ready, it does not throw", () => {
  const dir = scratch();
  try {
    const p = join(dir, "worker-a.json");
    writeFileSync(p, TRUNCATED);
    // The old reader was `existsSync(f) ? JSON.parse(readFileSync(f)) : null`,
    // which throws straight out of the 25ms poll loop and kills the driver.
    assert.doesNotThrow(() => readFactsWhenComplete(p));
    assert.equal(readFactsWhenComplete(p), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Non-vacuity control. Without it, a reader hard-coded to return null would
// satisfy RTR-01 and prove nothing.
test("RTR-02: a complete artefact is still read and parsed", () => {
  const dir = scratch();
  try {
    const p = join(dir, "worker-a.json");
    writeFileSync(p, COMPLETE);
    assert.deepEqual(readFactsWhenComplete(p), FACTS);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Discrimination control: absent and incomplete are both not-ready, but the
// reader must not invent a value for either.
test("RTR-03: an absent artefact is not-ready and is not confused with an empty one", () => {
  const dir = scratch();
  try {
    const absent = join(dir, "never-written.json");
    assert.equal(readFactsWhenComplete(absent), null);
    const empty = join(dir, "empty.json");
    writeFileSync(empty, "");
    assert.equal(readFactsWhenComplete(empty), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("RTR-04: publication is atomic — the final path never holds a prefix", () => {
  const dir = scratch();
  try {
    const p = join(dir, "worker-a.json");
    // A payload large enough that a non-atomic writer would be observable
    // mid-write by a poller.
    const big = { role: "worker-a", blob: "x".repeat(512 * 1024) };
    writeFactsAtomic(p, big);
    assert.ok(existsSync(p));
    assert.deepEqual(JSON.parse(readFileSync(p, "utf8")), big);
    // The temp file must be gone: rename(2) consumed it, it was not left behind
    // for a directory-scanning reader to trip over.
    assert.ok(!existsSync(`${p}.partial`));
    assert.deepEqual(readdirSync(dir), ["worker-a.json"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("RTR-05: an atomic republish is never observable as a prefix of the new value", () => {
  const dir = scratch();
  try {
    const p = join(dir, "worker-a.json");
    writeFactsAtomic(p, { generation: 1 });
    const before = readFactsWhenComplete(p);
    writeFactsAtomic(p, { generation: 2, padding: "y".repeat(256 * 1024) });
    const after = readFactsWhenComplete(p);
    assert.equal(before.generation, 1);
    assert.equal(after.generation, 2);
    // Either complete generation is acceptable to a reader; a prefix is not.
    assert.ok(after.padding.length === 256 * 1024);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The defect was not that atomic publication is unknown here — it is that the
// recovery family never received it. This pins the diffusion, so the class
// cannot be reported closed again while a sibling writer is still direct.
test("RTR-06: every recovery proof writer publishes atomically", () => {
  const dir = join(import.meta.dirname, "..", "scripts", "proof");
  const recovery = readdirSync(dir).filter(
    (f) => f.startsWith("node0-recovery-") && f.endsWith(".mjs"),
  );
  assert.ok(recovery.length >= 4, "expected the recovery proof family on disk");
  for (const f of recovery) {
    const src = readFileSync(join(dir, f), "utf8");
    const writes = src.match(/writeFileSync\s*\(/g) ?? [];
    assert.equal(
      writes.length,
      0,
      `${f} still calls writeFileSync directly; publish through writeFactsAtomic instead`,
    );
  }
});
