# Dema Operator Recovery Runbook (OPS-READINESS-1A)

- **Status:** local-only operator procedure. No network, no keys, no consent, no mint.
- **Scope:** back up, restore, and **prove** the integrity of `DEMA_HOME` (default `~/.dema`).
- **Proof tool:** `scripts/dema-recovery.mjs` (kernel: `packages/installer/src/dema-recovery.js`).

## Why this exists

Before OPS-READINESS-1A, recovery was _documented but not provable_. This runbook makes a restore **re-derivable and tamper-evident**: every file under `DEMA_HOME` is content-addressed (SHA-256), entries are sorted into a stable `bizra.dema.recovery_manifest.v0.1`, and a Merkle-style `root_hash` binds the whole set. A restored home is then **verified against its manifest**, not trusted.

> **One rule that matters:** store the manifest **outside** `DEMA_HOME` (beside the backup archive). A manifest written inside the home becomes a file the home didn't have at backup time, and verification will correctly flag it as `extra`.

## 1. Back up

```bash
# 1a. Write the integrity manifest (store it OUTSIDE DEMA_HOME):
node scripts/dema-recovery.mjs backup --out ~/dema-backups/manifest-$(date +%Y%m%d).json

# 1b. Copy the bytes (standard tooling — the manifest is the proof, tar moves data):
tar -czf ~/dema-backups/dema-$(date +%Y%m%d).tgz -C "${DEMA_HOME:-$HOME/.dema}" .
```

Keep the `.tgz` and its `manifest-*.json` together, off-machine if possible.

## 2. Restore

```bash
# 2a. Recreate / point DEMA_HOME, then unpack:
export DEMA_HOME="$HOME/.dema"
mkdir -p "$DEMA_HOME"
tar -xzf ~/dema-backups/dema-YYYYMMDD.tgz -C "$DEMA_HOME"
```

## 3. Verify the restore (the proof step — do not skip)

```bash
node scripts/dema-recovery.mjs verify ~/dema-backups/manifest-YYYYMMDD.json
```

- Exit **0** + `verdict: VERIFIED` + `root_hash: MATCH` → the restore is byte-for-byte faithful.
- Exit **1** + `verdict: FAILED` → inspect the reported sets:
  - `mismatched` — a file's content differs from the manifest (corruption or tamper).
  - `missing` — a file in the manifest is absent (incomplete restore).
  - `extra` — a file present now that wasn't at backup time.

## 4. Proof-of-Truth convergence

| Axis              | How recovery satisfies it                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------- |
| **Formal**        | this runbook + the `recovery_manifest.v0.1` / `recovery_verification.v0.1` schemas        |
| **Cryptographic** | per-file SHA-256 content addresses + a `root_hash` over the sorted set                    |
| **Empirical**     | `tests/dema-recovery.test.js` — round-trip VERIFIED, tamper/missing/extra all FAIL-closed |
| **Economic**      | n/a — zero-cost local operation; no mint, no transfer                                     |

## 5. Boundary (claim discipline)

- Read-only except writing the manifest file in `backup` mode.
- No network, no keys, no consent gate, no receipt mint, no federation.
- This procedure does **not** seal Block0, activate runtime, or make any economic/federation claim.

## 6. Limits / next

- Bounded walk: `MAX_FILES=20000`, `MAX_DEPTH=24` (fails closed on a pathological home).
- Verification is content + structure only; it does not re-validate signed receipts (use `dema setup-check` / `dema receipts` for that layer).
- Future: optional signed manifest (Ed25519) and an off-site archive policy.
