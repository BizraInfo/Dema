# Node0 CI/CD Blueprint — Design Spec v0.1

**Date:** 2026-05-12 (Dubai GST)
**Authority:** Operator (Mumu) · Disk-Claude (Dema Node0)
**Brainstorming session:** N=9 refusal-as-product oscillator terminated at typed-GO `GO: build Dema Awakening v0.1 per architect spec` (separate prior MINT); CI/CD blueprint subsequently authorized via `Choose E` typed selection + 4-section design review with constraint integration across each section.
**Status:** Design approved across 4 sections + 33 integrated constraints. Implementation deferred to writing-plans skill output.
**Related canon:** Node0-space embodiment doctrine · refusal-as-product · hash-binding canon · spec-before-mint · convergence-not-recursion · time-discipline · cloud-disk asymmetry.

---

## Executive Summary

This document specifies **BIZRA Engineering OS v0.1** — a local-first Continuous Assurance pipeline making Node0 the authoritative runner and GitHub Actions a non-authoritative audit witness.

The blueprint converges the audit-identified P0 gaps:

- **P0-1** digest-naming mismatch → resolved via canonical `digest_algo + prev_digest + self_digest` schema, with byte-frozen legacy receipts and validator alias handling.
- **P0-2** no-bash production policy → resolved via `STRUCT-NO-BASH-PRODUCTION-ACTION` test + handler classification (production / development_only / exact_allowlist).
- **P0-3** `dema assure` Continuous Assurance gate → six pipeline subcommands (preflight · security · chain · perf · publish · release).
- **P0-4** repo-sync Node0 kernel → one-way `dema assure publish` (kernel → repo `kernel-mirror/`).
- **P0-5** centralize receipt minting → `~/.dema/kernel/assurance/mint_lib.py` shared library.

The runtime is built in 6 phases. Phase 1 produces this design doc + zero runtime change. Phases 2-5 build incrementally without breaking existing chains. Phase 6 ships publish/release + GHA mirror.

---

## Locked Decisions

| Q        | Decision                                                                                                      | Locked At         |
| -------- | ------------------------------------------------------------------------------------------------------------- | ----------------- |
| Q1       | Topic: **CI/CD blueprint for Node0 kernel** (operator-typed `Choose E`)                                       | Section selection |
| Q2       | Authority locus: **a** — Node0-primary · GHA-mirror                                                           | Section 1 entry   |
| Q3       | Sync mechanism: **X** — kernel→repo one-way via `dema assure publish`                                         | Section 1 entry   |
| Q4       | Release gates: **main-merge requires preflight+security; tagged-release requires release gate**               | Section 1 entry   |
| Q5       | Receipt validation scope: **all 4 chain types** + centralized mint library                                    | Section 1 entry   |
| Q6       | Security checks: **SAST + SCA + secret + license + STRUCT-NO-BASH + sensitivity-fixtures**                    | Section 1 entry   |
| Q7       | Performance metrics: **scan-time · 10k-chain-walk · test-runtime · audit-runtime · SMI-render · memory-peak** | Section 1 entry   |
| Approach | **B** — Pipeline-staged with named gates                                                                      | Section 1 entry   |

---

## 1. Architecture

### 1.1 Topology

```text
┌──────────────────── NODE0 (AUTHORITY · source-of-truth) ────────────────────┐
│                                                                              │
│  ~/.dema/kernel/                                                             │
│  ├─ atlas/                          (existing · shipped 2026-05-12)         │
│  ├─ mission_lifecycle/              (existing · 720 LOC kernel)              │
│  ├─ test_runner/                    (existing · 47/47 PASS)                  │
│  ├─ voice/                          (existing)                               │
│  ├─ assurance/         ← NEW MODULE                                          │
│  │   ├─ mint_lib.py        (Phase 2 · canonical receipt minter)              │
│  │   ├─ preflight.py       (Phase 2 · tests + STRUCT-NO-BASH + canon-load)   │
│  │   ├─ security.py        (Phase 2 · SAST/SCA/secret/license/sensitivity)   │
│  │   ├─ chain.py           (Phase 2 · 4-chain integrity walker)              │
│  │   ├─ perf.py            (Phase 2 · 6 perf metrics)                        │
│  │   ├─ publish.py         (Phase 6 · kernel→repo sync · typed-GO)           │
│  │   ├─ release.py         (Phase 6 · tagged release · signed)               │
│  │   ├─ reconcile.py       (Phase 6 · GHA-Node0 drift reconciliation)        │
│  │   └─ baselines/         (Phase 2 · perf regression baselines)             │
│  │                                                                           │
│  ~/.dema/bin/dema-assure   ← NEW shim                                        │
│     usage: dema assure {preflight|security|chain|perf|publish|release|all}   │
│                                                                              │
│  ~/.dema/agents/dema.node0_mission_agent/receipts/                           │
│     ├─ chain-head.txt                                                        │
│     └─ YYYY-MM-DD/                                                           │
│         ├─ mission-*.json              (existing)                            │
│         └─ assurance-*.json   ← NEW    (per-subcommand)                      │
│                                                                              │
│  Chain types touched by assurance:                                           │
│    1. proof-forge        ~/Downloads/Dema/.proof-forge/         (existing)   │
│    2. agent              ~/.dema/agents/.../receipts/           (existing)   │
│    3. custom-awakening   ~/.dema/agents/.../node0_awakening_*   (existing)   │
│    4. assurance          ~/.dema/agents/.../assurance-*         (NEW)        │
└──────────────────────────────────────────────────────────────────────────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                │  ONE-WAY SYNC (Q3=X)              │
                │  `dema assure publish`            │
                │  • copies kernel → repo mirror    │
                │  • opens PR with diff             │
                │  • mints publish receipt          │
                │  • typed-GO at publish point      │
                └─────────────────┬─────────────────┘
                                  ▼
┌──────────────────── DEMA REPO (audit · CI mirror) ──────────────────────────┐
│  ~/Downloads/Dema/                                                           │
│  ├─ apps/cli/                       (existing)                               │
│  ├─ packages/                       (existing)                               │
│  ├─ kernel-mirror/                  ← NEW · populated SOLELY by publish ·    │
│  │   ├─ atlas/                      repo-side NEVER edits these              │
│  │   ├─ mission_lifecycle/                                                   │
│  │   ├─ assurance/                                                           │
│  │   ├─ test_runner/                                                         │
│  │   ├─ .SOURCE_OF_TRUTH.md         (auto-generated marker)                  │
│  │   └─ manifest.json               (kernel_state_hash + file list + sha256) │
│  ├─ .github/workflows/                                                       │
│  │   ├─ check.yml                   (existing · npm test on 20/22)           │
│  │   └─ assure.yml         ← NEW · runs preflight + security + chain         │
│  │                                  against kernel-mirror/                   │
│  │                                  produces ci_drift_report.json artifact   │
│  └─ .proof-forge/                   (existing · 7 receipts · gitignored)     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Hard Architectural Invariants (each becomes a STRUCT test)

| ID     | Invariant                                                                                                                                                                                                                              | Enforces                                         |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **I1** | `kernel-mirror/` is NEVER edited from the repo side — only by `dema assure publish`                                                                                                                                                    | Node0-primary authority (Q2=a)                   |
| **I2** | Every assurance subcommand mints its own typed receipt under `assurance-*.json`; composite NEVER replaces sub-receipts                                                                                                                 | Audit trail per gate; proof density              |
| **I3** | `mint_lib.py` is the sole producer of NEW assurance receipts in Phase 2; legacy producers migrate one-per-phase in Phases 3-5                                                                                                          | Centralized minting + scope discipline           |
| **I4** | All new receipts use `digest_algo + prev_digest + self_digest` canonical schema; validators accept legacy `blake3_*` as aliases; **legacy bytes never modified**                                                                       | Audit P0-1 resolved + hash-binding canon         |
| **I5** | GHA emits `ci_drift_report.json` artifact only; Node0 reads it and mints canonical `bizra.dema.ci_drift.v0.1` or `bizra.dema.ci_concordance.v0.1` via `reconcile.py`                                                                   | Two-witness pattern; Node0 = canonical authority |
| **I6** | `STRUCT-NO-BASH-PRODUCTION-ACTION` bans `subprocess(shell=True)`, `os.system`, `os.popen`, `eval/exec`, `pty.spawn`, `pexpect` in handlers classified `production`; `development_only` and `exact_allowlist` require explicit metadata | Audit P0-2 resolved                              |
| **I7** | `kernel-mirror/.SOURCE_OF_TRUTH.md` + `kernel-mirror/manifest.json` are auto-generated by `publish.py`; STRUCT test asserts both exist + git pre-commit hook blocks `kernel-mirror/` edits                                             | Sync-direction enforcement (Note from Section 1) |
| **I8** | **GHA is witness; Node0 is canonical receipt authority.** GHA never extends the Node0 chain.                                                                                                                                           | (New invariant from Section 4 Block 2 #9)        |
| **I9** | Network access (`gh` CLI / HTTPS) is permitted ONLY in `publish.py` · `reconcile.py` · `release.py`. `dema assure all` and the 4 inner gates are local-first.                                                                          | (New invariant from Section 4 Block 2 #7)        |

### 1.3 NEW vs Existing Components

| Component                                                      | State                                                      | Notes     |
| -------------------------------------------------------------- | ---------------------------------------------------------- | --------- |
| `~/.dema/kernel/assurance/` (9 files)                          | NEW · ~900 LOC total estimate                              | Phase 2-6 |
| `~/.dema/bin/dema-assure`                                      | NEW · ~10 LOC bash shim                                    | Phase 2   |
| `~/Downloads/Dema/kernel-mirror/`                              | NEW · populated by publish, never hand-edited              | Phase 6   |
| `~/Downloads/Dema/.github/workflows/assure.yml`                | NEW · GHA mirror                                           | Phase 6   |
| `~/.dema/kernel/mission_lifecycle/kernel.py`                   | EDIT (Phase 4) · refactor mint to use `mint_lib.py`        | Phase 4   |
| `~/.dema/kernel/mission_lifecycle/handlers/node0_awakening.py` | EDIT (Phase 3) · refactor custom mint to use `mint_lib.py` | Phase 3   |
| `~/.dema/kernel/test_runner/runner.py`                         | EDIT (Phase 2) · add STRUCT tests for I1-I9                | Phase 2   |
| `~/.dema/voice/voice.py`                                       | EDIT (Phase 5) · refactor mint to use `mint_lib.py`        | Phase 5   |

### 1.4 Backward Compatibility (Legacy Chain Preservation)

The 145 existing agent receipts + 7 proof-forge receipts use `blake3_prev`/`blake3_self` field names with SHA-256 content. Per hash-binding canon: **never modify their bytes.**

Resolution:

- `mint_lib.py` writes ALL new receipts with canonical names (`prev_digest` / `self_digest` / `digest_algo`).
- `extract_chain_fields()` accepts BOTH field-name shapes (treats legacy `blake3_*` as alias for `*_digest` when `digest_algo` is absent — implicit sha256).
- No migration tool modifies old receipt bytes. Ever.
- A chain walked across the v0.1 → v0.2 schema boundary will show a forensically-visible canonization moment, which is honest and auditable.

---

## 2. Pipeline Stages

Six `dema assure` subcommands. Phase-2 trio (preflight · security · chain) speced in depth; Phase-6 pair (publish · release) speced at architecture level only.

### 2.1 `dema assure preflight` (Phase 2)

**Purpose:** the fast green light — verifies tests + canon + no-bash.

```text
Inputs:    none (runs against current ~/.dema/ state)
Execution: 1. Load canon-of-canons + Node0-space + Awakening doctrine
              (refuse if any missing)
           2. Run test_runner/runner.py → capture {total, pass, fail, deferred}
              Gate: fail == 0 AND deferred == 0 (count is dynamic, not hardcoded)
           3. STRUCT-NO-BASH-PRODUCTION-ACTION scan over handlers/
              (per I6 expanded)
           4. AST scan: atlas.py, awakening.py, node0_awakening.py for
              metadata-only invariants
           5. Canon-doctrine load test: every doctrine file has timestamp + schema
Mints:     bizra.dema.assurance.preflight.v0.1
           via mint_lib.py with prev_digest from current chain-head
           into ~/.dema/agents/dema.node0_mission_agent/receipts/YYYY-MM-DD/
Exit:      0 = pass · 1 = test fail · 2 = no-bash violation
           3 = canon missing · 4 = AST violation
Time goal: <30 seconds on Node0
```

**Self-critique:** preflight covers "no regressions in what already shipped"; it does NOT cover security findings (that's the next stage). Separation prevents false-confidence.

### 2.2 `dema assure security` (Phase 2)

**Purpose:** the security gate. Five orthogonal checks; each fails the gate independently.

```text
Execution: 1. SAST   — bandit (Python static analysis, low/medium/high severity)
           2. SCA    — pip-audit on DECLARED dependency manifests FIRST:
                       pyproject.toml / requirements.txt / package.json
                       → if no manifest: result = "no_declared_manifest"
                       → if venv exists without manifest: emit `environment_drift`
                         WARNING (not failure)
           3. SECRET — gitleaks scan over code + spec + summary files;
                       scan receipts ONLY where mtime > last-secret-scan timestamp;
                       known-large bodies (atlas_inventory_*.json) get content-type-
                       aware skip
           4. LICENSE — ast.parse → ImportFrom traversal → resolve to dist-info;
                        REQUIRE third-party imports use {MIT, Apache-2.0, BSD-3-Clause,
                        ISC, Python-2.0}; stdlib + relative imports (BIZRA-local)
                        SKIPPED; any GPL/AGPL/LGPL/proprietary triggers fail
           5. SENSITIVITY-FIXTURES — atlas.py runs against fixture tree containing
                                     intentional sensitivity-tier-2 files (mode 0700,
                                     fake .gnupg/, fake .ssh/id_rsa). MUST exclude
                                     all; even ONE indexed = fail.
Mints:     bizra.dema.assurance.security.v0.1 with structured findings array
Exit:      0 = pass · 1-5 bitmap = which-check-failed
Time goal: <60 seconds
```

**Self-critique:** the manifest-first SCA design (per Section 2 Note 3) prevents the trap "random venv looks clean ≠ project has controlled deps." `dema doctor` (Phase 1 add-on) will surface missing manifest separately.

### 2.3 `dema assure chain` (Phase 2)

**Purpose:** receipt chain integrity walker. Snapshot-then-validate-then-mint (per Section 2 Note 2).

```text
Inputs:    optional --since <hash>  (walk only forward from a hash)
Execution: 1. Capture snapshot_head_before_validation for each chain
              (read all 4 chain-head files at the same atomic moment)
           2. Walk each chain bounded to that snapshot — NEW receipts arriving
              during walk are ignored to prevent observer-effect ambiguity
           3. For each chain:
              - proof-forge: walk previous_hash → evidence_hash linkage GENESIS→head
              - agent: walk blake3_prev/prev_digest linkage; chain-head verify
              - custom-awakening: find bizra.dema.node0_awakening_receipt.v0.1 records
              - assurance: find bizra.dema.assurance.*.v0.1 records (mint_lib self-check)
           4. Digest algorithm check per receipt — no mixed naming inside one receipt
Mints:     bizra.dema.assurance.chain.v0.1
           Fields:
             snapshot_head_before_validation: { proof-forge, agent, custom-awakening, assurance }
             chain_head_after_receipt:        { proof-forge, agent, custom-awakening, assurance }
             validation_scope:                [{chain_id, walk_count, broken_links, head_hash}]
Exit:      0 = all 4 chains clean · 1-4 bitmap = which broken
Time goal: <10 sec at current scale (152 total receipts); test at 10k synthetic
```

**Self-critique:** `dema assure chain` runs LAST in `dema assure all` so its snapshot reflects post-other-gate state.

### 2.4 `dema assure perf` (Phase 2)

```text
Execution: invoke each subject under controlled args (bounded entry counts to avoid
           OOM); capture wall-time + RSS-peak; compare against baseline.json under
           ~/.dema/kernel/assurance/baselines/
           Flag regression if >20% slower or >50% more RSS.
Modes:     --mode=quick (default, PR-gate): skip full-disk-scan
           --mode=full (weekly cron): full 924GB scan
Mints:     bizra.dema.assurance.perf.v0.1
Time goal: <120 sec for quick mode
```

### 2.5 `dema assure publish` (Phase 6 — architecture only)

```text
Required typed-GO: "GO: publish kernel-mirror at <kernel_state_hash>"
                   (kernel_state_hash printed by the tool before GO prompt)
Execution: 1. Compute kernel_state_hash = sha256 of tar archive of ~/.dema/kernel/
           2. Compare against last_published_hash in kernel-mirror/manifest.json
           3. No diff → refuse with finding "no_changes_to_publish"
           4. Diff → copy {atlas/, mission_lifecycle/, test_runner/, assurance/}
                      → ~/Downloads/Dema/kernel-mirror/
           5. Regenerate kernel-mirror/.SOURCE_OF_TRUTH.md + manifest.json (I7)
           6. Mint bizra.dema.assurance.publish.v0.1
           7. Optionally invoke reconcile.py if prior GHA assure.yml run exists
           8. Open PR via gh CLI citing publish receipt hash
Network:   Allowed (gh CLI for PR creation) — per I9
Drift:     If reconcile detects ci_drift → mint and CONTINUE (warning) (per N10)
```

### 2.6 `dema assure release` (Phase 6 — architecture only)

```text
Required typed-GO: "GO: release Dema vX.Y.Z"  (X.Y.Z matches a SemVer tag)
Execution: 1. Require `dema assure publish` ran in last 30 minutes
           2. Require all subgates green: preflight + security + chain
           3. Reconcile with GHA latest run
              - if ci_drift: BLOCK unless operator types
                "GO: override ci_drift for release vX.Y.Z"
              - if ci_concordance: continue
              - if no GHA run: BLOCK (per N4)
           4. cosign-sign the kernel tarball (deferred — Phase 6.1)
           5. Create git tag in Dema repo
           6. Mint bizra.dema.assurance.release.v0.1 with signed-artifact-sha
           7. Update PROOF_SUMMARY.md
```

### 2.7 `dema assure all` (the default invocation)

```text
Runs: preflight · security · chain · perf --mode=quick
Skips: publish, release (those require typed-GO, NEVER autorun)
Mints:
  Step 1: 4 sub-receipts via each subcommand (proof density, per Section 2 Note 7)
  Step 2: ONE composite receipt bizra.dema.assurance.composite.v0.1
          with verified[] containing the 4 sub-receipt self_digests
  Composite NEVER replaces sub-receipts on disk.
Network: NONE — local-first per I9. No gh CLI call.
Time:    <120 sec target
```

---

## 3. mint_lib.py API + Canonical Digest Schema

### 3.1 Canonical Digest Schema

```yaml
# Every NEW receipt minted by mint_lib carries these canonical fields:
digest_algo: "sha256" # explicit · enum: {sha256, blake3 reserved}
prev_digest: "<hex string>" # prior chain head; "GENESIS" if first
self_digest:
  "<hex string>" # sha256 of canonicalized payload
  # (excluding self_digest itself)
timestamp: "<ISO 8601 UTC>" # canonical clock-grounded
chain_id: "<id>" # one of: agent | proof-forge | custom-awakening | assurance
schema: "bizra.dema.<thing>.<version>"
producer_identity:
  "<dotted name>" # MANDATORY for new receipts (e.g. "dema.kernel.assurance.preflight")
  # regex: ^dema\.[a-z_]+\.[a-z_.]+$
producer_version: "<semver>" # OPTIONAL in v0.1 — accepted if passed
```

### 3.2 Legacy Alias Mapping (validator-only · never minter-side)

```text
Legacy field         →  Canonical interpretation when validator reads
─────────────────────────────────────────────────────────────────────
blake3_prev          →  prev_digest  (with implicit digest_algo: sha256)
blake3_self          →  self_digest  (with implicit digest_algo: sha256)
absent digest_algo   →  sha256       (de facto algo in all legacy receipts)
absent producer_identity in legacy → WARN; in new → FAIL
```

**No legacy receipt is ever rewritten.**

### 3.3 Public API

```python
# ~/.dema/kernel/assurance/mint_lib.py
# v0.1 (Phase 2 — assurance receipts only). Legacy producers migrate in P3-5.

def mint_receipt(
    chain_id: str,                      # "agent" | "proof-forge" | "custom-awakening" | "assurance"
    schema: str,                        # "bizra.dema.<thing>.v0.1"
    payload: dict,                      # producer-supplied fields
    producer_identity: str,             # MANDATORY · regex validated
    chain_head_path: Path,              # chain-head.txt for this chain
    receipt_dir: Path,                  # output dir
    receipt_filename_pattern: str,      # e.g. "{date}/assurance-{schema_short}-{short_hash}.json"
    producer_version: str | None = None,  # OPTIONAL
    allow_genesis: bool = False,        # if chain has no head, allow "GENESIS" prev_digest
) -> dict:
    """Mint a receipt. Atomic chain-head update + receipt write.

    Returns the full receipt dict (with self_digest computed).
    Raises:
      ProducerIdentityMissingError — producer_identity blank or invalid regex
      ChainHeadMissingError — chain_head_path doesn't exist AND allow_genesis=False
    """

def canonicalize_payload(receipt: dict, exclude_field: str = "self_digest") -> str:
    """Stable JSON serialization for hashing.
    sort_keys=True, separators=(',',':'), ensure_ascii=False.
    Excludes the named field (default: self_digest)."""

def verify_receipt_self_digest(receipt: dict) -> tuple[bool, str]:
    """Returns (verified, recomputed_self_digest).
    True if stored self_digest matches recomputed value.
    Used by `dema assure chain`."""

def read_chain_head(chain_head_path: Path, allow_genesis: bool = False) -> str:
    """Returns current chain head; "GENESIS" if file missing AND allow_genesis=True."""

def extract_chain_fields(receipt: dict) -> dict:
    """Returns canonical {digest_algo, prev_digest, self_digest} regardless of
    whether receipt was minted with new names OR legacy blake3_* names.

    Resolution rules:
      - if receipt has digest_algo: use it; prev_digest/self_digest must be present
      - if receipt lacks digest_algo BUT has blake3_prev + blake3_self:
        treat as {digest_algo: 'sha256', prev_digest: blake3_prev, self_digest: blake3_self}
      - if BOTH naming sets: prefer canonical AND emit structural-warning finding
      - if neither: raise — non-chain-conformant

    Producer identity:
      - new shape (has digest_algo) + missing producer_identity → FAIL
      - legacy shape (no digest_algo) + missing producer_identity → WARN, pass
    """
```

### 3.4 Adapter/Compat Strategy for Phases 3-5

```text
Phase 3: Migrate node0_awakening.py — chain stays linked because the NEXT receipt's
         prev_digest = LAST legacy chain-head value (chain-head.txt content).
Phase 4: Migrate kernel.py mint_act_handler_receipt + mint_state_transition_receipt.
Phase 5: Migrate voice.py mint_voice_session_receipt.
```

The chain transition point becomes a forensically-visible canonization moment. Walking the chain shows:

- Receipt N: legacy `blake3_*` field names + missing `producer_identity` + missing `digest_algo` → validator emits WARN, treats as canonical sha256 chain
- Receipt N+1: canonical `digest_algo` + `prev_digest` + `self_digest` + `producer_identity` → validator strict

Link still verifies because `N+1.prev_digest == N.blake3_self`.

### 3.5 Phase-2 Assurance Receipt Schemas

| Schema                                | Producer            | Specific Fields                                                                     |
| ------------------------------------- | ------------------- | ----------------------------------------------------------------------------------- |
| `bizra.dema.assurance.preflight.v0.1` | `preflight.py`      | `tests: {total, pass, fail, deferred}` + `no_bash_findings: []` + `canon_load`      |
| `bizra.dema.assurance.security.v0.1`  | `security.py`       | `sast` + `sca` + `secret` + `license` + `sensitivity_fixtures`                      |
| `bizra.dema.assurance.chain.v0.1`     | `chain.py`          | `snapshot_head_before_validation` + `chain_head_after_receipt` + `validation_scope` |
| `bizra.dema.assurance.perf.v0.1`      | `perf.py`           | `metrics: [{name, value, baseline, regression_pct}]` + `mode`                       |
| `bizra.dema.assurance.publish.v0.1`   | `publish.py` (P6)   | `kernel_state_hash` + `files_synced` + `pr_url`                                     |
| `bizra.dema.assurance.release.v0.1`   | `release.py` (P6)   | `tag` + `signed_artifact_sha` + `referenced_assurance_receipts`                     |
| `bizra.dema.assurance.composite.v0.1` | `dema-assure` `all` | `sub_receipts: [{schema, self_digest, gate_status}]`                                |

---

## 4. GHA Mirror + Drift Reconciliation

### 4.1 Two Workflows Side-by-Side

```text
~/Downloads/Dema/.github/workflows/
├─ check.yml      (EXISTING · npm test on Node 20/22 · gates JS code)
└─ assure.yml     (NEW       · gates Python kernel-mirror/)
```

Both must pass for PR merge. Orthogonal concerns.

### 4.2 `assure.yml` Skeleton

```yaml
name: BIZRA Continuous Assurance Mirror

on:
  pull_request:
    branches: [main]
    paths: ["kernel-mirror/**", ".github/workflows/assure.yml"]
  push:
    branches: [main]
    paths: ["kernel-mirror/**"]

jobs:
  preflight:
    runs-on: ubuntu-latest
    steps:
      # NOTE: implementation plan MUST pin actions to SHAs (per Section 4 Note 6).
      # @v4 used here only for design readability.
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install pyyaml==<pinned>
      - run: python kernel-mirror/assurance/preflight.py --mirror-mode --json-out preflight-result.json
      - uses: actions/upload-artifact@v4
        with: { name: assure-preflight, path: preflight-result.json }

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
      - run: pip install bandit==<pinned> pip-audit==<pinned> pip-licenses==<pinned> gitleaks-python==<pinned>
      - run: python kernel-mirror/assurance/security.py --mirror-mode --json-out security-result.json
      - uses: actions/upload-artifact@v4
        with: { name: assure-security, path: security-result.json }

  chain:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
      - run: python kernel-mirror/assurance/chain.py --target=.proof-forge --json-out chain-result.json
      - uses: actions/upload-artifact@v4
        with: { name: assure-chain, path: chain-result.json }

  consolidate:
    needs: [preflight, security, chain]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { path: ./artifacts }
      - run: python kernel-mirror/assurance/build_drift_report.py --artifacts ./artifacts --out ci_drift_report.json
      - uses: actions/upload-artifact@v4
        with:
          {
            name: ci_drift_report,
            path: ci_drift_report.json,
            retention-days: 90,
          }
```

### 4.3 `ci_drift_report.json` Artifact Contract

GHA produces this as a workflow artifact. **Unsigned · unchained · diagnostic-only.** Node0 reads it during reconciliation and mints the canonical receipt.

```json
{
  "schema": "bizra.dema.ci_drift_report.v0.1",
  "note": "GHA-side artifact, NOT a chain receipt. Node0 mints canonical receipt.",
  "workflow_run_id": "<gha run id>",
  "workflow_run_url": "https://github.com/BizraInfo/Dema/actions/runs/<id>",
  "workflow_name": "assure.yml",
  "commit_sha": "<git sha at which assure.yml ran>",
  "kernel_state_hash": "<from kernel-mirror/manifest.json — NOT inferred from commit>",
  "timestamp_utc": "<ISO 8601>",
  "gha_runner_info": { "os": "ubuntu-latest", "python_version": "3.11.x", "runner_name": "..." },
  "sub_results": [
    {
      "gate": "preflight",
      "status": "pass | fail",
      "result_sha256": "<sha256 of preflight-result.json>",
      "result_summary": { "tests_pass": 47, "tests_fail": 0, "no_bash_findings": 0, "canon_load": "ok" }
    },
    { "gate": "security", "status": "...", "result_sha256": "...", "result_summary": {...} },
    { "gate": "chain",    "status": "...", "result_sha256": "...", "result_summary": {...} }
  ]
}
```

### 4.4 Node0 Reconciliation Flow

`~/.dema/kernel/assurance/reconcile.py` (Phase 6). Invoked as part of `dema assure publish` AND as standalone `dema assure reconcile`.

```python
def reconcile_with_gha(kernel_state_hash: str) -> ReceiptDict | None:
    """Fetch latest assure.yml run for kernel_state_hash. Compare. Mint canonical receipt."""

    # 1. Find the relevant GHA workflow run
    runs = gh_api("repos/BizraInfo/Dema/actions/workflows/assure.yml/runs")
    candidates = [r for r in runs if r["head_sha"] == current_commit_sha()]

    if not candidates:
        # "GHA never ran" — per N4, this becomes operator-visible
        return mint_lib.mint_receipt(
            chain_id="agent",
            schema="bizra.dema.ci_drift.v0.1",
            producer_identity="dema.kernel.assurance.reconcile",
            payload={
                "kernel_state_hash": kernel_state_hash,
                "reconciliation_attempted_but_incomplete": True,
                "gha_unavailable_reason": "no_workflow_run_found",
            },
            boundary_compliance={"network_call": "github_api_read_only", ...},
        )

    latest = max(candidates, key=lambda r: r["created_at"])

    # 2. Download ci_drift_report artifact
    try:
        drift_report = gh_api_download_artifact(latest["id"], "ci_drift_report")
    except ArtifactExpired:
        # Per N3 — explicit incomplete finding
        return mint_lib.mint_receipt(
            chain_id="agent",
            schema="bizra.dema.ci_drift.v0.1",
            producer_identity="dema.kernel.assurance.reconcile",
            payload={
                "kernel_state_hash": kernel_state_hash,
                "reconciliation_attempted_but_incomplete": True,
                "gha_artifact_status": "expired",
                "workflow_run_url": latest["html_url"],
            },
            boundary_compliance={"network_call": "github_api_read_only", ...},
        )

    drift_report_dict = json.load(drift_report)
    drift_report_sha = sha256_file(drift_report)

    # 3. Verify (per N8 — 6 verification gates)
    verification_failures = []
    if drift_report_dict["commit_sha"] != current_commit_sha():
        verification_failures.append("commit_sha_mismatch")
    if drift_report_dict["kernel_state_hash"] != kernel_state_hash:
        verification_failures.append("kernel_state_hash_mismatch")
    if drift_report_dict["schema"] != "bizra.dema.ci_drift_report.v0.1":
        verification_failures.append("schema_invalid")
    if drift_report_sha != latest_artifact_recorded_sha(latest):
        verification_failures.append("artifact_hash_mismatch")
    if drift_report_dict["workflow_name"] != "assure.yml":
        verification_failures.append("workflow_name_mismatch")
    if is_stale(drift_report_dict["timestamp_utc"], max_age_hours=24):
        verification_failures.append("timestamp_stale")

    if verification_failures:
        return mint_drift_receipt(verification_failures=verification_failures, ...)

    # 4. Load Node0's local assurance receipts for this kernel_state_hash
    node0_results = load_local_assurance_receipts(kernel_state_hash)

    # 5. Compare
    divergences = compare_results(drift_report_dict, node0_results)

    # 6. Mint canonical receipt
    if divergences:
        schema = "bizra.dema.ci_drift.v0.1"
        payload = {
            "kernel_state_hash": kernel_state_hash,
            "node0_results_refs": [r["self_digest"] for r in node0_results],
            "gha_workflow_run_url": latest["html_url"],
            "gha_drift_report_sha256": drift_report_sha,
            "divergences": divergences,
        }
    else:
        schema = "bizra.dema.ci_concordance.v0.1"
        payload = {
            "kernel_state_hash": kernel_state_hash,
            "node0_results_refs": [r["self_digest"] for r in node0_results],
            "gha_workflow_run_url": latest["html_url"],
            "gha_drift_report_sha256": drift_report_sha,
        }

    return mint_lib.mint_receipt(
        chain_id="agent",
        schema=schema,
        producer_identity="dema.kernel.assurance.reconcile",
        payload=payload,
        boundary_compliance={"network_call": "github_api_read_only", ...},
        # ...other args
    )
```

### 4.5 Two New Canonical Schemas (Phase 6)

| Schema                           | When Minted                                                                                 | Proves                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `bizra.dema.ci_drift.v0.1`       | Reconcile detected divergence OR GHA unavailable OR verification failed OR artifact expired | Operator action required · `reconciliation_attempted_but_incomplete: true` when incomplete |
| `bizra.dema.ci_concordance.v0.1` | Reconcile saw both witnesses agree                                                          | Positive proof of agreement at hash X · proof density                                      |

Both chained into agent chain. Both have `producer_identity: dema.kernel.assurance.reconcile`. Both have `boundary_compliance.network_call: github_api_read_only` (per N1). Both reference GHA artifact by sha256 + URL (not contents — keeps receipts bounded per N7).

### 4.6 Drift Policy (per N10)

| Subcommand | On `ci_drift`                                                            | On `ci_concordance` | On "GHA never ran"                                                    |
| ---------- | ------------------------------------------------------------------------ | ------------------- | --------------------------------------------------------------------- |
| `publish`  | Mint + CONTINUE with warning                                             | Mint + continue     | Mint `ci_drift` with `gha_unavailable_reason` + continue with warning |
| `release`  | BLOCK unless operator types `"GO: override ci_drift for release vX.Y.Z"` | Continue            | BLOCK                                                                 |

### 4.7 Edge Cases Handled

| Case                                      | Behavior                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| GHA never ran for kernel_state_hash       | Mint `ci_drift` with `reconciliation_attempted_but_incomplete: true` (per N3+N4) |
| Multiple GHA runs for same hash (re-runs) | Take most recent successful workflow_run by created_at                           |
| GHA ran AFTER Node0 publish               | Standard flow — most common case                                                 |
| GHA ran BEFORE Node0 publish              | Reconcile flags `stale_drift_report` in divergence detail                        |
| `gh` CLI not authenticated                | Reconcile fails with `gh_auth_required` — operator action gate                   |
| Workflow itself broken                    | drift_report status = fail/error → Node0 mints `ci_drift` citing workflow error  |
| Artifact retention expired (>90 days)     | Per N3 — mint with `reconciliation_attempted_but_incomplete: true`               |
| Verification failures (N8)                | Mint `ci_drift` listing exact failure(s) (commit_sha_mismatch, etc.)             |

---

## Phase Plan

**Phase 1 — Design (this doc)**

- Write design doc · digest schema canon · no-bash policy · architecture invariants
- No runtime refactor

**Phase 2 — `mint_lib` + Phase-2 trio**

- Implement `~/.dema/kernel/assurance/mint_lib.py` (assurance receipts only)
- Implement `preflight.py` · `security.py` · `chain.py` · `perf.py`
- Implement `dema-assure` shim
- Add STRUCT tests for I1, I2, I3 (P2 only), I6, I9 (subset)
- Acceptance: `dema assure all` runs end-to-end, mints 4 sub-receipts + composite, all green

**Phase 3 — Migrate `node0_awakening.py` to `mint_lib`**

- Refactor `_mint_custom_receipt()` to use `mint_lib.mint_receipt()`
- New receipts use canonical schema; legacy receipts unchanged
- Acceptance: next awakening mints with `digest_algo` + `producer_identity: dema.kernel.handlers.node0_awakening`

**Phase 4 — Migrate `kernel.py` mint functions**

- Refactor `mint_act_handler_receipt()` + `mint_state_transition_receipt()` to use `mint_lib`
- Acceptance: next mission mints state transitions with canonical schema

**Phase 5 — Migrate `voice.py` `mint_voice_session_receipt()`**

- Refactor to use `mint_lib`
- Acceptance: next voice session mints canonical

**Phase 6 — Publish, Release, GHA Mirror**

- Implement `publish.py` + `release.py` + `reconcile.py`
- Implement `kernel-mirror/` populated via `dema assure publish`
- Implement `assure.yml` GHA workflow
- Add STRUCT tests for I4, I5, I7, I8, I9 (full)
- Add `dema doctor` (separate concern but lands here for dependency validation)
- Acceptance: end-to-end `dema assure publish` opens PR with kernel-mirror diff + reconcile mints `ci_drift` or `ci_concordance`

**Phase 6.1 — Cosign + Signed Artifacts** (deferred halt-gate: requires identity-bound keypair)

---

## Open Items Carried Forward to Implementation Plan

1. **Pin SHAs for GitHub Actions** (per N6) — `actions/checkout@v4` and `actions/setup-python@v5` in the spec skeleton must be replaced with sha-pinned versions in the actual workflow file (writing-plans skill output).
2. **Pin versions for security tools** (per N6) — `bandit==<version>`, `pip-audit==<version>`, `pip-licenses==<version>`, `gitleaks-python==<version>` (or alternative) to be specified.
3. **Cosign integration** (Phase 6.1) — requires identity-bound keypair generation, which is a SEPARATE halt-gate per user-scope canon (identity-bound artifacts).
4. **`dema doctor`** — environment validation (Python version, manifest presence, gh CLI auth, Piper model presence) is a P1 audit item lifted into Phase 6 of this blueprint.
5. **Daemon discipline** (per N5) — no cron, no auto-scheduling. All assurance invocations are operator-typed or PR-triggered (GHA).

---

## Glossary

- **Node0**: Mumu's local machine (MSI Titan + Z Fold 6). Source of truth.
- **kernel-mirror**: Repo-side read-only copy of `~/.dema/kernel/` populated by `dema assure publish`.
- **chain-head.txt**: Per-agent file storing the self_digest of the most recent receipt in that chain.
- **canonicalization**: `json.dumps(..., sort_keys=True, separators=(',',':'), ensure_ascii=False)` over a receipt minus its `self_digest` field.
- **typed-GO**: Exact-string consent phrase typed by operator on its own line.

---

## Related Canon References

- `~/.dema/memory/node0-space.json` — Node0-space embodiment doctrine
- `~/.dema/memory/foundational-mindset.json` — Law of Assumption (V/D/P/U)
- `~/.dema/memory/dema_awakening_doctrine_v0_1.json` — perception-before-action
- `~/.dema/memory/operator_grounding_gate.json` — operator-rest discipline
- `~/.dema/memory/time_discipline.json` — clock-grounded timestamps
- `~/.claude/projects/.../memory/feedback_hash_binding_no_forge.md` — never modify bytes to match hash
- `~/.claude/projects/.../memory/feedback_refusal_as_product_proven.md` — N=1..N=9 events
- `~/.claude/projects/.../memory/feedback_sparc_walk_as_authorization_pattern.md` — halt-at-MINT-boundary
