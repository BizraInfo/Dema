# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

**User-scope canon at `~/AGENTS.md` (Operator Discipline) is already in force here.** This file adds repo-specific surface; it does not replace it. Where the two overlap, this file wins for repo-local concerns; user-scope wins for execution discipline.

## Repo identity

- **Canonical:** `github.com/BizraInfo/Dema` — this checkout (`/home/bizra-operating-system/Downloads/Dema`).
- **Legacy:** `repos/DEMA` is blueprint-only, slated for archive after absorption.
- **Frame:** Dema is *one* visible bridge in the BIZRA seven-component node (PAT/SAT/DEMA/FATE/URP/RECEIPTS/POI) — not the whole.
- **Substrate (ADR-003, clarified 2026-05-05):** Core truth lives in `bizra-omega`, the Rust workspace **inside** `bizra-data-lake` — not a separate repo. Dema consumes it via gateway, never duplicates it.

## Repo at a glance

Node.js (>=20) ESM monorepo. **Zero runtime deps.** No build step. No npm workspaces — packages cross-import via relative paths.

- `apps/cli/src/index.js` — single entrypoint for every `dema` subcommand; pure switch over `process.argv`.
- `packages/node-adapter/` — shells out to `DEMA_NODE0_STATUS_COMMAND` and normalizes JSON. Unset env → `defaultStatus()` (everything blocked).
- `packages/core/` — `status.js` (formatting + readiness), `mission.js` (bounded-diagnostic proposal + preview), `today.js` (continuity tick).
- `packages/fate/` — `evaluateConsent()`: exact-string consent gate, no fuzzy match.
- `packages/installer/setup.js` — idempotent `~/.dema/` skeleton creator.
- `packages/receipts/receipt-store.js` — read-only viewer over `~/.dema/receipts/*.json`.
- `tests/status.test.js` — single `node:test` suite covering all packages and the CLI surface.
- `scripts/check.mjs` — full gate: test suite + CLI smoke commands.

## Common commands

```bash
npm install            # zero runtime deps — kept for muscle memory + CI parity
npm test               # node --test (tests/status.test.js)
npm run check          # tests + CLI smoke (welcome/help/status/mission propose/monetize)
npm run dev            # node apps/cli/src/index.js status
node apps/cli/src/index.js <subcommand>   # invoke any CLI command directly
```

Single test or pattern:

```bash
node --test tests/status.test.js
node --test --test-name-pattern="bounded diagnostic" tests/status.test.js
```

**CI:** `.github/workflows/check.yml` runs `npm test` + `npm run check` on Node 20.x and 22.x (matrix, `fail-fast: false`).

CLI surface (alpha):

```text
dema welcome | setup | status | status:json | today | doctor
dema mission propose [--consent "GO: Node0 bounded diagnostic activation only"]
dema receipts [ID|filename|path]
dema monetize | help
```

## Architecture spine

```
CLI → Node0 Adapter → status normalization → mission proposal → FATE consent → (governed runtime, NOT this repo) → receipts viewer
```

## Invariants — do not weaken

1. **No runtime execution here.** `dema mission propose` always returns `executes: false`. ARTIFACT-011 is created by the governed Node0 one-shot path elsewhere, never by Dema.
2. **No hidden daemon.** `setup` writes folders only. `today` records `missionExecuted: false, runtimePulse.fired: false`. `doctor` exits 0 only when **all** of `status.ready` + `status.consoleReady` + `status.activationGate === "EXPLICIT_GO_REQUIRED"` + `status.daemonStatus !== "running"` hold; otherwise exits 1. The "no hidden daemon" guard is one of those four predicates — see [apps/cli/src/index.js](apps/cli/src/index.js) `case "doctor"`.
3. **Setup is idempotent.** `runSetup()` reports `created` vs `existing` paths and never overwrites `profile.json` / `config.local.json`. Tests assert this.
4. **Consent is exact-string match only.** `evaluateConsent()` uses `===`; trailing whitespace fails. Phrase: `BOUNDED_DIAGNOSTIC_CONSENT_PHRASE` in [packages/core/src/mission.js](packages/core/src/mission.js).
5. **Schema-tagged outputs.** Every JSON envelope carries `schema: "bizra.dema.<thing>.v0.1"`. New outputs follow suit.
6. **Adapter input is untrusted.** `normalizeNode0Status()` coerces with `Boolean()` / `??` defaults; `human` defaults to `null`, never a hard-coded identity.

## Binding decisions (ADRs)

`docs/06-adr/` — read the ADR before touching code that lives in its concern.

- **ADR-001** — Dema is one face. Single product surface, not a constellation.
- **ADR-002** — No shadow state. All persistent state under `~/.dema/`; nothing hidden elsewhere.
- **ADR-003** — Core truth lives in `bizra-omega`. 2026-05-05 clarification: `bizra-omega` is the Rust workspace inside `bizra-data-lake`. v0.2.1+ migrates the adapter from shellout to the `bizra-cognition-gateway` HTTP surface.
- **ADR-004** — Local-first memory. Receipts / profile / config local; no implicit cloud sync.
- **ADR-005** — Operator actions require explicit consent. Pre-action disclosure, granular consent, visible action log, instant stop, receipt generation. Drives the FATE boundary.

## Engineering discipline

Five rules from [docs/ENGINEERING_DISCIPLINE.md](docs/ENGINEERING_DISCIPLINE.md):

1. **Small edits.** One concept per PR. If the description needs more than three bullets, split.
2. **Explicit assumptions.** Write the assumption before the code that depends on it. Hidden assumptions are silent landmines.
3. **No invented commands.** Verify with `--help` / file path / grep before citing. Never translate vision into commands that aren't in the tree.
4. **Testable success.** Every change ends in something replayable: `npm test`, `npm run check`, a recorded CLI invocation, a fixture.
5. **Stop at ambiguity.** Two reasonable interpretations → halt and ask. Auto-mode does not override.

The four Karpathy correctives operate inside those rules:

- **Think before coding.** Surface assumptions. Present interpretations. Push back if a simpler path exists. Stop when confused — name it.
- **Simplicity first.** No features beyond what was asked. No abstractions for single-use code. No "flexibility" you weren't asked for. No error handling for impossible scenarios. If 200 lines could be 50, rewrite it. New abstractions need a second concrete caller before they exist.
- **Surgical changes.** Every changed line traces directly to the request. Match existing style. Don't fix what wasn't reported. Don't reformat, retype, or re-quote in passing. Drive-by refactors go in a follow-up PR.
- **Goal-driven execution.** Convert imperatives to verifiable checks: failing test → make it pass → confirm no regressions. Weak criteria ("make it work") need clarification *before* code, not after.

New dependencies require written justification — Dema's zero-dep status is a feature.

## Halt gates (override auto-mode)

Never fall through, even with `/A` set:

- Push to `main` or any shared branch.
- Destructive git (`reset --hard`, force-push, `branch -D`, `rm -rf`).
- Posting to GitHub PRs, issues, or external services on the user's behalf.
- Modifying CI workflows, secrets, or production configs.
- Issuing identity-bound artifacts (signing keys, DIDs, ARTIFACT-011).

Describe the blast radius in one line and ask.

## Local state contract

Setup writes under `DEMA_HOME` env override or `~/.dema/`:

```
~/.dema/{profile.json, config.local.json, receipts/, memory/, logs/, skills/}
```

`receipt-store.js` and `today.js` resolve the same root via `process.env.DEMA_HOME ?? join(homedir(), ".dema")`. Tests use `mkdtemp` + `DEMA_HOME` override — follow that pattern for state-touching tests.

## Adapter integration

`createNode0Adapter()` reads `DEMA_NODE0_STATUS_COMMAND` (shell-tokenized via `parseCommandLine`, supports quoted paths and backslash escapes). The command must print JSON to stdout; non-JSON output produces a labeled error. Unset env → `defaultStatus()` (everything blocked) — the **expected developer-machine state**, not a bug.

Canonical env shape: `.env.example`. v0.2.1+ replaces this shellout with HTTP to `bizra-cognition-gateway` per ADR-003.

## PR / contribution checklist

From [CONTRIBUTING.md](CONTRIBUTING.md), enforced:

- User-facing language stays simple and non-hype (no token / passive-income / AGI / federation claims).
- No hidden background process introduced.
- Consent boundary remains explicit.
- Tests included; `npm run check` passes.
- README stays understandable to non-technical users.

## Doc map

- [README.md](README.md) — public landing page; first-run flow.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — adapter / runtime / receipt spine.
- [docs/ENGINEERING_DISCIPLINE.md](docs/ENGINEERING_DISCIPLINE.md) — five rules + halt gates.
- [docs/06-adr/](docs/06-adr/) — binding decisions (ADR-001…005).
- [docs/00-product-thesis/](docs/00-product-thesis/), [docs/02-architecture/](docs/02-architecture/) — product framing and repo charter.
- [docs/INSTALLER_ARCHITECTURE.md](docs/INSTALLER_ARCHITECTURE.md) — install levels, idempotency contract, release rule.
- [docs/RECEIPTS.md](docs/RECEIPTS.md) — receipt format + ARTIFACT-011 boundary.
- [docs/DECISION_two_dema_split.md](docs/DECISION_two_dema_split.md) — canon vs blueprint split rationale.
- [docs/FIRST_RUN_WIZARD.md](docs/FIRST_RUN_WIZARD.md), [docs/PRODUCT.md](docs/PRODUCT.md), [docs/ROADMAP.md](docs/ROADMAP.md), [docs/GTM.md](docs/GTM.md), [docs/ARTIFACT_011_PREP.md](docs/ARTIFACT_011_PREP.md), [docs/DEMA_CONSTITUTION.md](docs/DEMA_CONSTITUTION.md) — product / governance context.

---

**Session preamble compression:**

> User-scope canon applies. No runtime in this repo. Consent is exact-string. Adapter input is untrusted. ADRs bind. Five rules + four Karpathy correctives operate together. Halt before identity-bound or shared-branch acts. One undeniable loop beats ten plans.
