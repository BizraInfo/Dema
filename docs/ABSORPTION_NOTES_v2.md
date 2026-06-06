# Absorption Notes — v2

Patterns Dema studies from external reference projects. Read on disk, mapped against Dema's roadmap and invariants.

**Stance.** Dema stands on the shoulders of giants; it does not ingest them. The project below is studied for design patterns. Its code does not ship in this repo, and it lives outside the canonical product tree (under `~/Downloads/the-verifier-agent-main/` on the host that produced these notes).

**Method.** For each pattern: name what it solves, mark whether Dema already implements an equivalent, and note when it would apply if not yet present. Patterns that violate Dema invariants (zero runtime deps, one face, no shadow state, exact consent, no hidden daemon) are listed as _refused_.

**Context.** v1 absorbed Hermes/OpenClaw before SEED closed. v2 lands at the SEED → SPROUT transition (ARTIFACT-011 issued, chain length > 0). The relevant near-horizon is **B1 — continuous bounded diagnostics** from `docs/NODE0_ACTIVATION_ROADMAP.md`. v2 is filtered through that lens.

## Sources read

| Project           | Path                                                                                    | Lines read |
| ----------------- | --------------------------------------------------------------------------------------- | ---------- |
| pi-verifier-agent | `~/Downloads/the-verifier-agent-main/README.md`                                         | 187        |
| pi-verifier-agent | `~/Downloads/the-verifier-agent-main/.pi/verifier/agents/verifier.md`                   | 90         |
| pi-verifier-agent | `~/Downloads/the-verifier-agent-main/apps/verifier/_shared/ipc.ts` (header + envelopes) | ~80        |
| pi-verifier-agent | `~/Downloads/the-verifier-agent-main/apps/verifier/verifier.ts` (header)                | ~80        |
| pi-verifier-agent | `~/Downloads/the-verifier-agent-main/justfile`                                          | 35         |

Total code surface inspected: ~3 970 LOC TypeScript (sampled, not fully read).

This partially closes the v1 open-queue entry for **pi.dev** — the verifier-agent IS a Pi-based reference project. `agent-zero` and `space-agent` remain in the open queue.

## Patterns to absorb (when Dema needs them)

### V1 — Verifier-as-template doctrine

**Pattern.** The verifier-agent's load-bearing artifact is a single Markdown file (`.pi/verifier/agents/verifier.md`, 90 lines) — frontmatter declares the tool surface, body codifies the verification discipline. The TypeScript (~4000 LOC) is transport plumbing; the doctrine is in the prompt template. _"You can't fix bugs by typing at the verifier — you fix them by editing the persona, the script, or the prompt template."_

**Apply when.** SPROUT B1 begins. A Dema-side verifier sibling needs its own persona file (suggested path: `docs/verifier-persona-v0.1.md`) that declares: tool surface (read, grep, find, ls, bash with read-only allowlist, plus a single mutate-back tool analogous to `verifier_prompt`), the decomposition discipline, the report shape, the escalation threshold. Code follows doctrine, not the other way around.

### V2 — CONFIDENCE ladder as runtime verification grammar

**Pattern.** Five levels with explicit color/semantics: `PERFECT` (every claim verified, no gaps) / `VERIFIED` (all checked passed, minor gaps) / `PARTIAL` (no failures but significant gaps) / `FEEDBACK` (failure caught, corrective sent) / `FAILED` (couldn't verify, escalating). Each level binds to a UI bar color. The verifier emits a `CONFIDENCE:` line on every report.

**Status in Dema.** Adjacent but not equivalent. Dema's truth labels (MEASURED / DERIVED / DECLARED / PLANNED / ASPIRATIONAL) are about _static claims_ in receipts and memory entries. CONFIDENCE is about _dynamic verification cycles_. Both have a place. **Apply when.** SPROUT B1 needs a per-cycle verdict shape. Recommendation: introduce `bizra.dema.verification_cycle.v0.1` with a `confidence:` field using the verifier-agent ladder verbatim, alongside the existing `truth_label` for the underlying claim. The two vocabularies compose cleanly.

### V3 — "The verifier teaches you what your verifier is missing"

**Pattern.** Every Report block has a mandatory `### What could you not verify?` section listing the gaps — missing oracle, no fixture, ambiguous claim, no harness. That gap _is_ the next thing to template into the persona or build a domain script for. The system grows its own verification surface from its own failures.

**Status in Dema.** Structurally absent. Receipts today record what happened, not what couldn't be verified about what happened. **Apply when.** SPROUT B1's continuous bounded diagnostics emit their first verifier reports. Add an `unverifiable[]` field to the receipt schema; aggregate monthly into `~/.dema/memory/verification_gaps.json`; that file becomes the input for the next persona / script iteration. This is the autopoietic loop applied to verification specifically — same pattern as `feedback_validate_dont_assume.md` extended to runtime cycles.

### V4 — Decomposition discipline as anti-bundling

**Pattern.** _"A single PASS that hides three unverified sub-claims is worse than three explicit FAILs."_ Every claim is broken into the smallest atomic unit that can be independently proven or disproven. "I added the user with auth" is at least three claims (user record exists, auth record exists, link is correct).

**Status in Dema.** This is CLAIM_MUST_BIND extended to verification semantics. Already an active invariant for static claims; not yet codified for dynamic verification. **Apply when.** Drafting the verifier persona (V1). The Report's `### What did you verify?` section format — one bullet per atomic claim with cited tool output — should be lifted verbatim into Dema's verifier-cycle schema. Domain-naming aside, the rule is universal.

### V5 — Defense-in-depth on bash (three-layer enforcement)

**Pattern.** Read-only access enforced by THREE independent mechanisms:

1. Tool list in persona frontmatter (`tools: read, grep, find, ls, bash, verifier_prompt`) — declarative
2. Persona body restricts bash to read-only commands (`cat`, `head`, `tail`, `wc`, `diff`, `git diff|log|show|status|blame`, `jq`, language-native test runners in dry-run/list mode) — prompt-level enforcement
3. Domain-specific personas can pin bash to a single allowlisted script (the highest level — anything outside the script blocked)

**Status in Dema.** A4.5 Dema Autonomy Envelope defines L0–L5 levels but does not yet codify _how_ a verifier sibling enforces L0 (Observe) at the tool layer. **Apply when.** SPROUT B1's verifier sibling exists. The verifier should run with tool surface declared in its persona frontmatter, with bash pinned by allowlist. This is the operational form of "L0 by enforced contract" — same shape as the gateway HTTP adapter's GET-only test assertion (PR #10), now extended to a sibling agent's full runtime.

### V6 — Escalation threshold as doctrine constant

**Pattern.** `max_loops: 3` in the persona frontmatter. After three verifier corrections, the system surfaces "escalating to human" instead of auto-injecting another correction. The threshold is doctrine-as-constant; changing it requires editing the persona, not the runtime.

**Status in Dema.** A4.5 envelope has halt-gates per level but no loop-count escalation. **Apply when.** B1's continuous bounded diagnostics start producing `FEEDBACK`-grade verifications. Recommendation: add `max_corrective_cycles` to the verifier persona frontmatter (default 3); on the (N+1)-th attempt the verifier emits a `STATUS: unsure` + `CONFIDENCE: FAILED` and writes to `~/.dema/memory/escalations/<receipt_id>.json` for operator review. Loop-count escalation complements halt-gates — different failure modes, both needed.

## Patterns refused (would violate Dema invariants)

| Pattern                                                                | Why refused                                                                                                                                                                                                                |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pi-coding-agent extension API + tmux launcher (3 970 LOC TypeScript)   | Pi-specific transport. Dema is Node.js + zero-dep. Reimplementing the same shape over Dema's existing gateway HTTP would be a thinner layer; absorb the _pattern_, not the _code_.                                         |
| Two OS-level terminal windows for builder + verifier                   | Dema is a CLI library, not an interactive runtime UI. The verifier sibling, when it exists, runs as a subprocess or scheduled job — no tmux required.                                                                      |
| Builder owns a unix domain socket; verifier connects                   | Dema↔gateway already speaks HTTP on `127.0.0.1:7421`. The unix-socket discipline (`chmod 0700` as authentication, short path under `/tmp/pi-verifier/<sid>.sock`) is principled but redundant with the existing transport. |
| Verifier-as-status-bar UI (colored bar replaces input editor)          | Out of scope for Dema CLI. The CONFIDENCE color semantic still maps to terminal output formatting if Dema's status command grows a richer view, but no live editor manipulation.                                           |
| `verifier_prompt` as the only mutate-back channel via Pi extension API | Dema's existing channel is local-state writes (`~/.dema/memory/verifier_findings/<receipt_id>.json`) — operator reads via `dema memory show`. Same shape, different transport, more aligned with ADR-002 / ADR-004.        |

## Highest-leverage lifts for SPROUT (B1 — continuous bounded diagnostics)

The verifier-agent's pattern maps almost exactly onto B1. Three concrete lifts:

1. **Author the verifier persona before writing any verifier code.** Per V1: doctrine first, transport second. Suggested file: `docs/verifier-persona-v0.1.md` with frontmatter (tool surface, max cycles, model, domain) and body (decomposition discipline, evidence-cited verdicts, report block shape). The eventual TypeScript implementation in `packages/verifier/` is then a thin transport over the doctrine.

2. **Adopt the CONFIDENCE ladder verbatim into the receipt schema.** Per V2 + V3 + V4: a B1 receipt should carry `truth_label` (existing) + `confidence` (new, from the ladder) + `unverifiable[]` (new, the gaps). The receipt becomes both a record of what was done AND a record of what couldn't be verified about it. The `unverifiable[]` aggregation drives next-cycle persona evolution.

3. **Codify L0 enforcement via three-layer defense-in-depth.** Per V5: the verifier sibling's L0 status should be enforceable, not just doctrinal. (a) Tool surface in persona frontmatter. (b) Bash allowlist in persona body. (c) For the first domain-specific verifier (likely `bounded-diagnostic-verifier`), pin bash to a single script under `packages/verifier/scripts/`. Same enforcement shape as the gateway HTTP adapter's GET-only test (PR #10) extended to a richer sibling.

## Open queue (not yet read on disk)

- **agent-zero** — referenced in v1 open queue; still pending.
- **space-agent** — referenced in v1 open queue; still pending.
- **rest of pi.dev ecosystem beyond the verifier-agent** — IDE integration, branchable session tree pattern, custom provider routing.
- **AutoHotKey** — historical lineage referent (already captured in mission-centric thesis).
- **Telescript** — historical lineage referent (already captured in mission-centric thesis).

Adding any of these requires either pulling them locally first (see `~/Downloads/` or `/data/bizra/giants/` patterns) or explicit authorization to fetch their public docs from the network.

## What v2 closed from v1's open queue

| v1 open-queue entry                      | v2 status                                                                                                                                                                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pi.dev — branchable session tree pattern | **Partially absorbed.** The verifier-agent IS Pi-based. The session JSONL discipline is captured in V1; the `pi.sendUserMessage(deliverAs:"followUp")` callback shape is captured in V6's escalation threshold. Branchable session tree itself remains unstudied. |
| agent-zero                               | Still open.                                                                                                                                                                                                                                                       |
| space-agent                              | Still open.                                                                                                                                                                                                                                                       |
