// UI-TRUTH-LABEL-GATE-1A — the gate that stops the product from teaching an
// architecture the repo does not have.
//
// The red-first proof is transported, not simulated: the gate is pointed at a
// real pre-fix checkout of badb1c1 when one is available, and at synthesised
// pre-fix trees otherwise. A gate that only ever sees the fixed tree proves
// nothing.

import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { evaluateUiTruthLabel } from "../scripts/review/ui-truth-label-check.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const ECOSYSTEM = "packages/dema-ui/src/lib/game/ecosystem.ts";
const BOOT = "packages/dema-ui/src/components/game/SovereignBoot.tsx";
const FLEET_CANON = "packages/dema-ui/src/lib/game/fleet-canon.ts";
const KERNEL = "packages/core/src/node0-agent-fleet-roles.js";

// A throwaway copy of the real tree, so each mutation is a real file on disk.
function forkRepo() {
  const dir = mkdtempSync(join(tmpdir(), "ui-truth-"));
  for (const rel of [ECOSYSTEM, BOOT, FLEET_CANON, KERNEL]) {
    mkdirSync(join(dir, dirname(rel)), { recursive: true });
    cpSync(join(REPO, rel), join(dir, rel));
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function patch(dir, rel, fn) {
  const p = join(dir, rel);
  writeFileSync(p, fn(readFileSync(p, "utf8")));
}

test("the gate passes on the current tree", () => {
  const report = evaluateUiTruthLabel({ repoRoot: REPO });
  assert.equal(report.ok, true, JSON.stringify(report.findings));
  assert.equal(report.kernel_fleet_roles.length, 12);
  assert.deepEqual(report.ui_fleet_roles, report.kernel_fleet_roles);
  assert.equal(report.office_roster_size, 11);
});

test("the gate is RED on the real pre-fix tree at badb1c1", (t) => {
  // The exact tree the operator was looking at when they reported the defect.
  const preFix = "/data/bizra/worktrees/genesis-baseline-badb1c1/Dema";
  if (!existsSync(join(preFix, ECOSYSTEM))) {
    t.skip("pre-fix checkout of badb1c1 not present in this environment");
    return;
  }
  const report = evaluateUiTruthLabel({ repoRoot: preFix });
  assert.equal(report.ok, false);
  // Exactly the defect that was reported: the ceremony never showed the fleet.
  assert.ok(report.findings.some((f) => f.startsWith("ceremony_does_not_render_canonical_fleet")));
  assert.ok(report.findings.some((f) => f.startsWith("fleet_beat_absent")));
  assert.ok(report.findings.some((f) => f.startsWith("office_beat_absent")));
  assert.ok(report.findings.some((f) => f.startsWith("ceremony_beat_addressed_by_index")));
});

test("a ceremony that stops rendering the canonical fleet is refused", () => {
  const { dir, cleanup } = forkRepo();
  try {
    patch(dir, BOOT, (s) => s.replace('import { AGENTS, DEMA_ALPHA, COLOR_CLASS } from "@/lib/game/data";', 'import { COLOR_CLASS } from "@/lib/game/data";').replaceAll("AGENTS", "ORG_AGENTS"));
    const report = evaluateUiTruthLabel({ repoRoot: dir });
    assert.equal(report.ok, false);
    assert.ok(report.findings.some((f) => f.startsWith("ceremony_does_not_render_canonical_fleet")));
  } finally {
    cleanup();
  }
});

test("constitutional language on the office beat is refused", () => {
  const { dir, cleanup } = forkRepo();
  try {
    // The exact sentence that made the simulation read as the constitution.
    patch(dir, ECOSYSTEM, (s) =>
      s.replace(
        'It is a way to watch work move, nothing more."',
        'Each has a SOUL and a boundary. They work for you; never the reverse."',
      ),
    );
    const report = evaluateUiTruthLabel({ repoRoot: dir });
    assert.equal(report.ok, false);
    assert.ok(report.findings.some((f) => f.startsWith("office_beat_claims_constitution")));
  } finally {
    cleanup();
  }
});

test("dropping the simulation label from the office beat is refused", () => {
  const { dir, cleanup } = forkRepo();
  try {
    patch(dir, ECOSYSTEM, (s) =>
      s.replace(/id: "office",[\s\S]*?\n  \},/, `id: "office",\n    title: "The Office",\n    glyph: "x",\n    body: "Eleven agents assemble in the office.",\n    action: "Open",\n  },`),
    );
    const report = evaluateUiTruthLabel({ repoRoot: dir });
    assert.equal(report.ok, false);
    assert.ok(report.findings.some((f) => f.startsWith("office_beat_unlabeled")));
  } finally {
    cleanup();
  }
});

test("dropping a PAT/SAT boundary clause from the fleet beat is refused", () => {
  const { dir, cleanup } = forkRepo();
  try {
    patch(dir, ECOSYSTEM, (s) => s.replace("PAT proposes and never certifies itself; ", ""));
    const report = evaluateUiTruthLabel({ repoRoot: dir });
    assert.equal(report.ok, false);
    assert.ok(report.findings.includes("fleet_beat_missing_pat_boundary"));
  } finally {
    cleanup();
  }
});

test("a UI fleet mirror that drifts from the kernel is refused", () => {
  const { dir, cleanup } = forkRepo();
  try {
    patch(dir, FLEET_CANON, (s) => s.replace('"sat-3-impact"', '"sat-3-vibes"'));
    const report = evaluateUiTruthLabel({ repoRoot: dir });
    assert.equal(report.ok, false);
    assert.ok(report.findings.some((f) => f.startsWith("ui_fleet_drifted_from_kernel")));
  } finally {
    cleanup();
  }
});

test("re-introducing index-addressed beats is refused", () => {
  const { dir, cleanup } = forkRepo();
  try {
    patch(dir, BOOT, (s) => s.replace('cur.id === "oath"', "step === 4"));
    const report = evaluateUiTruthLabel({ repoRoot: dir });
    assert.equal(report.ok, false);
    assert.ok(report.findings.some((f) => f.startsWith("ceremony_beat_addressed_by_index")));
  } finally {
    cleanup();
  }
});

test("an office roster grown to fleet size is refused", () => {
  const { dir, cleanup } = forkRepo();
  try {
    patch(dir, ECOSYSTEM, (s) =>
      s.replace(
        /(export const ORG_AGENTS: OrgAgentDef\[\] = \[)/,
        '$1\n  { id: "extra", name: "Extra", role: "r", glyph: "x", color: "knowledge", soul: "s", station: "st", powers: [] },',
      ),
    );
    const report = evaluateUiTruthLabel({ repoRoot: dir });
    assert.equal(report.ok, false);
    assert.ok(report.findings.some((f) => f.startsWith("office_roster_fleet_sized")));
  } finally {
    cleanup();
  }
});
