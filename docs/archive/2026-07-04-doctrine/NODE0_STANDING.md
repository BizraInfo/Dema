# NODE0_STANDING.md — the one file that answers "where is my foot"

**Ritual:** this file lives at the root of the Dema repo. It is updated in ≤3 lines at the end of every working session, committed as `standing: YYYY-MM-DD`. Every cloud-planner session begins by pasting it. If a fact here conflicts with a fancier report elsewhere, **this file wins** — reports are receipts, not roadmaps.

**This edition:** 2026-07-02.2 · basis = direct clone of all three repos from GitHub **+ fresh executor verification transcript from NODE0 local working copy** (npm test/check/coverage/llm:guidance all run live)

---

## §1 · Where the foot is — one sentence

> You are standing at **Gate P (Protect)**, on branch `feat/node0-spine-runner-cli-1a`, local tip now `e8dae96` (world-map spec, on top of `1cf63ff` · 6,185/6,185 · coverage 95.6/84.2/97.7 · check clean · **zero dependencies**) — all of it **on exactly one disk**, origin/main at `696e160` (#311), remote #312 head stale, 30 CI rails dark behind one billing toggle, and one sudo password burned in AI transcripts.

## §2 · The three-repo board (verified today)

| Repo | Pulse | HEAD on origin | State | Direction |
|---|---|---|---|---|
| **Dema** | 🔥 hot (today) | origin/main `696e160` (#311) · **local tip `e8dae96`** on `feat/node0-spine-runner-cli-1a` | Local verified live: 1,545 files · 518 test files · 338 docs · ~309K lines · 6,185/6,185 · coverage L95.56/B84.16/F97.68 · check 0 fail (94-command consent matrix, no-mint gates, FDE, kernel purity, no-overclaim) · boot 86.9ms / RSS 55.5MB · **0 runtime + 0 dev dependencies** · executor grade A-/B, pressure point: cli/index.js 1,335 lines | The product face. All forward motion happens here. |
| **bizra-data-lake** | 🌡 warm (Jun 11) | `6a3c142` — #113, witness registry merged | 8,880 files · 779K py + 239K rs · **27-crate** bizra-omega workspace (incl. cognition-gateway) · 23 CI rails (dark) · 51 root-level .md reports · 47 TODO markers | The substrate + witness lane. Weekly heartbeat; no new fronts. |
| **award-winner-design** | 🧊 parked (May 14) | `5b80e68` — claim cleanup #4 | 382 files · 51K ts/tsx · three.js + gsap + framer stack · Dema UI wired to cognition-gateway · 50 root .md reports | **Frozen pending Gate C decision** — the spectacle stack contradicts the restraint canon (Design v0.2). Archive or re-scope; do not touch before C. |

Legacy estate: 157 repos distilled into these 3 — the distillation was the right move; orchestration is the missing organ, and this file is that organ.

## §3 · 🔴 The divergence (highest-order fact)

`1cf63ff` — **not a valid object on origin** (verified: `git cat-file` fails against the GitHub clone) — and the local branch has since advanced to `e8dae96` (NODE0-WORLD-MAP-1A design spec, committed today). Everything past remote #312 head `204b47c` exists **only** in `~/Downloads/Dema` on NODE0's single disk; the open PR #312 on GitHub is now stale relative to local. The newest proof work has zero off-disk copies. Gate P items P1/P2 exist because of this.

Also: SPROUT_PIN confirms the live Dema root is `/home/bizra-operating-system/Downloads/Dema` — the hot working copy sits **inside** the unbacked 75GB tree. P1 protects it wholesale.

## §4 · THE MAP — what is left (WIP limit = 1, top to bottom)

### GATE P · PROTECT — ⏱ ~1 hour, operator-side ← **YOUR FOOT IS HERE**
- [ ] **P0** rotate the NODE0 sudo password (`passwd`) — it was typed into an AI executor session and now appears verbatim in shared transcripts; treat it as burned. ⏱ 2 min → *exit: old password no longer valid*
- [ ] **P1** `rsync -a --info=progress2 ~/Downloads/ /data/backup-2026-07-02/` then BLAKE3 manifest over the copy → *exit: manifest hash pasted into this file*
- [ ] **P2** push the unpushed commits as a protection branch (needs your typed GO — it is a remote push): `git push origin HEAD:wip/1cf63ff-protect` → *exit: branch visible on GitHub*
- [ ] **P3** unlock GitHub Actions billing on BizraInfo → *exit: any workflow starts*

### GATE W · WITNESS — days
- [ ] **W1** split #312 (now **14 commits** locally / 93+ files) into a reviewable stack + fix the CodeRabbit **Major** (provenance/file mismatch + receipt-integrity gap) — *prep is fully local; no CI needed*. The `e8dae96` docs-only spec commit cherry-picks cleanly into its own tiny PR.
- [ ] **W2** push stack (typed GO per push) → CI green → merge in order
- [ ] **W3** rebase & land #313
- [ ] **W4** tag trunk + `npm run proof:attest:ci:aggregate` → *exit: green trunk tag = first external witness of the whole spine*

### GATE C · CELL — 1–2 weeks
- [ ] **C1** build APR-MSSC-001 (3 claims → 3 sealed atoms, real Web Crypto) per Design Concept v0.2
- [ ] **C2** cockpit v0.2: three strata, truth chips on every panel, retire the four overclaims
- [ ] **C3** 7 consecutive days of `actor_role: FIRST_USER` receipts — Dema carrying one real workflow of yours per day → *exit: 7-day lived-evidence chain*
- [ ] **C4** decision on award-winner-design: archive, or re-scope to restraint canon

### GATE F · FIRST FRUIT — weeks
- [ ] **F1** `npm run proof:export` → portable proof pack
- [ ] **F2** one warm-list human re-runs it end-to-end → *exit: first third-party verification receipt (Economic pillar finally moves off 2/10)*

## §4b · North Star — G001, the goal this ladder serves

**G001 (SMART):** Dema actively serving Mumo daily as Node0's first user, with the whole-machine world map composed over all asset lanes.
**Measure:** Gate C exit receipt = 7 consecutive `FIRST_USER` days **+** `node0-world-map` status ≥ `READY_FOR_HASH_CONSENT` on ≥4 lanes.
**Achievable:** substrate verified green (6,185/6,185, zero-dep, spec committed). **Relevant:** this *is* the alone-first principle. **Time-bound:** target **2026-07-23**.

Goal-chain → gate binding: genesis closed = W exit (witnessed, not re-minted) · Dema active = C3 (daily use, `GATED_OPERATOR_ONLY`) · PAT/SAT = graduates with C · URP local = WORLD-MAP-1A implementation · first node = C exit · flywheel = F + asset pipeline. **One ladder, one goal — there is no second map.**

Asset lanes (flywheel fuel, per the WORLD-MAP-1A lane contract):
| Lane | Holding | Protection | Pipeline entry |
|---|---|---|---|
| repos | 157 (3 active) | safe on GitHub | H4 archive-flag pass |
| research | 200+ originals | inside P1 scope if local | metadata lane → hash consent |
| dialogue | 6,000+ conversations since early 2023 | export/location to be confirmed | dedicated lane; proof-of-priority anchor exists |
| unstructured | ~750GB estate (75GB Downloads slice unprotected) | P1 covers the slice; /data,/data2 redundancy unverified | space-index per root, consent-gated |

Value-preservation law (already canon in the spec): metadata before content · content-hash only with root-bound consent phrase · dedup is plan-only · nothing moves or dies without plan-hash consent + apply receipt. *"Without losing value" is structural.*

Minimum viable daily action: one gate checkbox **or** one `FIRST_USER` receipt. Nothing else counts as progress.

### HYGIENE (parallel, low-risk, no gate blocking)
- [ ] **H1** Dema HANDOVER.md says "expected: 1159 tests" — stale by ~5,000 tests. Make expected counts **derived, not hardcoded** (same bug class as the cockpit's stale 6,090). CLAIM_MUST_BIND applies to docs.
- [ ] **H2** data-lake: quarantine the 51 root .md reports → `docs/archive/` (keep README, ARCHITECTURE, CHANGELOG, CLAUDE, CANONICAL). Reports are receipts, not roadmaps.
- [ ] **H3** award-winner-design: same quarantine for its 50 root reports (when unparked).
- [ ] **H4** GitHub archive-flag pass over the 157 legacy repos (mark archived; delete nothing).

## §5 · Orchestration protocol (the management fix, five rules)

1. **One file.** This one. If it isn't on the map, it isn't work — it goes to §6 Parking.
2. **WIP = 1.** One unchecked gate item at a time. The next item is always the top unchecked box.
3. **Session ritual.** End of every session: ≤3 lines updated here (foot moved from → to; next box; blockers), one commit. Start of every cloud session: paste this file.
4. **Heartbeats.** Dema daily · data-lake weekly · award-winner-design silent until C4.
5. **Sediment law.** Any new report/audit/synthesis is born inside `docs/archive/` with a date prefix. Root level is for living documents only.

## §6 · Parking (ideas that are real but not now)
UNDO-PROVEN-1A · dual-token live rails (mint = 0 until PoI) · URP federation · brand film integration (`bizra-film.jsx` still not in evidence) · sub-agent registry slices · world-cell 1A

---
*Session log:*
- 2026-07-02 — Standing map created from direct clone of all three repos. Foot: Gate P. Divergence `1cf63ff` flagged.
- 2026-07-02.2 — Local executor evidence absorbed: tip `e8dae96`, 6,185 green + coverage + zero-dep verified live; WORLD-MAP-1A spec committed (implementation parked behind P/W per WIP=1); P0 added (sudo burned in transcripts); Claude Desktop 1.17377.2 installed on NODE0. Foot: still Gate P.
- 2026-07-02.3 — G001 north star bound to ladder (§4b): genesis=W, Dema-active=C3, URP=WORLD-MAP, flywheel=F. Asset lanes inventoried (157 repos · 200+ research · 6k+ dialogues · ~750GB). Target: Gate C by 2026-07-23. Foot: still Gate P.
