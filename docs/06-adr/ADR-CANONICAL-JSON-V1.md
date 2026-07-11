# ADR-CANONICAL-JSON-V1 — one byte contract for future hash-bearing objects

- **Status:** Accepted (contract + vectors only; adoption frozen)
- **Slice:** CANONICAL-JSON-V1-0A (M5.1A of the M5 Canonical Primitives Unification campaign)
- **Truth label:** `PREVIEW_ONLY` — no production surface consumes this algorithm yet
- **Baseline evidence:** M5.0 Primitive Drift Inventory @ `14a0fff` (86 `stableStringify`
  definitions, 4 measured behavioral groups, divergent bytes for the same logical
  object; majority group emits invalid JSON for `undefined` values)

## Decision

Define **`bizra.canonical-json.v1`**: a single, versioned canonicalization
contract for FUTURE BIZRA cryptographic objects. Same value → same UTF-8 bytes →
same `sha256:<hex>` in every conforming implementation, in every language.

This ADR changes **no existing hash**. Legacy serializers keep their exact
semantics; historical receipts remain verifiable under the algorithms that
produced them. Migration (adapters, algorithm IDs on objects, pilots) is M5.2+.

## Contract

### Identity

```json
{
  "canonicalization_algorithm": "bizra.canonical-json.v1",
  "hash_algorithm": "sha256",
  "text_encoding": "utf-8"
}
```

Hash format: `sha256:` + 64 lowercase hex characters.

### Accepted domain

`null` · booleans · finite numbers (see number rules) · well-formed strings ·
dense plain arrays · plain objects (`Object.prototype` or `null` prototype)
with enumerable string-keyed data properties only.

### Rejected domain (fail-closed, registered error codes)

`undefined`, functions, symbols, `BigInt`, `NaN`, `±Infinity`, unsafe integers,
lone surrogates, sparse arrays, accessor properties (never executed), symbol
keys, non-enumerable own properties, non-plain objects (Date, Map, Set, typed
arrays, class instances), circular references, over-limit inputs. The closed
code registry lives in `packages/canon/src/canonical-json-errors.js`.

Rationale: the M5.0 inventory measured legacy serializers silently coercing
these (emitting literal `undefined` tokens — bytes no stock JSON parser
accepts — or silently dropping fields/array elements). v1 refuses instead of
guessing; refusal is reproducible cross-language, coercion is not.

### Number rules

- `-0` normalizes to `0` (sign is not representable ambiguity-free).
- Any number for which `Number.isInteger()` holds but `|n| > 2^53−1` is
  rejected (`number_unsafe_integer`) — this includes values like `1e300`.
  Integer semantics beyond the safe range are cross-language ambiguous.
- Non-integral finite doubles serialize as ECMAScript `Number::toString`
  (shortest round-trip digits, ECMA-262 layout). The Python verifier
  re-implements that exact layout over `repr()` digits and converges
  byte-for-byte on the committed vectors.

### Object and string rules

- Keys sort by **Unicode code point** (equals UTF-8 byte order). This is NOT
  UTF-16 code-unit order; the two disagree for astral-plane keys and the
  difference is pinned by a test.
- String escaping is JSON minimal escaping (`\" \\ \b \t \n \f \r`,
  `\u00XX` for remaining control characters); all other code points pass
  through as raw UTF-8. Inputs must be well-formed (no lone surrogates).
- No getter/setter executes during canonicalization; input is never mutated.
  Caveat: a `Proxy` wrapping a plain object is indistinguishable from that
  object in pure JavaScript — its traps run and control the serialized value.
  The contract guards against accessor *properties*, not engine-level proxies;
  callers hashing untrusted objects should structured-clone or JSON-round-trip
  first.

### Resource limits (measured, not invented)

Measured maxima across all 47 tracked JSON artifacts at baseline `14a0fff`,
held at ≤ 25% of each limit:

| Limit | Value | Measured max | Utilization |
|---|---|---|---|
| `MAX_CANONICAL_DEPTH` | 64 | 9 | 14% |
| `MAX_CANONICAL_BYTES` | 1,048,576 | 124,088 | 12% |
| `MAX_OBJECT_KEYS` | 256 | 47 | 18.4% |
| `MAX_ARRAY_LENGTH` | 1,024 | 121 | 12% |
| `MAX_STRING_BYTES` | 65,536 | 5,474 | 8% |

Raising a limit is a contract version change.

## Conformance corpus

`packages/canon/vectors/canonical-json-v1-valid.json` (24 vectors: exact
canonical bytes + sha256, including key-order independence, `-0`, integral
floats, exponent layout, Unicode, and all five limit boundaries) and
`canonical-json-v1-invalid.json` (34 vectors: exact error codes; `js_only`
marks values other languages cannot construct — verifiers must skip and
report them, never silently).

Gate: `scripts/review/canonical-json-v1-check.mjs` (wired into `npm run check`)
replays the corpus in JS, runs the independent Python verifier
(`scripts/review/canonical-json-v1-verify.py`, stdlib only), and enforces the
adoption freeze: importing `packages/canon` from any production surface fails
the gate in this slice.

## Cross-language status

- JavaScript (authoritative) — all 58 vectors. **VERIFIED**
- Python 3 (independent, stdlib) — all 24 valid byte-for-byte + 14
  constructible negatives; 20 `js_only` skipped explicitly. **VERIFIED**
- Rust — **deferred to M5.1C** (or the BIZRA Rust workspace) against the same
  committed vectors. The contract is not fully cross-language verified until
  JS, Python, and Rust all converge. No RFC 8785 compliance is claimed.

## Legacy algorithms (provisional names, inventoried not implemented)

Future migration objects will carry explicit algorithm IDs. Provisional names
from the M5.0 inventory — exact adapter behavior is M5.2 scope:

- `bizra.legacy.consent_stable_stringify.v0` — shared `consent-common.js`
  variant (sorted keys, depth-100 fail-closed, invalid-JSON `undefined` bytes)
- `bizra.legacy.sorted-json-invalid-undefined.v0` — the 76-file unbounded copy
- `bizra.legacy.omit-undefined-null-array.v0` — the 7-file omit/null variant
- `bizra.legacy.raw-json-stringify.v0` — insertion-order `JSON.stringify` sites

## Forbidden in this slice

No consumer migration, no receipt-ID change, no historical rehash, no schema
rename, no scaffold-template change (M5.1B), no boundary/failure/truth
migration, no canon edit, no runtime effect, no network, no mint/PoI/federation.
Boundary all-false; `authority_delta: 0`.
