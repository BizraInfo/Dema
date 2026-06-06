# Absorption Notes — v1

Patterns Dema studies from external reference projects. Read on disk, mapped against Dema's roadmap and invariants.

**Stance.** Dema stands on the shoulders of giants; it does not ingest them. The two projects below are studied for design patterns. Their code does not ship in this repo, and they live outside the canonical product tree (under `/data/bizra/giants/` on the host that produced these notes).

**Method.** For each pattern: name what it solves, mark whether Dema already implements an equivalent, and note when it would apply if not yet present. Patterns that violate Dema invariants (zero runtime deps, one face, no shadow state, exact consent) are listed as _refused_.

## Sources read

| Project      | Path                                                  | Lines read |
| ------------ | ----------------------------------------------------- | ---------- |
| hermes-agent | `/data/bizra/giants/hermes-agent-2026.4.23/AGENTS.md` | 751        |
| openclaw     | `/data/bizra/giants/openclaw-2026.4.25/AGENTS.md`     | 182        |

## Patterns to absorb (when Dema needs them)

### H1 — Tool registry with auto-discovery (Hermes)

**Pattern.** Any `tools/*.py` with a top-level `registry.register()` call is auto-imported. No manual import list to maintain. Schema collection, dispatch, availability checking, and error wrapping live in the registry.

**Apply when.** Dema gains real tool execution (the Cycle-6 niyyah — first impact receipt via MCP tool transport). Until then, premature.

### H2 — Profile-aware home (Hermes)

**Pattern.** State files always go through `get_hermes_home()` and `display_hermes_home()`. Tools never hard-code `Path.home() / ".hermes"`. Each profile gets its own state.

**Status in Dema.** Already aligned. `process.env.DEMA_HOME ?? join(homedir(), ".dema")` is the resolution path in `receipt-store.js`, `today.js`, `setup.js`. The first-run smoke uses `DEMA_HOME` override (see [EVIDENCE_v0.2_first_run_smoke.md](EVIDENCE_v0.2_first_run_smoke.md)).

### H3 — Synchronous agent loop with budget and interrupt (Hermes)

**Pattern.** A simple `while iterations < max && budget.remaining > 0` loop. Tool calls dispatch, results append, messages stay in `{role, ...}` format. Interrupt checks each iteration.

**Apply when.** Dema executes its first bounded diagnostic. Currently propose-only by ADR-001 and ADR-005. The actual loop lives in `bizra-omega`, not Dema; Dema's job is the proposal and the receipt view.

### O1 — Plugin-SDK boundary (OpenClaw)

**Pattern.** Extensions cross into core only via `openclaw/plugin-sdk/*`, manifest metadata, runtime helpers, and documented barrels. No deep core access; no broad mutable registries; broad access is transitional only.

**Map to Dema.** Same shape as ADR-003's `bizra-cognition-gateway` boundary. Today's shell-out adapter is the primitive form of this boundary; the v0.2.1+ migration to an HTTP gateway is the OpenClaw-shaped form. Already on the roadmap, with this pattern as the lens.

### O2 — Doctor / repair as the migration path (OpenClaw)

**Pattern.** Legacy config repair lives in `doctor`/`fix` paths, never in startup or load-time core migrations.

**Status in Dema.** Aligned. `dema doctor` exists. Its readiness predicate (see CLAUDE.md invariant #2 and [apps/cli/src/index.js](../apps/cli/src/index.js)) is the right place to add migration checks. `setup` stays idempotent; migrations land in `doctor`.

### O3 — Scoped test invocation (OpenClaw)

**Pattern.** "Never raw vitest." Tests run via `pnpm test <path-or-filter>`, never via broad discovery.

**Status in Dema.** Aligned. PR #4 scoped `npm test` to `tests/*.test.js` for exactly this reason — `node --test` with no path arg recursively scans the working tree, hangs on foreign code (gitignore protects `git`, not `node --test`).

### O4 — Manifest-first control plane (OpenClaw)

**Pattern.** Behavior driven by manifest, registry, and capability contracts. Hidden contract bypasses forbidden. Schema changes are additive first; incompatible changes need versioning.

**Map to Dema.** Schema-tagged outputs (`bizra.dema.<thing>.v0.1`) are the proto-manifest. The Phase 3 `RECEIPTS_HANDOFF` contract between Dema and `bizra-omega` is the receipt capability contract. Use this lens when authoring it.

## Patterns refused (would violate Dema invariants)

| Pattern                                      | Why refused                                                                                           |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Hermes 60-parameter `AIAgent.__init__`       | Configuration sprawl violates "simplicity first" and the Karpathy correctives.                        |
| OpenClaw pnpm + Bun dual-runtime             | Dema is Node-only. Multi-runtime adds complexity without benefit at v0.2.                             |
| Either's plugin / extension system           | Dema is one face per ADR-001. The giants are platforms; Dema is a bridge. Different category.         |
| OpenClaw marketplace / appcast / auto-update | Dema's GTM today is "Sovereign Local AI Node Setup + Safety Audit," not an auto-updating desktop app. |

## Highest-leverage lifts for Phase 3 (RECEIPTS_HANDOFF)

1. **Treat the receipt schema as a manifest** (O4 lens). Dema declares what fields its viewer reads. `bizra-omega` declares what fields its writer emits. The handoff doc pins the intersection plus the versioning rule.

2. **Apply OpenClaw's "additive first; incompatible needs versioning"** to receipt schema evolution. `bizra.dema.receipt.v0.1` is the floor; `v0.2` adds, `v1.0` may break. Dema's viewer is forward-compat-tolerant by default.

3. **Borrow Hermes's "agent-level tools intercepted before `handle_function_call`"** as the Dema/`bizra-omega` boundary. The gateway intercepts Dema's request before `bizra-omega`'s runtime handles it. Same shape, different direction.

## Open queue (not yet read on disk)

These are named in conversation but not yet absorbed. They will become `ABSORPTION_NOTES_v2` when read:

- **pi.dev** — referenced as a branchable session tree pattern.
- **agent-zero** — to investigate.
- **space-agent** — to investigate.
- **AutoHotKey** — historical lineage referent, captured separately in [00-product-thesis/mission-centric-thesis.md](00-product-thesis/mission-centric-thesis.md).
- **Telescript** — historical lineage referent, captured separately in [00-product-thesis/mission-centric-thesis.md](00-product-thesis/mission-centric-thesis.md).

Adding any of these requires either pulling them locally first (see `/data/bizra/giants/` pattern) or explicit authorization to fetch their public docs from the network.
