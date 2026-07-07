# DEMA-ZERO-OVERCLAIM-RESPONSE-POLICY-1A

Truth label: `DEMA_ZERO_OVERCLAIM_POLICY_MEASURED_REPO`.

## Purpose

The repo-enforced answer discipline. The Socratic critic interrogates a *hypothesis*; this policy
governs what may be *said* — it prevents an unsupported claim from leaving the system as if verified.
A correct-looking answer without a verified path is not sovereign intelligence; this kernel refuses to
ship one dressed as fact.

## Input contract — a response packet

```js
{
  answer_claims: [{
    text,               // the claim
    claim_type,         // "fact" | "inference" | "speculation"
    evidence_refs: [],  // supporting evidence for this claim
    freshness_risk,     // "current" (time-sensitive) | "stable"
    high_stakes_domain, // "legal" | "medical" | "financial" | "security" | null
    source_quality,     // "primary" | "secondary" | "none" | "invented"
    asserted_label,     // what the answer presents it as (e.g. "VERIFIED")
  }],
  grants_action,        // packet-level — must not be true
  authority_delta,      // packet-level — must be 0
  claims_truth,         // packet-level — not without a verified claim
}
```

## Output contract

```text
classified[]  { classification, enforced_label, blocked_by[] }
labels[]      one of VERIFIED / INFERRED / SPECULATIVE / UNVERIFIED / BLOCKED_PENDING_EVIDENCE
status        cleared_to_respond | blocked_pending_evidence | rejected_overclaim
blocked_by[]
grants_action: false · claims_truth: false · authority_delta: 0 · boundary: all-false · content_hash
```

## Discipline (downgrade vs reject)

- **Downgrade** (honest relabel, still shippable): fact-without-evidence → `UNVERIFIED`; inference →
  `INFERRED`; speculation → `SPECULATIVE`.
- **Block** (needs verification first): current-without-evidence and high-stakes-without-evidence →
  `BLOCKED_PENDING_EVIDENCE`.
- **Reject** (presentation violation): invented source; inference/speculation asserted as `VERIFIED`;
  authority inflation (`grants_action:true` / `authority_delta>0`); `claims_truth` without a verified
  claim.

## Boundaries

- Pure kernel; no fs/network/clock/random. No model invocation, no evidence fetch.
- It **downgrades and blocks; it never upgrades authority.** `authority_delta:0`, `grants_action:false`.
- No daemon, no URP, no mint, no federation, no wallet.

## Files

```text
packages/core/src/dema-zero-overclaim-response-policy.js
tests/dema-zero-overclaim-response-policy.test.js
scripts/review/dema-zero-overclaim-response-policy-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DEMA_ZERO_OVERCLAIM_RESPONSE_POLICY_1A.md
docs/02-architecture/DEMA_ZERO_OVERCLAIM_RESPONSE_POLICY_v0_1.md
```
