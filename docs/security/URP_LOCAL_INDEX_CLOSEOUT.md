# URP Local Index Closeout (Stage 3)

**Status:** remote-CI verified and drift-guarded
**Pair-doc:** [URP Local Index Preflight](./URP_LOCAL_INDEX_PREFLIGHT.md)
**Sparse point:** After URP-3.1C-ter verify-by-path at HEAD `b1a932f`

## 1. What this is

The closeout half of the URP-3.0 preflight. The preflight opened the
Stage 3 Local Index commitment; this doc closes it by stating what
was delivered, what was deliberately left out, and how regression is
detected going forward.

Stage 3 is one stage of the BIZRA Seed-to-Pool lifecycle. It produces
a local-only, content-addressed resource-wallet index from a verified
Proof Passport. It does **not** open any share, PoI, mint, or
federation surface — those belong to Stage 4 and beyond.

## 2. Stage 3 boundary triplet

Every persisted URP index file declares three fields that together
form the Stage 3 boundary contract:

| Field          | Value (constant)                | Contract                                                                                                                                               |
| -------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mode`         | `LOCAL_INDEX_ONLY`              | The index exists on this disk only. No federation transport, no public publication, no network egress.                                                 |
| `share_status` | `MARKED_LOCAL_ONLY`             | The operator has made no share decision. A Stage 4 Choose step would be required to change this.                                                       |
| `truth_label`  | `LOCAL_VERIFIED_RESOURCE_INDEX` | Every entry in the index references an authorship receipt whose Ed25519 signature was deep-verified against the proof passport at index-creation time. |

The writer (`packages/urp/src/local-index-writer.js`) refuses to
persist any object whose `mode` / `share_status` / `truth_label`
differ from these constants, or whose body contains any of the
forbidden fields (`private_key`, `raw_artifact`, `mint_candidate`,
`token_eligible`, `reward`, `economic_value`, `federation_target`,
etc.). The verifier (`packages/urp/src/local-index-verify.js`)
re-checks the triplet on every read.

## 3. 3-command operator replay

A working Stage 3 chain is exactly three commands against a prepared
`DEMA_HOME` (an authorship key has been initialized and at least one
artifact signed):

```bash
# 1. Write — build + persist a new local index from a verified passport.
dema urp index --passport ./passport.json --json
# → schema: bizra.dema.urp_local_index_cli_result.v0.1
#   exit 0 · file at $DEMA_HOME/urp/indexes/urp-index-<sha256>.json

# 2. List — enumerate all local indexes with filename↔hash parity.
dema urp list --json
# → schema: bizra.dema.urp_local_index_list.v0.1
#   exit 0 · corruption_detected:false · count >= 1

# 3. Verify — re-check one index by path (schema + body hash + filename hash).
dema urp verify "$DEMA_HOME/urp/indexes/urp-index-<sha256>.json" --json
# → schema: bizra.dema.urp_local_index_verification.v0.1
#   exit 0 · verdict:VERIFIED · truth_label:LOCAL_VERIFIED_RESOURCE_INDEX_FILE_VERIFIED
```

A failed step at any stage exits 1 with a structured error envelope
(never a partial write, never a silent skip).

## 4. What Stage 3 proves

- **Write/list/verify symmetric.** Three CLI surfaces; one cryptographic substrate.
- **Content-addressed persistence.** Every index file's filename is the SHA-256 of its stable body. Renaming or tampering is detected on read.
- **Deep-verified provenance.** Every entry traces back to an authorship receipt with a verified Ed25519 signature over the artifact's SHA-256.
- **Tamper-detected.** The verifier runs a 12-layer fail-fast check (`missing_path → cannot_read_file → invalid_json → wrong_schema → wrong_mode → wrong_truth_label → wrong_share_status → forbidden_field_present → missing_or_invalid_index_hash → body_hash_mismatch → filename_hash_mismatch`).
- **Boundary-attested.** Every emitted envelope carries an explicit `boundary` block declaring `file_write_performed` / `network_used` / `federation_used` / `token_minted` / `poi_score_calculated` flags.
- **Operator-isolated.** Every test, smoke, and demo run uses a throwaway `DEMA_HOME` under `mkdtemp`; the operator's real `~/.dema/` is never touched by the harness.

## 5. What Stage 3 does NOT prove

- ❌ No share decision (Stage 4 Choose territory)
- ❌ No PoI (Proof of Impact) scoring
- ❌ No token, reward, or economic value claim
- ❌ No mint — content-addressed persistence is not chain-bound minting
- ❌ No federation, MCP message, or peer broadcast
- ❌ No network egress of any kind
- ❌ No operator-visible public/private classification
- ❌ No legal-identity binding (the Ed25519 key is local cryptographic identity only)

These are Stage 4+ concerns and must NOT be inferred from a green
Stage 3 closeout.

## 6. Drift guard

The closeout is replayable. `scripts/urp-stage3-closeout.mjs`
constructs a fresh `DEMA_HOME` under `mkdtemp`, runs `authorship key
init → authorship sign → proof passport → urp index → urp list → urp
verify` against it, asserts every step succeeded, then cleans up. The
script is registered as one probe in `scripts/check.mjs`'s `commands`
array, so `npm run check` exercises it on every full check.

If any sub-CLI regresses (consent phrase change, schema bump,
boundary-field drift, etc.), the closeout script fails its assertion
and `execFileSync` throws — `npm run check` goes RED. The boundary
stops being a doc claim and becomes a continuous invariant.

Operators can replay the closeout manually at any time:

```bash
node scripts/urp-stage3-closeout.mjs
# Success → JSON envelope on stdout, exit 0, truth_label:
#   URP_STAGE_3_LOCAL_INDEX_DEMO_VERIFIED
# Failure → JSON envelope on stderr, exit 1, truth_label:
#   URP_STAGE_3_LOCAL_INDEX_DEMO_FAILED
```

## 7. Status

**Stage 3 closeout is remote-CI verified and drift-guarded.**

This wording is deliberate. Stage 3 is **not** described as
"permanently sealed" — future code can drift, which is exactly why
the drift-guard probe exists. The closeout is a living gate, not a
museum plaque.

## 8. What unlocks next

Stage 4 Choose preflight is unblocked once URP-3.1D is remote-CI
verified. Stage 4 itself remains `DESIGNED_NOT_LIVE`. The Stage 4
preflight must enumerate:

- The exact consent surface required for any share decision
- The schema for a `share_status` transition (the field becomes
  variable instead of constant)
- The classifier that distinguishes shareable metadata from forbidden
  fields (a stricter contract than today's writer-side rejection)
- The audit/replay shape for share decisions themselves

None of these exist yet. Stage 5 Mint remains `DESIGNED_NOT_LIVE`
until Stage 4 is itself drift-guarded.
