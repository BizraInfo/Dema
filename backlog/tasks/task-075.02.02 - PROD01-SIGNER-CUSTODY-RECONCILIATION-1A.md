---
id: TASK-075.02.02
title: PROD01-SIGNER-CUSTODY-RECONCILIATION-1A
status: Done
assignee:
  - '@codex'
created_date: '2026-08-26 21:40'
updated_date: '2026-08-26 21:58'
labels:
  - production
  - runtime
  - node0
  - identity
  - consent
  - security
dependencies: []
parent_task_id: TASK-075.02
priority: high
type: task
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reconcile the exact PROD-01 C6 producer consent boundary with the already-qualified Dema atomic nonce contract before any future runtime identity activation. The source-only slice must bind public-key verification to a configured fingerprint, reject unsafe or unavailable nonce-store conditions before the irreversible runtime call, preserve one-shot semantics, and produce static proof tied to the post-repair producer bytes. No key material may be read or created; no listener, activation, runtime, public network, PAT/SAT, push, merge, or authority transition is in scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The producer refuses unpinned, malformed, or fingerprint-mismatched consent verification keys before principal activation.
- [x] #2 The producer refuses unavailable or unsafe nonce reservation conditions before principal activation and preserves one-shot nonce behavior.
- [x] #3 Focused deterministic tests prove an expected RED control and a valid fixture GREEN without starting a listener.
- [x] #4 The closeout binds source/tree/test evidence and states that no runtime identity activation or key provisioning occurred.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 No private key material is read, generated, or written.
- [x] #2 No runtime process or HTTP listener is started.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rebind the exact C6 producer at commit 3f4d8fae83af645610c436f8e7356605946f5a58 and retain only the missing public-key pin and descriptor-relative nonce guards.
2. Establish a deterministic RED: the focused key-custody test references absent guard symbols and must fail before implementation.
3. Add the smallest shared boundary guards: pin and validate the public verification key once at router construction, reject unsafe nonce storage before submit, and retain a test-only injected dependency seam.
4. Prove direct and route-level refusal before runtime mutation, then run package tests, clippy, format, and diff checks.
5. Bind static hashes and host non-activation observations to this task; stop before key provisioning, listener startup, or principal activation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Static closeout, 2026-08-27 Asia/Dubai:

Scope and source binding
- External producer worktree: /data/bizra/node0-closure/worktrees/prod01-mission-recovery-1a-8f744/bizra-omega
- Base commit and branch: 3f4d8fae83af645610c436f8e7356605946f5a58 / fix/prod01-mission-recovery-1a
- Modified only: Cargo.lock, bizra-cognition-gateway/Cargo.toml, bizra-cognition-gateway/src/main.rs
- Post-repair SHA-256: Cargo.lock 5a82e7213994cda90be2ee7fb59db171e0c343430663d3c14591da17cb43584e; Cargo.toml 4a14e885333e53ed1100bcd6fa6067c05ad003279dd014b19918eb528f2d57f3; main.rs 24c1db0d32c34ce83820c98317553f0f66e0b816a960432ce096949adfda3a7d

Expected RED
- Before the repair, cargo test -p bizra-cognition-gateway consent_verification_key_requires_matching_fingerprint -- --test-threads=1 failed to compile because consent_verifying_key_fingerprint, load_consent_verifying_key_from, reserve_activation_consent_nonce, and NonceReservationError did not exist. This was the required red control; it started no listener.

Implemented boundary
- Production loads a public verification key through a descriptor-relative, no-symlink reader, verifies a configured domain-separated fingerprint and rejects weak keys. The successful result is pinned while the router is constructed.
- Nonce reservation is descriptor-relative, owner and 0700 root checked, 0600 marker checked, O_EXCL one-shot, and fsync-backed. It fails closed before submit.
- Tests inject only test dependencies, so they do not set production consent environment variables or write a public-key fixture to the host.

GREEN evidence
- Focused direct tests: matching/malformed/mismatched key guard PASS; private-root one-shot/unsafe-root guard PASS.
- Focused route tests: unavailable key and unsafe nonce store each returned 403 and left the in-memory chain length at 0.
- cargo test -p bizra-cognition-gateway PASS: 98 gateway tests plus 3 CLI tests, 101 total.
- cargo clippy -p bizra-cognition-gateway --all-targets -- -D warnings PASS.
- cargo fmt --all -- --check PASS.
- git diff --check PASS.

Non-activation boundary
- Final host observation: port 7421 had no listener and no bizra-cognition-gateway process was found.
- Values-only environment observation: BIZRA_CONSENT_PUBKEY_PATH=ABSENT; BIZRA_CONSENT_PUBKEY_FINGERPRINT=ABSENT; BIZRA_CONSENT_NONCE_STORE_PATH=ABSENT.
- Production source before #[cfg(test)] contains no SigningKey, SecretKey, or signing call. The existing deterministic test-only signer was not changed; no host private key was read, provisioned, or written.
- No public-key installation, POST /principal/activate, principal activation, runtime process, listener, public network, PAT/SAT, push, merge, mint, or authority transition occurred. Preview-only self-loop output is excluded from this evidence.

Known remaining boundary
- This source repair does not make PROD-01 AC5 green. A future live identity proof still requires new exact human authorization, an independently provisioned public verification key and matching public fingerprint, a safe nonce root, an identity anchor, a bounded loopback plan, independent verification, and automatic shutdown. The existing activation signed body also does not bind qualityScore; that is a separate contract-hardening decision and was not expanded into this slice.

Proof-closeout supplement
- Dema primary-worktree npm test completed successfully through scripts/ci/run-with-classifier.mjs.
- Dema primary-worktree npm run check completed successfully through scripts/ci/run-with-classifier.mjs with its required check-gate evidence.
- Dema primary-worktree npm run llm:guidance PASS, read-only audit.
- Dema primary-worktree git diff --check PASS after the Backlog record update.
- These Dema gates validate the task-record change only. They do not promote the external Rust producer patch to a commit, remote, or live runtime qualification.
- Unrelated primary-worktree items remain deliberately unabsorbed: parent task edits, TASK-075.02.01, audit/canon documents, and dema-data-steward skill files.

What changed: source-only custody guards in the external producer plus this Backlog evidence record.
What proof ran: focused Rust refusal tests; 101 Rust package tests; Rust clippy/fmt/diff gates; Dema npm test/check/guidance/diff gates.
What did not happen: no host private key or public key provisioning, daemon/listener, POST /principal/activate, public network, PAT/SAT, mint, federation, commit, push, or merge.
What remains blocked: PROD-01 AC5 is still OPEN until separately authorized loopback identity activation and independent restart/recovery proof.
Next safe action: wait for a new exact activation authorization packet; do not reuse the consumed C6 authorization.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed as a source-only consent-custody reconciliation. The producer now pins a public verification key by configured fingerprint, refuses malformed or mismatched key material, and uses descriptor-relative private nonce storage with one-shot reservation before activation submit. Direct and route-level tests prove refusal preserves a zero-length runtime chain; the package test, clippy, format, and diff gates are green. Evidence is hash-bound in Implementation Notes. No host private key was read, generated, or written; no listener, runtime process, public network call, key provisioning, principal activation, commit, push, merge, or authority transition occurred.

This closes TASK-075.02.02 only. PROD-01 AC5 remains open pending a separately authorized live identity proof. A signed qualityScore omission is recorded as a separate follow-up decision, not silently changed here.
<!-- SECTION:FINAL_SUMMARY:END -->
