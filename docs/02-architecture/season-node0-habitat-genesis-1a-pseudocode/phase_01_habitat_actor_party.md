# Phase 01 · Habitat / Actor / Party Ontology

**Module:** `packages/core/src/habitat-actor-party-ontology.js`  
**Tests:** `tests/habitat-actor-party-ontology.test.js`  
**Mode:** PREVIEW_ONLY

## Flow

```
SIGNAL: season ontology + Gemini MMORPG map + Cartographer naming drift
  → SNR: lock Player/Dema/PAT/SAT/Hometown/Gate (highest value, lowest noise)
  → VERIFY: refuseNamingDrift + verifyHabitatActorPartyOntology
  → AMPLIFY: reuse preview-boundary + home-node-space ontology (do not replace)
  → MAXIMIZE: freeze roles, relationships, allowed claims
  → EXEC: ship kernel + focused tests (no agent spawn)
  → RECEIPT: ontology_id sha256 + gate ok
```

## Pseudocode

```
buildHabitatActorPartyOntology():
  roles ← [player_human, avatar_dema, pat_party(7), sat_world_guard(5),
            hometown_local, village_gate, urp_open_world, habitat_bizra]
  FOR each relationship: REQUIRE boundary string
  axiom ← habitat_is_bizra ∧ actor_is_dema ∧ player_is_human ∧ seed_not_chain
  boundary ← preview_boundary ∪ {pat_agents_spawned:false, sat_agents_spawned:false,
                                  rsi_activated:false, singularity_claimed:false}
  RETURN freeze(report)

refuseNamingDrift({role_id, applied_label}):
  IF role_id=pat_party AND label∈{SAT, SAT-*} → REFUSE
  IF role_id=sat_world_guard AND label∈{PAT, PAT-*} → REFUSE
  IF role_id=avatar_dema AND label=BIZRA_HABITAT → REFUSE
  ELSE PASS

previewSeedScale(N):  # design math only
  RETURN {dema:N, pat:N*7, sat:N*5, claim_ceiling: DESIGN_EMULATION_NOT_RUNTIME}
```

## TDD anchors

1. Schema + truth label + `authority_delta === 0`
2. Drift refusal for SAT-on-PAT and PAT-on-SAT
3. Seed scale at N=1e6 yields 5e6 SAT slots without spawning
4. Forbidden overclaims absent from allowed claims
5. Gate passes with drift_refusal_ok

## Does NOT prove

Live PAT/SAT execution, URP inventory, Node0 closure, or Village Gate crossings.
