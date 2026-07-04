# DEMA-FDE-FORWARDER-DIAGNOSTIC-1A

Truth label: `DEMA_FDE_FORWARDER_DIAGNOSTIC_MEASURED_REPO`

## Purpose

Route a completed FDE dual-diagnostic report to a single fail-closed forwarding destination under the Diagnostic Doxology; routing proposes, never executes.

## The Diagnostic Doxology (routing law)

| Rule | Law | Encoding |
| --- | --- | --- |
| R1 | If the code failed, patch the code. | `implementation_defect` / `test_drift` → `patch_code_proposal` |
| R2 | If the proof failed, repair the proof. | `proof_gap` / `doc_drift` → `repair_proof_proposal` |
| R3 | If the world failed, repair the environment. | `environment_gap` / `dependency_gap` / `permission_gap` → `repair_environment_proposal` |
| R4 | If consent is missing, stop. | exact GO phrase gate; `boundary_violation` → `halt_boundary_violation`; `unknown` class or `UNKNOWN` status → `insufficient_evidence_stop` |
| R5 | If impact is simulated, do not mint. | `mint_blocked: true` on every routing; no mint destination exists |
| R6 | If cost is measured, do not call it value. | `cost_forwarded_as: "cost_only_never_value"` — cost never renders as value |
| R7 | If CI is unavailable, do not call it code failure. | `github_actions_billing_lock` → `ci_unavailable_operator_action`, `code_implicated_forwarded: false`; a report claiming both billing lock and `code_implicated: true` is rejected |
| R8 | If the phone is not registered, do not pretend it is connected. | `channel_status` ∈ `NO_CHANNEL` / `DECLARED_REGISTERED_NOT_VERIFIED` / `UNREGISTERED_NOT_CONNECTED`; `connected_claim_made: false` always |

Precedence (first match wins): `boundary_violation` > `github_actions_billing_lock` >
insufficient evidence > code > proof > world. Every destination is a proposal for a
human; there is no destination named mint, execute, autopatch, deploy, or merge.

## Input Contract

```js
runDemaFdeForwarderDiagnostic({ consent, input })
```

Exact consent:

```text
GO: dema fde forwarder diagnostic preview
```

## Output Contract

```text
schema
truth_label
ok
content_hash
boundary.execution_allowed (false)
blocked_by[]
```

## Verification

```js
verifyDemaFdeForwarderDiagnostic(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/dema-fde-forwarder-diagnostic.js
tests/dema-fde-forwarder-diagnostic.test.js
scripts/review/dema-fde-forwarder-diagnostic-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DEMA_FDE_FORWARDER_DIAGNOSTIC_1A.md
docs/02-architecture/DEMA_FDE_FORWARDER_DIAGNOSTIC_v0_1.md
```

## Commands

```bash
node --test tests/dema-fde-forwarder-diagnostic.test.js
node scripts/review/dema-fde-forwarder-diagnostic-check.mjs --json
npm test
npm run check
```
