# SAT Verifier Sibling — v0.3.2 Spec (DECLARED)

**Status:** doctrine, layered above [A4.5 Dema Autonomy Envelope](dema-autonomy-envelope.md) and [PAT-Builder / SAT-Validator Doctrine v0.1](pat-builder-sat-validator.md). Truth label: **DECLARED**. Implementation: **PLANNED** for v0.3.2 cycle.

**Bound by:** [ADR-001](../06-adr/ADR-001-dema-is-one-face.md), [ADR-003](../06-adr/ADR-003-core-truth-lives-in-bizra-omega.md), [ADR-005](../06-adr/ADR-005-operator-actions-require-explicit-consent.md), and the repo invariants in [CLAUDE.md](../../CLAUDE.md).

**One-line summary:** Today's SAT verifier handles only the *task-receipt* schema. Production receipts use *two* schemas. v0.3.2 closes the asymmetry while preserving the L0-only / placeholder-honest posture until the real SAT-5 Rust roster lands upstream.

---

## Why this exists (and why now)

The v0.3.0 SAT placeholder ([`packages/verifier/src/sat-placeholder.js`](../../packages/verifier/src/sat-placeholder.js)) verifies receipts of one shape — `bizra.dema.task_receipt.v0.1` (e.g. `downloads.audit.preview` outputs). It REJECTs receipts that try to claim a stronger verdict than evidence supports, which is honest behavior **for that schema**.

Production reality has a second schema in active use: `bizra.dema.gateway_receipt_handoff.v0.1` — the local mirror of upstream-issued mission receipts (e.g. ARTIFACT-011 at `~/.dema/receipts/artifact-011.json`).

A falsification probe run on 2026-05-07 surfaced this gap concretely:

```
verifyReceiptPlaceholder(<artifact-011>)
  → REJECT  (because: scope missing, rollback_required missing,
              payload_digest missing, sat_verdict missing)
```

The REJECT is *technically correct conservative behavior* — but it also reveals that **the placeholder has no schema-aware path for gateway-issued receipts at all.** The honest framing is: today's verifier is for one of two real shapes; the other shape has zero coverage, placeholder or otherwise.

v0.3.2 closes this asymmetry **without over-claiming.** The verifier remains placeholder-grade until the real SAT-5 Rust roster (PLANNED upstream in `bizra-data-lake/bizra-omega/bizra-cognition/`) replaces it. v0.3.2's job is to make the placeholder **schema-aware**, not to certify.

---

## The two receipt schemas v0.3.2 must handle

### 1. `bizra.dema.task_receipt.v0.1` (Dema-issued)

Produced by registered tasks in `packages/tasks/src/` (today: `downloads-audit-preview.js`). Shape:

```jsonc
{
  "schema": "bizra.dema.task_receipt.v0.1",
  "receipt_id": "task-<id>-<uuid>",
  "task_id": "downloads.audit.preview",
  "truth_label": "MEASURED",
  "scope": "read-only",
  "target": "/path/to/scanned/dir",
  "rollback_required": false,
  "consent_acknowledged": true,
  "sat_verdict": "PARTIAL_PLACEHOLDER",
  "result": { "file_count": ..., "by_extension": {...}, ... },
  "payload_digest": "<sha256-hex>"
}
```

**Verifier checks today (carry forward):** scope == "read-only", rollback_required === false, payload_digest present (64-hex), sat_verdict honestly declared as PARTIAL_PLACEHOLDER. All four must pass for `PARTIAL_PLACEHOLDER`; any fail → `REJECT`.

### 2. `bizra.dema.gateway_receipt_handoff.v0.1` (gateway-issued mirror)

Produced by `bizra-cognition-gateway` POST `/missions` upstream; mirrored locally to `~/.dema/receipts/`. Shape (per `SPROUT_PIN.md`):

```jsonc
{
  "schema": "bizra.dema.gateway_receipt_handoff.v0.1",
  "receipt_id": "<sha256>",
  "artifact_id": "ARTIFACT-011",
  "action": "bounded_diagnostic_activation",
  "truth_label": "GATEWAY_ISSUED_HANDOFF",
  "created_at": "<iso8601>",
  "handoff_note": "Gateway sealed first mission; Dema-local mirror...",
  "gateway": {
    "base_url": "http://127.0.0.1:7421",
    "mission_id": "<sha256>",
    "receipt_id": "<sha256>",
    "chain_head": "<sha256>",
    "chain_length": <n>,
    "admissibility_verdict": "Permit" | "Reject" | "Review" | "ScoreOnly",
    "final_stage": "Replayability"
  },
  "proof_anchors": {
    "evidence_hash_niyyah_sha256": "<sha256>",
    "preview_json_sha256": "<sha256>",
    "ideal_state_hash_sha256": "<sha256>"
  },
  "preserved_post_request_body": {...},
  "preserved_post_response_body": {
    "missionId": "<sha256>",
    "admissibility": {
      "verdict": "Permit",
      "gateVerdicts": [
        { "scorerId": "ZANN_ZERO", "verdict": "Permit", "score": 1, "reason": "..." },
        ...
      ]
    },
    ...
  },
  "preserved_get_chain_after_post": {...},
  "consent_phrase_record": "GO: Node0 bounded diagnostic activation only"
}
```

**Verifier checks v0.3.2 must add:**

| Check | Requirement |
|---|---|
| `gateway.admissibility_verdict === "Permit"` | required for non-REJECT verdict |
| `gateway.gateVerdicts` (if exposed in `preserved_post_response_body.admissibility`) | all required scorers Permit (ZANN_ZERO, CLAIM_MUST_BIND, RIBA_ZERO, NO_SHADOW_STATE, IHSAN_FLOOR ≥ 0.95) |
| `consent_phrase_record === BOUNDED_DIAGNOSTIC_CONSENT_PHRASE` | byte-for-byte for ARTIFACT-011 receipts; future actions may have other phrases |
| `proof_anchors.evidence_hash_niyyah_sha256` matches the niyyah on disk if available | optional; report `evidence_hash_unverified_locally` if niyyah file absent |
| `gateway.chain_head` matches live gateway `/chain` response if gateway reachable | optional; report `chain_head_unverified_offline` if gateway unreachable |
| `truth_label === "GATEWAY_ISSUED_HANDOFF"` | required |

**Verdict shape:** the existing `bizra.dema.sat_verdict.v0.1` schema already maps to upstream `GateVerdict` (`PERMIT` / `REJECT` / `REVIEW` / `SCORE_ONLY`). v0.3.2 reuses that schema for both receipt shapes; the per-schema check list differs but the verdict envelope is uniform.

---

## Routing contract — `verifyReceipt(receipt)`

v0.3.2 introduces a single dispatch entry point in the verifier package:

```ts
function verifyReceipt(receipt: object): VerifierVerdict;
```

Behavior:

1. **Inspect `receipt.schema`** — strict equality, no fuzzy match (per A4.5 anti-pattern #4: shadow consent surfaces).
2. **Dispatch:**
   - `bizra.dema.task_receipt.v0.1` → existing `verifyReceiptPlaceholder` (now renamed `verifyTaskReceipt` for clarity).
   - `bizra.dema.gateway_receipt_handoff.v0.1` → new `verifyGatewayHandoffReceipt`.
   - Any other schema → return `REJECT` with reason `unsupported_schema:<schema>`. Fail-closed by default per A4.5 §"Core law".
3. **Compose verdict** in the uniform `bizra.dema.sat_verdict.v0.1` envelope. Schema-specific check details land in the `checks[]` array; the top-level `verdict` reflects whether all required checks passed.

The existing `verifyReceiptPlaceholder` export is **kept** for backwards compatibility; new callers use `verifyReceipt`. Migration: deprecate `verifyReceiptPlaceholder` in v0.3.3 once the active kernel + tests use `verifyReceipt`.

---

## Post-action verification contract

v0.3.2 also formalizes the post-action verification pattern that the active kernel already implements informally:

```
1. Operator runs `dema task <name>`
2. Approval gate (B1.2) clears (or refuses)
3. Task runs (read-only by current scope)
4. Task writes a receipt
5. ──── post-action verification gate ────
   - verifyReceipt(receipt) is called BEFORE the receipt is reported as final
   - if verdict === "REJECT", the receipt is still written (audit trail) but the
     CLI reports the rejection prominently
   - if verdict === "PARTIAL_PLACEHOLDER", the CLI reports it as such (honest)
   - the operator never sees a "CERTIFIED" claim until real SAT-5 lands
6. Receipt + verdict displayed via formatTaskReceipt + formatVerdict
```

The contract is: **every L1+ act that produces a receipt must call `verifyReceipt` before declaring success.** A failure to verify is itself a finding to surface — never a silent pass.

This contract is enforced by tests:
- For each task-receipt-producing path in `apps/cli/src/index.js`, a CLI integration test asserts `verifyReceipt` was called and its verdict is rendered in stdout.
- For each gateway-receipt-handling code path, a test fixtures a known-good and a tampered receipt, asserting Permit and REJECT verdicts respectively.

---

## L0–L5 boundary preservation

v0.3.2 stays L0 (Observe) per A4.5:

- **No mutation** — the verifier only reads receipts; never writes, edits, or deletes.
- **No POST** — gateway cross-checks (when reachable) use GET only, mirroring the existing `gateway-http-adapter.js` contract.
- **No identity binding** — verifier never signs, never issues, never timestamps.
- **No autonomous action** — no daemon, no scheduler, no proactive verification cycle. Verification fires only when a CLI surface explicitly requests it (per the post-action contract above).

The verifier package remains a pure-function library plus optional HTTP cross-check (read-only). Its truth label posture is **"DECLARED"** for v0.3.2's own checks and **"MEASURED_PARTIAL"** when gateway cross-check is performed and reaches the gateway.

The verifier never returns `truth_label: "MEASURED"` standalone — that label is reserved for receipts produced by code paths that directly observed the underlying state. The verifier observes **the receipt about** the state, not the state itself.

---

## What v0.3.2 does NOT do

These items are **NOT** in v0.3.2 scope and remain PLANNED for v0.3.3+ or upstream:

- Real SAT-5 admissibility chain (Ihsān ≥0.95, Adl, Guardian, Confidence ≥0.80) — lives upstream in `bizra-omega/bizra-cognition/src/admissibility_freeze_v1.rs`. v0.3.2 reuses the verdict shape; v0.3.2 does NOT implement the chain.
- Cryptographic signature verification on receipts — needs identity material (DIDs, signing keys) which is L5 and out of scope for any Dema-side surface.
- Receipt chain validator (`prev_hash` walk over `~/.dema/receipts/`) — this is v0.3.6 per ROADMAP.
- POI score derivation — lives upstream; v0.3.2 may *read* POI summaries but never *derives* impact scores.
- Schema migration tooling — when the receipt schema bumps from v0.1 to v0.2, that's a separate concern.

---

## Receipt-shape integrity rules (carry forward from existing placeholder)

Both schema verifiers MUST enforce:

1. **Truth-label discipline** — receipt's declared `truth_label` must match its evidence class. A receipt declaring `truth_label: "MEASURED"` while missing required evidence fields → REJECT.
2. **Schema-tag discipline** — receipts without `schema` field, or with unknown schema → REJECT (no implicit defaults).
3. **Decline-to-overclaim** — verifier never returns `PERMIT` for any receipt v0.3.2 handles. Only real SAT-5 issues `PERMIT`. v0.3.2 caps at `PARTIAL_PLACEHOLDER` for the happy path and `REJECT` for any failure.

---

## Migration path to real SAT-5

When the SAT-5 Rust roster lands upstream in `bizra-data-lake/bizra-omega/`:

1. **Gateway exposes verification endpoint** — e.g. `GET /verify?receipt_id=...` returning the upstream admissibility verdict.
2. **Dema verifier module gains a `--use-real-sat` mode** — when enabled, calls the gateway endpoint instead of running the local placeholder logic.
3. **Truth labels upgrade** — gateway-cross-checked receipts can now claim `truth_label: "MEASURED"` because the upstream admissibility chain is the actual measurement.
4. **`PERMIT` verdict becomes available** — only when SAT-5 says so; never from local logic alone.

v0.3.2 designs for this future without committing to any aspect of it. The router pattern in `verifyReceipt(receipt)` is the seam where the real-SAT-5 client lands.

---

## File layout (v0.3.2)

```
packages/verifier/
├── src/
│   ├── sat-placeholder.js      ← existing (kept for backwards compatibility)
│   ├── verify-receipt.js       ← NEW: router + dispatch
│   ├── verify-task-receipt.js  ← NEW: extracted task-receipt logic (currently in sat-placeholder.js)
│   └── verify-gateway-handoff.js  ← NEW: gateway-receipt-shape verifier
└── package.json                ← (or rolled into root package.json — TBD per zero-deps style)
```

If the package split feels heavy, an alternative is to keep all logic in `sat-placeholder.js` and add the router as a new export. v0.3.2 implementation will choose the lower-LOC path consistent with engineering discipline rule #1.

---

## Acceptance criteria for v0.3.2 close

The cycle ships when:

1. ✅ `verifyReceipt(receipt)` exists, dispatches by schema, falls closed on unknown schema.
2. ✅ Task-receipt verification has identical behavior to existing `verifyReceiptPlaceholder` (regression-tested).
3. ✅ Gateway-handoff verification is implemented with the checks listed above; honest about its placeholder grade.
4. ✅ Tests cover both schemas, including: a known-good receipt of each shape, a tampered receipt of each shape, an unsupported-schema input, and the absent-niyyah / unreachable-gateway optional-check paths.
5. ✅ `apps/cli/src/index.js` task case calls `verifyReceipt` (not `verifyReceiptPlaceholder` directly) — same behavior, route through the dispatch.
6. ✅ `dema receipts <id>` CLI surface is unchanged in v0.3.2 scope (verification on read is v0.3.6).
7. ✅ `npm test` and `npm run check` green.
8. ✅ No L1+ surfaces added; verifier stays L0.
9. ✅ This spec doc updated with implementation cross-references on close.

---

## Versioning

This document is **v0.1**. Tightening edits (more checks, narrower acceptance criteria, additional schemas) → standard PR review. Loosening edits (fewer checks, weaker truth-label rules, autonomous verification cycles) → require operator typed GO and a new ADR.

Doc-level invariants:
- The verifier never claims to be SAT-5.
- The verifier never returns `PERMIT` from local logic.
- The verifier preserves L0–L5 boundary at all times.

These three are unconditional in v0.1 of this spec.
