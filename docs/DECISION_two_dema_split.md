# Decision: Reconciling the two Dema repos

**Date:** 2026-05-05
**Author:** Mumu (Mohamed Beshr) — drafted with Claude Code
**Status:** Proposed — awaiting GO

## Why this exists

Two unrelated git histories named "Dema" exist on this host:

| Slot  | Path                                          | Remote                          | Commits | Latest                                                                      | First                                                                 |
| ----- | --------------------------------------------- | ------------------------------- | ------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **A** | `/home/bizra-operating-system/Downloads/Dema` | `github.com/BizraInfo/Dema.git` | 4       | `1685e80` 2026-05-04 _polish first-run_                                     | `5057af3` 2026-04-18 _Initialize BIZRA Genesis application structure_ |
| **B** | `/data/bizra/repos/DEMA`                      | none (local-only)               | 1       | `ed1c313` 2026-04-17 _R1 scaffold — one face, six modes, zero shadow state_ | same                                                                  |

`comm -12` over `git log --all --format=%H` returns empty — **no shared commits, no fork relationship**. They are independent lineages started one day apart.

## What each one actually is

### A — Downloads/Dema (`v0.1-alpha`)

- **Stack:** plain Node.js ≥20, ESM, no build step, no TypeScript, no workspaces declaration; cross-package imports are relative paths.
- **Surface:** one CLI ([apps/cli/src/index.js](../apps/cli/src/index.js)) — `welcome`, `setup`, `status`, `today`, `doctor`, `mission propose`, `receipts`, `monetize`.
- **Architecture spine:** CLI → Node0 adapter (shells out to `DEMA_NODE0_STATUS_COMMAND`) → status normalization → mission proposal → FATE consent gate → read-only receipts viewer.
- **Invariants enforced in code:** no runtime execution (`executes: false`), no hidden daemon, idempotent `~/.dema/` setup, exact-string consent only ([packages/fate/src/fate.js](../packages/fate/src/fate.js#L1)).
- **Tests:** single suite, [tests/status.test.js](../tests/status.test.js), 16 cases, all green via `node --test` (verified 2026-05-05).
- **LoC:** ~3,123 (md+js).
- **Doctrine attached:** ARTIFACT-011 boundary, FATE consent phrase, BIZRA Third Fact PDF, monetization skill, Genesis provenance ledger, four bootstrap docs.

### B — repos/DEMA (R1 scaffold)

- **Stack:** Turborepo + pnpm@9.15 + TypeScript strict + Biome + Vitest + Playwright, declared in [package.json](../../../data/bizra/repos/DEMA/package.json) and `turbo.json`.
- **Surface:** `apps/{web,cli}` (no desktop yet despite the doc), `packages/{schemas,sdk,design-system,mcp,prompts}`. Web is Next.js, CLI uses commander, SDK has `gateway/research/actions/trust/receipts/manifest/resources` modules.
- **Schemas:** Zod-typed contracts for `receipt, manifest, trust-state, current-ideal-gap, poi, resource-registry, task-protocol`.
- **Architecture spine:** DEMA (web/cli/desktop) → SDK → Gateway client → `bizra-omega` core. DEMA "consumes core truth, never invents it."
- **Doctrine attached:** five accepted ADRs (one-face, no-shadow-state, core-truth-in-bizra-omega, local-first-memory, operator-actions-require-explicit-consent), competitive thesis vs Claude Code / Perplexity / Manus.
- **LoC:** ~1,187 (md+ts).
- **Reality check:** **no `pnpm-lock.yaml`, no `node_modules`** — the scaffold has never been installed or run. Single commit, single author, single day, then abandoned for 18 days while Mumu shipped commits on A.

## Honest read

- **A is the only thing that runs.** It has working code, tests, a public GitHub remote, and four commits of iterative polish. You can `npm test` today.
- **B is the better long-term blueprint.** Its boundary doctrine (one-face, no-shadow-state, core-truth-elsewhere, SDK-as-only-bridge) is sharper than A's narrative docs. Its toolchain (Turbo + pnpm + TS-strict + Biome + Vitest + Playwright) is what a serious product needs. Its ADRs are real ADRs.
- **A and B disagree about what Dema _is_.** A is "sovereign AI node companion, ARTIFACT-011 preview." B is "one face, six modes, full-stack operator surface for BIZRA-Omega." Same name, different products.
- **Nothing references B from anywhere productive.** `grep -r "/data/bizra/repos/DEMA"` returns only Claude session logs and one host-topology memory note. No code, no docs, no other repo points at it.

This is not a fork to merge. It is two design sketches that happen to share a name.

## Recommendation

**A stays canonical. B becomes the v0.2 design target — absorbed, not preserved as a sibling repo.**

### Rationale

1. **Cost of moving canonical to B:** lose GitHub commit history, lose the only working code, lose the public Dema URL. Unacceptable.
2. **Cost of keeping both:** doctrine drift, two answers to "what is Dema", new contributors will pick the wrong one, and B is already 18 days stale.
3. **Cost of absorbing B's blueprint into A:** real but bounded — TypeScript port of ~3k LoC, Turborepo migration, ADR import. Estimated 1–2 focused sessions.
4. **Daughter Test:** if Mumu's daughter inherited this stack tomorrow, would I want her to have to choose between two repos with the same name and no shared history? No. One canonical Dema.

### Concrete path (4 PRs into A)

Each PR is small, reversible, and lands a working tree before the next one starts.

| PR                                | Scope                                                                                                                                                                                                                                                                                                                                                           | Risk                                        | Verifies                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------- |
| **0.2.0 — ADR import**            | Copy B's `docs/06-adr/ADR-00{1..5}.md` into A's `docs/`, renumber if needed; copy `docs/00-product-thesis/dema-one-face.md` and `docs/02-architecture/repo-charter.md`. Update [docs/PRODUCT.md](PRODUCT.md) to cite ADR-001. No code changes.                                                                                                                  | Trivial                                     | `npm run check` still green                   |
| **0.2.1 — Schema package import** | Add `packages/schemas/` with Zod versions of A's existing JSON envelopes (`bizra.dema.status.v0.1`, `…profile.v0.1`, `…local_config.v0.1`, `…fate_consent.v0.1`, `…mission_preview.v0.1`, `…today_tick.v0.1`, `…setup.v0.1`). Plus B's `receipt.ts` (already aligned with [packages/receipts/src/receipt-store.js](../packages/receipts/src/receipt-store.js)). | Low — schemas only                          | New tests parse fixtures                      |
| **0.2.2 — Monorepo migration**    | Add `pnpm-workspace.yaml` + `turbo.json` + Biome. Convert `apps/cli` and `packages/{core,fate,installer,node-adapter,receipts}` into proper workspaces with `package.json` each. Keep code as JS for this PR — no TS port yet.                                                                                                                                  | Medium — touches all package boundaries     | `pnpm install && pnpm test && pnpm run check` |
| **0.2.3 — TS strict port**        | Move package-by-package to TS strict. Start with `fate` (12 LoC) and `receipts`, end with `node-adapter` (most surface). Ship `tsconfig.base.json` with project references.                                                                                                                                                                                     | Medium — type errors will surface real bugs | `pnpm typecheck` clean                        |

After PR 0.2.3, `/data/bizra/repos/DEMA` is archivable. Recommended action: `tar -czf /data/bizra/archive/DEMA-R1-scaffold-2026-04-17.tar.gz` then delete the working copy. Do NOT push it to a remote — single-commit scaffolds with no install create exactly the kind of doctrine confusion this memo exists to end.

### What does NOT cross over from B

- B's web app and Next.js stack — out of scope for v0.2. Dema today is a CLI; web is a v0.3 conversation.
- B's "six modes" framing — preserve as **product vocabulary** in `docs/PRODUCT.md`, but do not pre-build empty mode skeletons. Mode N exists when mode N has a working command.
- B's `mcp/` and `prompts/` packages — empty in B, do not seed them empty in A.
- B's claim that Dema "consumes truth from `bizra-omega`" — validated 2026-05-05: `bizra-omega` is the Rust workspace inside `bizra-data-lake` (27+ crates including `bizra-cognition-gateway`, the read-only HTTP projection meant for the Dema Console). The gateway boundary is real, not aspirational. Today's Dema CLI consumes Node0 status via the adapter shellout in [packages/node-adapter/src/node0-adapter.js](../packages/node-adapter/src/node0-adapter.js); v0.2.1+ migration moves that toward the `bizra-cognition-gateway` HTTP surface. ADR-003 stays `Accepted`.

## What stays uncertain (do not pretend otherwise)

- ~~Whether `bizra-omega` exists as a real repo target~~ — **resolved 2026-05-05**: `bizra-omega` is the Rust workspace inside `bizra-data-lake` (Cargo workspace with 27+ member crates including `bizra-cognition-gateway`). ADR-003 stays `Accepted`.
- Whether the public GitHub repo (`BizraInfo/Dema`) should become a Turborepo monorepo or stay a single-package repo for v0.2. The Turbo migration is reversible; do it on a branch first.
- Whether ARTIFACT-011 doctrine survives B's "no shadow state" doctrine intact. They are compatible (ARTIFACT-011 is preview-only and explicit), but the language will need a one-paragraph reconciliation.

## Next exact action

```bash
cd /home/bizra-operating-system/Downloads/Dema
git checkout -b feat/v0.2-adr-import
mkdir -p docs/00-product-thesis docs/02-architecture docs/06-adr
cp /data/bizra/repos/DEMA/docs/00-product-thesis/*.md docs/00-product-thesis/
cp /data/bizra/repos/DEMA/docs/02-architecture/*.md docs/02-architecture/
cp /data/bizra/repos/DEMA/docs/06-adr/*.md docs/06-adr/
# ADR-003 stays Accepted — bizra-omega validated as Rust workspace inside bizra-data-lake (2026-05-05)
npm test && npm run check
```

That is PR 0.2.0. It writes nothing executable, breaks nothing, and locks B's doctrine into A's history before B is archived.

## Halt gate

Do not run any of the four PRs without explicit GO per PR. Each PR ends with a passing `npm run check` or `pnpm run check` before the next opens.
