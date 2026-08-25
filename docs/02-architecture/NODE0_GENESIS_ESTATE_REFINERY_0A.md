# Node0 Genesis Estate Refinery 0A

**Status:** `COMPONENT_SPECIFICATION_ONLY`  
**Purpose:** Define the smallest safe contract for a *future* read-only estate-refinery mission. It may turn one separately approved BIZRA source-root observation into an evidence-weighted clean-twin plan only while the three immutable Genesis roots remain intact.

This document creates no root approval, twin, receipt, mission, runtime, or claim. It is a specification, not an instruction to operate on the estate.

## Root Canon Binding

The existing [Root Canon](../root-canon/BIZRA_ROOT_CANON_v0_1.md) is the sole Genesis-root authority. Its existing manifest, [`docs/root-canon/root-canon.manifest.json`](../root-canon/root-canon.manifest.json), owns the exact SHA-256 and SHA3-512 values; this specification deliberately does not copy, replace, or extend them.

The existing verifier, [`scripts/verify-root-canon.mjs`](../../scripts/verify-root-canon.mjs), must observe exactly these identities:

| Root ID | Canonical source reference |
| --- | --- |
| `ROOT_1_THE_MESSAGE` | `docs/root-canon/source/themassage.pdf` |
| `ROOT_2_THE_SEED` | `docs/root-canon/source/bizra.pdf` |
| `ROOT_3_THE_THIRD_FACT` | `docs/root-canon/source/BIZRA_Third_Fact_v0_1_FINAL.pdf` |

The future mission contract interprets existing verifier evidence as follows:

| Existing verifier evidence | Contract outcome | Permission |
| --- | --- | --- |
| `verified: true`, `result: BIZRA_ROOT_CANON_SEALED` | `ROOT_CANON_VERIFIED` | A separately authorized future proposal may be considered. |
| Any non-verified result, including `ROOT_CANON_HASH_MISMATCH` | `ROOT_CANON_DRIFT_LOCKED` | `HOLD`; no refinery step, twin materialization, or claim promotion. |
| Missing, stale, or unbound verifier evidence | `ROOT_CANON_UNKNOWN` | `HOLD`; do not infer a match. |

`ROOT_CANON_DRIFT_LOCKED` is an estate-refinery contract outcome, not a new Root Canon verifier result. Root mismatch means `FORK_NOT_BIZRA`; no repair, replacement, or rewrite is permitted here.

## DEMA DNA Pack

The DNA pack is a compact, reference-only context object. It preserves constitutional provenance without carrying source content, raw paths, credentials, or authority.

```yaml
schema: bizra.dema.genesis_dna_pack.v0.1
dna_pack_id: dna:<sha256-hex>
claim_scope: COMPONENT_SPECIFICATION_ONLY
root_canon:
  manifest_ref: docs/root-canon/root-canon.manifest.json
  verifier_ref: scripts/verify-root-canon.mjs
  required_root_ids:
    - ROOT_1_THE_MESSAGE
    - ROOT_2_THE_SEED
    - ROOT_3_THE_THIRD_FACT
  status: ROOT_CANON_VERIFIED | ROOT_CANON_DRIFT_LOCKED | ROOT_CANON_UNKNOWN
principles:
  - human_sovereignty
  - root_immutability
  - evidence_before_claim
  - unknown_holds
  - models_do_not_create_verified_state
authority_delta: 0
```

The pack is valid only when its root references name the existing manifest and verifier exactly. It is neither an authorization nor a mutable policy source.

## Mission Contract

`NODE0-GENESIS-ESTATE-REFINERY-0A` names a future mission template; it is not an active Node0 mission.

```yaml
mission_template:
  mission_id: NODE0-GENESIS-ESTATE-REFINERY-0A
  stage: SPECIFICATION_ONLY
  claim_scope: MISSION_FUTURE
  input:
    genesis_dna_pack: required
    approved_source_root: exactly_one
    metadata_observation: caller_supplied_only
  intended_chain:
    - root_canon_gate
    - deterministic_metadata_normalization
    - deterministic_snapshot_comparison
    - independent_verification
    - human_brief
  future_dependency:
    comparator: packages/core/src/node0-estate-map.js
  success_definition: not_evaluated_by_this_specification
  failure_definition: HOLD_on_unknown_or_drift
  authority_delta: 0
```

The intended chain is declarative. It performs no work in this repository and does not establish `MISSION_VERIFIED`, `RESPONSIBILITY_VERIFIED`, VRO, or Node0 closure.

## Canonical Schemas

All schema instances are future caller-supplied metadata. They are canonical only after a future deterministic validator binds them to the declared release, root-canon evidence, and approved input. No schema permits raw source content, absolute paths, tokens, passwords, private keys, or network destinations.

### Approved source root

```yaml
schema: bizra.dema.approved_source_root.v0.1
approved_root_id: root:<opaque-stable-id>
root_identity_digest: sha256:<hex>
approval_evidence_ref: evidence:<opaque-id>
source_locator_ref: registry:<opaque-id>
observation_mode: METADATA_ONLY
root_canon_status: ROOT_CANON_VERIFIED
forbidden_fields:
  - absolute_path
  - source_content
  - secret_reference
  - credential
  - private_key
```

`source_locator_ref` is an opaque registry reference, never a filesystem path. “Approved” records a future governing decision; this document approves no root.

### Asset card

```yaml
schema: bizra.dema.estate_asset_card.v0.1
asset_id: asset:<sha256-hex>
approved_root_id: root:<opaque-stable-id>
observation_ref: observation:<sha256-hex>
metadata_digest: sha256:<hex> | null
availability: AVAILABLE | UNAVAILABLE | UNKNOWN
completeness: COMPLETE | INCOMPLETE
provenance:
  root_canon_status: ROOT_CANON_VERIFIED
  root_identity_digest: sha256:<hex>
classification: UNCLASSIFIED | EVIDENCE_WEIGHTED
content_included: false
```

`UNAVAILABLE`, `UNKNOWN`, and `INCOMPLETE` remain evidence states. None may be rewritten as deletion, absence of history, or clean state.

### Claim card

```yaml
schema: bizra.dema.estate_claim_card.v0.1
claim_id: claim:<sha256-hex>
subject_asset_ids: [asset:<sha256-hex>]
statement: bounded-human-readable-text
claim_state: PROPOSED | HOLD | VERIFIED_BY_FUTURE_VERIFIER
evidence_refs: [observation:<sha256-hex>]
root_canon_status: ROOT_CANON_VERIFIED | ROOT_CANON_DRIFT_LOCKED | ROOT_CANON_UNKNOWN
verifier_ref: verifier:<opaque-id> | null
authority_delta: 0
```

`VERIFIED_BY_FUTURE_VERIFIER` is a schema value, not a result made by this document. A model may phrase a verified delta later; it may not create a verified claim.

### Receipt-shaped evidence record

```yaml
schema: bizra.dema.estate_evidence_record.v0.1
evidence_record_id: evidence:<sha256-hex>
record_kind: RECEIPT_SHAPED_NOT_A_RECEIPT
claim_scope: COMPONENT_SPECIFICATION_ONLY
root_canon_binding:
  manifest_ref: docs/root-canon/root-canon.manifest.json
  status: ROOT_CANON_VERIFIED | ROOT_CANON_DRIFT_LOCKED | ROOT_CANON_UNKNOWN
approved_root_ref: root:<opaque-stable-id>
input_digest: sha256:<hex>
output_digest: sha256:<hex> | null
verification_status: PASS | FAIL | HOLD | UNKNOWN
authority_delta: 0
minted: false
```

The record is a proposed shape for evidence correlation. It is not a governed runtime receipt, a ledger entry, a signature, or completion proof.

## Clean Twin Folder Plan

The clean-twin layout is a future containment convention only. No folder is created, copied, renamed, populated, or deleted by this task.

```text
DEMA_HOME/
  genesis/
    estate-refinery/
      <approved_root_id>/
        <observation_id>/
          manifest-reference.json
          metadata-observation.json
          asset-cards.json
          claim-cards.json
          evidence-record.json
          daily-brief.md
```

Rules for a future materializer:

1. The proposed namespace is separate from the approved source root.
2. Every item must bind the approved-root ID, root-canon outcome, and immutable input digest.
3. Source content is excluded; only authorized metadata and derived bounded cards may appear.
4. A drift, unknown, incomplete observation, or missing approval leaves the namespace in `HOLD`; it must not look clean by omission.
5. Materialization, retention, and cleanup require a separate mission/effect contract and are outside this specification.

## DEMA Daily Brief Template

The brief is a future human-facing report shape. It does not invoke a model, write local state, or generate a receipt.

```text
DEMA · Estate Refinery Daily Brief

Root Canon:        <ROOT_CANON_VERIFIED | ROOT_CANON_DRIFT_LOCKED | ROOT_CANON_UNKNOWN>
Approved root:     <opaque root ID | none>
Observation:       <AVAILABLE | UNAVAILABLE | UNKNOWN> / <COMPLETE | INCOMPLETE>
Comparable delta:  <unchanged | changed | unavailable | incomparable | baseline required>
Evidence:          <bound digest refs only>
Claims:            <proposed | hold | future verifier status>
Attention:         <drift, unknowns, missing evidence, or none>
Action now:        <HOLD | present verified metadata delta only>

Boundary: specification/report template only; no runtime claim, no receipt, no authority change.
```

## Definition of Done

This 0A task is done only when the specification and its static contract check establish all of the following:

- The existing three-root manifest and verifier are referenced as the only Root Canon authority.
- Hash match, drift lock, and unknown outcomes are explicit and fail closed.
- DNA pack, mission template, approved-source-root, asset-card, claim-card, and evidence-record schemas are bounded and secret-free.
- The clean-twin plan is declarative, source-separated, and metadata-only.
- The daily brief preserves drift, unknown, and hold states.
- The document states `authority_delta: 0` and forbids all ungranted effects.
- The focused static test passes.

The following remain explicitly excluded:

```text
no filesystem scan
no file-content read
no file mutation
no network use
no provider or model invocation
no runtime activation
no consent consumption
no receipt minting
no keys or secrets
no cloud write or publication
no source-root create, delete, copy, or rename
no recovery proof
no VRO
no Node0 closure claim
```

## Proof Boundary

This document is a `COMPONENT_SPECIFICATION_ONLY` artifact. It can be checked for structural completeness and for the absence of operational instructions. It does not prove a provider route, mission execution, independent live verification, durable receipt, recovery, human burden reduction, responsibility, or Genesis closure.
