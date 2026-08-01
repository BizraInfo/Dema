# CONSENT-NONCE-ATOMIC-RELAND-1A

## Truth label

`LOCALLY_RECONSTRUCTED_FROM_PRIOR_PROVEN_COMMIT__REMOTE_QUALIFICATION_PENDING`

## Why this re-land exists

`backlog/tasks/task-017 - CONSENT-NONCE-ATOMIC-1A-exclusive-create-nonce-consumption.md` records TASK-017 as Done and cites commit `77873fc85b8b43600504c99cdac0f77c97efb806`.

Current `main` at the start of this slice did not contain that implementation. It still used a shared `used-nonces.json` read-modify-rename flow and treated unreadable or malformed registry state as an empty registry. Therefore the task ledger and the executable authority path contradicted each other.

This slice re-lands the previously implemented fix onto current `main` without changing consent phrases, schemas, call signatures, model behavior, networking, identity keys, token logic, or federation state.

## Minimum provable special case

One local Node0 must accept a given consent nonce at most once, including concurrent presentations, while preserving compatibility with nonces recorded in the legacy JSON registry.

## State transition

```text
shared JSON read/modify/write authority
→ one exclusive-create file per nonce
→ legacy JSON retained as compatibility mirror
```

Canonical authority path:

```text
$DEMA_HOME/consent/used-nonces.d/<nonce>.json
```

The per-nonce record is created using `flag: "wx"`; the filesystem exclusive-create operation decides the single winner.

## Fail-closed rules

- Invalid or path-escaping nonce: `consent_nonce_invalid`.
- Existing valid nonce record: `consent_nonce_already_used`.
- Existing malformed per-nonce state: `consent_nonce_state_corrupt`.
- Existing malformed or unreadable legacy state during consumption: `consent_nonce_registry_corrupt`.
- Other write failure: `consent_nonce_write_failed`.
- A read-back mismatch leaves the exclusive-created file in place so the nonce cannot become reusable.

## Regression contract

`tests/consent-nonce-atomic.test.js` proves:

1. 100 concurrent presentations of one nonce produce exactly one success.
2. Concurrent distinct nonces remain independently durable.
3. Corrupt per-nonce state fails closed.
4. A legacy consumed nonce remains consumed.
5. Corrupt legacy state fails closed.
6. Path-escaping nonce input is refused before state creation.
7. Successful consumption updates the legacy compatibility mirror.
8. Sequential replay behavior remains unchanged.

## Authority boundary

This slice:

- does not execute a governed action;
- does not sign a receipt;
- does not read or rotate private keys;
- does not use a network;
- does not start a daemon;
- does not mint or access a wallet;
- does not merge, deploy, or promote itself.

`authority_delta: 0`

## Recovery

The legacy registry remains read-compatible and continues to be written as a mirror. If the new implementation is rejected before merge, deleting this branch restores the exact current-main state. Once an exclusive-created nonce file exists in an operator home, it must not be deleted as rollback because deletion would make a consumed nonce appear reusable.

## What this proves

After exact-head tests and CI pass, this proves that the repository implementation uses filesystem-exclusive creation as the local single-use authority for consent nonces and rejects the covered corruption/replay cases.

## What this does not prove

It does not prove cross-machine replay protection, hostile-filesystem resistance, federation-wide nonce uniqueness, production deployment, operator-home migration, or independent reproduction outside the repository CI environments.

## Promotion gate

Do not mark this re-land complete until all required exact-head GitHub workflows pass and review confirms that current callers preserve fail-closed handling of every returned error.
