# UNTRUSTED-CORPUS-SANITIZER-PREVIEW-1A

Truth label: `UNTRUSTED_CORPUS_SANITIZER_PREVIEW_MEASURED_REPO`

## Purpose

**Layer -1 of the Materialization Pulse** — the corpus safety gate that runs *before* niyyah, before
any untrusted text touches memory / RAG / the receipt shelf. It exists because a real pasted
third-party transcript carried live API keys AND a prompt-injection payload with no detector in the
tree.

Two layers:
- **Pure kernel** (`untrusted-corpus-sanitizer-preview.js`) — deterministic regex/lexicon scan (no
  model) over an injected text chunk → content-addressed verdict.
- **CLI adapter** (`apps/cli/src/commands/corpus.js`, `dema corpus sanitize`) — reads one file
  read-only, exits non-zero unless `ALLOWED` (so it can gate a pipeline).

## Three attack classes scanned

```text
secret        sk- / ghp_ / xox_ / AKIA / z.ai-key / labeled "api_key:…"   → redacted [REDACTED:secret]
injection     ignore-previous-instructions · print/reveal-the-system-prompt · you-are-now · forget-everything
authority     --admin · override-the-gate · grant-admin · mint_allowed:true
```

## Verdict (a pure function of the counts)

```text
injection_count > 0  OR  authority_count > 0   → BLOCKED     (active attack — do not ingest)
else secret_count > 0                          → QUARANTINED (redacted; hold for human/SAT review)
else                                           → ALLOWED     (no known-bad pattern; ingestable)
```

## Input / Output Contract

```js
runUntrustedCorpusSanitizerPreview({ consent, input })   // input = { text, source }
```
Exact consent: `GO: untrusted corpus sanitizer preview`

```text
schema · truth_label · ok · status · verdict · ingest_allowed · ingest_performed(false)
findings[] (class · pattern_id · match_preview) · secret/injection/authority_count · redacted_text
boundary (all-false) · mint_allowed:false · authority_delta:0 · content_hash · blocked_by[]
```

## Verification

```js
verifyUntrustedCorpusSanitizerPreview(payload)
```
Body-bound re-derivation PLUS: re-derives the verdict from the counts (forged verdict rejected),
enforces `ingest_performed === false`, enforces per-class count consistency, and **rejects any finding
that leaks a full `sk-` secret** (redaction discipline).

## What this does NOT prove

A **pattern filter, not a proof of safety** — no model, cannot catch novel/obfuscated attacks beyond
its lexicon. `ALLOWED` ≠ semantically safe. `QUARANTINED` still requires human/SAT review. It performs
NO ingestion, network, execution, or mint.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/untrusted-corpus-sanitizer-preview.js
tests/untrusted-corpus-sanitizer-preview.test.js
scripts/review/untrusted-corpus-sanitizer-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/UNTRUSTED_CORPUS_SANITIZER_PREVIEW_1A.md
docs/02-architecture/UNTRUSTED_CORPUS_SANITIZER_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/untrusted-corpus-sanitizer-preview.test.js
node scripts/review/untrusted-corpus-sanitizer-preview-check.mjs --json
npm test
npm run check
```
