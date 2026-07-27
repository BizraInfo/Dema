# 01 — Dema boundary

```text
Dema is the face, not the whole system.
No runtime execution in this repo by default — only in explicitly named runtime
adapters, under exact consent, bounded authority, append-only evidence,
independent verification and reconstructable state (ADR-048).
Pure kernels (packages/*/src) remain side-effect free — kernel-purity-check.mjs.
No hidden daemon. No implicit model invocation. No unreceipted state transition.
No external provider call by default.
Exact-string consent only (packages/fate/src/fate.js).
All local state under DEMA_HOME or ~/.dema unless explicitly scoped.
Receipts: read/list in Dema; governed runtime issues receipts.
Node1/Node2/federation/token/PoI: DESIGNED_NOT_LIVE or PREVIEW_ONLY until proof gates pass.
```

Honesty map: `docs/CURRENT_LIMITS.md` — update when promoting any surface to `MEASURED`.

Layer 1 scanner enforces forbidden phrases in structured artifacts (`npm run eval:layer1`).
