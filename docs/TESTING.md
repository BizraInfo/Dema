# Dema Testing Matrix

This matrix records the committed local test surfaces. It is intentionally scoped to committed files in this slice; broader dirty-tree preview tests remain separate until their own atomic commits land.

## Commands

Run the full local gate:

```bash
npm test
npm run coverage
npm run check
git diff --check
```

Run one test file:

```bash
node --test tests/status.test.js
```

## Test surfaces

| Test file | Surface covered |
|---|---|
| `tests/active-kernel-banner.test.js` | Active-kernel banner, gateway probe, and shell tokenization. |
| `tests/active-kernel-cli.test.js` | Active-kernel CLI smoke behavior and task command wiring. |
| `tests/downloads-audit-preview.test.js` | Read-only downloads audit task, task receipt, placeholder SAT verdict formatting. |
| `tests/sat-placeholder.test.js` | Receipt verifier dispatch, gateway handoff checks, exact consent, fail-closed behavior. |
| `tests/actuator-check.test.js` | Raw actuator and EffectCap invariant static guard behavior. |
| `tests/approval-gate.test.js` | Approval gate and exact-consent safety behavior. |
| `tests/canon-check.test.js` | Topology canon registry and forbidden topology drift guard. |
| `tests/consent-planner.test.js` | Micro-consent planning, permission extraction, unsafe file filtering, JSON/human CLI output. |
| `tests/effectcap-invariant.test.js` | Pre-runtime EffectCap invariant spec and negative tests. |
| `tests/gateway-http-adapter.test.js` | Gateway adapter probing and failure normalization. |
| `tests/llm-guidance-check.test.js` | Canonical LLM flow guidance, root agent routing, and docs noise classification. |
| `tests/loop-emulator.test.js` | PAT/SAT loop design emulation preview, determinism, and no-runtime boundary. |
| `tests/melae-preview.test.js` | MELAE/SAPE preview scoring, fail-closed probe validation, SNR/Ihsan floor gates, and no-runtime boundary. |
| `tests/memory.test.js` | Local memory/profile reading and safe missing-state behavior. |
| `tests/node0-local-urp-proof.test.js` | Local URP proof boundaries. |
| `tests/node0-self-check.test.js` | Node0 self-check verification surface. |
| `tests/priority-anchor.test.js` | Founding-file Merkle root algorithm and priority anchor behavior. |
| `tests/release-readiness.test.js` | Release-readiness report, workflow scan, dependency/installer/doc risk checks. |
| `tests/review-gate.test.js` | PR class and proof-scope guardrails. |
| `tests/status.test.js` | Status formatting, readiness, setup idempotency, mission proposal, receipts, CLI basics. |


## Coverage threshold

`npm run coverage` uses Node's native test coverage gate with enforced
thresholds:

```text
lines: 95
branches: 80
functions: 95
```

The primary GitHub Actions check and BIZRA Review Gate run this coverage command
after `npm test` and before `npm run check`.
