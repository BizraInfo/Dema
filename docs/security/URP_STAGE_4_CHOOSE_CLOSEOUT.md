# URP Stage 4 Choose Closeout

**Status:** local worktree closeout probe added; remote CI verification pending after commit/push
**Pair-doc:** [URP Stage 4 Choose Preflight](./URP_STAGE_4_PREFLIGHT.md)
**Sparse point:** After URP-4.1C-ter choose verify at HEAD `79b46eb`

## 1. What this is

This is the closeout half of URP Stage 4 Choose. The preflight defined the
risk class: local operator intent capture, not publication. The implemented
Stage 4 chain now has write, list, and verify symmetry for choose receipts.

The closeout probe makes that chain replayable. It is a harness check, not a
runtime authority and not a new product claim.

## 2. Stage 4 boundary triplet

Stage 4 uses three contracts together:

| Contract | Value | Meaning |
| --- | --- | --- |
| Source index | `LOCAL_VERIFIED_RESOURCE_INDEX` | Choose can only operate on a Stage 3 local index that has already passed the local index verifier. |
| Decision | `MARK_SHAREABLE` or `MARK_LOCAL_ONLY` | The operator records local intent only. No bytes are published. |
| Receipt truth | `LOCAL_CHOOSE_RECEIPT_PERSISTED` / `LOCAL_CHOOSE_RECEIPT_FILE_VERIFIED` | A local content-addressed choose receipt exists and can be verified by path. |

The forbidden-field discipline carries forward from Stage 3: no private key,
raw artifact, full receipt JSON, personal memory, mint candidate, token
eligibility, reward, economic value, or federation target belongs in a choose
receipt.

## 3. Operator replay

Against a prepared `DEMA_HOME` with a verified Stage 3 index:

```bash
dema urp choose "$DEMA_HOME/urp/indexes/urp-index-<sha256>.json" \
  --decision MARK_SHAREABLE \
  --consent "MARK URP ENTRY SHAREABLE" \
  --json

dema urp choose "$DEMA_HOME/urp/indexes/urp-index-<sha256>.json" \
  --decision MARK_LOCAL_ONLY \
  --consent "MARK URP ENTRY LOCAL-ONLY" \
  --json

dema urp choose list --json

dema urp choose verify "$DEMA_HOME/urp/choices/choose-<sha256>.json" --json
```

Every command is local-only. Wrong or missing consent exits 1 before a choose
receipt is written.

## 4. What Stage 4 proves

- Choose decisions are exact-string-consent bound.
- Choose receipts are content-addressed and written atomically at mode `0o600`.
- `MARK_SHAREABLE` records candidate local intent only; it does not publish.
- `MARK_LOCAL_ONLY` records local-only intent with the same receipt discipline.
- The list surface detects corrupt choose receipts.
- The verify surface rechecks schema, decision, consent flag, forbidden fields,
  stable body hash, and filename hash.
- The closeout probe exercises both consent strings and verifies both generated
  choose receipts.

## 5. What Stage 4 does not prove

- No Stage 5 mint exists.
- No PoI score is calculated.
- No token, reward, or economic value is claimed.
- No federation or peer transport is opened.
- No public sharing occurs.
- No Node1 or Node2 connection is made.
- No operator `DEMA_HOME` is mutated by the closeout harness.

## 6. Drift guard

`scripts/urp-stage4-closeout.mjs` creates a throwaway `DEMA_HOME` under
`mkdtemp`, then runs the real local chain:

```text
authorship key init
authorship sign
proof passport
urp index
urp verify
urp choose MARK_SHAREABLE
urp choose MARK_LOCAL_ONLY
urp choose list
urp choose verify
```

The script emits `bizra.dema.urp_stage4_closeout_demo.v0.1`. On success it uses
truth label `URP_STAGE_4_CHOOSE_CLOSEOUT_VERIFIED`; on failure it uses
`URP_STAGE_4_CHOOSE_CLOSEOUT_FAILED` and exits 1. It is registered in
`scripts/check.mjs`, so `npm run check` fails if the Stage 4 chain drifts.

## 7. Proof-of-truth convergence

| Lens | Evidence |
| --- | --- |
| Formal | Schema-tagged envelopes and explicit truth labels. |
| Cryptographic | SHA-256 content addressing for index and choose receipt files. |
| Empirical | Real CLI chain replayed in `scripts/urp-stage4-closeout.mjs`. |
| Economic | Explicit non-claim boundary: no token, PoI, mint, reward, or economic value field. |

## 8. What unlocks next

Once this closeout probe is committed, pushed, and remote-CI verified, URP
Stage 4 can be called drift-guarded. Only then should Stage 5 Mint preflight
start, and it must define a new consent surface before any mint-related code
exists.
