# Reviewer Feedback Form · Launch Pack v0.1 Binder

> Please fill this form after running the 10-minute verification path in `05_DAY_1_OPERATOR_RUNBOOK.md`. **Empty answers are fine** — empty answers tell us nothing was found. Untruthful answers are not fine; please leave blank rather than invent.

---

## Reviewer identity

| Field | Your answer |
|---|---|
| Name (or pseudonym) | _________________________ |
| Ring | (you are Ring-1 N=1) |
| Date completed | _________________________ |
| Local OS · architecture | _________________________ (e.g., Ubuntu 24.04 · x86_64) |
| `node --version` | _________________________ |
| Terminal | _________________________ (e.g., Windows Terminal · iTerm2 · alacritty · screen via SSH · ...) |
| Approximate time spent | _________________________ minutes |

---

## Section 1 · Did the install path work?

| Question | Your answer |
|---|---|
| Did `git clone` succeed at the URL in the runbook? | ☐ yes ☐ no · details: ____ |
| Did `npm install --no-audit --no-fund` complete in under 5 seconds with `added 0 packages`? | ☐ yes ☐ no · details: ____ |
| Did `grep -E '"dependencies"\|"devDependencies"' package.json` return EMPTY? | ☐ yes ☐ no · if NO, what was matched? ____ |
| Did `npm test` exit 0 with `# fail 0`? | ☐ yes ☐ no · what was N (total tests)? ____ |
| Did all 4 review gates exit 0? | ☐ all 4 yes ☐ partial · which failed? ____ |
| Did `python3 scripts/forge_evidence.py --project-dir . --verify` return `"ok": true`? | ☐ yes ☐ no ☐ skipped (no python3) · details: ____ |
| Did `bin/dema` render the homebase TUI with the GOLD-tinted title? | ☐ yes · color visible ☐ yes · plain text (no color) ☐ no · what happened? ____ |
| Did pressing `m` in the homebase TUI dispatch to `dema mission propose` with the refusal output? | ☐ yes ☐ no · what happened? ____ |

---

## Section 2 · Claim falsification attempts (≥7 expected · per runbook Step 8)

For each claim you tried to falsify, fill one row:

| # | Source (file:line OR ADR # · §) | Claim text (paraphrase ok) | Falsifier you ran | Verdict |
|---|---|---|---|---|
| 1 | _____ | _____ | _____ | ☐ VERIFIED ☐ FALSIFIED ☐ UNCLEAR · details: ____ |
| 2 | _____ | _____ | _____ | ☐ VERIFIED ☐ FALSIFIED ☐ UNCLEAR · details: ____ |
| 3 | _____ | _____ | _____ | ☐ VERIFIED ☐ FALSIFIED ☐ UNCLEAR · details: ____ |
| 4 | _____ | _____ | _____ | ☐ VERIFIED ☐ FALSIFIED ☐ UNCLEAR · details: ____ |
| 5 | _____ | _____ | _____ | ☐ VERIFIED ☐ FALSIFIED ☐ UNCLEAR · details: ____ |
| 6 | _____ | _____ | _____ | ☐ VERIFIED ☐ FALSIFIED ☐ UNCLEAR · details: ____ |
| 7 | _____ | _____ | _____ | ☐ VERIFIED ☐ FALSIFIED ☐ UNCLEAR · details: ____ |
| +N | _____ | _____ | _____ | _____ |

---

## Section 3 · Surprises

**Surprise (positive)** — something that worked better than you expected:

> _____

**Surprise (negative)** — something that didn't work as expected · or felt off:

> _____

**Surprise (constitutional)** — a system behavior that surprised you because it was a refusal rather than an action (refusal-as-product · the system explicitly refused to do something):

> _____

---

## Section 4 · Known-gap verification (per `06_KNOWN_GAPS_v2.md`)

Did the Known Gaps register match what you found?

| Gap category | Match? | Mismatches found (list any) |
|---|---|---|
| KNOWN-MISSING (10 items) | ☐ all match ☐ partial mismatch ☐ no match | _____ |
| KNOWN-PARTIAL (7 items) | ☐ all match ☐ partial mismatch ☐ no match | _____ |
| KNOWN-DEFERRED (15 items) | ☐ all match ☐ partial mismatch ☐ no match | _____ |
| KNOWN-LIVE (14 items) | ☐ all match ☐ partial mismatch ☐ no match | _____ |

**New gaps you found NOT listed in `06_KNOWN_GAPS_v2.md`** (this is the highest-value section · please be thorough):

> _____

---

## Section 5 · The 4 PoT axes · do they hold for you?

Per the operating canon, BIZRA / Dema should pass on Formal · Cryptographic · Empirical · Economic. After your verification, your verdict:

| Axis | Your verdict on your machine | Evidence |
|---|---|---|
| **Formal** (tests · ADRs · gates) | ☐ STRONG ☐ STRONG-WITH-CAVEATS ☐ INCONSISTENT · _____ |
| **Cryptographic** (receipt chain · OTS) | ☐ STRONG ☐ STRONG-WITH-CAVEATS ☐ INCONSISTENT · _____ |
| **Empirical** (does it run · does it refuse correctly) | ☐ STRONG ☐ STRONG-WITH-CAVEATS ☐ INCONSISTENT · _____ |
| **Economic** (N/A at v0.1 · do you agree?) | ☐ correctly N/A ☐ should be in scope · _____ |

---

## Section 6 · GTM verdict

After reading `01_BIZRA_90_Day_GTM_v0.1.1.md`:

| Question | Your answer |
|---|---|
| Is the 90-day phased plan realistic? | ☐ yes ☐ no · details: ____ |
| Are the 7 named risks reasonable? Any missing? | ☐ reasonable ☐ missing: ____ |
| Is the Ring 1 → 2 → 3 sequence sound (vs jumping to public)? | ☐ sound ☐ unsound · details: ____ |
| Is the "no token mint at v0.1" position credible? | ☐ credible ☐ not credible · why: ____ |
| Would you be willing to be Ring-2 reviewer (after Ring-1 = you closes)? | ☐ yes ☐ no ☐ maybe ☐ already done · contact: _____ |

---

## Section 7 · ADR verdicts

### ADR-009 POI Design (`03_ADR_009_POI_accepted.md`)

| Element | Your verdict |
|---|---|
| The 5 canonical refusals (no token · no comparison · no attestation · no time-weighting · no speculation) — sound? | ☐ sound ☐ unsound · details: ____ |
| The 5 rules of POI v0.1 (function of receipts not intent · local · deterministic · non-mutable · bounded) — sound? | ☐ sound ☐ unsound · details: ____ |
| The 8 binding constraints (POI-C1..C8) — any you'd amend? | ☐ no amendments ☐ amendments: ____ |
| The 5 activation gates — are they too strict · just right · too loose? | ☐ too strict ☐ just right ☐ too loose · _____ |
| Any hidden flaw the architect missed? | _____ |

### ADR-014 Three-Runtime Architecture (`04_ADR_014_three_runtime_accepted.md`)

| Element | Your verdict |
|---|---|
| Is the Python data-lake / Rust bizra-omega / JS Dema split intentional and sound? | ☐ sound ☐ unsound · details: ____ |
| Does the wrong-codebase-pattern protection feel real or theatre? | ☐ real ☐ theatre · why: ____ |
| Should there be a 4th runtime (e.g., mobile-native)? | ☐ no ☐ yes: ____ |
| Are the cross-runtime bridges right (PyO3 between A&B · design-only between B&C · none A&C)? | ☐ right ☐ should add: ____ |

---

## Section 8 · The Daughter Test (the final filter)

Per BIZRA canon: *"Would Mumu willingly subject his own family to this output?"*

After reviewing the binder + the code, your verdict:

| Daughter Test question | Your verdict |
|---|---|
| Would you be willing to recommend a family member install Dema today (preview-only)? | ☐ yes ☐ no ☐ with caveats · _____ |
| Would you be willing to recommend a family member install Dema if a token mint existed? | ☐ yes ☐ no ☐ with caveats · _____ (this is the architect-self-binding test · NO is the right answer at v0.1) |
| If the Daughter Test failed for you, what specifically failed? | _____ |

---

## Section 9 · One sentence summary

If you had to summarize Dema / BIZRA in one sentence after this verification, what would you say?

> _____

---

## Section 10 · How to return this form

Email · Telegram · Signal · USB · GitHub gist · whatever channel Mumu specified when sending you the binder. Plain text or Markdown. **No format constraints.**

If you found a critical security issue, send it ENCRYPTED. Mumu's public Ed25519 key is at `~/.bizra/mumo/node0-key.pub.hex` in your clone. Use age or GPG.

---

## What happens after you return this form

1. Mumu reads your feedback
2. Coordinator parses your findings · identifies amendments needed
3. Each significant finding gets an amendment ADR (or supersedes an existing ADR)
4. Receipt #N+1 is minted to anchor the feedback to the chain · truth label includes your pseudonym
5. Phase 1 of 90-Day GTM v0.1.1 closes
6. You may be invited to Ring-2 (after Phase 1 close) if you indicated willingness in §6

The chain witnesses your participation forever. Your feedback becomes part of BIZRA's constitutional history.

---

**Thank you for being the first witness.**
