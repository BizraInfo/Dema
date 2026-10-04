# RECOVERY CENSUS — 2026-08-30

**Authorization:** PHASE-0-RECOVERY-CENSUS-READ-ONLY
**Authority delta:** 0
**Operations performed:** READ ONLY — no restore, no reconstruction, no file creation, no deletion, no git mutation, no policy change

---

## Summary

| File | Worktrees | Transcripts | Artifacts | Git Stash | Recovery Status |
|------|-----------|-------------|-----------|-----------|-----------------|
| `packages/core/src/assumption-evaluator.js` | NOT_FOUND | NOT_FOUND | Proof receipt metadata only | NO | **PARTIAL — receipt describes intent, not source** |
| `packages/core/src/baseline-verifier-gate.js` | NOT_FOUND | **FULL SOURCE in sessionlast.md L8494** | N/A | NO | **RECOVERABLE from transcript** |
| `tests/assumption-evaluator.test.js` | NOT_FOUND | NOT_FOUND | N/A | NO | **NOT_FOUND — no source recovered** |
| `tests/baseline-verifier-gate.test.js` | NOT_FOUND | **FULL SOURCE in sessionlast.md L8546** | N/A | NO | **RECOVERABLE from transcript** |
| `tests/bizra-autonomous-knowledge-foundry-0a-spec.test.js` | NOT_FOUND | Untracked status traces only | N/A | NO | **NOT_FOUND — no source recovered** |
| `tests/dema-data-steward-scripts.test.js` | NOT_FOUND | Untracked status traces only | N/A | NO | **NOT_FOUND — no source recovered** |

---

## Detailed Findings

### 1. `packages/core/src/assumption-evaluator.js`

- **Worktrees searched:** 6 worktrees in `.claude/worktrees/`, `/data/bizra/worktrees/`
- **Transcript traces:** None containing source code
- **Artifact:** `artifacts/assumption-evaluator-1a-proof-receipt.json` exists (2170 bytes, dated 2026-08-29). Contains:
  - Schema: `bizra.dema.canonical_receipt.v0.1`
  - Intent: "ASSUMPTION-EVALUATOR-1A: implement pure deterministic Law-of-Assumption epistemic classifier"
  - Slice artifacts listed: `packages/core/src/assumption-evaluator.js`, `tests/assumption-evaluator.test.js`
  - Verification details (test counts, integration check status)
- **Source code:** NOT FOUND in any searched location
- **Recovery potential:** The receipt proves the file existed and passed tests. The receipt does NOT contain the source. Source may exist in editor local history or unsaved session state.

### 2. `packages/core/src/baseline-verifier-gate.js`

- **Worktrees searched:** 6 worktrees in `.claude/worktrees/`, `/data/bizra/worktrees/`
- **Transcript traces:** Full source code found in `sessionlast.md` at line 8494
  - Content is embedded as a JSON tool-call argument with `"filePath"` and `"content"` keys
  - Source is complete: imports, exports, function body, boundary objects, consent gate
  - Line count: ~100 lines
  - Dependencies: `./node0-sse-envelope-stream.js` (tracked, exists)
- **Recovery potential:** **HIGH** — full source recoverable from transcript. The transcript also shows the file was created by a prior session and verified via `node -e "import(...)"` test.

### 3. `tests/assumption-evaluator.test.js`

- **Worktrees searched:** 6 worktrees in `.claude/worktrees/`, `/data/bizra/worktrees/`
- **Transcript traces:** Only proof receipt metadata (not source code)
- **Source code:** NOT FOUND
- **Recovery potential:** LOW — no source recovered. The proof receipt mentions "23 red-first tests pass" but does not contain the test code.

### 4. `tests/baseline-verifier-gate.test.js`

- **Worktrees searched:** 6 worktrees in `.claude/worktrees/`, `/data/bizra/worktrees/`
- **Transcript traces:** Full source code found in `sessionlast.md` at line 8546
  - Content is embedded as a JSON tool-call argument with `"filePath"` and `"content"` keys
  - Source is complete: 5 test cases (consent mismatch, missing proposal, GO consent verified, no GO consent, boundary all-false)
  - Dependencies: `../packages/core/src/baseline-verifier-gate.js` + `../packages/core/src/node0-sse-envelope-stream.js`
- **Recovery potential:** **HIGH** — full source recoverable from transcript

### 5. `tests/bizra-autonomous-knowledge-foundry-0a-spec.test.js`

- **Worktrees searched:** 6 worktrees in `.claude/worktrees/`, `/data/bizra/worktrees/`
- **Transcript traces:** Only git status `??` (untracked) markers in codex session
- **Source code:** NOT FOUND
- **Recovery potential:** LOW — no source recovered

### 6. `tests/dema-data-steward-scripts.test.js`

- **Worktrees searched:** 6 worktrees in `.claude/worktrees/`, `/data/bizra/worktrees/`
- **Transcript traces:**
  - Git status `??` (untracked) markers in codex session
  - TESTING.md documentation row: "DEMA-DATA-STEWARD-INVENTORY-BOUNDARY-1A: temporary fixtures prove opt-in exact directory exclusions..."
  - Related skill files exist at `.agents/skills/dema-data-steward/scripts/` (4 Python scripts)
- **Source code:** NOT FOUND
- **Recovery potential:** LOW — no source recovered. The skill scripts exist but are not the test file.

---

## Surfaces Searched

| Surface | Searched | Result |
|---------|----------|--------|
| `.claude/worktrees/*/` (6 worktrees) | YES | No matches for any of the 6 files |
| `/data/bizra/worktrees/` | YES | No matches (timeout on deep search; top-level checked) |
| `codex-session-*.md` (2 files, 257K lines) | YES | Untracked status traces only |
| `sessionlast.md` (9K lines) | YES | **Full source for baseline-verifier-gate.js + test** |
| `eval season plan e.md` | YES | No traces |
| `.claude/hooks/logs/posttool-proof-log.jsonl` (37K lines) | YES | No traces of assumption-evaluator |
| `artifacts/` | YES | Proof receipt metadata for assumption-evaluator |
| `git stash` (3 stashes) | YES | Stash 2 has model-eval-baseline, not our files |
| `git reflog` | YES | No relevant entries |
| `.agents/skills/dema-data-steward/` | YES | Related Python scripts exist (not the test file) |

---

## Recovery Decision

| File | Decision | Reason |
|------|----------|--------|
| `baseline-verifier-gate.js` | **RECOVERABLE** — extract from sessionlast.md L8494 | Full source in transcript |
| `baseline-verifier-gate.test.js` | **RECOVERABLE** — extract from sessionlast.md L8546 | Full source in transcript |
| `assumption-evaluator.js` | **NOT YET RECOVERED** — check editor local history | Receipt proves existence, not source |
| `assumption-evaluator.test.js` | **NOT YET RECOVERED** — check editor local history | No source found |
| `knowledge-foundry-0a-spec.test.js` | **NOT YET RECOVERED** — may need recreation | No source found |
| `dema-data-steward-scripts.test.js` | **NOT YET RECOVERED** — may need recreation | No source found |

---

## Next Decision (requires operator)

The two recoverable files (`baseline-verifier-gate.js` + test) can be extracted from the transcript. The four unrecovered files need either:
1. Editor local-history search (VS Code, JetBrains, etc.)
2. Recreation from intent + proof-receipt metadata
3. Acceptance that they are lost

**No files have been restored. No mutations performed. AUTHORITY_DELTA = 0.**
