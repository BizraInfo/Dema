# ADR-036: Node0 Local Persistence Boundary

**Status:** Proposed / Boundary Spec / No Implementation

**Date:** 2026-06-09

**Decision Makers:** Mumu (via GO consent), Codex (implementation + verification)

[CITED]
**Supersedes:** None. Builds on ADR-034 G-Ladder Layer Index and ADR-035 Node0 Closed-Loop Runtime Dry-Run Boundary. Exact-head proof for ADR-035 runtime dry-run mock is `cf30fde6acc19a4a2f513f2af8ca7f868bc67d68`, with local `pre-push:seal` `PUSH_READY`, `delivery:check` `OVERALL A+: PASS`, and four remote rails green: gitleaks `27207607683`, BIZRA Review Gate `27207607707`, CodeQL `27207607729`, and check `27207607685`.

[CITED]
**Related:** ADR-001 (Dema is one face), ADR-002 (no shadow state), ADR-004 (local-first memory), ADR-005 (explicit consent), ADR-006 (continuous assurance and no-mint verification), ADR-007 (multi-session chain policy), ADR-026 (reward receipt local write boundary), ADR-027 (reward receipt local writer boundary), ADR-030 (Dema/Data-Lake alignment boundary), ADR-032 (Node0 Closed-Loop Digest), ADR-034 (G-Ladder Layer Index), ADR-035 (Node0 Closed-Loop Runtime Dry-Run Boundary), Delivery Spine, Claims Ledger, `docs/LLM_SYSTEM_FLOW.md`, and the BIZRA Node0 / Dema Closed-Loop Production Checklist Section 3. [DECLARED]

[DECLARED]
**Implements:** G63_NODE0_LOCAL_PERSISTENCE_BOUNDARY_LOCAL_GREEN (this boundary spec + test scaffold only; no writer implementation). [DECLARED]

## 1. Title

ADR-036: Node0 Local Persistence Boundary

## 2. Status

Proposed / Boundary Spec / No Implementation

## 3. Context

Checklist Section 3 moves from runtime-readiness boundaries into data and persistence. This is the first dangerous storage surface after the proof-layer and dry-run runtime gates. The system needs disk memory, but only as explicit, local, inspectable, schema-bound proof state. Conversation context is disposable; the filesystem is the durable memory only when the write boundary is approved, replayable, and operator-visible. [DECLARED]

This ADR defines the local persistence boundary only. No filesystem writes are introduced here. No receipt log, digest log, layer index writer, schema migration engine, backup/restore tool, corruption detector, rollback tool, Data Lake mutation, public publication, Node1 sync, URP bridge, reward logic, token logic, contract behavior, marketplace behavior, or Shariah-compliance claim is implemented. [DECLARED]

## 4. Purpose

Define what Node0 / Dema may eventually store locally, what it must never store, and what proof gates must exist before any persistence writer is implemented.

The goal is to make local storage auditable before storage authority exists.

## 5. Definition

The Node0 local persistence boundary is a future local-only storage envelope for proof artifacts under operator-controlled local state roots such as `DEMA_HOME` or `~/.dema`. [DECLARED]

It may define shapes, paths, schemas, append-only rules, digest expectations, layer-index expectations, retention rules, privacy rules, rollback expectations, and corruption-detection expectations. [DECLARED]

It does not write files. It does not mutate existing files. It does not create directories. It does not call Data Lake. It does not publish. It does not synchronize to Node1 or URP.

## 6. Core Principle

Local persistence is disk truth only when it is explicit, append-only where required, schema-bound, trace-linked, privacy-aware, and proof-gated. [DECLARED]

No hidden persistence. No opaque memory. No inferred consent. No public or economic meaning. [DECLARED]

## 7. Local Persistence Boundary

The local persistence boundary covers future private artifacts only: [DECLARED]

- append-only receipt log expectation [DECLARED]
- local digest log expectation
- local layer index file expectation
- schema migration plan
- runtime trace ID references
- proof gaps
- still-blocked invariants
- local corruption-detection expectation
- local rollback expectation
- backup and restore expectation
- data retention policy expectation
- local privacy policy expectation

All items above are boundary concepts in this ADR. They are not implemented by this ADR.

## 8. What May Be Stored

Future local persistence may store only explicitly approved local proof artifacts: [DECLARED]

- schema-tagged receipt review records or receipt expectation records
- append-only receipt log entries [DECLARED]
- digest records derived from local proof artifacts
- local layer index records
- runtime trace ID references
- proof gaps
- still-blocked invariants
- local verification results
- remote witness IDs for exact heads
- migration plans after boundary approval
- backup metadata without secrets
- rollback metadata without secrets
- retention metadata without secrets

Every stored object must carry a schema, local-only posture, trace or source reference, integrity material, and non-claim flags. [DECLARED]

## 9. What Must Never Be Stored

Future local persistence must never store:

- credentials
- private keys
- raw secrets
- API tokens, session tokens, or bearer tokens [DECLARED]
- unredacted personal secrets
- public URL claims [DECLARED]
- reward authorization [DECLARED]
- reward amount, payout, APR, yield, or investment language [DECLARED]
- token minting data or token entitlement data [DECLARED]
- contract call data
- marketplace signal data
- Node1 sync payloads
- URP publication payloads
- Data Lake mutation payloads
- Shariah-compliant label [DECLARED]
- production-readiness certification
- hidden consent
- invisible queue state
- opaque memory not visible to the operator

If a future artifact requires sensitive material, that material must remain outside this repo and outside the persistence artifact unless a separate security ADR and exact consent gate authorize it.

## 10. Append-Only Receipt Log Boundary [DECLARED]

The append-only receipt log is a future local log. It may record receipt review entries or receipt expectation entries after a writer boundary and exact consent are proven. [DECLARED]

Boundary requirements:

- append-only by default [DECLARED]
- one entry per traceable event
- schema-tagged entries
- content hash or integrity hash
- no public URL [DECLARED]
- no minting [DECLARED]
- no reward authorization [DECLARED]
- no economic claim [DECLARED]
- no Data Lake mutation

No append-only receipt log implementation is introduced here. [DECLARED]

## 11. Local Digest Log Boundary

The local digest log is a future local summary log derived from approved local proof artifacts.

Boundary requirements:

- derived from local proof artifacts only [DECLARED]
- references source hashes
- carries runtime trace ID where applicable
- carries proof gaps
- carries still-blocked invariants
- never replaces the source receipt log
- never publishes externally

No local digest log implementation is introduced here.

## 12. Local Layer Index File Boundary

The local layer index file is a future local index that may summarize layer closure state for operator review.

Boundary requirements:

- one record per layer or gate
- boundary reference
- schema reference
- test scaffold reference
- mock reference when present
- delivery-check marker when present
- claim-map status
- proof-gap status
- remote witness condition
- exact-head witness IDs when available

No local layer index writer is introduced here.

## 13. Schema Migration Boundary

Schema migrations require boundary approval before implementation.

A future schema migration plan must define:

- source schema
- target schema
- compatible fields
- incompatible fields
- rollback path
- corruption-detection rule
- retention impact
- privacy impact
- exact consent requirement for write-capable migration

No schema migration engine is introduced here.

## 14. Backup and Restore Boundary

Backup and restore are future local-only operations. They must be explicitly scoped before implementation. [DECLARED]

Boundary requirements:

- backup and restore must be local-only by default [DECLARED]
- backup metadata must not include credentials, private keys, tokens, or raw secrets [DECLARED]
- restore must verify integrity before declaring success
- restore must not publish, bridge, or mutate Data Lake
- restore must preserve proof gaps and still-blocked invariants

No backup or restore implementation is introduced here.

## 15. Corruption Detection Boundary

Future persistence must define corruption detection before any writer becomes authoritative.

Boundary requirements:

- schema check
- hash or integrity check
- trace consistency check
- append-only sequence check where applicable [DECLARED]
- fail-closed result for malformed records
- no automatic repair without a separate boundary

No corruption detection implementation is introduced here.

## 16. Rollback Boundary

Rollback is a future local-only recovery path. [DECLARED]

Boundary requirements:

- rollback must be explicit
- rollback must preserve audit evidence
- rollback must not erase proof gaps
- rollback must not overwrite append-only history without a separate boundary [DECLARED]
- rollback must not publish or synchronize externally

No rollback implementation is introduced here.

## 17. Data Retention Policy Boundary

The data retention policy must be local-first and operator-visible. [DECLARED]

Boundary requirements:

- classify artifact type
- define retention period or indefinite-local status
- define deletion eligibility
- define audit-retention exception
- define privacy impact
- define exact consent requirement for destructive cleanup

No data retention implementation is introduced here.

## 18. Local Privacy Policy Boundary

The local privacy policy requires:

- no credentials in local proof logs
- no private keys in local proof logs
- no tokens in local proof logs [DECLARED]
- redact raw secrets before persistence
- minimize personal data
- keep local artifacts under operator-controlled roots
- no network upload
- no public publication

No privacy scanner implementation is introduced here.

## 19. Data Lake Mutation Boundary

Prevent Data Lake mutation until an explicit future bridge boundary is proven.

This ADR allows only references to Data Lake expectations where required by prior ADRs. It does not write to the Data Lake repo, does not synchronize with the Data Lake body, does not invoke Data Lake runtime code, and does not create a cross-repo bridge. [DECLARED]

## 20. Allowed Inputs

- persistence_scope
- artifact_kind
- schema_ref
- source_ref
- runtime_trace_id
- receipt_log_expectation_ref
- digest_log_expectation_ref
- layer_index_expectation_ref
- migration_plan_ref
- backup_restore_policy_ref
- corruption_detection_policy_ref
- rollback_policy_ref
- retention_policy_ref
- privacy_policy_ref
- proof_gaps
- still_blocked_invariants
- consent_status
- review_status
- prototype_posture

## 21. Forbidden Inputs

- filesystem_write_request
- append_receipt_log_request
- write_digest_log_request
- write_layer_index_request
- migration_execution_request
- backup_execution_request
- restore_execution_request
- rollback_execution_request
- delete_request
- datalake_mutation_request
- cross_repo_write_request
- public_publication_request
- node1_target
- urp_publication
- credential
- private_key
- api_token
- session_token
- raw_secret
- reward_authorization
- token_amount
- contract_call
- marketplace_signal
- public_url
- Shariah-compliant assertion [DECLARED]

## 22. Allowed Outputs

- schema
- persistence_boundary_id
- persistence_scope
- may_store
- must_never_store
- append_only_receipt_log_expectation
- local_digest_log_expectation
- local_layer_index_file_expectation
- schema_migration_plan_expectation
- backup_restore_expectation
- corruption_detection_expectation
- rollback_expectation
- data_retention_policy_expectation
- local_privacy_policy_expectation
- datalake_mutation_block
- proof_gaps
- still_blocked_snapshot
- created_at
- prototype_posture

## 23. Forbidden Outputs

- filesystem_write_performed
- receipt_log_appended
- digest_log_written
- layer_index_written
- schema_migration_executed
- backup_performed
- restore_performed
- rollback_performed
- delete_performed
- datalake_mutated
- cross_repo_write_performed
- public_publication_performed
- node1_sync
- urp_publication
- credential_stored
- private_key_stored
- token_stored
- raw_secret_stored
- reward_authorized
- token_minted
- contract_call
- marketplace_signal
- public_url
- Shariah-compliant label [DECLARED]

## 24. Still-Blocked Invariant Rule

The local persistence boundary carries these invariants forward:

- NO_PRODUCTION_SCORING
- NO_ECONOMIC_SCORING
- NO_REWARD_ELIGIBILITY_IMPLEMENTATION
- NO_REWARD_LOGIC
- NO_RECEIPT_MINTING
- NO_PUBLIC_RECEIPT_WRITING
- NO_PUBLISHING
- NO_BRIDGING
- NO_DATA_LAKE_MUTATION
- NO_CONTRACTS
- NO_TOKEN_LOGIC
- NO_MARKETPLACE
- NO_PUBLIC_ECONOMIC_COPY
- NO_NODE1
- NO_PUBLIC_URP_BRIDGE
- NO_SHARIAH_COMPLIANCE_CLAIM

## 25. Non-Claims

[PROTOTYPE]
[DESIGNED_NOT_LIVE]
LOCAL_ONLY
GENESIS_MODE

No implementation.
No filesystem writes.
No receipt log writer.
No digest log writer.
No layer index writer.
No schema migration engine.
No backup or restore implementation.
No corruption detector.
No rollback implementation.
No deletion or cleanup implementation.
No Data Lake mutation.
No cross-repo writes.
No public publication.
No Node1 activation.
No URP bridge.
No reward logic. [DECLARED]
No token logic. [DECLARED]
No contracts.
No marketplace.
No Shariah-compliant claim. [DECLARED]

## 26. MBOK / DevOps / CI-CD / A+ QA Mapping

G62R/G63 boundary progression -> ADR-036 -> persistence scaffold -> future persistence mock -> future delivery-check marker -> future four-rail proof.

| Area | Status / Action |
| --- | --- |
| Integration Management | Defines the local data/persistence boundary after runtime dry-run proof. |
| Scope Management | Limits the slice to may-store/must-never-store rules, log expectations, migration boundaries, retention/privacy boundaries, and Data Lake mutation prevention. |
| Quality Management | Requires schema, trace, integrity, corruption, rollback, retention, and privacy expectations before any writer. |
| Risk Management | Explicitly forbids credentials, private keys, tokens, raw secrets, public URLs, economic activation, Data Lake mutation, Node1, URP, and Shariah claims. | [DECLARED]
| Stakeholder Management | Preserves operator-visible local storage and exact consent for any future write-capable path. |
| DevOps | Local-only, [PROTOTYPE][DESIGNED_NOT_LIVE], proof-gated. No storage automation added here. | [DECLARED]
| CI/CD | Closure requires scaffold, mock, delivery-check integration, clean pre-push seal, and exact-head four-rail remote proof. |
| A+ Performance-Quality Assurance | No throughput, durability, backup, privacy, production, public, economic, or compliance claims until production DoD passes. | [DECLARED]

## 27. Next Micro

GO: NODE0 LOCAL PERSISTENCE TEST SCAFFOLD

Only after ADR-036 local proof + commit + push + four-rail remote proof. [DECLARED]
