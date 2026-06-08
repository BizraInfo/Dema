# G20 Reward Eligibility Mock Local Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the smallest ADR-024-compliant local mock reward eligibility review object while preserving all no-reward, no-token, no-contract, no-marketplace, no-public-bridge boundaries.

**Architecture:** Add one pure local module under `scripts/`, one focused native Node test file, and one delivery-check exercise. Follow existing Dema patterns from `impact-scoring-mock.mjs`, `real-scoring-minimal.mjs`, and `delivery-check.mjs`.

**Tech Stack:** Node.js ESM, `node:test`, `node:assert/strict`, `node:crypto`, existing npm verification scripts.

---

### Task 1: RED Test For G20 Mock Review

**Files:**
- Create: `tests/reward-eligibility-mock.test.js`
- Later create: `scripts/reward-eligibility-mock.mjs`

- [x] **Step 1: Write failing tests**

Add tests importing `createMockRewardEligibilityReview`, `loadExampleRewardEligibilityInput`, and `REWARD_ELIGIBILITY_MOCK_CONSENT` from `../scripts/reward-eligibility-mock.mjs`.

Required assertions:

- wrong consent throws `CONSENT_REQUIRED`
- default review emits `schema: "bizra.impact.reward-eligibility.mock-review.v0.1"`
- returned id starts with `sha256:`
- allowed input fields are preserved
- unknown input field throws `FORBIDDEN_INPUT`
- forbidden promotion language throws `FORBIDDEN_PROMOTION`
- all four ADR-024 statuses are reachable
- forbidden output keys are absent
- boundary flags are local-only and no-economics

- [x] **Step 2: Run the narrow test**

Run:

```bash
node --test tests/reward-eligibility-mock.test.js
```

Expected: fail because `scripts/reward-eligibility-mock.mjs` does not exist yet.

### Task 2: GREEN Minimal Module

**Files:**
- Create: `scripts/reward-eligibility-mock.mjs`
- Test: `tests/reward-eligibility-mock.test.js`

- [x] **Step 1: Implement the pure module**

Create a self-contained module that:

- imports `createHash` from `node:crypto`
- defines `REWARD_ELIGIBILITY_MOCK_CONSENT`
- defines allowed input fields exactly from ADR-024
- defines forbidden promotion terms from ADR-024
- validates exact consent
- validates input object and allowed fields
- scans serialized input for forbidden terms
- maps `local_context.prototype_scenario` to the four allowed statuses
- returns a frozen, deterministic, schema-tagged review object

- [x] **Step 2: Run the narrow test**

Run:

```bash
node --test tests/reward-eligibility-mock.test.js
```

Expected: pass.

### Task 3: Delivery Check Integration

**Files:**
- Modify: `scripts/delivery-check.mjs`
- Test: `npm run delivery:check`

- [x] **Step 1: Add ADR-024/G20 exercise**

Add a small `try` block after the ADR-021 mock scoring exercise. It imports `createMockRewardEligibilityReview`, `loadExampleRewardEligibilityInput`, and `REWARD_ELIGIBILITY_MOCK_CONSENT`, creates one review, and checks:

- `id` starts with `sha256:`
- `review.claim_label` exists
- `review.consent_status === "required"`
- `review.review_status === "local_review_only"`
- `review.receipt_expectation.placeholder === true`
- `boundary.noReward === true`

- [x] **Step 2: Run delivery check**

Run:

```bash
npm run delivery:check
```

Expected: exit 0 and print `ADR-024 reward eligibility mock integrated: PASS`.

### Task 4: Local Verification

**Files:**
- Verify all touched files.

- [x] **Step 1: Run targeted and required local gates**

Run:

```bash
node --test tests/reward-eligibility-mock.test.js
npm test
npm run check
npm run llm:guidance
git diff --check
```

Expected: all commands exit 0. Existing known B-bucket classifier output is acceptable only if it matches the repo classifier and exits 0.

- [x] **Step 2: Inspect git diff**

Run:

```bash
git diff -- docs/superpowers/specs/2026-06-08-g20-reward-eligibility-mock-local-prototype-design.md docs/superpowers/plans/2026-06-08-g20-reward-eligibility-mock-local-prototype.md tests/reward-eligibility-mock.test.js scripts/reward-eligibility-mock.mjs scripts/delivery-check.mjs
```

Expected: no reward implementation, no token logic, no receipt write, no network, no runtime, no public bridge.

- [x] **Step 3: Commit locally**

Run:

```bash
git add docs/superpowers/specs/2026-06-08-g20-reward-eligibility-mock-local-prototype-design.md docs/superpowers/plans/2026-06-08-g20-reward-eligibility-mock-local-prototype.md tests/reward-eligibility-mock.test.js scripts/reward-eligibility-mock.mjs scripts/delivery-check.mjs
git commit -m "feat(adr-024): reward eligibility mock local prototype"
```

Expected: local commit only. Push remains blocked until explicit operator GO.
