# Phase 00 - Packaging Audit

## Purpose

The current Dema worktree contains several valid local improvements. The risk is
packaging disorder, not lack of direction. This audit defines the safest publish
order so each future PR preserves reviewability and proof-safe scope.

Truth label: `LOCAL_PACKAGING_AUDIT_NOT_PR_CREATED`.

## Packaging law

```text
One invariant per PR.
Gate policy before runtime power.
Docs-only mirrors do not authorize execution.
Preview surfaces do not mint capabilities.
Runtime work waits for EffectCap invariants.
```

## Atomic slice order

1. `actuator-boundary-guard`
   - Include:
     - `scripts/review/actuator-check.mjs`
     - `tests/actuator-check.test.js`
     - ambient boundary proof text/tests if needed
   - Rationale: protects all future runtime and MCP surfaces from raw shell drift.
   - Exclude: runtime EffectCap, Bash sandbox, Node1/Node2, PoI.

2. `effectcap-invariant-spec-tests`
   - Include:
     - this spec bundle
     - `tests/effectcap-invariant.test.js`
     - actuator-check invariant extensions if needed
   - Rationale: formalizes object-capability law before execution power.
   - Exclude: runtime execution, Bash sandbox, receipt minting, federation, PoI,
     IMP, GOLD, or URP activation.

3. `canon-topology-guard`
   - Include:
     - Topology Canon mirror
     - canon registry
     - canon checker and tests
     - SAT/URP wording correction
   - Rationale: prevents old topology drift before federation language spreads.
   - Exclude: federation or shared URP runtime.

4. `release-readiness-maturity`
   - Include:
     - release readiness schema additions
     - SHA-pinned workflow references
     - native coverage threshold gate
     - testing docs updates
   - Rationale: makes quality and supply-chain posture measurable before release.
   - Exclude: deployment, release publishing, secret management.

5. `optimization-roadmap-preview`
   - Include:
     - roadmap preview module
     - CLI command
     - tests and docs command map
   - Rationale: advisory blueprint only; no gate enforcement or execution.

6. `mcp-blueprint-preview`
   - Include:
     - MCP blueprint module
     - CLI command
     - tests and docs command map
   - Rationale: defines secure MCP integration boundaries before using tools in
     product surfaces.

7. `loop-emulator-preview`
   - Include:
     - design emulation module
     - CLI command
     - tests and docs command map
   - Rationale: keeps scale/impact numbers labeled as design emulation.

8. `docs-spec-sync`
   - Include:
     - SPARC spec bundles
     - LLM flow docs
     - docs index updates
   - Rationale: routes future agents to current sources of truth.

9. `amana-gate-policy-pr`
   - Include: review class/proof-scope updates only.
   - Rationale: policy gate lands before contracts that rely on it.

10. `amana-contracts-pr`
   - Include: Amana contract schemas/tests only.
   - Rationale: contracts remain local/proof-only until runtime gates exist.

## Current PR recommendation

After `actuator-boundary-guard`, ship `effectcap-invariant-spec-tests`. The
first slice blocks accidental raw Bash or shell execution paths; this second
slice blocks caller-provided execution closures and executable policy code
before any runtime capability exists.

## Non-goals

- No branch push.
- No PR creation.
- No staging instruction executed by this audit.
- No runtime, daemon, receipt minting, federation, or economic claim.
