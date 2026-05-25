# Mission Closeout Evidence Report v0.1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `dema mission closeout [mission-id] [--json]` — reads a completed mission receipt from disk, verifies its content hash, and renders a structured execution-proof report.

**Architecture:** One new module (`packages/mission/src/mission-closeout.js`) with three functions: resolve receipt, build closeout report, render output. CLI wiring under the existing `case "mission"` dispatch. Read-only — no files written, no network.

**Tech Stack:** Node.js stdlib only (node:fs/promises, node:path, node:crypto). Reuses `sha256`/`stableStringify` from `packages/consent/src/consent-common.js`.

---

### Task 1: Core module — receipt resolution and closeout builder

**Files:**

- Create: `packages/mission/src/mission-closeout.js`

- [ ] **Step 1: Create the module with receipt resolution**

```javascript
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export async function resolveMissionReceipt(missionId, home) {
  const root = home || process.env.DEMA_HOME || join(homedir(), ".dema");
  const receiptsDir = join(root, "receipts");

  let entries;
  try {
    entries = await readdir(receiptsDir);
  } catch {
    return { error: "No mission receipts found. Run a mission first." };
  }

  const missionFiles = entries.filter(
    (f) => f.startsWith("mission-") && f.endsWith(".json"),
  );
  if (missionFiles.length === 0) {
    return { error: "No mission receipts found. Run a mission first." };
  }

  if (missionId) {
    const match = missionFiles.filter((f) => f.includes(missionId));
    if (match.length === 0) {
      return { error: `No receipt matching '${missionId}' found.` };
    }
    const picked = match[0];
    const fullPath = join(receiptsDir, picked);
    const raw = await readFile(fullPath, "utf8");
    return { receipt: JSON.parse(raw), path: fullPath, filename: picked };
  }

  const withMtime = await Promise.all(
    missionFiles.map(async (f) => {
      const fullPath = join(receiptsDir, f);
      const s = await stat(fullPath);
      return { filename: f, path: fullPath, mtime: s.mtimeMs };
    }),
  );
  withMtime.sort((a, b) => b.mtime - a.mtime);
  const latest = withMtime[0];
  const raw = await readFile(latest.path, "utf8");
  return {
    receipt: JSON.parse(raw),
    path: latest.path,
    filename: latest.filename,
  };
}
```

- [ ] **Step 2: Add the closeout report builder**

Append to the same file:

```javascript
export function buildCloseoutReport(receipt, sourcePath, sourceFilename) {
  if (!receipt || !receipt.attests) {
    return { error: "Receipt is malformed — missing attests block." };
  }

  const attests = receipt.attests;
  const recomputedHash = sha256(stableStringify(attests));
  const originalHash = receipt.content_hash || "";
  const hashMatch = recomputedHash === originalHash;

  const boundary = attests.boundary || {};
  const boundaryKeys = Object.keys(boundary);
  const trueCount = boundaryKeys.filter((k) => boundary[k] === true).length;
  const falseCount = boundaryKeys.filter((k) => boundary[k] === false).length;

  return {
    schema: "bizra.dema.mission_closeout.v0.1",
    mission_id: receipt.mission_id || null,
    source_receipt: sourceFilename,
    source_path: sourcePath,
    verification: {
      content_hash_match: hashMatch,
      recomputed_hash: recomputedHash,
      original_hash: originalHash,
    },
    summary: {
      type: attests.mission_type || null,
      executed_at: attests.executed_at || null,
      verdict: attests.mission_verdict || null,
      results: attests.results || {},
      boundary: {
        ...boundary,
        total_keys: boundaryKeys.length,
        true_count: trueCount,
        false_count: falseCount,
      },
    },
  };
}
```

- [ ] **Step 3: Add the plain-text renderer**

Append to the same file:

```javascript
export function renderCloseoutText(report) {
  if (report.error) return report.error;

  const v = report.verification;
  const s = report.summary;
  const r = s.results;
  const hashStatus = v.content_hash_match ? "✓ PASS" : "✗ MISMATCH";

  const lines = [
    "Mission Closeout Evidence Report",
    "═".repeat(42),
    `  Mission ID:     ${report.mission_id || "unknown"}`,
    `  Type:           ${s.type || "unknown"}`,
    `  Executed:       ${s.executed_at || "unknown"}`,
    `  Verdict:        ${s.verdict || "unknown"}`,
    `  Content Hash:   sha256:${v.original_hash.slice(0, 16)}...`,
    `  Hash Verified:  ${hashStatus}`,
    "",
  ];

  if (r.setup) {
    lines.push(`  Results:`);
    lines.push(
      `    Setup:    ${r.setup.verdict} (${r.setup.checks} checks, ${r.setup.missing} missing)`,
    );
  }
  if (r.harness) {
    lines.push(
      `    Harness:  ${r.harness.verdict} (${r.harness.gates}, ${r.harness.hooks} hooks)`,
    );
  }
  if (r.doctor) {
    lines.push(
      `    Doctor:   ${r.doctor.ok} ok / ${r.doctor.fail} fail / ${r.doctor.warn} warn (of ${r.doctor.predicates})`,
    );
  }
  if (r.witness) {
    const wLabel = r.witness.exists
      ? `${r.witness.verdict || "present"}`
      : "not present";
    lines.push(`    Witness:  ${wLabel}`);
  }
  if (r.memory) {
    lines.push(`    Memory:   ${r.memory.entries} entries`);
  }

  lines.push("");

  const bKeys = Object.keys(s.boundary).filter(
    (k) => !["total_keys", "true_count", "false_count"].includes(k),
  );
  const trueKeys = bKeys.filter((k) => s.boundary[k] === true);
  if (trueKeys.length > 0) {
    lines.push(`  Boundary (${s.boundary.total_keys} keys):`);
    lines.push(
      `    ${trueKeys.map((k) => k.replace(/_performed$/, "").replace(/_/g, "_")).join(": YES | ")}: YES`,
    );
    lines.push(`    All others: NO`);
  } else {
    lines.push(`  Boundary (${s.boundary.total_keys} keys): all NO`);
  }

  lines.push("");
  const integrityMsg = v.content_hash_match
    ? "Integrity: content_hash recomputed and matches."
    : `Integrity: MISMATCH — expected ${v.original_hash.slice(0, 16)}..., got ${v.recomputed_hash.slice(0, 16)}...`;
  lines.push(`  ${integrityMsg}`);
  lines.push("═".repeat(42));

  return lines.join("\n");
}
```

- [ ] **Step 4: Commit core module**

```bash
git add packages/mission/src/mission-closeout.js
git commit -m "feat(mission): add mission-closeout core module — receipt resolution + verification + rendering"
```

---

### Task 2: Unit tests

**Files:**

- Create: `tests/mission-closeout.test.js`

- [ ] **Step 1: Write the test file**

```javascript
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  resolveMissionReceipt,
  buildCloseoutReport,
  renderCloseoutText,
} from "../packages/mission/src/mission-closeout.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

function makeReceipt(overrides = {}) {
  const attests = {
    mission_type: "health_snapshot",
    executed_at: "2026-05-25T22:00:00.000Z",
    mission_verdict: "CLEAN",
    results: {
      setup: { verdict: "INTACT", checks: 7, missing: 0 },
      harness: { verdict: "CLEAN", gaps: 0, gates: "5/5 passing", hooks: 6 },
      doctor: { predicates: 5, ok: 5, fail: 0, warn: 0 },
      witness: { exists: true, verdict: "VERIFIED" },
      memory: { entries: 3 },
    },
    boundary: {
      filesystem_write_performed: true,
      network_used: false,
      runtime_execution_performed: false,
      model_loaded: false,
      model_invocation_performed: false,
      prompt_executed: false,
      external_call_performed: false,
      raw_corpus_scan_performed: false,
      raw_data_included: false,
      tool_executed: false,
      chain_advance_performed: false,
      receipt_mint_performed: false,
      federation_invoked: false,
      node_connection_performed: false,
      public_network_used: false,
      consent_collected: true,
    },
    consent_verified: true,
    ...overrides.attests,
  };
  const content_hash = sha256(stableStringify(attests));
  return {
    schema: "bizra.dema.mission_receipt.health_snapshot.v0.1",
    truth_label: "LOCAL_OPERATOR_MISSION",
    mission_id: `health_snapshot_${content_hash.slice(0, 12)}`,
    attests,
    content_hash,
    ...overrides,
  };
}

describe("mission-closeout", () => {
  let home;
  let receiptsDir;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "dema-closeout-test-"));
    receiptsDir = join(home, "receipts");
    await mkdir(receiptsDir, { recursive: true });
  });

  describe("resolveMissionReceipt", () => {
    it("returns error when receipts dir missing", async () => {
      const emptyHome = await mkdtemp(join(tmpdir(), "dema-closeout-empty-"));
      const result = await resolveMissionReceipt(undefined, emptyHome);
      assert.ok(result.error);
      assert.match(result.error, /No mission receipts found/);
    });

    it("returns error when no mission files exist", async () => {
      await writeFile(join(receiptsDir, "other.json"), "{}");
      const result = await resolveMissionReceipt(undefined, home);
      assert.ok(result.error);
      assert.match(result.error, /No mission receipts found/);
    });

    it("resolves latest mission receipt by mtime", async () => {
      const r1 = makeReceipt();
      const r2 = makeReceipt({
        attests: {
          ...makeReceipt().attests,
          executed_at: "2026-05-26T01:00:00.000Z",
        },
      });
      await writeFile(
        join(receiptsDir, "mission-health-aaa.json"),
        JSON.stringify(r1),
      );
      // Small delay to ensure different mtime
      await new Promise((r) => setTimeout(r, 50));
      await writeFile(
        join(receiptsDir, "mission-health-bbb.json"),
        JSON.stringify(r2),
      );
      const result = await resolveMissionReceipt(undefined, home);
      assert.ok(!result.error);
      assert.equal(result.filename, "mission-health-bbb.json");
    });

    it("resolves by substring ID match", async () => {
      const r = makeReceipt();
      await writeFile(
        join(receiptsDir, "mission-health-abc123def.json"),
        JSON.stringify(r),
      );
      const result = await resolveMissionReceipt("abc123", home);
      assert.ok(!result.error);
      assert.equal(result.filename, "mission-health-abc123def.json");
    });

    it("returns error for unmatched ID", async () => {
      const r = makeReceipt();
      await writeFile(
        join(receiptsDir, "mission-health-abc.json"),
        JSON.stringify(r),
      );
      const result = await resolveMissionReceipt("zzz999", home);
      assert.ok(result.error);
      assert.match(result.error, /No receipt matching 'zzz999' found/);
    });
  });

  describe("buildCloseoutReport", () => {
    it("builds report with verified hash", () => {
      const receipt = makeReceipt();
      const report = buildCloseoutReport(receipt, "/tmp/r.json", "r.json");
      assert.equal(report.schema, "bizra.dema.mission_closeout.v0.1");
      assert.equal(report.verification.content_hash_match, true);
      assert.equal(report.summary.verdict, "CLEAN");
      assert.equal(report.summary.boundary.true_count, 2);
      assert.equal(report.summary.boundary.false_count, 14);
      assert.equal(report.summary.boundary.total_keys, 16);
    });

    it("detects tampered hash", () => {
      const receipt = makeReceipt();
      receipt.content_hash = "0000000000000000000000000000000000000000";
      const report = buildCloseoutReport(receipt, "/tmp/r.json", "r.json");
      assert.equal(report.verification.content_hash_match, false);
    });

    it("returns error for malformed receipt", () => {
      const report = buildCloseoutReport({}, "/tmp/r.json", "r.json");
      assert.ok(report.error);
      assert.match(report.error, /malformed/);
    });
  });

  describe("renderCloseoutText", () => {
    it("renders human-readable report", () => {
      const receipt = makeReceipt();
      const report = buildCloseoutReport(receipt, "/tmp/r.json", "r.json");
      const text = renderCloseoutText(report);
      assert.match(text, /Mission Closeout Evidence Report/);
      assert.match(text, /CLEAN/);
      assert.match(text, /PASS/);
      assert.match(text, /Integrity.*matches/);
    });

    it("renders mismatch warning", () => {
      const receipt = makeReceipt();
      receipt.content_hash = "bad";
      const report = buildCloseoutReport(receipt, "/tmp/r.json", "r.json");
      const text = renderCloseoutText(report);
      assert.match(text, /MISMATCH/);
    });

    it("renders error string when report has error", () => {
      const text = renderCloseoutText({ error: "broken" });
      assert.equal(text, "broken");
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail (module not yet importable if Task 1 not done) or pass (if Task 1 done)**

```bash
node --test tests/mission-closeout.test.js
```

Expected: All tests PASS (if Task 1 is committed first, as ordered).

- [ ] **Step 3: Commit tests**

```bash
git add tests/mission-closeout.test.js
git commit -m "test(mission): add mission-closeout unit tests — resolution, verification, rendering"
```

---

### Task 3: CLI dispatch wiring

**Files:**

- Modify: `apps/cli/src/index.js` — add `closeout` branch under `case "mission"`

- [ ] **Step 1: Find the mission dispatch block and add the closeout branch**

Locate the `case "mission"` block in `apps/cli/src/index.js`. Add the closeout handler after the existing `mission draft` block and before the block's closing brace.

Add this import near the top of the file with the other mission imports:

```javascript
import {
  resolveMissionReceipt,
  buildCloseoutReport,
  renderCloseoutText,
} from "../../packages/mission/src/mission-closeout.js";
```

Add this branch inside `case "mission"`:

```javascript
if (subcommand === "closeout") {
  const missionId = argv[2] && !argv[2].startsWith("-") ? argv[2] : undefined;
  const wantJsonCO = argv.includes("--json") || !process.stdout.isTTY;

  const resolved = await resolveMissionReceipt(missionId);
  if (resolved.error) {
    if (wantJsonCO) {
      console.log(
        JSON.stringify(
          {
            schema: "bizra.dema.mission_closeout.v0.1",
            error: resolved.error,
          },
          null,
          2,
        ),
      );
    } else {
      console.error(resolved.error);
    }
    process.exitCode = 1;
    return;
  }

  const report = buildCloseoutReport(
    resolved.receipt,
    resolved.path,
    resolved.filename,
  );
  if (report.error) {
    if (wantJsonCO) {
      console.log(
        JSON.stringify(
          {
            schema: "bizra.dema.mission_closeout.v0.1",
            error: report.error,
          },
          null,
          2,
        ),
      );
    } else {
      console.error(report.error);
    }
    process.exitCode = 1;
    return;
  }

  if (wantJsonCO) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderCloseoutText(report));
  }
  return;
}
```

- [ ] **Step 2: Run the full test suite to confirm no regressions**

```bash
node --test tests/*.test.js 2>&1 | tail -8
```

Expected: All tests pass, count >= 2799.

- [ ] **Step 3: Manually test the CLI against the real receipt**

```bash
# Test with explicit ID (substring of the receipt filename):
DEMA_NO_TUI=1 node apps/cli/src/index.js mission closeout b8299ecbe7f63655

# Test latest (no ID):
DEMA_NO_TUI=1 node apps/cli/src/index.js mission closeout

# Test JSON output:
DEMA_NO_TUI=1 node apps/cli/src/index.js mission closeout --json

# Test error path (no matching ID):
DEMA_NO_TUI=1 node apps/cli/src/index.js mission closeout nonexistent123
```

- [ ] **Step 4: Commit CLI wiring**

```bash
git add apps/cli/src/index.js
git commit -m "feat(cli): wire dema mission closeout — reads receipt, verifies hash, renders report"
```

---

### Task 4: Smoke driver row + integration validation

**Files:**

- Modify: `.claude/skills/run-dema/driver.mjs` — add `closeout-json` row to SMOKE_MATRIX

- [ ] **Step 1: Add the smoke row**

In `driver.mjs`, add this entry to the `SMOKE_MATRIX` array, after the `harness-summary` row and before the `memory-query-no-wrapper` row:

```javascript
  {
    label: "closeout-json",
    argv: ["mission", "closeout", "--json"],
    assertStdoutIncludes: /"schema": "bizra\.dema\.mission_closeout\.v0\.1"/,
    // Fresh DEMA_HOME has no mission receipts — exit 1 with error envelope is expected.
    allowFail: true,
  },
```

- [ ] **Step 2: Run the smoke matrix**

```bash
node .claude/skills/run-dema/driver.mjs --smoke
```

Expected: 23/23 PASS (closeout-json passes with allowFail since fresh tmpdir has no receipts).

- [ ] **Step 3: Test closeout against operator's real receipt**

```bash
node .claude/skills/run-dema/driver.mjs --cmd "mission closeout --json"
```

This runs against a fresh DEMA_HOME (no receipts), so it should emit an error envelope with exit 1. To test the happy path against the real receipt:

```bash
node apps/cli/src/index.js mission closeout --json
```

Expected: Full closeout JSON envelope with `content_hash_match: true`.

- [ ] **Step 4: Update SKILL.md smoke matrix documentation**

In `.claude/skills/run-dema/SKILL.md`, add the row to the matrix table:

```
| `closeout-json` | Mission closeout evidence report — reads latest receipt, verifies hash, renders summary |
```

Update the smoke case count from 22 to 23 in the relevant places.

- [ ] **Step 5: Run the full validation chain**

```bash
node --test tests/*.test.js 2>&1 | tail -8
node .claude/skills/run-dema/driver.mjs --smoke
```

Expected: All tests pass. 23/23 smoke PASS.

- [ ] **Step 6: Final commit**

```bash
git add .claude/skills/run-dema/driver.mjs .claude/skills/run-dema/SKILL.md
git commit -m "feat(smoke): add closeout-json row to run-dema smoke matrix"
```

---

### Task 5: Integration commit + validation

- [ ] **Step 1: Run the canonical check suite**

```bash
npm test
npm run check
```

Expected: All tests pass. Check exits 0.

- [ ] **Step 2: Verify the feature end-to-end with the real receipt on disk**

```bash
# Plain text:
node apps/cli/src/index.js mission closeout

# JSON:
node apps/cli/src/index.js mission closeout --json | head -20

# Specific ID:
node apps/cli/src/index.js mission closeout b8299ecbe7f63655
```

All three should render the closeout report against `~/.dema/receipts/mission-health-b8299ecbe7f63655.json` with `Hash Verified: ✓ PASS`.
