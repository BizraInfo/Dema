# Dema Skill Manifest v0.1

**Status:** DECLARED design (preview-only spec; no implementation, no skill activation).
**Date:** 2026-05-16
**Scope:** Specify a preview-only module that records a typed manifest for a Dema skill. The manifest declares the skill's identity, risk level, declared and denied effects, required PAT roles, required SAT verdicts, test references, and receipt policy. It does not activate the skill, register it for runtime use, or grant any capability.

## Current facts

- Integration Foundry registry at `b400bd9` lists `skills` (via the broader registry framework). No skill activation mechanism exists in this repo yet.
- `~/.dema/skills/` directory exists on disk per the operator-side environment (created by `dema setup`); it is not yet wired to a skill runner.
- `packages/consent/src/consent-hash-preview.js` declares `OPERATIONS`.
- `docs/02-architecture/pat-builder-sat-validator.md` declares the PAT-7 + SAT-5 model and `GateVerdict`.
- `packages/core/src/node0-homebase-state-preview.js` (commit `13f32c5`) declares PAT-7 + SAT-5 local registries with role IDs.

## Product objective

For each Dema skill (a capability the operator might invoke through PAT roles), emit a typed manifest envelope that records:

1. **Skill ID** — opaque string identifier
2. **Risk level** — typed enum: `low | medium | high | step_seven_tier`
3. **Declared effects** — subset of `OPERATIONS`
4. **Denied effects** — subset of `OPERATIONS`
5. **Required PAT roles** — which PAT-7 agents are required to compose this skill (subset of `["intent_extractor", "permission_planner", "evidence_collector", "consent_drafter", "mission_proposer", "receipt_renderer", "memory_steward"]`)
6. **Required SAT verdicts** — which SAT-5 verdicts must be PERMIT for the skill to run (subset of `["consent_verifier", "boundary_auditor", "ihsan_floor_checker", "evidence_chain_validator", "step7_gate_keeper"]`)
7. **Test references** — list of test file paths that exercise the skill
8. **Receipt policy** — typed enum: `no_receipt | preview_receipt | step_seven_receipt`
9. **Active now?** — always `false` in v0.1

## Functional requirements

### F-01 · Module exports

```
packages/core/src/skill-manifest-preview.js

export const SKILL_MANIFEST_PREVIEW_SCHEMA =
  "bizra.dema.skill_manifest_preview.v0.1"
export const SKILL_RISK_LEVELS = Object.freeze([
  "low", "medium", "high", "step_seven_tier"
])
export const SKILL_RECEIPT_POLICIES = Object.freeze([
  "no_receipt", "preview_receipt", "step_seven_receipt"
])
export const PAT_ROLE_IDS = Object.freeze([
  "intent_extractor", "permission_planner", "evidence_collector",
  "consent_drafter", "mission_proposer", "receipt_renderer", "memory_steward"
])
export const SAT_ROLE_IDS = Object.freeze([
  "consent_verifier", "boundary_auditor", "ihsan_floor_checker",
  "evidence_chain_validator", "step7_gate_keeper"
])
export function buildSkillManifestPreview({
  skill_id, risk_level, declared_effects, denied_effects,
  required_pat, required_sat, tests, receipt_policy, now
})
```

### F-02 · Envelope shape (success)

```
{
  schema:               "bizra.dema.skill_manifest_preview.v0.1",
  mode:                 "PREVIEW_ONLY",
  truth_label:          "DECLARED",
  valid:                true,
  skill_id:             <string>,
  risk_level:           <one of SKILL_RISK_LEVELS>,
  declared_effects:     <array subset of OPERATIONS>,
  denied_effects:       <array subset of OPERATIONS>,
  required_pat:         <array subset of PAT_ROLE_IDS>,
  required_sat:         <array subset of SAT_ROLE_IDS>,
  tests:                <array of strings>,
  receipt_policy:       <one of SKILL_RECEIPT_POLICIES>,
  active_now:           false,                                  -- invariant
  generated_at:         <ISO>,
  boundary: { ... 7 authority flags all false ... }
}
```

### F-03 · Boundary invariants

```
runtime:               false
federation:            false
mint:                  false
skill_activated:       false  (NEW flag, add to allowlist)
skill_invoked:         false  (NEW flag, add to allowlist)
receipt_minted:        false  (already in AUTHORITY_FLAGS)
authority_imported:    false  (already in AUTHORITY_FLAGS)
```

### F-04 · Validation

- `skill_id` must be a non-empty string matching `/^[a-z][a-z0-9_]*$/`
- `risk_level` must be in `SKILL_RISK_LEVELS`
- `declared_effects` ∩ `denied_effects` empty; both subsets of `OPERATIONS`
- `required_pat` must be a non-empty subset of `PAT_ROLE_IDS`
- `required_sat` must be a non-empty subset of `SAT_ROLE_IDS`
- `tests` must be a non-empty array (a skill without tests fails validation)
- `receipt_policy` must be in `SKILL_RECEIPT_POLICIES`
- If `risk_level === "step_seven_tier"`, then `receipt_policy` must be `"step_seven_receipt"` and `step7_gate_keeper ∈ required_sat`

### F-05 · v0.1 invariants

- `active_now` always `false`
- Module imports zero `fs / net / http / child_process`
- Skills with `declared_effects` containing `execute` require `risk_level >= "high"`

### F-06 · Determinism + purity

Same inputs → deeply-equal frozen output with fresh references.

## Out of scope

- Skill activation / registration
- Skill execution surface
- Sandbox / quarantine implementation (ASPIRATIONAL per ROADMAP.md v0.4)
- Skill marketplace / signing
- Cross-skill dependency resolution
- CLI verb

## Acceptance criteria

1. New file at `packages/core/src/skill-manifest-preview.js`
2. New test file with ≥ 14 TDD anchors
3. `AUTHORITY_FLAGS` extended by 2 new flags (`skill_activated`, `skill_invoked`)
4. `docs/TESTING.md` registers the new test
5. All 7 gates green; `boundary-invariant-check` `modules_scanned ≥ 28`

## References

- `packages/core/src/node0-homebase-state-preview.js` — PAT-7 + SAT-5 registries (role IDs source)
- `packages/consent/src/consent-hash-preview.js` — `OPERATIONS`
- `docs/02-architecture/pat-builder-sat-validator.md` — PAT/SAT model + `GateVerdict`
- `docs/ROADMAP.md` v0.4 § "Skill quarantine" — explicitly ASPIRATIONAL; this spec is preview-only docs
- `~/.dema/skills/` — operator-side directory (currently empty surface)

## Operating law

```
A skill declares its authority.
A skill names its tests.
A skill names which guardians must approve.
A skill that cannot name its denied effects is not a skill.
```
