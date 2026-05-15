# Dema Testing Matrix

This matrix records the committed local test surfaces. It is intentionally scoped to committed files in this slice; broader dirty-tree preview tests remain separate until their own atomic commits land.

## Commands

Run the full local gate:

```bash
npm test
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
| `tests/active-kernel.test.js` | Active-kernel banner, gateway probe, shell tokenization, CLI smoke behavior, and task registry basics. |
| `tests/actuator-check.test.js` | Raw actuator and EffectCap invariant static guard behavior. |
| `tests/approval-gate.test.js` | Approval gate and exact-consent safety behavior. |
| `tests/canon-check.test.js` | Topology canon registry and forbidden topology drift guard. |
| `tests/consent-planner.test.js` | Micro-consent planning, permission extraction, unsafe file filtering, JSON/human CLI output. |
| `tests/effectcap-invariant.test.js` | Pre-runtime EffectCap invariant spec and negative tests. |
| `tests/gateway-http-adapter.test.js` | Gateway adapter probing and failure normalization. |
| `tests/loop-emulator.test.js` | PAT/SAT loop design emulation preview, determinism, and no-runtime boundary. |
| `tests/melae-preview.test.js` | MELAE/SAPE preview scoring, fail-closed probe validation, SNR/Ihsan floor gates, and no-runtime boundary. |
| `tests/memory.test.js` | Local memory/profile reading and safe missing-state behavior. |
| `tests/node0-local-urp-proof.test.js` | Local URP proof boundaries. |
| `tests/node0-self-check.test.js` | Node0 self-check verification surface. |
| `tests/priority-anchor.test.js` | Founding-file Merkle root algorithm and priority anchor behavior. |
| `tests/review-gate.test.js` | PR class and proof-scope guardrails. |
| `tests/status.test.js` | Status formatting, readiness, setup idempotency, mission proposal, receipts, CLI basics. |
