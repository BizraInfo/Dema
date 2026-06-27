# NODE0-PROOF-ARTIFACT-EXPORT-1A

**Slice:** Canonical local proof artifact bundle for operator replay.  
**Truth label:** `NODE0_PROOF_ARTIFACT_BUNDLE_LOCAL_ONLY`  
**Share-safe redaction:** `NODE0_PROOF_ARTIFACT_BUNDLE_SHARE_SAFE_REDACTED`

## What shipped

| Module | Role |
| --- | --- |
| `packages/core/src/node0-proof-artifact-bundle.js` | Pure manifest builder, verify, redact, replay text, write consent gate |
| `scripts/proof/export-node0-proof-artifact-bundle.mjs` | Gathers proof:truth ledger + release verdict + optional attestation |
| `scripts/review/node0-proof-artifact-export-check.mjs` | Hermetic review gate |
| `tests/node0-proof-artifact-bundle.test.js` | PAE-01 … PAE-07 |

## Artifact layout (on `--write` with micro-consent)

```text
artifacts/proofs/node0-proof-artifact-v0.1/
  node0-proof-ledger.json
  node0-release-verdict.json
  node0-ci-evidence-attestation.json   (when present)
  node0-proof-artifact-manifest.json
  node0-proof-artifact-replay.txt
```

Public-safe variant: `artifacts/proofs/node0-proof-artifact-v0.1-public-safe/` (redacted paths).

## Commands

```bash
npm run proof:export
npm run proof:export:check
npm run proof:export -- --write --consent "GO: write node0 proof artifact bundle to artifacts/proofs/node0-proof-artifact-v0.1"
```

## Boundaries

- Max release verdict remains `READY_LOCAL`
- No `PUBLIC_SAFE` release verdict claim (share-safe label is artifact redaction only)
- Default export is stdout JSON summary — no filesystem write without exact consent

## Replay chain

```text
proof:truth → proof:verdict → proof:attest:ci:aggregate
→ DEMA_CI_EVIDENCE_ATTESTATION_PATH → proof:export → local artifact dir
```
