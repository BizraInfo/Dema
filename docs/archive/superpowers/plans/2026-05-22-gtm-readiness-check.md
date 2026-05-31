# GTM Readiness Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only GTM readiness check that keeps the current GTM plan, Phase-1 operator packet, Lighthouse packet, and proof-safe claim boundaries machine-checkable.

**Architecture:** Add one script under `scripts/` that returns a schema-tagged audit report and human formatter. Add one focused Node test file under `tests/`. Expose the check through `npm run gtm:readiness` and include it in `scripts/check.mjs` after the existing LLM guidance check.

**Tech Stack:** Node.js stdlib only (`node:test`, `node:assert/strict`, `node:fs`, `node:path`, `node:crypto`); no runtime dependencies; no shelling out from the checker.

---

### Task 1: Add Failing GTM Readiness Tests

**Files:**
- Create: `tests/gtm-readiness-check.test.js`
- Later create: `scripts/gtm-readiness-check.mjs`

- [x] **Step 1: Write the failing test**

Create `tests/gtm-readiness-check.test.js` with tests that import:

```js
import {
  buildGtmReadinessReport,
  formatGtmReadinessReport,
  verifyManifestLines
} from "../scripts/gtm-readiness-check.mjs";
```

The tests must assert:

```js
assert.equal(report.schema, "bizra.dema.gtm_readiness_check.v0.1");
assert.equal(report.mode, "READ_ONLY_AUDIT");
assert.equal(report.boundary.runtime_execution, false);
assert.equal(report.boundary.receipt_minted, false);
assert.equal(report.ok, true);
```

They must also create a temporary Lighthouse pack directory with a valid `MANIFEST.sha256` and prove the manifest verifier catches tampered content.

- [x] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test tests/gtm-readiness-check.test.js
```

Expected: fail with `ERR_MODULE_NOT_FOUND` for `scripts/gtm-readiness-check.mjs`.

### Task 2: Implement The Read-Only Checker

**Files:**
- Create: `scripts/gtm-readiness-check.mjs`

- [x] **Step 1: Write minimal implementation**

Implement:

```js
export async function buildGtmReadinessReport({ root = REPO_ROOT, lighthousePackDir = defaultLighthousePackDir() } = {}) {}
export function formatGtmReadinessReport(report) {}
export async function verifyManifestLines({ dir, manifestText }) {}
```

The report checks:

- required GTM files exist,
- stale GTM markers are absent,
- required current-state markers are present,
- Phase-1 operator packet contains the independent POI test-plan phrase and private record paths,
- Lighthouse doc links the operator packet,
- Lighthouse pack manifest entries hash-match if the pack directory exists.

- [x] **Step 2: Run the focused test to verify it passes**

Run:

```bash
node --test tests/gtm-readiness-check.test.js
```

Expected: all tests in that file pass.

### Task 3: Expose The Check In Local Gates

**Files:**
- Modify: `package.json`
- Modify: `scripts/check.mjs`
- Modify: `docs/LLM_SYSTEM_FLOW.md`

- [x] **Step 1: Add package script**

Add:

```json
"gtm:readiness": "node scripts/gtm-readiness-check.mjs"
```

- [x] **Step 2: Add check ladder command**

Add this command in `scripts/check.mjs` after `node scripts/llm-guidance-check.mjs`:

```js
["node", ["scripts/gtm-readiness-check.mjs"]],
```

- [x] **Step 3: Document the command**

In `docs/LLM_SYSTEM_FLOW.md`, add `npm run gtm:readiness` to the verification ladder after `npm run release:readiness`.

- [x] **Step 4: Run the full verification ladder**

Run:

```bash
npm test
npm run check
npm run llm:guidance
npm run gtm:readiness
npm run release:readiness
git diff --check
```

Expected: all commands exit `0`.
