# README v0.2 · Design Proposal

**Status:** PROPOSAL · design ready · awaiting typed-GO for implementation
**Date:** 2026-05-24 GST
**Authors:** Coordinator (Claude Opus 4.7) at Mumu's direction · output of the `planner` subagent (run_id `aa65adc250041c8fa`) routed through full Dema doctrine context + per-file disk read of current README, PRODUCT.md, CURRENT_LIMITS.md, INDEX.md, A_PLUS_BLUEPRINT_v0_1.md, BIZRA_NODE0_DEMA_GOAL_SCRIPT_v0_1.md, ROADMAP.md, and user-scope CLAUDE.md.
**Scope:** Full rewrite of `/home/bizra-operating-system/Downloads/Dema/README.md` (the top-level README) to fix cold-visitor pull-page failure mode.
**Implementation typed-GO:** see §9 below.

---

## Why this proposal exists

The operator identified on 2026-05-24 that the current 426-line README is correct but operator-internal in voice. A cold visitor (Twitter / HN / Google / Lighthouse Pack invitation) has ~10–30 seconds of attention. The current README's first screen does not pull them in — they bounce before reaching the substance.

This proposal is the **planner output** for a focused rewrite that:
- Hits the cold-visitor 30-second test
- Surfaces trust signals as numbers at the top
- Replaces command-doc-style sections 2-9 with a single curated deeper-reading table
- Preserves every load-bearing verbatim string
- Stays within Dema discipline (no bombast · no badge-image services · no decimal scores · truth labels intact)

The plan is implementation-ready: §4 contains concrete content drafts for every critical section. An implementer can execute the rewrite from this document without further design decisions.

---

## 1. Recommended path

**Full rewrite, not additive.** The current 426-line file is structurally inverted (commands at line 50, product promise at line 380) and section-shaped like a man page; pasting a new top onto it will not fix the inversion.

The rewrite preserves every load-bearing string verbatim (current lines 23–24, 76–77, 380–388, 394–414, 418–426) but **re-orders aggressively**: hook → stats → diagram → narrative → comparison → tour → install → promise → boundary → proof → deeper-reading.

Target ~240 lines (43% reduction from 426). All command-reference depth migrates to `docs/PRODUCT.md` (already authoritative) and `docs/INDEX.md` (already curated). The README becomes the **cold-visitor pull-page**; the docs/ dir stays the depth lane.

---

## 2. Decomposition (10 sub-tasks · ~3.5–4 h total)

| # | Sub-task | Effort | Source | Replaces current lines |
|---|---|---|---|---|
| 1 | Replace opening tagline + 4-line stance + stats badges row | 30 min | needs writing; numbers from disk at impl time | 1–13 |
| 2 | Insert ASCII trust-topology diagram | 30 min | needs writing; structure from A_PLUS_BLUEPRINT §2.1 + goal-script Mission Lifecycle | new |
| 3 | Write "What is Dema?" 80-word narrative + Sara scenario | 30 min | distill PRODUCT.md lines 17–43; scenario needs writing (must match actual `dema status` output) | rewrites 28–42 |
| 4 | Write "Why does it exist?" 2-paragraph block | 15 min | distill goal-script lines 20–38 | new |
| 5 | Build "How does it compare?" 6-property × 4-tool binary table | 30 min | needs writing; properties grounded in CURRENT_LIMITS.md MEASURED rows | new |
| 6 | Compress "60-second tour" + first-impression block | 15 min | keep 5 commands + impression; trim repetition | 44–90 |
| 7 | Relocate 5-line product promise (verbatim) | 15 min | keep verbatim lines 380–388 | move from 380 to ~136 |
| 8 | Compress "Current boundary" + "Proof of priority" into one section | 30 min | keep substance verbatim or near-verbatim | 392–426 |
| 9 | Replace 8 command-section man-page with one curated deeper-reading 5-row table | 30 min | links from INDEX.md "Current public front doors" | 93–333 |
| 10 | Final pass: line-count audit · truth-label sweep · eval:layer1 dry-run · link check | 30 min | self | whole file |

---

## 3. Final README structure (section-by-section)

| § | Header | Content summary | Line budget |
|---|---|---|---|
| 0 | `# Dema · your sovereign AI companion` (H1) | Tagline + 4-line stance | 1–10 |
| 1 | (no header) | Stats badges row + ASCII trust-topology diagram | 11–35 |
| 2 | `## What is Dema?` | 80-word narrative + Sara scenario | 36–55 |
| 3 | `## Why does it exist?` | 2 short paragraphs on the pain point | 56–75 |
| 4 | `## How does it compare?` | 6-property × 4-tool binary table + 1-line caveat | 76–100 |
| 5 | `## 60-second tour` | 5-command block + expected first impression + 4-bullet honest negative-space | 101–135 |
| 6 | `## The product promise` | 5-line poetry block (verbatim) | 136–148 |
| 7 | `## Install` | Guided installer + PLANNED-not-live banner + developer install | 149–180 |
| 8 | `## Current boundary` | ARTIFACT-011 origin + Bitcoin-anchored proof spine + `npm run priority-anchor:verify` | 181–210 |
| 9 | `## Where to go next` | Live anchor pointer (`dema roadmap dev`) + curated 5-row deeper-reading table | 211–235 |
| — | Footer | "BIZRA is the ecosystem. Dema is the door." + last-refreshed date + refresh trigger | 236–245 |

**Total: ~240 lines** (down from 426; 43% reduction).

---

## 4. Concrete content drafts for the critical sections

These are ready-to-use drafts. Implementer can paste them verbatim into the new README (after the impl-time disk re-verification noted in §6 / §7).

### 4.1 Opening tagline (replaces current line 3)

```markdown
# Dema · your sovereign AI companion

> Local AI you can audit. Every action consented. Every claim truth-labeled.
> Every consequential step produces an inspectable receipt.

**No daemon. No remote provider. No autonomy you didn't authorize — by design.**
```

Note: the current line 3 ("A deterministic constitutional execution engine with replayable receipts") stays in `docs/PRODUCT.md` §1 and ADR contexts where the reader has already opted-in.

### 4.2 Stats badges row (plain markdown table, NOT shields.io)

Zero-dep posture extends to README assets. Render as a plain markdown table:

```markdown
| Tests | Prod deps | Dev deps | ADRs | Receipts | License | Network at runtime |
|---|---|---|---|---|---|---|
| 2,602 PASS | 0 | 0 | 18 accepted | ARTIFACT-011 + Bitcoin-anchored spine | MIT | 0 (stdlib only) |

*All seven cells are `MEASURED` — verify locally with `npm test` · `cat package.json` · `ls docs/06-adr/` · `npm run priority-anchor:verify`.*
```

**Impl-time caveat (per §6 R6):** implementer must re-count from disk: `node --test tests/*.test.js 2>&1 | tail -3` + `ls docs/06-adr/*.md | wc -l`. The numbers shown here are 2026-05-24 snapshot; refresh on the day of merge.

### 4.3 ASCII trust-topology diagram

```text
                    YOU (sovereign operator)
                            │
                    typed exact-string consent
                            │
                            ▼
              ┌─────────────────────────────┐
              │   Dema (the door · CLI)     │   ← reads · lists · previews
              │   - stdlib only             │
              │   - $DEMA_HOME (~/.dema/)   │
              │   - no daemon · no network  │
              └──────────────┬──────────────┘
                             │
                  preview / refusal / receipt
                             │
                             ▼
       ┌─────────────────────────────────────────┐
       │  Local model (Ollama · LM Studio · ...) │   ← runs on YOUR machine
       └─────────────────────────────────────────┘
                             │
                  (governed upstream lane · not Dema)
                             │
                             ▼
            BIZRA Node0 gateway (issues receipts)
```

Caption immediately below:
> *The dashed boundary is governed by the upstream gateway; receipts are read/listed by Dema, never minted locally.*

### 4.4 "What is Dema?" 80-word narrative + Sara scenario (replaces current lines 28–42)

```markdown
## What is Dema?

Dema is a command-line companion for running local AI on your own
machine, with one invariant: **nothing consequential happens without
your typed consent, and everything consequential that does happen
leaves a receipt you can read**.

There is no daemon. No upload. No invisible agent. Just a small CLI
that shows you what is ready, what is blocked, what it can safely
preview, what requires an exact consent phrase, and what receipt
will prove the result.

**Sara opens her laptop:**

```text
$ dema status
Profile:    ~/.dema/profile.json          ✓
Local model: ollama · llama3.1:8b         ✓
Receipts:   1 (ARTIFACT-011 · 2026-05-06) ✓
Next safe action: dema roadmap dev
```

She knows in 5 seconds what's ready, what is blocked, and what the
next safe step is. No prompts to a remote API. No background tasks.
```

**Impl-time caveat (per §6 R7):** the `dema status` output shown must match actual disk output. Implementer runs `dema status` and uses the real format, not invented.

### 4.5 "Why does it exist?" 2 paragraphs (new)

```markdown
## Why does it exist?

Most "agentic AI" tools quietly trade your sovereignty for convenience:
opaque autonomy, hidden network calls, decisions made without your
typed consent, and no receipt you can audit afterward. The pattern
produces software that feels powerful and behaves untrustably.

Dema is the inverse experiment. Build the smallest possible local AI
companion where **every consequential step is gated by exact-string
consent, every claim is labeled `MEASURED` / `DESIGNED_NOT_LIVE` /
`PLANNED` / `LOCAL_ONLY`, and every artifact that leaves the operator's
machine has passed a structural safety scan**. If that minimum can be
held without external dependencies, the rest of BIZRA — Node0, PAT-7,
SAT-5, URP, Proof-of-Impact — can be built on top of a trustable seed
rather than a hopeful one.
```

### 4.6 Comparison table (new section)

Binary ✅/❌ only. No decimal scores. Date-stamped. Default-posture-as-of-2026-05.

```markdown
## How does it compare?

| Property | ChatGPT Desktop | Ollama | Claude Desktop | **Dema** |
|---|---|---|---|---|
| Runs without network at runtime | ❌ | ✅ | ❌ | ✅ |
| Zero production dependencies | ❌ | ❌ | ❌ | ✅ |
| Every consequential action requires typed consent phrase | ❌ | ❌ | ❌ | ✅ |
| Every L4 action produces an inspectable receipt | ❌ | ❌ | ❌ | ✅ |
| Truth labels on every claim (MEASURED / DESIGNED_NOT_LIVE / PLANNED) | ❌ | ❌ | ❌ | ✅ |
| Source-readable in a text editor (no compile step) | ❌ | partial | ❌ | ✅ |

> Competitor rows describe each tool's **default** posture as of 2026-05.
> They are not a feature war — Dema is doing a different job. See
> [`docs/PRODUCT.md`](docs/PRODUCT.md) for the lineage Dema combines.
```

### 4.7 5-line product promise relocation (move from current line 380–388 to ~line 136)

Preserved **verbatim** + supplementary sentence:

```markdown
## The product promise

Dema says:

> Here is what I know.
> Here is what is safe.
> Here is what is blocked.
> Here is what I can preview with your consent.
> Here is the receipt.

When Dema cannot say all five of those honestly, Dema refuses the
action and surfaces the refusal as a receipt of its own.
```

The second paragraph is from `docs/PRODUCT.md` lines 86–87 and strengthens the original verbatim block.

### 4.8 Curated deeper-reading table (replaces dozens of scattered links)

```markdown
## Where to go next

```bash
dema roadmap dev    # live anchor: current branch · tests · last 5 merges
```

| If you are a... | Open this |
|---|---|
| Cold visitor who wants the product story | [`docs/PRODUCT.md`](docs/PRODUCT.md) |
| Reviewer verifying claims | [`docs/CURRENT_LIMITS.md`](docs/CURRENT_LIMITS.md) (MEASURED / DESIGNED_NOT_LIVE / PLANNED) |
| Developer reading code | [`docs/A_PLUS_BLUEPRINT_v0_1.md`](docs/A_PLUS_BLUEPRINT_v0_1.md) (component map) + [`docs/INDEX.md`](docs/INDEX.md) |
| Operator running first-run | [`docs/USER_LIFECYCLE.md`](docs/USER_LIFECYCLE.md) + [`docs/FIRST_RUN_WIZARD.md`](docs/FIRST_RUN_WIZARD.md) |
| Researcher of north-star intent | [`docs/BIZRA_NODE0_DEMA_GOAL_SCRIPT_v0_1.md`](docs/BIZRA_NODE0_DEMA_GOAL_SCRIPT_v0_1.md) |
```

Five rows; replaces dozens of scattered links throughout the current README. `docs/INDEX.md` already curates the full set for readers who want everything.

---

## 5. What to delete or trim from the current README

| Lines | Section | Action |
|---|---|---|
| 3 | "deterministic constitutional execution engine" tagline | Replace (§4.1) |
| 79–85 | "There are more commands once you are ready (...)" link dump | Delete; subsumed by §4.8 deeper-reading table |
| 93–112 | `## Sovereign journey` | Delete (one-line mention in deeper-reading or in `docs/PRODUCT.md`) |
| 114–171 | `## Ambient boundary` | Delete; operator-internal vocabulary, belongs in `docs/PRODUCT.md` or `docs/02-architecture/` |
| 173–196 | `## Consent planning` | Delete; link from deeper-reading |
| 198–217 | `## Diagnostics plan` | Delete; link from deeper-reading |
| 220–238 | `## Mission drafting` | Delete; link from deeper-reading |
| 241–254 | `## Local models` | Delete; link from deeper-reading |
| 257–274 | `## Safety report` | Delete; link from deeper-reading |
| 336–355 | `## What setup creates` | Trim to 4 lines or move to `docs/USER_LIFECYCLE.md` |
| 358–377 | `## Receipts` | Trim to 3 lines or fold into "Current boundary" section |

**Net deletion: ~280 lines. Net addition: ~95 lines. Net file: ~240 lines.**

---

## 6. Risks (9 enumerated)

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Overclaim drift in marketing language — new tagline / "Why does it exist?" prose tempts language like "the first sovereign AI" or "fully autonomous yet safe" | **HIGH** | After the rewrite, run `npm run eval:layer1 -- --artifact /home/bizra-operating-system/Downloads/Dema/README.md` and read the verdict. **Caveat per CURRENT_LIMITS.md lines 107–113:** Layer 1 scanner is for runtime artifacts, not prose; verdict will not be `PUBLIC_SAFE` because the README references operator-side absolute paths legitimately. Use the scanner's overclaim/path findings as a checklist, not as a pass/fail. |
| R2 | Losing the 60-second discipline — rewrite may itself become long-form prose | MED | Enforce line-count budget per section (§3 table). If any section exceeds budget by >25% during implementation, halt and re-scope rather than ship a 350-line "new" README. |
| R3 | Loss of operator-internal audience — current README serves the operator's own re-orientation | MED | Footer line: "BIZRA is the ecosystem. Dema is the door." preserved verbatim; `dema roadmap dev` named at top of "Where to go next"; deeper-reading row for the goal script preserves operator self-orientation path. |
| R4 | Decimal-score / bombast creep | MED | CLAUDE.md user-scope rule. Comparison table (§4.6) uses ✅/❌ exclusively. No decimal scores. Reject any draft introducing a numeric score column. |
| R5 | Comparison-table accuracy — claims about ChatGPT Desktop / Ollama / Claude Desktop may be challenged | **HIGH** | Use only well-known **default-posture** properties; date-stamp the comparison; do not assert features that vary across versions or paid tiers. If any cell is uncertain at implementation time, mark as `?` and ask Mumu for the call. |
| R6 | Truth-label staleness in stats badges — "2,602 tests" / "18 ADRs" go stale on the next merge | MED | Implementation must re-count from disk at typed-GO moment: `node --test tests/*.test.js 2>&1 \| tail -3` and `ls docs/06-adr/*.md \| wc -l`. Footer says "Last refreshed: <date>". Add refresh-trigger line: "Refresh this row whenever `npm test` count changes by ≥50 or a new ADR is accepted." |
| R7 | Scenario-block invention risk — Sara scenario shows a `dema status` output | MED | The shown output must be a realistic `dema status` rendering. Implementer should run `dema status` on the operator's machine at implementation time and use the actual format, not invent one. If format differs from §4.4 draft, the draft yields to disk truth. |
| R8 | ASCII diagram referencing not-live surfaces — diagram names "BIZRA Node0 gateway" | LOW-MED | Diagram caption "(governed upstream lane · not Dema)" preserved + the dashed-boundary caveat sentence under the diagram. |
| R9 | Link rot in deeper-reading table | LOW | Every file referenced in §4.8 currently exists (verified via Read of docs/INDEX.md). Implementation includes `git diff --check` + manual `ls` check pre-commit on each referenced doc. |

---

## 7. Invariants to preserve

- All truth labels intact (`MEASURED` / `DESIGNED_NOT_LIVE` / `PLANNED` / `LOCAL_ONLY`).
- `install.bizra.ai` flagged as **PLANNED — not yet live** (current lines 296–298 banner preserved verbatim in new §Install).
- ARTIFACT-011 origin story preserved: **issued 2026-05-06 by the governed runtime, not minted locally**; phrase `GO: Node0 bounded diagnostic activation only` preserved verbatim; "Each future L4 mission requires its own typed phrase" preserved.
- Bitcoin-anchored proof spine preserved: `npm run priority-anchor:verify` command + `proof-of-priority/PIN.md` + `docs/PRIORITY_ANCHOR.md` links.
- `BIZRA is the ecosystem. Dema is the door.` preserved **verbatim** (currently lines 23–24; in v0.2 lives in footer).
- 5-line product promise preserved **verbatim** (currently lines 380–388; in v0.2 lives at §6, ~line 136).
- Pointers to `docs/PRODUCT.md` · `docs/CURRENT_LIMITS.md` · `docs/INDEX.md` · `docs/BIZRA_NODE0_DEMA_GOAL_SCRIPT_v0_1.md` · `docs/USER_LIFECYCLE.md` · `docs/FIRST_RUN_WIZARD.md` · `SPROUT_PIN.md`.
- No new dependency · no code change · no schema change.
- Layer 1 `eval:layer1` verdict on the rewritten README **WILL NOT be `PUBLIC_SAFE`** (per CURRENT_LIMITS.md lines 107–113: prose docs legitimately reference operator paths). Implementation does not chase `PUBLIC_SAFE`; it chases **no overclaim hits** specifically.
- ADR-018 / model-broker reference remains accurate if cited (and only if cited as `MEASURED`).
- Footer "Last refreshed: <date>" + refresh trigger line, matching the discipline already used by `docs/PRODUCT.md` line 131 and `docs/CURRENT_LIMITS.md` line 124.

---

## 8. Verification strategy

### How to know the rewrite achieved the goal

The 30-second cold-visitor test: fresh reader squints at the first screen (~line 1 through end of "How does it compare?" table, ~line 100) and within 30 seconds can answer the four questions:
- What is this? (one sentence)
- Why care? (one sentence)
- How is it different? (one row of the comparison table)
- What's the one next step? (`git clone` or "read PRODUCT.md")

If any of those four cannot be answered, the rewrite has not landed.

### Gates to run after the rewrite

```bash
# 1. README itself
git diff --check                      # whitespace / mixed tabs

# 2. Repo-wide gates (mandated by CLAUDE.md "Required local checks")
npm test                              # all 2,602 tests must still pass
npm run check                         # env-hygiene + tests + node0_self_check_verify
npm run llm:guidance                  # confirms canonical-flow links live

# 3. Artifact safety scan on the README
npm run eval:layer1 -- --artifact /home/bizra-operating-system/Downloads/Dema/README.md
#    - Expected: NOT PUBLIC_SAFE (prose doc; see CURRENT_LIMITS.md caveat)
#    - Required: no NO_OVERCLAIM hits flagging forbidden phrases from
#      CURRENT_LIMITS.md "Hard non-claims" list

# 4. Link-existence check (manual)
for f in docs/PRODUCT.md docs/CURRENT_LIMITS.md docs/A_PLUS_BLUEPRINT_v0_1.md \
         docs/INDEX.md docs/USER_LIFECYCLE.md docs/FIRST_RUN_WIZARD.md \
         docs/BIZRA_NODE0_DEMA_GOAL_SCRIPT_v0_1.md docs/RECEIPTS.md \
         docs/PRIORITY_ANCHOR.md proof-of-priority/PIN.md SPROUT_PIN.md; do
  test -f "/home/bizra-operating-system/Downloads/Dema/$f" || echo "MISSING: $f"
done
```

### Manual 30-second test method

Two passes:
- **Squint test**: operator opens the rewritten README in the GitHub web preview (after push to feature branch), waits 5 seconds, scrolls once, and reads aloud what they understood. If "I think it's a local AI thing with receipts and no daemon" lands within 30 seconds, pass.
- **External reader test** (post-merge, optional): paste raw README markdown to one Ring-1 reviewer with the prompt "What is this in one sentence?" Expected answer maps to §4.4's first paragraph.

### Markdown lint considerations

- Heading levels: one H1 (`# Dema · your sovereign AI companion`); the rest H2/H3. No skips.
- Fence language tags: `text` for terminal-output blocks; `bash` only for runnable bash. ASCII diagram uses `text`, not `bash` (otherwise GitHub tries to syntax-highlight it).
- No HTML in the rewrite (current README is pure markdown; preserve).
- No badge-image services (zero-dep posture extends to README assets: keep stats as a plain markdown table, not shields.io PNGs).

### New test needed?

**None.** This is doc-only. The existing onboarding-seal regression contract does not gate README prose.

---

## 9. Typed-GO line (for the implementation slice)

```text
GO ship readme-v0-2-rewrite as a full rewrite of /home/bizra-operating-system/Downloads/Dema/README.md
targeting ~240 lines, covering opening tagline + 4-line stance + 7-cell stats table + ASCII
trust-topology diagram + "What is Dema?" 80-word narrative + Sara scenario + "Why does it exist?"
2-paragraph block + "How does it compare?" binary 6-property × 4-tool table + compressed 60-second
tour + relocated 5-line product promise + Install section with PLANNED-not-live banner preserved
verbatim + Current boundary with ARTIFACT-011 origin story + Bitcoin-anchored proof spine +
curated 5-row deeper-reading table + footer with "BIZRA is the ecosystem. Dema is the door."
preserved verbatim, preserving every verbatim string named in §7 and all truth labels, no new
dependency · no code change · no schema change · no decimal scores · no badge-image services ·
no comparison cells beyond default-posture facts as of 2026-05.
```

Exact-string. Byte-comparison. No fuzzy match. Any deviation halts.

---

## When this proposal changes

This proposal is `v0.1` (the design itself · the README being rewritten is v0.2). Material edits to the structure (§3 table) or the verbatim-preservation set (§7) require a new proposal version + explicit operator typed-GO.

Refinements (typo fixes · content draft tightening · new risks discovered during implementation) may land through standard PR on the implementation slice itself.

Last refreshed: 2026-05-24.
