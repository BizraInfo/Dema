# CANONICAL_JSON_V1_CONTRACT_0A — slice receipt

- **Slice:** CANONICAL-JSON-V1-0A (M5.1A)
- **Date:** 2026-07-11
- **Base:** `main` @ `14a0fff49b3251ab6f20603f0dcddb55f84a38aa`
- **Truth label:** `PREVIEW_ONLY`
- **Boundary:** canonical 17-key preview boundary, all false
- **Authority delta:** 0

## What shipped

| Piece | Path |
|---|---|
| Pure canonicalizer kernel | `packages/canon/src/canonical-json-v1.js` |
| Closed error-code registry | `packages/canon/src/canonical-json-errors.js` |
| sha256 binding + verify | `packages/canon/src/sha256-canonical-json-v1.js` |
| Valid vectors (24, exact bytes + hashes) | `packages/canon/vectors/canonical-json-v1-valid.json` |
| Invalid vectors (34, exact error codes) | `packages/canon/vectors/canonical-json-v1-invalid.json` |
| Tests (14) | `tests/canonical-json-v1.test.js` |
| Review gate (wired into `npm run check`) | `scripts/review/canonical-json-v1-check.mjs` |
| Independent Python verifier (stdlib only) | `scripts/review/canonical-json-v1-verify.py` |
| Contract ADR | `docs/06-adr/ADR-CANONICAL-JSON-V1.md` |

## Proof commands

```bash
node --test tests/canonical-json-v1.test.js
node scripts/review/canonical-json-v1-check.mjs --json
python3 scripts/review/canonical-json-v1-verify.py
npm test
npm run check
npm run llm:guidance
```

## What this proves

- One versioned byte contract (`bizra.canonical-json.v1`) exists with a closed
  accepted/rejected domain and a closed error-code registry.
- 24 valid vectors reproduce exact authored UTF-8 bytes and `sha256:` hashes in
  **two independent implementations** (JavaScript and Python stdlib), including
  ECMAScript shortest-round-trip number layout, code-point key ordering, `-0`
  normalization, and all five measured resource-limit boundaries.
- 34 invalid vectors fail closed with exact registered error codes (incl. the
  SAT-found non-canonical array-index names `"00"`/`"-0"`/`"1e0"`); accessor
  properties are rejected **without executing**; input is never mutated.
- Resource limits are evidence-based: measured maxima over all 47 tracked JSON
  artifacts sit at ≤ 18.4% of every limit (25% rule honored).
- The M5.0 divergence inputs (`{a: undefined, b: 1}`, `[undefined]`) are pinned
  as regression vectors: v1 rejects what legacy serializers silently disagreed
  on.
- Adoption is frozen and gate-enforced: no production surface imports
  `packages/canon` (the review gate scans `packages/`, `apps/`, `bin/`,
  `scripts/` and fails on any importer outside tests + the gate itself).

## What this does not prove

- NOT full cross-language verification — Rust convergence is deferred (M5.1C /
  BIZRA Rust workspace); no RFC 8785 compliance is claimed or tested.
- NOT a migration: no existing serializer consumer changed, no receipt ID or
  historical hash changed, no legacy adapter implemented (M5.2), no scaffold
  template change (M5.1B).
- NOT in the capability truth registry — a contract library with zero adopters
  is not a mission capability; the registry entry lands with first production
  adoption.
- NOT a runtime, daemon, network surface, model invocation, token, mint, PoI,
  or federation feature. Boundary all-false; `authority_delta: 0`.
