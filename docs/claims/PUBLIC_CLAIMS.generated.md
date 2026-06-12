# BIZRA Public Claims (generated — do not edit by hand)

> Generated from `docs/claims/node0-claim-register.v0.1.json` by
> `scripts/claims/generate-public-claims.mjs` (`npm run claims:generate`).
> Every public statement about BIZRA should trace to a row below. A claim's
> `status` is its maturity, not a marketing label: DESIGNED < MECHANISM_VERIFIED_SYNTHETIC
> < REAL_OPERATOR_VERIFIED < PUBLIC_MAIN_SYNCED < PRODUCTION_ACTIVE.

| ID | Claim | Scope | Status | Evidence | Confidence |
| --- | --- | --- | --- | --- | --- |
| C-DEMA-COCKPIT | Dema is a local-first, consent-bound, receipt-backed proof cockpit — the door into BIZRA, not the whole ecosystem. | dema | MECHANISM_VERIFIED_SYNTHETIC | MEASURED | high |
| C-DEMA-ZERODEP | Dema has zero production and zero dev dependencies (Node.js stdlib only; no package-lock). | dema | PUBLIC_MAIN_SYNCED | VERIFIED | high |
| C-N0-MUMU-MECHANISM | The Node0/Mumu closed loop produces replay-verifiable, privacy-safe artifacts end-to-end (scan -> world map -> mission -> PAT/SAT -> consent -> action -> receipts -> reflection). | node0 | MECHANISM_VERIFIED_SYNTHETIC | MEASURED | high |
| C-N0-MUMU-REAL-RUN | The Node0/Mumu loop has served Mumu's real private data in a real operator run. | node0 | DESIGNED | UNKNOWN | low |
| C-G8-FRESHNESS | The G8 harness classifier fails closed on stale/empty/unbound test logs (a verifier verifies its evidence freshness before the result). | ci | MECHANISM_VERIFIED_SYNTHETIC | VERIFIED | high |
| C-RECEIPT-REPLAY | BIZRA receipt chains are hash-chained and replay-verifiable, with tamper detection on corrupted receipts or inventory. | node0 | MECHANISM_VERIFIED_SYNTHETIC | MEASURED | high |
| C-TOKEN-ECONOMY | BIZRA mints token / economic rewards from verified impact. | economy | DESIGNED | SCENARIO | low |
| C-FEDERATION | BIZRA operates a public federation / global URP network across multiple nodes. | federation | DESIGNED | DESIGNED_NOT_LIVE | low |
| C-PRODUCTION-READY | Node0 / Dema is production-ready for closed-loop deployment. | node0 | DESIGNED | UNKNOWN | low |
| C-IHSAN-ENFORCED | The Ihsan constitutional gate (>= 0.95) is enforced in code on every surface. | datalake | DESIGNED | DERIVED | low |

## Gated — must NOT be stated as live

These carry blocked wording (token / federation / production / private data /
Data-Lake mutation). They cannot exceed MECHANISM_VERIFIED_SYNTHETIC until real
evidence exists. State them only with their status, never as live:

- **C-N0-MUMU-REAL-RUN** — `DESIGNED` · blocked: private_data · artifacts/node0/mumu/ is empty — no real operator chain on disk. Pending gate: N0-MUMU-REAL-ROOT-RUN.
- **C-TOKEN-ECONOMY** — `DESIGNED` · blocked: token, mint, reward, economic · Simulation only. dual-token-preview.v0.1.json carries token_minted:false, wallet_used:false, network_used:false. Requires external scholarly/legal/economic validation before any live claim.
- **C-FEDERATION** — `DESIGNED` · blocked: federation, public_network · network mode is GENESIS_SINGLE_NODE_ACTIVE_NETWORK; external_federation_active:false; node_count:1. Directional only.
- **C-PRODUCTION-READY** — `DESIGNED` · blocked: production · Production checklist 13/134 (9.7%) complete; constitutional Ihsan gate 0.808 < 0.95. Blocked until checklist DoD passes.
- **C-IHSAN-ENFORCED** — `DESIGNED` · blocked: production · Composite Ihsan 0.808 < 0.95; gate is not CI-hard on every surface (audit finding). Designed, not uniformly live.
