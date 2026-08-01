# Node0 Seal Receipt — 2026-08-01

**Act:** preserve the Node0 mechanical-closure and First Light slices that existed
only as untracked working-tree material. Nothing below was in any commit on any
branch before this session.

**Operator:** Mumu (Mohamed Beshr) · **Executed by:** Claude (Cowork) · **Dubai, 04:57 GST**

---

## What was sealed

Branch: `seal/omega0-mechanical-closure-1a`
Parent: `10986c483933d0f08e9b830a8812052a214f9d0d`

| SHA | Slice | Files | Lines |
|---|---|---:|---:|
| `35bdcdda9266ea6bcdb0054882fa4c1cfdc7ee7d` | Ω0-M mechanical closure + chain anchor + L1 loop + verification admission | 14 | +3210 |
| `07a0c6521ed60cffe830395887efe79171faee5c` | First Light `dema ask` H3/H4 — consent → grounded answer → receipt | 4 | +1138 |

### Slice 1 — `35bdcdd`
```
packages/core/src/omega0-mechanical-closure.js   311 lines
packages/core/src/chain-anchor.js                220 lines
packages/core/src/l1-micro-loop.js               659 lines
packages/core/src/verification-admission.js      255 lines
tests/omega0-mechanical-closure.test.js          236 lines
tests/chain-anchor.test.js                       210 lines
tests/l1-micro-loop.test.js                      527 lines
tests/verification-admission.test.js             247 lines
docs/receipts/  (6 receipts)                     545 lines
```

### Slice 2 — `07a0c65`
```
packages/core/src/dema-ask-h3h4.js               549 lines
apps/cli/src/commands/ask.js                     362 lines
tests/dema-ask-h3h4.test.js                      220 lines
apps/cli/src/index.js                            +7 lines (one command, one binding)
```

---

## Evidence at the sealed HEAD

Environment: Node `v22.22.3`, sandbox, `node --test`

```
omega0-mechanical-closure    10/10
chain-anchor                 11/11
l1-micro-loop                25/25
verification-admission       15/15
dema-ask-h3h4                 8/8
─────────────────────────────────
TOTAL                        69/69   0 failures

kernel-purity        OK · 452 scanned · 0 violations · 89 allowlisted
git diff --check     clean
```

Re-verified **after** commit, from the sealed tree — not only before staging.

---

## Root cause of the three-week stall

`.git/index.lock` — 0 bytes, created 04:29, no git process running.

Every prior agent reported "git is broken in the sandbox" and fell back to leaving
work untracked. The actual cause was a single stale lock file from a crashed git
process. This sandbox can create but not unlink inside `.git`, so the lock was
moved aside rather than deleted; the same is required after each git write here.
Stale locks now sit at `.git/index.lock.stale*`, `.git/HEAD.lock.*` and are inert.

**Law:** a tool failure that is never diagnosed becomes an architectural belief.
Three years of closing gears sat one `mv` away from preservation.

---

## Truth boundary — what these two commits do NOT prove

- **NOT** Node0 closure. Activation rungs have not been executed.
- **NOT** L1 activation. The retraction still stands.
- **NOT** federation, URP, token, mint, PoI, or unattended operation.
- **NOT** a full-gate pass: `npm test` and `npm run check` were not run at this SHA.
- **NOT** pushed. Both commits are local only; no remote, no PR, no merge.
- Anchoring remains **per-call optional** in the reusable L1 API; only the
  Ω0-M production-shaped route requires it.
- The `--invoke` local-model path in `dema ask` exists but was not exercised here.
- `authority_delta = 0` · no network · no runtime activation · no key ceremony.

## What this DOES prove

The Node0 mechanical-closure gears and the First Light consent→answer→receipt join
now exist at exact, reproducible SHAs with green focused suites. They are no longer
one disk failure from `UNKNOWN`.

---

## Remaining uncommitted (30 paths)

Deliberately **not** absorbed into these seals — they belong to separate proof stories:

- doctor/theme/consent-matrix modifications (4 M files + 3 test files)
- GTM pack: `AUG2_OPERATION_FIRST_WITNESS.md`, `G0_PRIVATE_SEND_GO_CARD.md`, `G0_WITNESS_CAMPAIGN_v0_1.md`
- ADR-049, ADR-050, ADR-051 (three architecture decision records)
- `MASTER-SPEC-NODE0-2026-07-31.md`, `SESSION-OWNERSHIP.md`
- `pke/` (Personal Knowledge Engine), `companion/`
- `THIRD_FACT_CONVERGENCE_AUDIT_v0_1.md`
- backlog task-029 / task-031 / task-057 edits
- `.probe-del`, `.wtest2` (empty probe artifacts, safe to delete)

---

## Next corridor toward Node0 closure

```
1. [DONE] Seal Ω0-M + First Light                    35bdcdd · 07a0c65
2. Run full npm test + npm run check at 07a0c65
3. Carve the doctor/theme slice; commit separately
4. Carve the GTM + ADR docs slice; commit separately
5. Run one REAL dema ask mission against a real BIZRA folder
6. Record burden baseline vs actual minutes (Ω0-H human closure)
7. Only then: L1 recertification and activation rungs
```

`Disk wins. Nothing above is claimed beyond what the commits and suites show.`
