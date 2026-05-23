# Dema · Current Limits v0.1

The honest map of what Dema does today, what is designed but not live,
and what is planned. Read this before reading the README, before quoting
us in a slide, before recommending Dema to a friend.

The rule: **no surface in Dema may advertise a capability that the local
code does not actually implement**. If a feature is below "MEASURED"
truth level, this page names it.

> **Companion docs**:
> - [`BIZRA_NODE0_DEMA_GOAL_SCRIPT_v0_1.md`](BIZRA_NODE0_DEMA_GOAL_SCRIPT_v0_1.md) — the north-star goal this page tracks against. The goal names every subsystem; this page reports how much of each is `MEASURED` today.
> - [`ROADMAP.md`](ROADMAP.md) — what slices are moving rows on this page from `PLANNED` / `DESIGNED_NOT_LIVE` toward `MEASURED`.

> **Truth labels** used on this page:
> - `MEASURED` — verifiable from the local code or a captured artifact.
> - `DESIGNED_NOT_LIVE` — schema/spec exists, runtime does not.
> - `PLANNED` — design intent only; not in code yet.
> - `LOCAL_ONLY` — works locally but is not share-safe in its current form.

---

## What is MEASURED today

| Surface | Evidence |
|---|---|
| 2,489 unit tests passing locally (Node 20.x + 22.x) | `npm test` (counted at commit `a457fdf`); CI matrix in `.github/workflows/check.yml` |
| Stdlib-only dependency posture | 0 production deps, 0 devDeps in `package.json` |
| Local profile / setup loop | `dema setup` is idempotent and writes only to `$DEMA_HOME` (default `~/.dema/`) — see `packages/installer/src/setup.js` |
| Exact-string consent gate | `packages/fate/src/fate.js` — strict `===` byte match, fail-closed |
| Approval gate (L0–L5 matrix) | `packages/core/src/approval-gate.js` + 16 tests |
| Receipt store (read/list only) | `packages/receipts/src/receipt-store.js` — symlink-aware containment, max-files + max-bytes caps; **NO mint surface** |
| Onboarding Seal v0.1 (9-invariant regression contract) | `packages/core/src/onboarding-seal.js` + 23 tests |
| Layer 1 artifact safety eval | `packages/core/src/artifact-safety-eval.js` + `npm run eval:layer1` + 15 tests |
| Envelope schema validator v0.1 (covers `onboarding_seal`, `artifact_safety_eval`, `proof_room_bundle`) | `packages/core/src/envelope-schema-validator.js` + `packages/core/schemas/*.v0.1.json` + 20 tests; library-only, no CLI surface yet |
| Public-safe proof-room variant | `artifacts/proofs/proof-room-v0.1-public-safe/` (Layer 1 verdict `PUBLIC_SAFE`) |
| CodeQL security scan | `.github/workflows/codeql.yml` (per-PR + weekly cron) |
| ARTIFACT-011 — first bounded-diagnostic receipt | `~/.dema/receipts/artifact-011.json` (issued 2026-05-06 by the governed gateway; admissibility verdict `Permit`; chain length 8) |
| Pre-push local gate (operator-side μ-layer test orchestrator) | `.git/hooks/pre-push` (operator-installed) |

## What is DESIGNED_NOT_LIVE

| Surface | Spec | What is missing for MEASURED |
|---|---|---|
| Node1 / federation between nodes | `docs/02-architecture/dema-a2a-message-envelope-v0.1.md` | Real second-node ceremony beyond schema preview; no live federation handshake |
| URP (Universal Resource Pool) shared runtime | `docs/HOUSE_OF_WISDOM_UKE_URP_CANON_v0_1.md`, `packages/core/src/urp-local.js` | URP is local-only; the shared/economic lane is schema + previews, not runtime |
| Proof-of-Impact / token economy | `docs/02-architecture/dema-urp-resource-offer-v0.1.md` | No PoI runtime, no token issuance, no economic settlement |
| Identity-bound signing of receipts (Ed25519 hot path) | `docs/02-architecture/key-maker-epistemic-conduct-v0.1.md` | Receipts are minted upstream by the governed gateway; Dema-local identity-bound signing is partial |
| Behavioral modulation runtime | `packages/core/src/behavioral-modulation.js` | Preview-only; no live tone-adjustment runtime |
| MCP capability descriptor | `docs/02-architecture/dema-mcp-capability-descriptor-v0.1.md` | Descriptor preview, no live MCP runtime in Dema |
| QR / mobile consent companion | `docs/02-architecture/dema-mobile-qr-consent-v0.md` | Preview only; QR + manual echo flow on paper |

## What is PLANNED

| Surface | Notes |
|---|---|
| Terminal installer URL `install.bizra.ai/dema/install.sh` (+ `.ps1`) | Endpoint does not resolve yet; planned for packaged alpha release |
| Installer SHA-256 hash publication per release tag | Will live in `docs/INSTALLER_ARCHITECTURE.md` when terminal installer goes live |
| macOS notarization + Windows code-signing of installer binaries | Roadmap; see `docs/INSTALLER_ARCHITECTURE.md` |
| `dema first-run` single-command entry | Composes welcome → setup → status → doctor; spec exists, command pending (see `docs/FIRST_RUN_WIZARD.md`) |
| SBOM emission at release | Stdlib-only surface; SBOM script not yet present |
| Dependabot for GitHub Actions SHA-pinned bumps | `.github/dependabot.yml` not yet present |
| Release workflow | Manual today; `release.yml` workflow not yet present |
| Expanded threat model in `SECURITY.md` | Current `SECURITY.md` is the non-negotiables list, not a STRIDE-style threat model |

## What is LOCAL_ONLY (works locally, not share-safe by default)

| Surface | Why it is not share-safe |
|---|---|
| `artifacts/proofs/proof-room-v0.1/proof-room-bundle.json` | Contains the operator's absolute `repo_root` path; Layer 1 eval classifies this bundle as `LEAKAGE_DETECTED`. Use the `-public-safe` variant for sharing |
| `~/.dema/receipts/*.json` | Local receipts are not designed to be shared outside the operator's machine without an explicit consent + redaction pass |
| `.proof-forge/` | Operator-local proof receipts; gitignored by design |

## Hard non-claims

These phrases are forbidden in any Dema-issued artifact unless each is
explicitly qualified on the same line as `DESIGNED_NOT_LIVE`,
`preview-only`, or `not live`. The Layer 1 artifact-safety scanner
enforces this as a regression gate:

- URP is live → status today: DESIGNED_NOT_LIVE (URP shared runtime is not live)
- Nodes are synchronized → status today: DESIGNED_NOT_LIVE (node federation is not live)
- Federated network is live → status today: DESIGNED_NOT_LIVE (preview-only)
- Public token economy is active → status today: DESIGNED_NOT_LIVE (no token economy is live)
- Proof-of-Impact rewards are active → status today: DESIGNED_NOT_LIVE (PoI is not live)
- Chain-bound mint is active → status today: DESIGNED_NOT_LIVE (preview-only)
- Chain-bound proof is live → status today: DESIGNED_NOT_LIVE (preview-only)
- Distributed intelligence network is live → status today: DESIGNED_NOT_LIVE (preview-only)

## How to verify this page

```bash
# Test count (locally)
node --test tests/*.test.js | tail -5

# Onboarding Seal posture on the operator's machine
node --test tests/onboarding-seal.test.js

# Proof-room public-safe variant (must pass PUBLIC_SAFE)
npm run eval:layer1 -- --artifact "$(pwd)/artifacts/proofs/proof-room-v0.1-public-safe/proof-room-bundle.json"
```

> Note: the Layer 1 artifact-safety scanner is designed for
> runtime-generated structured artifacts (proof-room bundles, mission
> receipts, evidence packets), not prose documentation. Markdown docs
> like this one legitimately reference the operator's Dema home
> directory by name for documentation purposes — running the scanner
> against prose will flag those references. Read [TESTING.md](TESTING.md)
> for the surfaces eval:layer1 is meant to gate.

## When this page changes

Anyone promoting a row from `PLANNED` or `DESIGNED_NOT_LIVE` to `MEASURED`
must add the evidence path to the "What is MEASURED" table at the same
time. Promotion without evidence is the failure mode this page exists to
prevent.

---

Last refreshed: 2026-05-23. Refresh trigger: any commit that adds, removes,
or promotes a surface listed here.
