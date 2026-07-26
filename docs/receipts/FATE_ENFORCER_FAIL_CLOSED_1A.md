# FATE-MICRO-ENFORCER-FAIL-CLOSED-1A + identity truth closure — receipt

- **Date:** 2026-07-23 (GST)
- **Worktree:** `/data/bizra/worktrees/ipc-1a/Dema` · branch `feat/identity-pair-coherence-1a`
- **Base:** main `719ec026a02af3e74fc71c71845f1916a0cd181a` (PR #410 merged)
- **Truth label:** LOCAL_ONLY · not remotely bound · not independently reproduced

## Phase 1–3 — consent enforcer fail-closed (user-scope hook)

**Diagnosis (proven from disk, not narrative).** The μ-C1 consent enforcer is
`~/.claude/hooks/consent-enforcer.sh`, registered as a `PreToolUse` hook on
`Edit|Write|MultiEdit` in `~/.claude/settings.json`. Its v0.1 DENY path exited
**1**. Claude Code treats exit 1 on PreToolUse as a *non-blocking* status —
it reports the message and then PERFORMS the tool call. Confirmed against the
live decision ledger: `~/.dema/lint/consent_enforcement_log.ndjson` records
`decision:"DENY"` for the ADR-047 write (`decision_id 161a1264…`,
`2026-07-22T19:36:32Z`) — yet ADR-047 was written. Policy=BLOCK,
execution=MUTATION. Fail-open.

**Correction (v0.2, fail-closed).** DENY now exits **2** (the only PreToolUse
code Claude Code enforces as blocking). Additionally fail-closed: unparseable
hook input and an absent grants ledger on a protected path both exit 2.
Non-protected paths still ALLOW (exit 0). Operator escape hatch unchanged
(`DEMA_CONSENT_BYPASS=1`, logged). Decision receipts now carry
`fail_open_on_hook_error:false` + `blocking_exit_code:2`.

**Isolated reproduction.** `~/.claude/hooks/consent-enforcer.selftest.sh`
(disposable temp targets, no repo file used) proves: protected-no-grant → 2,
non-protected → 0, malformed input → 2, empty target → 0, non-mutating tool →
0, ledger-absent → 2. `OK — enforcer is fail-closed`.

**Live proof in this session.** After the fix, an attempted `Write` to
`…/docs/06-adr/live-probe.md` and an `Edit` to ADR-047 were both **blocked by
the runtime** (target absent on disk afterward). A `Write` to a non-protected
path succeeded. The boundary now enforces, and it stopped the agent — including
this agent's own ADR-047 documentation edit (see Consent-gate note below).

## Phase 4 — identity truth closure (ADR-047 code, in `authorship-key-store.js`)

- **Finding #2 — force-init bypass CLOSED.** `initAuthorshipKey` refuses when
  an active pointer exists, regardless of `force:true`
  (`error:"key_already_exists"`, pointer + fingerprint unchanged). `force`
  bypasses only the legacy flat-file check. Identity replacement remains
  exclusive to the future governed rotation transaction. Test: F2.
- **Finding #3 — presence ≠ verification CLOSED.** New `inspectActiveIdentity`
  returns exactly one of ABSENT / PRESENT_UNVERIFIED / VERIFIED /
  BLOCKED_CORRUPT / BLOCKED_RETIRED / BLOCKED_POINTER_INVALID. VERIFIED
  requires a successful `loadActiveKeyPair()`. `dema-realm-home.js` and
  `dema-realm-status.js` now derive their VERIFIED display from this — a
  corrupt/retired/pointer-invalid identity reads as blocked, not verified.
  Tests: F3 (6 states).
- **Gate widened.** `identity-pair-coherence-check.mjs` now also rejects direct
  `node0-ed25519(.pub).pem` references outside a legacy-path allowlist
  (`kind:"direct_legacy_key_path"`), catching split-loader paths the
  loader-name rule alone missed. Test: T14+T15 (both violation kinds).

## Local qualification (logs under `/data/bizra/logs/fate1a-*`)

```text
focused identity + realm + negative-verdict suites : green
npm test        : only the 4 pre-existing environmental fails remain
                  (273 preflight EROFS·$HOME, 2492 EROFS real ~/.dema,
                   4124/4557 uv_os_get_passwd) — zero new failures vs baseline
npm run coverage: thresholds met (95.35 L / 84.33 B / 97.75 F ≥ 95/84/95)
integration-check · ipc-gate · kernel-purity · no-overclaim
llm:guidance · git diff --check : all exit 0
enforcer selftest : OK — fail-closed
```

## Consent-gate note (honest outward-failure classification)

The repaired enforcer now blocks edits to `docs/06-adr/*` without a μ-C1
grant. This receipt's companion ADR (`ADR-047`) therefore was **not** updated
with the Phase-4 refinements in this slice — that edit is gated, and the agent
did not self-bypass (`DEMA_CONSENT_BYPASS` is operator-only; a prose GO is not
a ledger grant). The ADR update is OPEN pending an operator-typed grant
(`mu-consent record "GO: edit docs/06-adr/ADR-047-identity-pair-coherence-generation-store.md once"`)
or an explicit bypass. This is the boundary functioning as designed — an
outward block reported, not laundered into progress.

## Non-claims

No push · no PR change (#411 stays frozen) · real `~/.dema` signer untouched ·
no rotation command · no mint/network/model/federation · no Node0 closure.

## Next rung

A separate **C3 authorization** to push the exact qualified head and open a new
draft PR (PR #411 remains the superseded two-file rotation spike). The ADR-047
edit needs its own μ-C1 grant or bypass.
