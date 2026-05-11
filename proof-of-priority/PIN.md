# Proof-of-Priority — Canonical Pin

This file pins the canonical BIZRA proof-of-priority state on disk and on `main`. Until the OpenTimestamps attestation lands, this is the authoritative record of *which root, by which algorithm, over which named documents, on which commit.*

| Field | Value |
|---|---|
| `algorithm_id` | `bizra.priority-anchor.v1` |
| `algorithm_spec` | [`docs/PRIORITY_ANCHOR.md`](../docs/PRIORITY_ANCHOR.md) |
| `algorithm_script` | [`scripts/priority-anchor.mjs`](../scripts/priority-anchor.mjs) |
| `root_hash` | `45aa2789b6085558a387cd3d6bbae894defdfa71fdd5a1db18135e6039e1477a` |
| `manifest` | [`proof-of-priority/manifest.json`](./manifest.json) |
| `algorithm_commit` | `685e51b` (PR #7) |
| `merge_commit` | `7b35964` (main) |
| `pinned_at` | `2026-05-05` |
| `stamp_status` | `UPGRADED` — Bitcoin block-header attestations embedded; calendar contact no longer required for verification |
| `stamped_at` | `2026-05-05T12:07Z` (UTC; corrected from the earlier PIN's `16:07Z` which was +04 local time) |
| `upgraded_at` | `2026-05-05T15:11Z` (same-day upgrade — calendars batched into Bitcoin in roughly three hours, well under the typical 24h window) |
| `stamped_file_sha256` | `637f067e1200909c08294b20e1d4be9063862a2fd53dcf47bb07ad1d93c98702` (sha256 of `merkle-root.txt` bytes — the value OTS actually attests to; binds to `root_hash` via the file's content) |
| `bitcoin_block_heights` | `948027`, `948028`, `948029` (multiple independent attestations across blocks) |
| `bitcoin_block_merkle_roots` | `948027` → `c0d0faf0a901e98bb76aae087f055300271f537cfa3cf49fff6761f37b473515`<br/>`948028` → `e082a4651cb49c06c3e234d90585535188b1c0f2ba71e2e5516967b708e07378`<br/>`948029` → `b8516f0e89748911ddd4e554ba146d121910bc6e5c2c26f026a3c5f76e97dfd1` |
| `ots_artifact` | [`proof-of-priority/merkle-root.txt.ots`](./merkle-root.txt.ots) |
| `confirmed_calendars` | `https://btc.calendar.catallaxy.com` (block 948027), `https://alice.btc.calendar.opentimestamps.org` (block 948029) |
| `still_pending_calendars` | `https://finney.calendar.eternitywall.com` (one calendar still un-batched; not load-bearing — bitcoin attestations from the other two are sufficient) |
| `per_file_attestations` | [`per-file/`](./per-file/) — three independent per-document `.ots` receipts, each upgraded to its own Bitcoin block-header attestations (themassage / bizra / Third Fact each anchored in blocks 948027 + 948028 + 948029) |

## Frozen filenames

The v1 algorithm binds `filename + file_size_bytes + file_sha256` into each leaf. The following names are part of the proof and **must not be renamed** while this pin is in force; any rename invalidates the anchor and requires minting a v2 artifact.

| File | Role | SHA-256 (first 16) |
|---|---|---|
| `themassage.pdf` | الرسالة — personal letter, 2023 | `e05b73b933df3196` |
| `bizra.pdf` | البذرة — the seed, 2023 | `f95bc6f76acdc933` |
| `BIZRA_Third_Fact_v0_1_FINAL.pdf` | Third Fact v0.1 — public manifesto, 2026 | `1deacd63f42315d7` |

## Reproduce

From the repo root:

```bash
npm run priority-anchor:verify
```

Expected output:

```text
✔ bizra.priority-anchor.v1
✔ root_hash reproduced: 45aa2789b6085558a387cd3d6bbae894defdfa71fdd5a1db18135e6039e1477a
✔ file bytes matched manifest: 3 files from /path/to/Dema
```

## Stamp lifecycle

This pin advances through the following states. Each transition requires an explicit human GO and a follow-up commit that updates this file.

| State | Meaning | Update on transition |
|---|---|---|
| `PENDING` | Algorithm + manifest + root committed on `main`; no OpenTimestamps action yet. | — |
| `STAMPED` | `ots stamp proof-of-priority/merkle-root.txt` run; `merkle-root.txt.ots` committed. | set `stamp_status: STAMPED`; add `stamped_at`, `stamped_file_sha256`, `pending_calendars` |
| `UPGRADED` | `ots upgrade` run; calendars batched into Bitcoin block(s); attestation paths embedded; offline verification possible. **(current)** | set `stamp_status: UPGRADED`; add `upgraded_at`, `bitcoin_block_heights`, `bitcoin_block_merkle_roots` |

The stamp action is irreversible (it writes to public timestamp calendars) and identity-binding. It is out of scope for any auto-mode session and requires explicit human authorization.

## How to verify (no trust in BIZRA infrastructure required)

Anyone can independently verify the Bitcoin anchor with three steps:

1. Reproduce the canonical Merkle root from the three founding PDFs in this repo:
   ```bash
   npm run priority-anchor:verify
   ```
   Expect: `45aa2789b6085558a387cd3d6bbae894defdfa71fdd5a1db18135e6039e1477a`.

2. Inspect the OpenTimestamps receipt for its Bitcoin block attestations:
   ```bash
   ots info proof-of-priority/merkle-root.txt.ots
   ```
   Expect: `BitcoinBlockHeaderAttestation(948027)` and `BitcoinBlockHeaderAttestation(948029)` with their respective Bitcoin block merkle roots.

3. Cross-check the cited Bitcoin block merkle roots against any public block explorer (e.g. mempool.space, blockstream.info) for blocks 948027, 948028, 948029. The merkle-root values shown by `ots info` must match the block's published merkle root.

Local full verification with `ots verify` additionally requires either a running Bitcoin node (`bitcoind` with cookie auth) or a future ots release with a public-explorer fallback. The block-header attestations themselves are already self-contained in the `.ots` file and require no further calendar contact.
