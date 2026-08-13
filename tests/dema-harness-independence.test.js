// DEMA-HARNESS-INDEPENDENCE-1A — HI-01…HI-05.
//
// THE LAW. Claude Code, Codex, Hermes, Manus, OpenClaw, pi.dev and every future
// provider are DEVELOPMENT/HARNESS PLANE. They may build Dema and may later be
// delegated work by Dema. They are never Dema's identity, memory, authority or
// liveness. Dema's authoritative state has one root: DEMA_HOME.
//
//   CLAUDE_STOPS      != DEMA_STOPS
//   CLAUDE_STATE      != DEMA_STATE
//   CLAUDE_HOOK       != DEMA_AUTONOMY
//   PROVIDER_ARTIFACT != DEMA_LIVENESS_EVIDENCE
//
// THE MEASURED VIOLATION this slice closes. `buildHookInventory()` in
// packages/core/src/harness-integration.js mapped five `~/.claude/hooks/*.sh`
// entries to a hardcoded `wired: true`. The path was dropped and never checked,
// so the field was a CONSTANT wearing the costume of a measurement: delete every
// hook file and it still reported wired. Worse, that count reaches Dema's own
// CLEAN verdict line (live-homebase.js) and mission closeout — provider-harness
// state presented as Dema status.
//
// It happens to be true today (all five files exist on this host). True by luck
// is exactly the false-GREEN class this estate exists to refuse: the sibling
// function `buildBehavioralProbeAwareness` in the same module DOES existsSync its
// paths, so the module measures repo state honestly and asserts provider state by
// literal.
//
// THE FIX IS NOT TO MEASURE THE HOOKS. Measuring them would make Dema's status a
// function of provider files — the plane violation, merely made accurate. The fix
// is to label the plane honestly and refuse the item as Dema evidence.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import {
  HARNESS_HOOK_CHECKS,
  buildHarnessHookInventory,
} from "../packages/core/src/harness-integration.js";

const REPO = fileURLToPath(new URL("..", import.meta.url));

/** Remove block and line comments so the scan measures code rather than prose. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ── HI-01 · the inventory declares its plane and disclaims Dema evidence ─────
test("HI-01: the provider hook inventory is labelled harness-plane, not Dema liveness", () => {
  const inv = buildHarnessHookInventory();
  assert.ok(inv.length > 0, "control: the inventory must be non-empty or this test is vacuous");
  for (const h of inv) {
    assert.equal(h.plane, "harness", `${h.id} must declare the harness plane`);
    assert.equal(
      h.dema_liveness_evidence,
      false,
      `${h.id} must never count as evidence that Dema is alive`,
    );
  }
});

// ── HI-02 · no constant may impersonate a measurement ───────────────────────
test("HI-02: the inventory carries no hardcoded `wired` claim about provider files", () => {
  const inv = buildHarnessHookInventory();
  for (const h of inv) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(h, "wired"),
      false,
      `${h.id} still asserts \`wired\` — a constant about a file it never checked`,
    );
    assert.equal(h.measured, false, `${h.id} must state plainly that it measured nothing`);
  }
});

// ── HI-03 · Dema status must not vary with provider state ───────────────────
test("HI-03: the inventory is a pure declaration — provider files cannot change it", () => {
  // If the inventory ever became a function of ~/.claude contents, Dema's own
  // CLEAN line would move when a provider file was added or deleted. Determinism
  // across calls with no provider I/O is the observable form of independence.
  const a = JSON.stringify(buildHarnessHookInventory());
  const b = JSON.stringify(buildHarnessHookInventory());
  assert.equal(a, b);
  assert.ok(
    !a.includes(".claude"),
    "a provider path must not travel into a Dema-facing structure",
  );
});

// ── HI-04 · no authoritative module reads provider-harness state ────────────
test("HI-04: no packages/*/src module reads .claude / .codex state as authority", () => {
  const offenders = [];
  let scanned = 0;
  for (const pkg of readdirSync(join(REPO, "packages"))) {
    let files;
    try {
      files = readdirSync(join(REPO, "packages", pkg, "src"));
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith(".js")) continue;
      scanned += 1;
      const rel = `packages/${pkg}/src/${f}`;
      // Scan CODE, not prose. Comments are where this boundary gets explained —
      // including in the module this slice just repaired — so a scanner that
      // flags them produces false positives and gets weakened within a week.
      const src = stripComments(readFileSync(join(REPO, rel), "utf8"));
      // A violation is a provider path living in a string literal. An EXCLUSION
      // filter is the boundary working, not breaking it: node0-library-census.js
      // matches `.claude` to keep provider config OUT of chat history, and its
      // pattern is a regex rather than a path literal, so it does not match here.
      for (const m of src.matchAll(/["'`]([^"'`]*\.(?:claude|codex)\/[^"'`]*)["'`]/g)) {
        offenders.push(`${rel}: ${m[1]}`);
      }
    }
  }
  assert.ok(scanned > 100, `control: expected a real scan, got ${scanned} files`);
  assert.deepEqual(
    offenders,
    [],
    `authoritative modules must not carry provider-harness paths:\n${offenders.join("\n")}`,
  );
});

// ── HI-05 · DEMA_HOME is the named authoritative root ───────────────────────
test("HI-05: Dema's authoritative root is DEMA_HOME, and it is not a provider directory", () => {
  const readers = [];
  for (const pkg of readdirSync(join(REPO, "packages"))) {
    let files;
    try {
      files = readdirSync(join(REPO, "packages", pkg, "src"));
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith(".js")) continue;
      const src = readFileSync(join(REPO, `packages/${pkg}/src/${f}`), "utf8");
      if (src.includes("DEMA_HOME")) readers.push(`packages/${pkg}/src/${f}`);
    }
  }
  // Not a cap — a floor plus a truthful record. DEMA_HOME currently has many
  // independent readers and no single resolver module; that is a real open
  // finding (there is no packages/core/src/dema-home.js), recorded here rather
  // than asserted away. What this test pins is the direction: the authoritative
  // root is DEMA_HOME and never a provider directory.
  assert.ok(readers.length > 0, "control: DEMA_HOME must actually be referenced");
  for (const r of readers) {
    const src = readFileSync(join(REPO, r), "utf8");
    assert.ok(
      !/DEMA_HOME[^\n]*\.(claude|codex)/.test(src),
      `${r} resolves Dema's root from a provider directory`,
    );
  }
});
