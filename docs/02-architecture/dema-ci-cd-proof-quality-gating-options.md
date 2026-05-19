# Dema CI/CD — proof-quality gating: trade-off surface for broad-scope PRs

**Status:** Architectural discussion surface — no decision encoded, no edits proposed
**Author:** automated audit, 2026-05-16
**Related:** PR #44 (`adr/007-accept-clean`), ADR-006 (continuous assurance), ADR-007 (multi-session chain policy)

## What this document is and is not

**Is:** a trade-off analysis surfacing why `proof-quality` does not match broad-scope acceptance PRs today, and the conceptual shape of three resolution paths the operator might consider.

**Is not:** an implementation plan, an edit prescription, or an authorization to modify any CI workflow or gating configuration. Any change to `.github/workflows/bizra-review.yml`, `scripts/review/pr-class.mjs`, or `scripts/review/proof-scope.mjs` is a halt-gate per project policy and requires operator typed-GO. This document hands the operator the shape of the decision; the operator owns the choice and any subsequent implementation.

## Why the current shape is mismatched

The `proof-quality` job in `bizra-review.yml` reflects a one-class-per-PR discipline:

- A PR's head-branch name maps to a `BIZRA_REVIEW_CLASS`
- That class pins an allowlist of "primary files" plus a small set of "required files"
- The job fails if (a) the head branch matches no class or (b) the PR changes a file outside its class's allowlist

This is well-tuned for **feature-class PRs** — narrow scope, well-defined surface, predictable file footprint.

It is **mismatched for broad-scope acceptance PRs** like the ADR-007 acceptance (PR #44, 53 files across 8+ top-level directories). The acceptance PR is broad by design: ADR file + Node0 Homebase + Shared URP + Integration Foundry registry + 5 sibling implementations + TUI design + UX Proof Harness + 2 review scripts + RDR-001 + dependency closure. No existing class fits. Inventing one with a 53-file allowlist would be brittle.

PR #44's `proof-quality` failure is purely structural — it fails at the *"Resolve BIZRA review class"* step because the branch name `adr/007-accept-clean` matches none of the workflow's existing cases. All other CI checks (test 20.x, test 22.x, CodeQL, Socket, Analyze) pass cleanly.

## Three resolution shapes (conceptual only — no edits prescribed)

### Option Q — broad-scope class with allowlist short-circuit

Introduce a single new review class whose validator opts out of the file-allowlist check, intended for PRs that intentionally span many feature areas. Branches under acceptance/policy prefixes would map to it.

- **Pros:** Smallest delta. Preserves strict allowlist for feature classes.
- **Cons:** Allowlist enforcement skipped on broad-scope branches — reviewer discipline replaces automated guardrail.
- **Forward-compat:** medium.

### Option R — explicit file-allowlist enumeration

Add an ADR-acceptance class with primary-files literally enumerating every changed file in PR #44.

- **Pros:** Most faithful to the existing single-source-of-truth pattern.
- **Cons:** Brittle — every new file added requires a class edit. High operational friction. Sets a precedent of co-editing proof-scope for each acceptance PR.
- **Forward-compat:** low.

### Option S — informational proof-quality for broad-scope branches

Make `proof-quality` non-blocking (advisory) for branches matching a broad-scope pattern. The job still runs and reports its JSON to reviewers, but it does not block merge for those branches.

- **Pros:** Cleanest separation between feature-PR gating and acceptance-PR oversight. Reviewer treats advisory report as a real signal.
- **Cons:** Biggest workflow restructure. Discipline now lives in reviewer behavior, not in the gate.
- **Forward-compat:** high.

## Decision matrix

| Criterion | Q | R | S |
|---|---|---|---|
| Approx. delta size | small | large | medium |
| Workflow file edit required | yes | no | yes |
| Class-config file edit required | yes | yes | yes |
| Maintenance burden | low | high | low |
| Faithful to one-class-per-PR | partial | yes | partial |
| Unblocks PR #44 | yes | yes | yes |
| Forward-compat for future acceptance PRs | medium | low | high |

## Recommendation

**Option Q for PR #44 short-term, Option S for the longer-term architecture.** Q lets #44 merge with minimal patch cost; S lets future broad-scope acceptance PRs flow without inventing throwaway classes each time. R is recommended against on maintenance-burden grounds.

This is a recommendation, not a decision. The operator owns the choice and the implementation.

## Halt-gates that bound this document

- Modifying `.github/workflows/bizra-review.yml`: halt-gate. Not edited by this document.
- Modifying class definitions in `scripts/review/pr-class.mjs` or `scripts/review/proof-scope.mjs`: halt-gate. Not edited by this document.
- Modifying any other CI configuration: halt-gate. Not touched.

The companion artifact `scripts/review/env-hygiene-check.mjs` (preventive infrastructure that institutionalizes the verify-test-env discipline from the 2026-05-16 retraction) is an additive net-new script in `scripts/review/` — it does **not** modify any existing gating logic, does not add a new review class, and does not change which files any existing class considers in-scope. It is a standalone lint that operators may choose to invoke.

## Operator's next move

If the operator chooses to act on any of Q / R / S:

1. Read the current shape of `.github/workflows/bizra-review.yml`, `scripts/review/pr-class.mjs`, and `scripts/review/proof-scope.mjs`
2. Pick Q, R, or S
3. Type a fresh GO of the form `GO: proof-quality option Q` (or R, or S) on a separate branch
4. Implementation can then proceed with workflow-edit authorization in scope

If the operator chooses **not** to act: PR #44 can still merge with `proof-quality` overridden one-time by a reviewer. The other 7 CI checks pass cleanly.
