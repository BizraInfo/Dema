// UI-TRUTH-LABEL-GATE-1A — test-first.
//
// Proves a read-only gate that fails when a dema-ui component tied to a
// DESIGNED_NOT_LIVE capability renders a liveness word, or renders no truth
// label at all.
//
// Why: `AutopoieticLoop.tsx` on origin/main renders `● LIVE` for the autopoietic
// runtime, driven by a client-side boolean tick. Canon holds that runtime as
// DESIGNED_NOT_LIVE. The label existed in `lib/game/data.ts` and never reached
// the screen — a truth label the user cannot see is a comment, not a disclosure.
//
// Every case below runs the gate against a TEMP FIXTURE via `--ui-root`, never
// the real tree. A gate that can only be observed passing proves nothing, so
// each test that expects success is paired with one that forces the failure.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const GATE = fileURLToPath(new URL("../scripts/review/ui-truth-label-check.mjs", import.meta.url));

/** Run the gate against a fixture. Returns { status, report }. */
function runGate(uiRoot) {
  try {
    const stdout = execFileSync("node", [GATE, "--ui-root", uiRoot], { encoding: "utf8" });
    return { status: 0, report: JSON.parse(stdout) };
  } catch (err) {
    return { status: err.status ?? 1, report: JSON.parse(String(err.stdout || "{}")) };
  }
}

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), "dema-ui-truth-"));
  mkdirSync(join(dir, "game"), { recursive: true });
  for (const [name, source] of Object.entries(files)) {
    writeFileSync(join(dir, "game", name), source);
  }
  return dir;
}

const LABELLED_NO_CLAIM = `
import { TruthLabelBadge } from "./primitives";
export function AutopoieticLoop({ running }) {
  return (
    <div>
      <TruthLabelBadge label="DESIGNED_NOT_LIVE" size="xs" />
      <span>{running ? "◐ ANIMATING" : "○ IDLE"}</span>
    </div>
  );
}
`;

test("G1 a labelled component with no liveness claim passes", () => {
  const dir = fixture({ "AutopoieticLoop.tsx": LABELLED_NO_CLAIM });
  try {
    const { status, report } = runGate(dir);
    assert.equal(status, 0);
    assert.equal(report.ok, true);
    assert.deepEqual(report.findings, []);
    assert.equal(report.scanned_components.length, 1, "the fixture component must actually be scanned");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("G2 reintroducing the exact origin/main claim fails the gate", () => {
  // This is verbatim what origin/main ships at AutopoieticLoop.tsx line 30.
  const dir = fixture({
    "AutopoieticLoop.tsx": LABELLED_NO_CLAIM.replace(
      '{running ? "◐ ANIMATING" : "○ IDLE"}',
      '{running ? "● LIVE" : "○ IDLE"}',
    ),
  });
  try {
    const { status, report } = runGate(dir);
    assert.equal(status, 1, "gate must exit nonzero");
    assert.equal(report.ok, false);
    const hit = report.findings.find((f) => f.label === "ui.liveness_claim_on_not_live_capability");
    assert.ok(hit, `expected a liveness finding, got ${JSON.stringify(report.findings)}`);
    assert.equal(hit.match, "LIVE");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("G3 a component with no truth label at all fails, even without a liveness word", () => {
  const dir = fixture({
    "VerificationMesh.tsx": "export function VerificationMesh() {\n  return <div>mesh</div>;\n}\n",
  });
  try {
    const { status, report } = runGate(dir);
    assert.equal(status, 1);
    assert.ok(report.findings.some((f) => f.label === "ui.missing_truth_label_badge"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("G4 a `truth` prop passed to a primitive counts as labelled", () => {
  // Panel/SceneHeader render the badge on the component's behalf. Checking for
  // the literal string "TruthLabelBadge" would flag these as unlabelled, so the
  // gate tests the behaviour rather than the spelling.
  const dir = fixture({
    "EvolutionGraph.tsx":
      'export function EvolutionGraph() {\n  return <Panel title="Evolution" truth="DESIGNED_NOT_LIVE" />;\n}\n',
  });
  try {
    const { status } = runGate(dir);
    assert.equal(status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("G5 a component NOT on the not-live list is never scanned", () => {
  // The gate does not ban the words. A genuinely live surface may say LIVE.
  const dir = fixture({
    "SomeLiveThing.tsx": 'export function SomeLiveThing() {\n  return <span>● LIVE</span>;\n}\n',
  });
  try {
    const { status, report } = runGate(dir);
    assert.equal(status, 0);
    assert.deepEqual(report.scanned_components, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("G6 the word inside a line comment is not a rendered claim", () => {
  const dir = fixture({
    "AgentPanel.tsx":
      'import { TruthLabelBadge } from "./primitives";\n' +
      "// this panel must never render LIVE\n" +
      "export function AgentPanel() {\n  return <TruthLabelBadge label=\"DESIGNED_NOT_LIVE\" />;\n}\n",
  });
  try {
    const { status, report } = runGate(dir);
    assert.equal(status, 0, `unexpected findings: ${JSON.stringify(report.findings)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("G7 the real repo tree passes", () => {
  // Runs with no --ui-root, i.e. against packages/dema-ui/src/components.
  // Meaningful only because G2/G3 prove the gate can fail.
  try {
    execFileSync("node", [GATE], { encoding: "utf8" });
  } catch (err) {
    assert.fail(`gate failed on the real tree: ${String(err.stdout || err.message)}`);
  }
});
