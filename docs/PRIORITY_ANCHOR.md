# Priority Anchor

**Algorithm ID:** `bizra.priority-anchor.v1`
**Script:** [`scripts/priority-anchor.mjs`](../scripts/priority-anchor.mjs)
**Artifact:** [`proof-of-priority/`](../proof-of-priority/)

A repo-canonical, deterministic SHA-256 Merkle root over the three founding documents. The root is the artifact intended for OpenTimestamps anchoring; the stamp itself is a **halt-gated**, identity-binding follow-up — the script does not perform it.

## Why this exists

The three founding documents — `themassage.pdf` (الرسالة, 2023), `bizra.pdf` (البذرة, 2023), and `BIZRA_Third_Fact_v0_1_FINAL.pdf` (Third Fact v0.1, 2026) — already form a defensible proof-of-priority arc on their own (text from الرسالة reappears verbatim in Third Fact v0.1; the personal letters cannot be retrofit). What was missing was a single, public, tamper-evident pointer that an outsider can verify *without trusting BIZRA*. A SHA-256 Merkle root, anchored on Bitcoin via OpenTimestamps, gives exactly that — for effectively zero cost.

The previous candidate root `63917c2e…d8b89` was produced by an out-of-tree script that used non-standard domain tags. The algorithm was not in this repo, so a future auditor could not reproduce the root from the founding documents alone. **A hash whose algorithm does not ship with it is not a proof.** This document and the script alongside it close that gap.

## Algorithm

```text
leaf = sha256("BIZRA-PRIORITY-LEAF-v1\0" + filename + "\0" + size + "\0" + file_sha256_hex)
node = sha256("BIZRA-PRIORITY-NODE-v1\0" + left_hex + "\0" + right_hex)
```

- **Domain separation** — distinct prefixes for leaves and internal nodes prevent second-preimage attacks where a node hash could be confused with a leaf hash.
- **Filename + size in the leaf** — a leaf is bound not just to file content but to the filename and size of the document as it appears in this repo. Renaming a file invalidates its leaf — an intentional tradeoff: the priority claim is over *named* documents, not anonymous bytes.
- **`file_sha256_hex`** — lowercase hex string (64 chars), the streaming SHA-256 of the file bytes.
- **`left_hex` / `right_hex`** — lowercase hex strings (64 chars), the child hashes.
- **Tree order** — leaves are sorted by `filename` in ascending Unicode code-point order. Reordering the CLI arguments does not change the root.
- **Odd-leaf rule** — at any layer with an odd count, the trailing leaf is duplicated. (Conservative against second-preimage ambiguity that affects the RFC 6962 "promote unchanged" rule.)
- **No external deps.** Node ≥20 stdlib only.

## Reproducing the root

From the repo root:

```bash
npm run priority-anchor
```

Or invoke the script directly:

```bash
node scripts/priority-anchor.mjs themassage.pdf bizra.pdf BIZRA_Third_Fact_v0_1_FINAL.pdf
```

Both write `proof-of-priority/{manifest.json, merkle-root.txt, merkle-tree.json}`.

To verify the committed manifest still matches its root **and** the current founding PDF bytes (re-hashes each named file, re-derives every leaf, then re-derives the root):

```bash
npm run priority-anchor:verify
```

## Manifest fields

| Field | Meaning |
|---|---|
| `algorithm_id` | Frozen at `bizra.priority-anchor.v1`. A future v2 must change this string. |
| `domain.leaf` / `domain.node` | The exact byte sequences used as domain separators. |
| `tree_order` | `filename_ascending_lexicographic` for v1. |
| `duplicate_odd_leaf` | `true` for v1. |
| `created_at` | ISO-8601 UTC timestamp of the build. |
| `input_files` | Filenames in tree order. |
| `files[].filename`, `file_size_bytes`, `file_sha256`, `leaf_hash` | Per-file inputs and the derived leaf hash. |
| `root_hash` | The single 64-char hex Merkle root. |
| `layers` | Full intermediate-layer hex dump (audit aid). |

## OpenTimestamps anchoring (halt-gated)

Stamping is **not** performed by this script. After the manifest and root are committed and reviewed, the next step is:

```bash
ots stamp proof-of-priority/merkle-root.txt
# wait ~24h for a calendar attestation
ots upgrade proof-of-priority/merkle-root.txt.ots
ots verify  proof-of-priority/merkle-root.txt.ots
```

The stamp action is irreversible (it writes to a public timestamp calendar) and identity-binding. It requires explicit human GO and is out of scope for any auto-mode session.
