# ADR-012 — CLI Naming Convention

**Status:** ACCEPTED  
**Date:** 2026-05-19  
**Context:** Dema UX upgrade arc (Task #12 of 12)

---

## Context

The Dema CLI has grown across multiple sprint seasons, accumulating commands registered by
different authors at different times. A naming audit on 2026-05-19 (branch
`season-gap2-summary-flag`, HEAD `57ca642`) found four distinct patterns in use simultaneously.

### Pattern count (verified against `REGISTERED_COMMANDS_LIST` in `apps/cli/src/index.js`)

| Pattern              | Example(s)                                                                                                                                                                                                                                                                                                                                                               | Count                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| **single-word**      | `status`, `doctor`, `today`, `welcome`, `setup`, `onboard`, `explain`, `ambient`, `state`, `profiles`, `receipts`, `memory`, `models`, `task`, `sovereign`, `monetize`, `help`                                                                                                                                                                                           | 17                                     |
| **space-subcommand** | `mission draft`, `mission propose`, `consent plan`, `diagnostics plan`, `models scan`, `memory show`, `report safety`, `network blueprint`, `network fixture preview`, `network refusal preview`, `amana contracts preview`, `mcp blueprint`, `roadmap preview`, `evidence receipt preview`, `ihsan floor preview`, `behavior modulation preview`, `design emulate-loop` | 17 (grouped under 13 top-level tokens) |
| **kebab**            | `consent-card`, `mission-loop`, `evidence-event`, `node-registry`, `onboarding-lifecycle`, `skill-growth-governor`, `project-status`, `craftsmanship-witness`, `llm-router`, `process-mining`, `key-maker-check`, `llm-invoke`, `master-craftsmanship` _(amendment 2026-05-19)_                                                                                          | 13                                     |
| **colon-format**     | `status:json`, `ambient:json`                                                                                                                                                                                                                                                                                                                                            | 2                                      |

Total tokens in `REGISTERED_COMMANDS_LIST`: 42 (including top-level dispatch tokens for
space-subcommand groups).

---

## Decision

Codify the existing conventions as canonical rather than retroactively renaming commands.
Renaming would be a breaking change requiring a major version bump and migration guide; the
cost/benefit is unfavorable at this stage.

### Canonical rules for new commands

1. **Single-word** — for atomic top-level commands with no subcommand modes.  
   Use when the command does exactly one thing (`dema status`, `dema doctor`, `dema today`).

2. **Space-subcommand** — **PREFERRED for all new commands** that have or will have multiple
   modes, or whose concept spans two nouns.  
   Pattern: `dema <noun> <verb>` or `dema <noun> <noun> <verb>`.  
   This arc's new commands (`dema explain`, and the suggester wiring visible via the default
   handler) follow this intent: `explain` is single-word because it takes a positional argument,
   not a subcommand.  
   Examples: `dema mission draft`, `dema models scan`, `dema behavior modulation preview`.

3. **Kebab** — **GRANDFATHERED ONLY**. The 12 kebab commands listed above are preserved as-is
   for backwards compatibility. No new commands should be added in kebab format.

4. **Colon-format** (`status:json`, `ambient:json`) — **SPECIAL CASE, NOT RECOMMENDED for new
   commands**. These two exist for machine-parseable output alternatives to single-word commands.
   New output format variants should use `--json` on an existing command instead.

---

## Consequences

- **Positive:** Convention is now documented. The drift-guard lint test
  (`tests/cli-naming-convention.test.js`) prevents new commands from silently adding to the
  kebab or colon allowlists.
- **Positive:** New contributors have a clear rule: use space-subcommand or single-word.
- **Negative:** The 12 legacy kebab commands remain inconsistent with the preferred pattern.
  This is an accepted technical debt item.
- **Neutral:** `dema explain` (added in Task #6 of this arc) and suggester wiring follow the
  single-word pattern correctly.

---

## Alternatives considered

| Alternative                                                      | Rejected reason                                                                                                                                                         |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full normalization (rename all kebab to space-subcommand)        | Breaking change. Any script or CI job using `dema consent-card` would break. Requires major version bump, migration guide, and deprecation shims.                       |
| Full colon convention (`dema status:json`, `dema missions:list`) | Non-standard CLI idiom. Colon is typically a namespace separator, not a subcommand separator. Would confuse users familiar with Heroku/GitHub CLI patterns.             |
| Full kebab for all commands                                      | Harder to type and read for multi-word concepts. Space-subcommand (`dema mission draft`) is more natural and matches the Heroku CLI pattern that has proven UX success. |
| Full single-word for all commands                                | Would require either very long single words (`dema networkrefulsal`) or abbreviations (`dema nrp`) — both poor for discoverability.                                     |

---

## Future work

The following renames would improve consistency and MAY be executed in a future breaking-change
release with a scoped GO and deprecation shims:

| Current (kebab)              | Preferred (space-subcommand) |
| ---------------------------- | ---------------------------- |
| `dema consent-card`          | `dema consent card`          |
| `dema mission-loop`          | `dema mission loop`          |
| `dema evidence-event`        | `dema evidence event`        |
| `dema node-registry`         | `dema node registry`         |
| `dema onboarding-lifecycle`  | `dema onboarding lifecycle`  |
| `dema skill-growth-governor` | `dema skill governor`        |
| `dema project-status`        | `dema project status`        |
| `dema craftsmanship-witness` | `dema craftsmanship witness` |
| `dema llm-router`            | `dema llm router`            |
| `dema process-mining`        | `dema process mining`        |
| `dema key-maker-check`       | `dema key check`             |
| `dema llm-invoke`            | `dema llm invoke`            |

Each rename requires: (a) explicit typed GO, (b) deprecation shim for the old name printing a
one-line migration hint for ≥1 release cycle, (c) update to `REGISTERED_COMMANDS_LIST`,
`HELP` string, and all test fixtures, (d) semver minor bump.

---

## Enforcement

`tests/cli-naming-convention.test.js` asserts:

1. No new colon-format commands beyond the allowlist (`status:json`, `ambient:json`).
2. No new kebab commands beyond the 13-entry legacy allowlist (extended by 1 on 2026-05-19; see §Amendments).
3. Every command in `REGISTERED_COMMANDS_LIST` is classifiable into one of the four known
   patterns (catch-all guard against future unclassifiable patterns).

The test reads `REGISTERED_COMMANDS_LIST` directly from `apps/cli/src/index.js` — the live
source of truth — so it does not drift from the actual command surface.

---

## Amendments

### 2026-05-19 · +1 kebab allowlist entry: `master-craftsmanship`

**Context.** ADR-011 phase-4 (commit `4125a42`) shipped the full T-1..T-18 + P1-P10 compliance suite. To consolidate that artifact under master-craftsmanship canon — i.e., to prove it meets the 10 master-craftsmanship invariants by EXTERNAL audit rather than self-assertion — commit `3d8522e` shipped a new audit module + CLI surface `dema master-craftsmanship audit [<path>] [--json]`. The audit verdict on the compliance suite was COMPLIANT (10/10).

**The drift.** The top-level token `master-craftsmanship` is kebab. ADR-012 §Decision rule 2 says "No new kebab commands beyond the 12-entry legacy allowlist." Strict reading: this commit either violates the rule OR requires this amendment.

**Decision.** Extend the kebab allowlist from 12 to 13 entries with `master-craftsmanship`. The rationale is:

1. **Companion to `craftsmanship-witness`** — already in the allowlist. The new command's prefix is intentionally aligned ("craftsmanship" stem) so the two surfaces feel related; using a different stem (e.g., `quality-audit`) would lose that semantic linkage.
2. **No new convention introduced** — the amendment uses the existing kebab pattern, not a fourth convention. The total convention count remains 4 (single-word · space-subcommand · kebab · colon-format).
3. **Audit-class command, not action-class** — `master-craftsmanship audit` reads (does not mutate state). Discoverability matters more than terseness; the long-form name is acceptable for a low-frequency audit surface.

**Alternatives considered.**

| Option                                                                    | Why rejected                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rename to `craftsmanship-witness audit` (subcommand under existing kebab) | Would conflate the SELF-witness surface (the existing builder asserts its own MC compliance) with the EXTERNAL-witness surface (the new auditor judges other artifacts). Different semantics deserve different top-level tokens. |
| Rename to `audit` (single-word)                                           | Too generic. `dema audit` could mean many things in the future; the master-craftsmanship dimension would be invisible.                                                                                                           |
| Skip the allowlist extension and ship the command anyway                  | Violates the ADR's own drift-guard rule and creates silent precedent that lint can be ignored. ADR governance requires the amendment to be explicit.                                                                             |

**Consequence.** Future amendments must follow the same pattern: typed-GO + ADR-012 amendment block + KEBAB_ALLOWLIST update + commit message reference. The amendment cap remains at 4-5 conventions (no new pattern is introduced); allowlist growth is bounded by the principle that NEW commands should prefer space-subcommand and only request kebab when a strong semantic-linkage argument applies.

**Future work.** If audit becomes a recurring class (e.g., `master-craftsmanship audit`, `provenance audit`, `dependency audit`), promote `audit` to a top-level space-subcommand pattern with `dema audit <subject>` and deprecate the kebab `master-craftsmanship` entry in a future major version.

### 2026-06-18 · +1 kebab allowlist entry: `peak-self-loop`

**Context.** PEAK-SELF-LOOP-1A ships `dema peak-self-loop` and routes `dema realm proof-studio` / menu item 5 to the same ultra-micro self-loop preview (SNR · convergence · HHMM diffusion · proactive self harness). The token is kebab-linked to `craftsmanship-witness` as a composed spine surface.

**Decision.** Extend the kebab allowlist to 15 entries with `peak-self-loop`. Semantic linkage to the existing craftsmanship witness family; no new naming convention introduced.

**Consequence.** `tests/cli-naming-convention.test.js` kebab count guard expects 15.
