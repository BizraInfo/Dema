# Node0 Data Estate Definition of Done — Pilot then Scale

## Pilot DoD

- [ ] Exact pilot root and exclusions bound.
- [ ] Metadata inventory completes with error list and SHA-256 manifest.
- [ ] Symlinks are not followed outside the bound root.
- [ ] File Cards generated deterministically.
- [ ] Logical zones assigned without requiring physical moves.
- [ ] Same-size groups remain `HASH_REQUIRED` until full hashes exist.
- [ ] Exact duplicate claims use full raw SHA-256 equality.
- [ ] Originals preserved.
- [ ] Content-aware extraction runs only on explicitly authorized bounded shard.
- [ ] Every Knowledge Card retains source references and epistemic status.
- [ ] Contradictions/superseded versions preserved.
- [ ] Decision Graph has at least one source-bound decision with evidence and current status.
- [ ] Golden Set has at least one reproducible regression case.
- [ ] Any physical rename/move uses reversible steward with exact GO and post-state verification.
- [ ] Run receipt seals inventory, outputs, script identity, and `authority_delta=0`.

## Google Knowledge pilot DoD

- [ ] Every selected Drive item has file ID/title/MIME/modified time/source ref.
- [ ] Materialized bytes, when used, have raw SHA-256.
- [ ] Changed Drive versions create new lineage nodes rather than overwrite history.
- [ ] Drive writeback remains disabled unless separately authorized.
- [ ] Duplicate and near-duplicate relationships are explicit.
- [ ] Mission retrieval returns a minimum evidence-complete packet with provenance.

## Scale DoD

Scale beyond the pilot only after:

- pilot produces useful founder/mission value;
- false duplicate rate is measured and acceptable;
- parsing/error rates are known;
- resource budget is measured;
- restart/resume works without reprocessing completed shards;
- every promoted artifact remains reproducible from source + parser/version config.
