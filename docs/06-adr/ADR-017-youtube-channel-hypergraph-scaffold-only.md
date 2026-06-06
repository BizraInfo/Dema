# ADR-017: YouTube Channel Hypergraph Miner v0.1 — scaffold-only · parking-lot status

**Status:** Parking lot · planner-output scaffold preserved · **implementation execution explicitly deferred** on 2026-05-23 per operator pivot to ADR-018 (Model Broker Promotion) as the load-bearing next slice.
**Date:** 2026-05-23 GST
**Authors:** Coordinator (Claude Opus 4.7) at Mumu's direction · output of the `planner` subagent (run_id `aec0440ecda2bcf71`) routed through full Dema doctrine context.
**Supersedes:** none
**Related:** ADR-001 Dema is One Face · ADR-002 No Shadow State · ADR-004 Local-First Memory · ADR-015 LLM is Suggestion · Verifier is Authority · ADR-016 Eval Layer 2 Scaffold-Only · (forthcoming) ADR-018 Model Broker Promotion Path
**Implements:** `docs/A_PLUS_BLUEPRINT_v0_1.md` parking-lot row · capability surface · **NOT** flagship critical path
**Evidence:** planner output 2026-05-23 · 4-source convergence (this session's state report · external assessor 2026-05-23 · A+ blueprint §6 · operator question) all named model-broker promotion as the higher priority

---

## Why this ADR exists in Parking-Lot status

The planner subagent produced a complete 9-section v0.1 plan for `feat/youtube-channel-hypergraph-miner-v0-1` — a read-only, local-corpus-only YouTube channel hypergraph mining surface. The plan is sound: scaffold-only path (b), 8 sub-tasks ~15h 30min total, 3 new envelope schemas, 4 modules, ~38 new tests, 10 risks identified, 10 explicit non-goals.

But after producing the plan, the operator pivoted: per the 4-source convergence on **model-broker promotion as the flagship bottleneck**, the youtube-hypergraph slice is reclassified as _adjacent capability_, not _load-bearing-on-the-north-star_. Implementation is therefore explicitly deferred.

This ADR preserves the design work as a durable record so:

- the slice can be reactivated by typed-GO without re-invoking the planner subagent,
- future contributors can see WHY the scaffold-only path was chosen,
- the typed-GO line below remains a stable handle for reactivation.

**This ADR does NOT authorize implementation.** No code lands on the basis of this ADR alone. A separate typed-GO is required for any of the 8 sub-tasks to begin.

---

## Operating canon

> **The LLM is a suggestion engine; the verifier is authority (ADR-015). The hypergraph is therefore a suggestion structure; multi-hop queries return advisory relational context, not deterministic verdicts.**

This ADR locks how Dema would introduce a YouTube-corpus knowledge surface without violating that canon. It does not introduce a new model invocation surface, a new dependency, or a new authority lane — it ships rubric-pack-analog data (channel + video manifests) + result-envelope schema + read-only query CLI surfaces only.

---

## Context

This is a **knowledge-ingestion** slice. Four boundary concerns:

1. **Network call** — Fetching YouTube data via yt-dlp / YouTube Data API requires outbound HTTP. The user-scope `CLAUDE.md` halt gate forbids "remote LLM/provider calls from the runtime"; the repo-local `CLAUDE.md` states "no runtime execution in this repo." Outbound network from Dema is similarly forbidden.
2. **Operator-private corpus** — A YouTube channel may contain operator-personal content. Must NOT be minted, federated, or included in any proof-room bundle.
3. **LLM invocation temptation** — Extracting topics / entities / summaries from transcripts is a natural LLM task. Forbidden in v0.1 per ADR-015 + ADR-016.
4. **Hypergraph as authority temptation** — Multi-hop query results could be cited as truth. Per ADR-015, the hypergraph is a _suggestion structure_; queries return _advisory_ relational context.

Three resolution paths were considered:

- **(a) Network-from-Dema** — Dema calls yt-dlp / YouTube API directly. **Rejected up-front** — violates no-network constitutional boundary.
- **(b) Paste-back / local-corpus-only** — Operator runs yt-dlp externally on their own machine, writes JSON to a directory under `~/.dema/` or operator-supplied path; Dema accepts that pre-fetched corpus as input; builds index; answers queries. No network call from Dema. **Adopted.**
- **(c) Mark DESIGNED_NOT_LIVE** — Defer entirely. Ships zero new capability. **Rejected** as zero-capability when (b) was viable.

## Decision

**Path (b) — Scaffold-only / paste-back / local-corpus-only.**

The slice (when reactivated) ships:

1. **`packages/core/src/youtube-corpus-loader.js`** (NEW · pure · read-only) — pre-fetched JSON corpus loader with structural validation via `validateAgainstRegistry`. Path-traversal containment (`path.relative` + `realpath`). `maxVideos` cap for memory bounding.
2. **`packages/core/src/youtube-hypergraph-index.js`** (NEW · pure · per-call lifetime) — in-memory hypergraph builder + lexical co-mention + anchor-topics query primitives. **No persistence. No exported registry. Lifetime = single function call.** Honors ADR-002 (no shadow state).
3. **3 envelope schemas** under `packages/core/schemas/`:
   - `bizra.dema.youtube_channel_corpus_manifest.v0.1` — channel root manifest
   - `bizra.dema.youtube_video_record.v0.1` — one per video; `LOCAL_ONLY` tagged
   - `bizra.dema.youtube_hypergraph_query_result.v0.1` — advisory query result; `verdict_role: const "advisory"`
4. **Two read-only CLI surfaces**:
   - `dema youtube hypergraph build --manifest <abs-path> [--json]` — runs loader + builder, prints summary `{ videos, nodes, hyperedges, truth_label }`; exits 1 on `truth_label != MEASURED`.
   - `dema youtube hypergraph query --manifest <abs-path> --concept <term> [--max-hits <n>] [--json]` — runs loader + builder + `queryCoMentions`; prints/JSON-dumps the advisory envelope; exits 1 on loader failure.
5. **No runtime model invocation, no automated runner, no result aggregation, no write surface.**

### Why path (b) over (a) or (c)

| Path                           | Issue                                                                                                                                                                        | Verdict                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **(a) Network-from-Dema**      | Violates no-network constitutional boundary; do not consider further.                                                                                                        | REJECTED               |
| **(b) Scaffold-only**          | Operator runs yt-dlp externally; Dema accepts pre-fetched JSON envelopes; builds index; queries. No network call from Dema. Mirrors ADR-016 (b) for the ingestion direction. | **ADOPTED (deferred)** |
| **(c) DESIGNED_NOT_LIVE only** | Ships zero new capability. Honest but no movement.                                                                                                                           | REJECTED               |

### v0.2 promotion path

Once reactivated:

- `dema youtube hypergraph join <manifest-a> <manifest-b>` — multi-channel
- `--save-index <abs-path>` — persistent index (mirroring verification-result-save canon, with explicit `LOCAL_ONLY` tag)
- `--ingest-cmd <operator-supplied-command>` — operator-bring-your-own external fetcher invocation surface (still no network from Dema)
- Topic extraction via `dema model-broker` once ADR-018 lands and model-broker reaches `MEASURED`

---

## Module boundary (after v0.1 lands — deferred)

### `packages/core/src/youtube-corpus-loader.js`

- `YOUTUBE_CORPUS_LOADER_SCHEMA: string` — `"bizra.dema.youtube_corpus_loader.v0.1"`
- `loadChannelManifest(absPath: string): FrozenEnvelope`
- `loadVideoRecord(absPath: string): FrozenEnvelope`
- `loadChannelCorpus(manifestAbsPath: string, { maxVideos?: number }): FrozenEnvelope`

### `packages/core/src/youtube-hypergraph-index.js`

- `YOUTUBE_HYPERGRAPH_QUERY_RESULT_SCHEMA: string` — `"bizra.dema.youtube_hypergraph_query_result.v0.1"`
- `buildHypergraphIndex(corpus: object): FrozenIndex`
- `queryCoMentions(index: FrozenIndex, { concept: string, maxHits?: number }): FrozenEnvelope`
- `queryAnchorTopics(index: FrozenIndex, { minVideos?: number }): FrozenEnvelope`

### `apps/cli/src/index.js` (EDIT)

- `dema youtube hypergraph build --manifest <abs-path> [--json]`
- `dema youtube hypergraph query --manifest <abs-path> --concept <term> [--max-hits <n>] [--json]`

### Reused / unchanged

- `envelope-schema-validator.js` — picks up the 3 new schemas automatically via `loadKnownSchemasFromDir` at module init. No code change.
- `artifact-safety-eval.js` — query-result envelopes piped through `evaluateArtifactSafety` in self-validation tests.
- `preview-boundary.js` — canonical 16-key all-false boundary stamped on every emitted envelope.

---

## Envelope schemas

### `bizra.dema.youtube_channel_corpus_manifest.v0.1`

Required: `schema` (const), `version` (`^v0\.1$`), `channel_id` (`^[A-Za-z0-9_\-]{1,64}$`), `channel_handle` (`^@[A-Za-z0-9_\-.]{1,64}$`), `corpus_fetched_at` (ISO-8601), `fetcher_origin` (enum `external_operator_fetch`), `video_refs` (array of `{ path: ^[^/].*\.json$, video_id: ^[A-Za-z0-9_\-]{6,16}$ }`, minItems ≥ 1), `boundary` (canonical 16-key all-false).
Optional: `notes`, `non_goals`.

### `bizra.dema.youtube_video_record.v0.1`

Required: `schema` (const), `video_id`, `title` (1..512), `published_at` (ISO-8601), `duration_seconds` (integer ≥ 0), `tags` (array · 0..50), `description` (string · 0..10000), `record_origin` (enum `external_operator_fetch`).
Optional: `transcript_excerpts` (array of string · each 0..500 chars · max 20 entries · **total cap 10,000 chars** to match the doctrine bound below), `chapters` (array of `{ start_seconds, title }`), `notes`.
**Forbidden**: `private_*`, `api_key`, `auth_token`, full transcripts > 10,000 chars. The `transcript_excerpts` cardinality (20 × 500 = 10,000) is tightened from the planner's original (100 × 2,000 = 200,000) to be consistent with this 10,000-char doctrine bound.

### `bizra.dema.youtube_hypergraph_query_result.v0.1`

Required: `schema` (const), `query_kind` (enum `co_mentions | anchor_topics`), `query_input` (object · echoes operator input), `verdict_role` (const `"advisory"`), `truth_label` (enum `MEASURED | NO_HITS | INDEX_EMPTY`), `videos_matched` (array), `topic_anchors` (array), `index_stats` (object), `boundary` (canonical 16-key).

---

## Risks (10)

| #   | Risk                                                                        | Severity | Mitigation                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Operator-private video content leaks into a shared artifact                 | HIGH     | Layer 1 self-validation test pipes manifest + query-result envelopes through `evaluateArtifactSafety`; asserts `PUBLIC_SAFE` on synthetic fixture and `LEAKAGE_DETECTED` on path-seeded variant |
| 2   | Hidden network call slips in                                                | HIGH     | Grep-assert test scans `packages/core/src/youtube-*.js` for `fetch(`, `node:http`, `node:https`, `node-fetch`, `axios` — must be zero matches                                                   |
| 3   | LLM call slips in (topic-extraction temptation)                             | HIGH     | Same grep extends to `anthropic`, `openai`, `ollama`, `gemini`, `claude`, `localLLMRouter`, `routedInvocation`                                                                                  |
| 4   | Corpus size exhausts memory                                                 | HIGH     | Loader enforces `maxVideos` (default 500) + per-record byte cap via schema string caps                                                                                                          |
| 5   | Hypergraph index becomes stored mutable state (ADR-002 violation)           | HIGH     | `buildHypergraphIndex` is pure; deep-frozen return; no module-level state                                                                                                                       |
| 6   | Query results cited as authoritative (ADR-015 violation)                    | HIGH     | `verdict_role` const `"advisory"` enforced by schema; CLI prefixes results with ADVISORY label                                                                                                  |
| 7   | Transcript contains `FORBIDDEN_LIVE_CLAIMS` phrase and query repeats it     | HIGH     | Self-validation test seeds fixture with forbidden claim; Layer 1 scanner gates this surface                                                                                                     |
| 8   | Schema-namespace drift                                                      | MED      | Registry-wiring test asserts all 3 schema IDs in `KNOWN_SCHEMA_IDS` with non-empty `properties`                                                                                                 |
| 9   | ReDoS via operator-supplied `--concept` regex                               | MED      | CLI rejects concepts > 64 chars + non-`[A-Za-z0-9 _\-]` chars; lexical scan uses `String.prototype.includes` not regex                                                                          |
| 10  | Corpus path-traversal — `video_refs[*].path` resolving outside manifest dir | HIGH     | Loader rejects `..`, leading `/`; `realpath` containment check                                                                                                                                  |

---

## Invariants

- 0 prod deps · 0 dev deps
- No network · no LLM call · no mint · no federation · no token claim · no daemon · no public send · no write surface
- All emitted envelopes deep-frozen
- Test count floor preserved (≥ 2,588 at deferral; ~+38 expected on reactivation)
- `eval:layer1` CLI semantics unchanged
- Every new schema auto-picked-up by `envelope-schema-validator.KNOWN_SCHEMA_IDS`
- Hypergraph index lifetime = single CLI invocation
- `bizra.dema.youtube_video_record.v0.1` tagged `LOCAL_ONLY` by default

---

## Verification strategy (when reactivated)

### New tests (~38 across 5 files)

| File                                                      | Approx tests |
| --------------------------------------------------------- | ------------ |
| `tests/youtube-corpus-loader.test.js`                     | ~10          |
| `tests/youtube-hypergraph-index.test.js`                  | ~12          |
| `tests/youtube-hypergraph-schema-registry-wiring.test.js` | ~3           |
| `tests/youtube-hypergraph-cli.test.js`                    | ~6           |
| `tests/youtube-hypergraph-layer1-self.test.js`            | ~7           |

### Gate sequence

```bash
npm test
npm run check
npm run llm:guidance
npm run eval:layer1 -- --artifact "$(pwd)/artifacts/proofs/proof-room-v0.1-public-safe/proof-room-bundle.json" --json
git diff --check
~/.dema/bin/mu-test-all
```

### Fixtures

`tests/fixtures/youtube-channel-3v/` — synthetic 3-video channel; 2 videos share a concept term; all titles + descriptions safe-by-construction.

---

## Non-goals (10)

1. No live network fetch (v0.2 candidate: `--ingest-cmd`)
2. No LLM transcript summarization (v0.2 once model-broker MEASURED via ADR-018)
3. No persistent hypergraph index (v0.2 candidate: `--save-index`)
4. No cross-channel queries (v0.2 candidate)
5. No temporal-trend analysis (v0.2 candidate)
6. No recommendation surface (v0.3 candidate; separate ADR per ADR-015)
7. No proof-room bundle inclusion (design boundary; no v0.x candidate)
8. No write surface anywhere in slice (v0.2 candidate behind typed-GO)
9. No mint / federation / PoI / URP wiring (no v0.x candidate from this slice)
10. No raw transcript ingestion > 10,000 chars per video (v0.2 candidate with cap-bump ADR)

---

## Reactivation handle · typed-GO line

When the operator decides to reactivate this slice (after ADR-018 + model-broker promotion lands, or independently if priorities shift), the exact typed phrase to start implementation is:

```text
GO ship youtube-channel-hypergraph-miner-v0-1 with scaffold-only paste-back
resolution, covering corpus-loader + in-memory hypergraph-index + 2 read-only
CLI surfaces (build + query) over operator-supplied JSON envelopes,
advisory-only query results stamped with the canonical 16-key preview
boundary, no network from runtime, no LLM invocation, no persistent index,
no cross-channel join, no recommendation surface, no proof-room inclusion,
no mint, no federation, no write surface
```

---

## Consequences

### Positive (when reactivated)

- New capability: read-only relational queries over a local channel corpus, with structural + boundary validation already in place.
- Clean v0.2 promotion path that doesn't require redesigning the v0.1 surface.

### Negative

- v0.1 cannot fetch corpus autonomously; every ingestion is operator-mediated.
- Does not directly unblock the flagship runtime question (model-broker promotion is the load-bearing path; this slice is adjacent).

### Trade-off accepted

The slice is in scope-of-doctrine but not load-bearing for the flagship. Deferral preserves the analytical work without committing engineering hours that would not advance the north-star.

---

## When this ADR changes

This ADR is `v0.1 parking-lot`. Material edits to the path decision require a new ADR. Editorial refinements may land through standard PR. Reactivation does not require an ADR update — it requires the typed-GO line above.

Last refreshed: 2026-05-23.
