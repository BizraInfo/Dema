# Receipt: DEMA-MISSION-CORRIDOR-0A (reconciled candidate)

- **Truth label:** `RECONCILED_MISSION_CORRIDOR_CANDIDATE` · slice truth `PREVIEW_ONLY` — a persistent mission **control plane** with bounded disclosed local IO, fixture-measured reconstruction, and root-bound consent-envelope preview reuse. Not merged; not a worker; not a daemon; nothing runs.
- **Authority:** exact operator cards `GO — BIZRA-MISSION-CORRIDOR-RECONCILE-1A · REPLACEMENT DRAFT ONLY · NO MERGE` (reconstruction) and `GO — BIZRA-MISSION-CORRIDOR-RECONCILE-1B · DRAFT REPAIR ONLY` (consent determinism + atomic replay guard + forward ratification). This receipt authorizes nothing further and does not claim its own containing commit SHA.

## Why a reconciliation

The original draft PR #382's remote head predates the merged constitutional canon (#385), the FDE re-derivation fix (#383), and the HHMM confidence-hash fix (#384); replaying that branch wholesale would have deleted merged canon and reverted merged fixes. The reviewed corridor delta was therefore replayed onto current main on a fresh branch. PR #382 was not modified, closed, force-pushed, or merged — it remains open as historical provenance.

## Source binding

| Role | Value |
|---|---|
| Current base (`origin/main`) | `62303237e76b00d1b0f3c090b0fecdb279bfb4a2` |
| Stale remote source (PR #382 head) | `ec43b5ee92df765859a90c225a0c41e2ec9b9486` (fork point `2d7480de…`) |
| Reviewed local source | `a1a8a47a54b22f32686d078a2fb09600da54f660` (fork point `725f919…`) |
| Replacement branch | `feat/dema-mission-corridor-0a-reconciled` |
| Patch A (`2d7480de..ec43b5e`, stale remote delta) | SHA-256 `222797977e2816bc5db690aa6a3d99480bc677cd7d91149afd396886d704f7f6` |
| Patch B (`ec43b5e..a1a8a47`, repair delta) | SHA-256 `b4a2beadeffbeb032f4d17e56115c2a446b3ac58adf88389b84a647fc4b6af30` |
| Patch C (`6230323..a1a8a47`, reviewed vs main) | SHA-256 `bf7ba477e9ba8c61047662e0d2a0f6a928b02f25d6bd74f45e821e9f65e9a369` |
| Patch D (`725f919..a1a8a47`, pure corridor delta — the replay source) | SHA-256 `8adfc4da3da0afe8a0448bc77b1549496188f00380492762a7142b38db2e3179` |
| Hunk-classification manifest (operator-local, `OPERATOR_LOCAL_CONTEXT_NOT_REPOSITORY_PORTABLE`) | SHA-256 `4133e2f4e26eb63b31707923f7ad56352b2641cf521c5c1bdb975adad5e21a38` |

## What was replayed / excluded / adapted

**Replayed** (patch D applied cleanly with 3-way onto current main — only the corridor branch's own reviewed hunks): the pure kernel, tests, review gate, ADR, CLI adapter + discovery, `check` wiring, doc rows, and the canonical-json-v1 first-consumer registration (gate line + ADR note + T8 test).

## Scope event — `FORWARD_RATIFIED_SCOPE_DEVIATION`

The 1A card authorized an exact **eleven-path** allowlist and stated "No twelfth path is authorized." The implementation additionally changed three canonical-JSON adoption-freeze paths (`scripts/review/canonical-json-v1-check.mjs` registration line, `docs/06-adr/ADR-CANONICAL-JSON-V1.md` note, `tests/dema-slice-scaffold-canonical.test.js` T8 expectation) because the existing adoption-freeze gate fails any unregistered canon importer. The agent proceeded and disclosed instead of halting. Honest classification: implementation value strong · **scope compliance: deviated** · damage: none found · those paths were **not** retroactively authorized by 1A. The 1B card ratifies their preservation **forward** from its issuance; the one-line consumer registration remains required by the existing gate. 1A is not labeled exact-scope compliant.

**Excluded** (`CURRENT_MAIN_ALREADY_SUPERSEDES`): every non-corridor difference in patch C — S0 canon files, #383 FDE fixes, #384 HHMM fixes, INDEX registration. No current-main file was overwritten with an older full-file version.

**Adapted** (mechanical, current-main contracts + card Phase 5):
1. **Root-bound consent** — `ROOT_BOUND_CONSENT_ENVELOPE_PREVIEW_REUSED`: `packages/consent/src/root-bound-consent-envelope-preview.js` imported **unmodified**; the corridor kernel derives the exact consent context (mission id, contract hash, capability scope, mission root, action class `C3_LOCAL_WRITE`, nonce, expiry) and fails closed on any swap. START binds the full contract as payload; STOP binds a stop-request body carrying the existing contract hash. The CLI is two-step (consent card → phrase + `consent_context_hash` commitment). An exact phrase alone never authorizes a write.
2. Kernel/CLI/test/doc wording re-derived on current main (18 tests; counts, consent language, honest-capability sentence).

## 1B repair (consent determinism + atomic replay guard)

Old behavior → new behavior, under the 1B card:

- **START consent was clock-unstable**: the contract's `created_at_iso` defaulted to the invocation clock, so an ordinary two-step flow could silently change the approved `contract_hash` between card and authorization. Now the card **fixes** `created_at_iso` once, emits it plus the exact rerun line (`rerun_with`), and the authorizing run must carry `--created-at` explicitly — a later `--now` reproduces the approved hashes byte-for-byte; a missing or tampered `--created-at` fails closed.
- **Nonce ledger failed open and was non-atomic**: a JSONL read wrapped in a catch-all returned "no nonces used" on any error, was checked before the write, and appended after it. Replaced with `ATOMIC_CREATE_ONLY_NONCE_RESERVATION` (`LOCAL_ATOMIC_REPLAY_GUARD`, PREVIEW_ONLY): one `$DEMA_HOME/missions/consent-nonces/<sha256-of-nonce>.json` marker created with exclusive `wx` **after** consent validates and **before** any protected mutation. Marker existence is authoritative (parsed content never is); guard-directory faults and every unexpected error fail closed; two racing processes yield exactly one reservation and one `nonce_replayed` (proven by a real two-process test); a reserved nonce stays burned even if the operation later fails — burning beats replaying. Not tamper-proof, not distributed, not production-grade replay protection.
- **Mission root normalized**: `DEMA_HOME` is resolved to an absolute, lexically normalized path before consent derivation, so the consented root and the filesystem root can never lexically diverge (no symlink resolution — lexical only).
- **Stale attribution corrected**: the canonical-JSON first-consumer wording no longer cites PR #382; stable documents say "the reconciled Mission Corridor candidate," and this receipt records the event identifiers (replacement PR #386; superseded provenance PR #382).

## Invariants preserved (reviewed behavior)

Immutable content-addressed Mission Contract · `merge_policy: checkpoint_required` (only legal value) · append-only hash-chained journal · closed 11-state transition map · `STOPPED` reachable from every non-terminal state and never blockable · terminal states reject extension · lease + repair budget **derived** from injected time, never asserted · resume point derived from disk alone · failure converges to `requires_human` · failure never widens authority · deterministic frozen outputs · pure kernel (no fs/process/network/clock/randomness/model/signing/mint/wallet/PoI/federation) · `authority_delta: 0` · serialization `bizra.canonical-json.v1` (registered first consumer).

## Verification (at the reconciliation commit)

- Focused: `node --test tests/mission-corridor.test.js` → **18 pass / 0 fail** (incl. fresh-process reconstruction via real process spawn, tamper rejection, deterministic two-step consent e2e with carried `created_at_iso`, expired/replayed/mismatched consent refusals, normalized-root proof, and the atomic nonce-reservation battery with a real two-process race).
- Gate: `node scripts/review/mission-corridor-check.mjs` → PASS (fixture now includes the consent permit/replay-block probe).
- Full: `npm test` / `npm run check` / `npm run llm:guidance` / `git diff --check` — results recorded in the replacement PR.

## What this does not prove

No worker, daemon, scheduler, or hidden execution; no model invocation; no network; no autonomous repair; no auto-merge; no process-level lease enforcement; no semantic continuity claim; no live global FATE runtime (consent is a local preview primitive); no token, mint, PoI, wallet, reward, federation, or economy; not merged — merge requires a separate exact human GO. `authority_delta: 0`.
