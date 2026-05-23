# proof-room-v0.1-public-safe

Share-safe variant of the Dema Proof Room bundle.

The non-redacted `artifacts/proofs/proof-room-v0.1/` bundle keeps the
operator-absolute `repo_root` so a local operator can replay the bundle
against their own checkout. That bundle is **operator-local-only** — the
Layer 1 artifact-safety eval correctly classifies it as
`LEAKAGE_DETECTED` (its `repo_root` includes `/home/...` and `/Downloads/`).

This `-public-safe` variant runs the same gates but the resulting bundle
is passed through `redactProofRoomBundle()`, which:

- replaces `repo_root` with `<repo_root:redacted>`
- adds `repo_root_basename` (just `Dema`) for human context
- adds `repo_root_sha256` so an operator who knows their checkout can
  verify against the original path
- sets `redacted: true` and `truth_label: PUBLIC_SAFE`

The bundle in this directory passes the Layer 1 artifact-safety eval
with verdict `PUBLIC_SAFE`.

## Regenerate

```bash
npm run proof:room -- --public-safe --write --consent \
  "GO: write proof room bundle to artifacts/proofs/proof-room-v0.1-public-safe"
```

## Verify share-safety

```bash
npm run eval:layer1 -- --artifact \
  "$(pwd)/artifacts/proofs/proof-room-v0.1-public-safe/proof-room-bundle.json"
# exit 0 only when verdict === PUBLIC_SAFE
```
