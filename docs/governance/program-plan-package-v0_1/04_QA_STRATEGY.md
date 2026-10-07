# 04 · Quality Assurance Strategy

**Status:** PROPOSED · current gates are MEASURED; enterprise tiers are TARGETS

## Testing methodology (what actually runs today)

| Tier | Implementation | Gate status |
|---|---|---|
| Unit/law | 9740 Node tests + 37 Rust tests; red-first slice discipline | **BLOCKING, measured green** |
| Mutation-style tamper probes | every kernel ships content-hash flip tests (structure-sensitive) | blocking |
| Integration | negative controls inside orchestrators (flipped hash / mutated frame / dropped terminal must fail) | blocking |
| Contract (cross-language) | PARITY gate: JS↔Rust refusal-name parity under shared digest `ce180884…` / `6a4d352a…` | wired into qualification receipt |
| Review gates | per-slice `<slice>-check.mjs` wired into `npm run check`; G8 fail-closed TAP classifier | blocking, exit-evidence emitted |
| Static/security | CodeQL + gitleaks in CI; no-overclaim + receipt-integrity review scripts | blocking |
| Performance | PERF-MEASURE-1A bench (boot latency/RSS/CPU) recorded per run | informational → budget-gating is TARGET |
| E2E/perf/soak | k6/Playwright suites | NOT YET BUILT — Phase P4 deliverable |

## Compliance framework position

- Every capability row carries: truth_label, what_this_proves,
  what_this_does_not_prove, forbidden_claims, evidence paths — the
  no-overclaim discipline IS the compliance substrate.
- Qualification verdicts limited to PASS|REFUSE|CONTRADICTED|UNKNOWN
  (MOSTLY_PASS unrepresentable at type level).
- Audit trail convention: receipts bind digests of descriptor+evidence.

## Performance benchmarks (TARGETS until measured at load)

p95 API <300ms @2× peak · availability 99.9% · boot ≤150ms (measured 104ms) ·
queue backpressure contractual (128/16).

## Quality gates ladder (repo law)

```text
node --test <focused> → npm test → npm run check → npm run llm:guidance → git diff --check → CI sweep
```

Promotion of any `[MEASURED]` claim requires the full ladder plus the
four-wiring-point invariant (kernel+test+gate+registry row+docs+receipt).
