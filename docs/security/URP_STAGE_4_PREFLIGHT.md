# URP-4.0 — Universal Resource Pool Choose Preflight

Risk classification and design preflight for Stage 4 (Choose) of the
BIZRA Lifecycle (`docs/canon/BIZRA_LIFECYCLE_SEED_TO_POOL.md`). This
document must pass before any URP choose code ships.

## 1. Context

URP-3.1A through URP-3.1D made Stage 3 (Index) MEASURED, write/list/verify
symmetric, and drift-guarded (`URP_3_1D_LOCAL_INDEX_CLOSEOUT_REMOTE_CI_VERIFIED`
at commit `4f10f6a`). Stage 4 (Choose) is currently `DESIGNED_NOT_LIVE`.

The operator's intent (from `docs/security/URP_LOCAL_INDEX_CLOSEOUT.md` §8):

> Stage 4 Choose preflight is unblocked once URP-3.1D is remote-CI
> verified. Stage 4 itself remains DESIGNED_NOT_LIVE. The Stage 4
> preflight must enumerate the exact consent surface required for any
> share decision; the schema for a `share_status` transition; the
> classifier that distinguishes shareable metadata from forbidden
> fields; the audit/replay shape for share decisions themselves.

Choosing is not the same as indexing. The risk class changes from
"this collection is composed in a way that makes a claim about my
body of work" to **"I, the operator, am attesting that this specific
entry is a candidate for sharing — and that attestation is itself a
receipt that must survive replay."** Choose is the first stage with
an outbound-intent decision; consent becomes meaningful (not preview),
and the operator's local act becomes its own audit-bearing artifact.

## 2. URP-4.1 Intended Capability

```
dema urp choose share <index-hash> --consent "MARK URP ENTRY SHAREABLE" [--json]
dema urp choose keep  <index-hash> --consent "MARK URP ENTRY LOCAL-ONLY" [--json]
dema urp choose list  [--state <state>] [--json]
dema urp choose verify <choose-receipt-path> [--json]
```

Behavior:

- Read one entry from `DEMA_HOME/urp/indexes/urp-index-<sha256>.json`
  by `index-hash`. Reject if entry not found or index file fails
  URP-3.1C-ter verification.
- Transition that entry's `share_status` from `MARKED_LOCAL_ONLY` to
  exactly one of `CANDIDATE_SHAREABLE` or `MARKED_KEEP_LOCAL`.
- Write a content-addressed choose receipt at
  `DEMA_HOME/urp/choices/choose-<sha256>.json` (mode `0o600`, atomic
  rename, read-back hash check — same writer discipline as URP-3.1B).
- Receipt carries: source `index_hash`, source `entry` reference,
  decision, exact `consent_phrase` received, `chosen_at_iso`,
  `node` (always `Node0`).
- All four sub-commands are local-only. No share. No federation.
  No mint. No network. The state transition is operator-visible
  intent capture; it does NOT publish anything.

## 3. Non-Goals (Stage 4 boundary)

- No actual share/publish/upload (still local-only intent capture)
- No mint candidate (that is Stage 5)
- No federation (separate later stage)
- No PoI economic claim
- No legal identity assertion
- No production readiness claim
- No "this work is valuable" claim
- No automatic share decision (every transition requires exact consent)
- No bulk decision (one entry per command invocation)
- No share decision rollback by code (Stage 4 receipt is append-only;
  reversing a CANDIDATE_SHAREABLE requires a new choose receipt with
  the keep-local consent phrase, which the Stage 5 mint guard must
  honor)

## 4. Compositional Claim Risk Classification

The four risks Stage 4 introduces beyond Stage 3:

| #   | Risk                                                                                                              | Mitigation                                                                                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Consent-phrase replay** — an automated script captures the exact phrase once and replays it for many entries    | Each choose receipt binds the consent phrase to ONE `index_hash`. The receipt's content hash includes both. Replaying a captured `--consent` flag against a different entry produces a different receipt hash — replay is detectable on the choose-list audit and via the H18-style consent-collected boundary attestation.       |
| R2  | **Bulk auto-share via piped operator input** — `for hash in $(dema urp list); do dema urp choose share $hash ...` | The choose CLI accepts exactly one positional `<index-hash>` per invocation. No `--all` flag, no glob expansion, no `--input-file`. Each invocation requires re-typing the consent phrase. Per safeguard #8 below, the CLI refuses to read consent from stdin or env var — only an explicit `--consent` argv value.               |
| R3  | **Decision drift** — operator changes mind, but the original receipt remains and Stage 5 reads stale state        | Choose receipts are append-only and content-addressed. Stage 5 mint guard MUST read the latest choose receipt for an entry by `chosen_at_iso`, not the first. A CANDIDATE_SHAREABLE that has been superseded by a MARKED_KEEP_LOCAL must be excluded from mint candidacy. Bridge Rule 16 below encodes this discipline.           |
| R4  | **Premature mint inference** — Stage 5 code reads CANDIDATE_SHAREABLE as "mint this now"                          | The choose receipt schema MUST NOT contain `mint_candidate`, `token_eligible`, `reward`, `economic_value`, or `bzc`. CANDIDATE_SHAREABLE explicitly means "the operator would consider sharing this" — not "this is a mint target." Stage 5 mint preflight (URP-5.0, future) introduces its own consent surface gated on Stage 4. |

## 5. Proposed Choose Receipt Schema

```json
{
  "schema": "bizra.dema.urp_choose_receipt.v0.1",
  "chosen_at_iso": "<ISO8601>",
  "node": "Node0",
  "source_index_hash": "<sha256 of stable index body>",
  "source_index_path": "<DEMA_HOME>/urp/indexes/urp-index-<sha256>.json",
  "source_entry": {
    "artifact_sha256": "<hex>",
    "author_fingerprint": "<sha256 of SPKI DER>",
    "receipt_filename": "authorship-<sha256>.json"
  },
  "decision": "CANDIDATE_SHAREABLE",
  "consent_phrase": "MARK URP ENTRY SHAREABLE",
  "consent_collected": true,
  "truth_label": "LOCAL_SHAREABILITY_DECISION_RECEIPT",
  "share_status_transition": {
    "from": "MARKED_LOCAL_ONLY",
    "to": "CANDIDATE_SHAREABLE"
  },
  "choose_receipt_hash": "<sha256 of stable receipt body>"
}
```

Required fields:

- `source_index_hash` — bridge back to Stage 3 evidence; the index file
  MUST verify (URP-3.1C-ter pass) at choose time, not just at index time
- `decision` — exactly one of `CANDIDATE_SHAREABLE` or `MARKED_KEEP_LOCAL`
- `consent_phrase` — verbatim string the operator typed; binds the
  receipt to a specific intent, not a generic GO
- `share_status_transition.from` — locked to `MARKED_LOCAL_ONLY` in
  v0.1 (only first transitions; re-decisions emit a NEW receipt with
  `from` set to the prior decision)
- `choose_receipt_hash` — content-addressed SHA-256 of the stable
  body, excluding the hash field itself

Forbidden fields:

- `private_key`, `private_key_pem`
- `raw_artifact`, `artifact_content`
- `full_receipt_json`, `personal_memory`
- `mint_candidate`, `token_eligible`, `reward`, `bzc`, `imp`
- `economic_value`, `federation_target`
- Any field that names a remote peer, federation address, or smart
  contract identifier

## 6. Choose Receipt File Properties

| Aspect       | Decision                                                                                                         |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| Path         | `DEMA_HOME/urp/choices/choose-<sha256>.json`                                                                     |
| Format       | Single JSON object with `choose_receipt_hash` content-addressed                                                  |
| File mode    | `0o600` (operator-only read/write — same as URP-3.1B writer)                                                     |
| Atomic write | Temp file + rename (matches H18.3B authorship + URP-3.1B index writers)                                          |
| Append-only  | A new receipt for the same index entry NEVER overwrites a prior one                                              |
| Rebuild      | No `--rebuild` flag. Choose receipts are operator intent records and must not be regenerated from derived state. |
| Consent      | Exact-string `--consent` argv only. Not from stdin, env var, or file.                                            |

## 7. Stage 4 Bridge Rules (composition discipline)

Adding to the 12 lifecycle bridge rules (Stage 3 added Rules 8–12):

```
Rule 13. Every choose receipt traces back to exactly one Stage 3 index
         entry, identified by source_index_hash + source_entry's
         artifact_sha256 + author_fingerprint.
Rule 14. Choose receipt is operator intent capture, not publication.
         It does not move bytes off the local machine.
Rule 15. Choose receipts are content-addressed and append-only. A new
         decision for the same entry is a NEW receipt with its own
         hash, not a mutation of the prior one.
Rule 16. Stage 5 mint candidacy reads the LATEST choose receipt per
         (artifact_sha256, author_fingerprint) by chosen_at_iso.
         A CANDIDATE_SHAREABLE superseded by MARKED_KEEP_LOCAL is
         NOT a mint candidate.
Rule 17. The CLI accepts consent only via an explicit --consent argv
         value. Stdin, env var, and --consent-file are all rejected.
Rule 18. The CLI accepts exactly one --index-hash positional per
         invocation. No bulk, no glob, no --all.
```

## 8. Acceptance Criteria for URP-4.1

All must pass before URP-4.1 can be considered complete:

- [ ] `dema urp choose share <hash> --consent "MARK URP ENTRY SHAREABLE"`
      writes one content-addressed choose receipt to
      `DEMA_HOME/urp/choices/choose-<sha256>.json`
- [ ] `dema urp choose keep <hash> --consent "MARK URP ENTRY LOCAL-ONLY"`
      writes a content-addressed receipt with `decision: MARKED_KEEP_LOCAL`
- [ ] Wrong consent phrase → exit 1, no file written, structured error
      envelope with `required_phrase` field
- [ ] Missing `--index-hash` → exit 1, usage on stderr
- [ ] `--index-hash` that does not appear in any local index → exit 1,
      structured error envelope (`error: "index_entry_not_found"`)
- [ ] Source index file fails URP-3.1C-ter verification → exit 1, no
      choose receipt written (`error: "source_index_unverified"`)
- [ ] Choose receipt file mode is `0o600`
- [ ] Choose receipt schema matches §5 (frozen object, no forbidden fields)
- [ ] No private key material in choose receipt or CLI output
- [ ] No raw artifact content in choose receipt or CLI output
- [ ] No `mint_candidate` / `token_eligible` / `economic_value` /
      `federation_target` field in receipt or output
- [ ] `dema urp choose list [--state CANDIDATE_SHAREABLE|MARKED_KEEP_LOCAL]`
      enumerates local choose receipts; filename-hash parity check;
      LATEST-per-entry by `chosen_at_iso`
- [ ] `dema urp choose verify <receipt-path>` re-checks schema + body
      hash + filename hash + forbidden-field absence (mirrors URP-3.1C-ter
      12-layer pattern for the choose receipt schema)
- [ ] Re-decision: `keep <hash>` after prior `share <hash>` produces a
      new receipt; both files coexist; `list` shows latest decision
- [ ] No CLI flag exports any choose receipt to network or another node
- [ ] No CLI flag accepts `--all`, `--input-file`, stdin consent, or
      env-var consent
- [ ] Pure module + writer + verifier package layout mirrors
      URP-3.1A/B/C-ter for consistency
- [ ] Tests cover: happy share, happy keep, wrong consent, missing
      hash, not-found hash, unverified source index, mode 0o600,
      append-only re-decision, no forbidden fields, no private key
      leak, no raw artifact leak, exact-consent-only enforcement,
      list filters by state, verify returns VERIFIED/FAILED
- [ ] Docs in `ARCHITECTURE.md` + `TESTING.md` updated for each sub-slice
- [ ] CI green at each URP-4.1A/B/C/-ter/D commit
- [ ] URP-4.1D closeout drift-guard probe wired into `scripts/check.mjs`
      (same pattern as `scripts/urp-stage3-closeout.mjs`)

## 9. What This Preflight Does NOT Do

- Does not create any choose receipt file
- Does not write the choose kernel, writer, or CLI modules
- Does not authorize sharing or publication of any bytes
- Does not enable Stage 5 (Mint)
- Does not federate with any other node
- Does not assert any resource has economic value
- Does not introduce PoI scoring
- Does not extend any prior CLI surface

## 10. Boundary

```json
{
  "urp_4_0_preflight_boundary": {
    "code_written": false,
    "choose_receipt_created": false,
    "share_decision_executed": false,
    "publish_enabled": false,
    "mint_enabled": false,
    "federation_enabled": false,
    "operator_action_required": false,
    "private_key_loaded": false,
    "network_used": false,
    "token_minted": false,
    "poi_score_calculated": false,
    "economic_claim_made": false,
    "document_written": true,
    "risk_classified": true
  }
}
```

## 11. Next Step

After this preflight is remote-CI-sealed:

```
URP-4.1 — Local Choose v0.1
```

Implementation scope per §8 acceptance criteria, decomposed into:

- **URP-4.1A** — pure share-decision kernel (`packages/urp/src/choose-decision.js`)
- **URP-4.1B** — durable choose receipt writer (`packages/urp/src/choose-writer.js`)
- **URP-4.1C** — `dema urp choose share|keep` CLI wiring
- **URP-4.1C+** — `dema urp choose list` read surface
- **URP-4.1C-ter** — `dema urp choose verify <path>` verify-by-path
- **URP-4.1D** — docs + replayable real-chain demo script + `check.mjs` harness probe

No Stage 5 work until URP-4.1 is fully sealed and drift-guarded. The
Stage 5 Mint preflight (URP-5.0, future) introduces its own consent
surface gated on the existence of `CANDIDATE_SHAREABLE` choose receipts
that have not been superseded.

Last updated: 2026-05-28 at commit `4f10f6a` (URP-3.1D closeout sealed).
