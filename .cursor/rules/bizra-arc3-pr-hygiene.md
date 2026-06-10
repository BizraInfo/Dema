# BIZRA Arc 3 — PR Hygiene

Companion to `bizra-arc3-operator-wiring.md`. Use when staging commits or opening PRs on `fix/pulse-v1.1-line-157-pool-framing`.

## Allowed paths (Arc 3 PR scope)

```
bizra-omega/bizra-cognition/src/receipt_chain_store.rs
bizra-omega/bizra-cognition/src/receipts.rs
bizra-omega/bizra-cognition/src/runtime.rs
bizra-omega/bizra-cognition/src/lib.rs
bizra-omega/bizra-cognition-gateway/**
bizra-omega/evidence/CYCLE6_ARC3_*
```

Supporting fixes on the same branch (already merged in history):

- `bizra-omega/bizra-cognition-gateway/src/bin/dema.rs` (POST /mission body)
- `tests/integration/test_autonomous_pilot.py`
- `tests/core/test_rust_bridge.py`

## Denylist (never stage for Arc 3 commits)

```
constants.py
TOPOLOGY_CANON.md
scripts/ci_proof_pyramid_gate.py
bizra-omega/bizra-node/data/audit/**
.claude/skills/cross-lang-sync/**
tests/core/integration/test_cross_lang*
tests/scripts/test_ci_proof_pyramid_gate_constants.py
frontend/package*.json
docs/architecture/MATERIALIZATION_PULSE.md
```

Pulse-bundle doc commits may stay on branch history but **do not add new unrelated diffs** to Arc 3 follow-on commits.

## Staging recipe

```bash
cd /data/bizra/repos/bizra-data-lake
git add bizra-omega/bizra-cognition/src/receipt_chain_store.rs   # example
git diff --cached --name-only   # must match allowlist only
```

## PR body must include

- Witness artifact path + commit SHA
- CI run links (CI + Canonical Validation Gate)
- Persistence invariants (opt-in, unset=in-memory, default token)
- Explicit note of branch commits outside Arc 3 if PR is wide

## Micro-consent

- **Push:** explicit user `GO push` only
- **PR create:** explicit user request or bundled `proceed with PR` instruction
- **Operator shell auto-export of `BIZRA_RECEIPT_STORE_PATH`:** never without explicit GO
