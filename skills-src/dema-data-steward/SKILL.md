---
name: dema-data-steward
description: "Evidence-bound Node0 data-estate stewardship for DEMA. Use when ChatGPT or a local agent must inventory, classify, deduplicate, normalize, organize, provenance-bind, index, or prepare BIZRA knowledge from local files or Google Drive-derived corpora; build File Cards/Knowledge Cards; maintain Decision Graph and Golden Set artifacts; or prepare reversible organization plans. Default to metadata-only read operations, preserve originals, separate observation from mutation, require explicit consent for content reads and exact GO for file mutation, and emit manifests/receipts with no-false-GREEN discipline."
---

# DEMA Data Steward

Treat the filesystem as evidence, not as an unlabeled bag of files. Preserve human sovereignty and originals. Optimize for a progressively verified data estate that can serve DEMA without making the data-processing layer authoritative.

## Core laws

- Disk/executable evidence overrides remembered narrative.
- `inventory != understanding`.
- `same_name != duplicate` and `same_size != duplicate`.
- `hash_equal => byte-identical`, but byte identity does not settle semantic authority.
- `memory != authority`.
- `source != truth`.
- `indexed != verified`.
- `installed != admitted != qualified != authorized`.
- `planned_file_action != executed_file_action`.
- Preserve contradictions and superseded versions; do not silently harmonize them.
- Never delete originals during ordinary stewardship.
- Default mutation authority is zero.

## Workflow

1. **Bind the evidence boundary.**
   - Record the requested root(s), source system, allowed read scope, excluded paths, current repo/runtime anchor if relevant, and whether content reads are authorized.
   - If the root or scope is ambiguous, stop before scanning.

2. **Metadata census first.**
   - Run `scripts/inventory_fs.py` without `--hash-content`.
   - Do not follow symlinks.
   - Produce `inventory.jsonl` and `summary.json`.
   - Treat unreadable paths as explicit errors, never as absence.

3. **Build a deterministic knowledge index.**
   - Run `scripts/build_file_cards.py` to produce metadata File Cards.
   - Assign source identity, relative path, size, timestamps, type, and provenance anchor.
   - Do not label content or truth from filename alone.

4. **Plan deduplication.**
   - Run `scripts/dedupe_candidates.py`.
   - Same-size groups are only `HASH_REQUIRED` candidates.
   - Exact duplicates require full-content SHA-256 equality.
   - Read file content for hashes only when the user/mission explicitly authorizes content reads.
   - Preserve at least one source identity per duplicate and preserve provenance for every alias/path.

5. **Content-aware refinement only inside a bounded mission.**
   - Load the minimum shard needed.
   - Extract claims, decisions, architecture, procedures, failures, tests, receipts, and open questions.
   - Label each derived object: `VERIFIED`, `MEASURED`, `SOURCE_BOUND`, `INFERENCE`, `ASSUMPTION`, `HYPOTHESIS`, `UNKNOWN`, `CONTRADICTION`, or `SUPERSEDED`.
   - Keep raw bytes immutable or separately archived; normalized derivatives never replace originals.

6. **Google knowledge intake.**
   - Read `references/google-knowledge-system.md` before working with Drive-derived material.
   - Bind every Drive object to file ID, title, MIME type, modified time, source URL/reference, and local materialization hash when bytes are copied locally.
   - Google Drive is a source plane, not Node0 authoritative memory.
   - Default writeback to Drive is `DENY` unless explicitly authorized.

7. **Decision Graph and Golden Set.**
   - Promote a decision only when decision text, evidence, date/version, alternatives, and outcome are known or explicitly UNKNOWN.
   - Promote a Golden Set case only from a verified decision, regression, failure, refusal, or independently reproducible invariant.
   - Do not train or reward from `UNKNOWN`, `DISPUTED`, `CONTRADICTED`, or `UNAUTHORIZED` experience.

8. **Organization preview.**
   - Propose logical zones before physical moves.
   - Prefer manifests/tags over mass moves for large estates.
   - Every proposed rename/move must include source, destination, reason, collision check, reversibility, and receipt requirement.

9. **Mutation gate.**
   - Never invent a new mutation path when the DEMA reversible file steward exists.
   - For Dema repository work, use the existing reversible steward execution surface and its exact consent contract.
   - If exact consent is absent, return a preview only.
   - Deletes are out of scope unless a separately designed, independently verified destruction contract exists.

10. **Verify and seal.**
   - Re-inventory affected scope after any authorized mutation.
   - Compare pre/post manifests.
   - Verify expected changes and zero unexpected changes.
   - Run `scripts/seal_run.py` over the output directory.
   - Report `authority_delta`; ordinary stewardship must remain `0`.

## Node0 zone model

Use the desired-state zone model in `references/node0-data-contract.md`. Treat it as a logical classification model first. Do not mass-migrate `/data/bizra` merely to make the physical tree match the model.

## Output contract

Read `references/output-contract.md`. Every run must return:

- evidence boundary;
- inventory anchors;
- classifications and confidence;
- duplicates: exact vs candidate vs unresolved;
- contradictions/supersessions;
- proposed actions;
- actions actually executed, if any;
- verification results;
- open proof gaps;
- receipt/manifests;
- `authority_delta`.

## Stop conditions

Stop and report rather than improvise when:

- a root resolves outside the authorized scope;
- symlink traversal would escape the bound root;
- expected source identity changed during the run;
- a write is required but exact consent is absent;
- a collision would overwrite existing bytes;
- a dedupe conclusion lacks byte-level evidence;
- a source mutation is requested without backup/undo semantics;
- a Drive object changed between discovery and materialization;
- provenance is insufficient to distinguish original from derivative;
- any receipt or manifest fails re-hash verification.
