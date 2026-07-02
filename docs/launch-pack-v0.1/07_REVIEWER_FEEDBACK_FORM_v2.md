# Reviewer Feedback Form · Launch Pack v0.1 Binder

> Please fill this form after running the 10-minute verification path in `05_DAY_1_OPERATOR_RUNBOOK.md`. **Empty answers are fine** — empty answers tell us nothing was found. Untruthful answers are not fine; please leave blank rather than invent.

---

## Reviewer identity

| Field                   | Your answer                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Name (or pseudonym)     | \***\*\*\*\*\*\*\***\_\***\*\*\*\*\*\*\***                                                                      |
| Ring                    | (you are Ring-1 N=1)                                                                                            |
| Date completed          | \***\*\*\*\*\*\*\***\_\***\*\*\*\*\*\*\***                                                                      |
| Local OS · architecture | \***\*\*\*\*\*\*\***\_\***\*\*\*\*\*\*\*** (e.g., Ubuntu 24.04 · x86_64)                                        |
| `node --version`        | \***\*\*\*\*\*\*\***\_\***\*\*\*\*\*\*\***                                                                      |
| Terminal                | \***\*\*\*\*\*\*\***\_\***\*\*\*\*\*\*\*** (e.g., Windows Terminal · iTerm2 · alacritty · screen via SSH · ...) |
| Approximate time spent  | \***\*\*\*\*\*\*\***\_\***\*\*\*\*\*\*\*** minutes                                                              |

---

## Section 1 · Did the install path work?

| Question                                                                                         | Your answer                                                                        |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Did `git clone` succeed at the URL in the runbook?                                               | ☐ yes ☐ no · details: \_\_\_\_                                                     |
| Did `npm install --no-audit --no-fund` complete in under 5 seconds with `added 0 packages`?      | ☐ yes ☐ no · details: \_\_\_\_                                                     |
| Did `grep -E '"dependencies"\|"devDependencies"' package.json` return EMPTY?                     | ☐ yes ☐ no · if NO, what was matched? \_\_\_\_                                     |
| Did `npm test` exit 0 with `# fail 0`?                                                           | ☐ yes ☐ no · what was N (total tests)? \_\_\_\_                                    |
| Did all 4 review gates exit 0?                                                                   | ☐ all 4 yes ☐ partial · which failed? \_\_\_\_                                     |
| Did `python3 scripts/forge_evidence.py --project-dir . --verify` return `"ok": true`?            | ☐ yes ☐ no ☐ skipped (no python3) · details: \_\_\_\_                              |
| Did `bin/dema` render the homebase TUI with the GOLD-tinted title?                               | ☐ yes · color visible ☐ yes · plain text (no color) ☐ no · what happened? \_\_\_\_ |
| Did pressing `m` in the homebase TUI dispatch to `dema mission propose` with the refusal output? | ☐ yes ☐ no · what happened? \_\_\_\_                                               |

---

## Section 2 · Claim falsification attempts (≥7 expected · per runbook Step 8)

For each claim you tried to falsify, fill one row:

| #   | Source (file:line OR ADR # · §) | Claim text (paraphrase ok) | Falsifier you ran | Verdict                                              |
| --- | ------------------------------- | -------------------------- | ----------------- | ---------------------------------------------------- |
| 1   | **\_**                          | **\_**                     | **\_**            | ☐ VERIFIED ☐ FALSIFIED ☐ UNCLEAR · details: \_\_\_\_ |
| 2   | **\_**                          | **\_**                     | **\_**            | ☐ VERIFIED ☐ FALSIFIED ☐ UNCLEAR · details: \_\_\_\_ |
| 3   | **\_**                          | **\_**                     | **\_**            | ☐ VERIFIED ☐ FALSIFIED ☐ UNCLEAR · details: \_\_\_\_ |
| 4   | **\_**                          | **\_**                     | **\_**            | ☐ VERIFIED ☐ FALSIFIED ☐ UNCLEAR · details: \_\_\_\_ |
| 5   | **\_**                          | **\_**                     | **\_**            | ☐ VERIFIED ☐ FALSIFIED ☐ UNCLEAR · details: \_\_\_\_ |
| 6   | **\_**                          | **\_**                     | **\_**            | ☐ VERIFIED ☐ FALSIFIED ☐ UNCLEAR · details: \_\_\_\_ |
| 7   | **\_**                          | **\_**                     | **\_**            | ☐ VERIFIED ☐ FALSIFIED ☐ UNCLEAR · details: \_\_\_\_ |
| +N  | **\_**                          | **\_**                     | **\_**            | **\_**                                               |

---

## Section 3 · Surprises

**Surprise (positive)** — something that worked better than you expected:

> ---

**Surprise (negative)** — something that didn't work as expected · or felt off:

> ---

**Surprise (constitutional)** — a system behavior that surprised you because it was a refusal rather than an action (refusal-as-product · the system explicitly refused to do something):

> ---

---

## Section 4 · Known-gap verification (per `06_KNOWN_GAPS_v2.md`)

Did the Known Gaps register match what you found?

| Gap category              | Match?                                    | Mismatches found (list any) |
| ------------------------- | ----------------------------------------- | --------------------------- |
| KNOWN-MISSING (10 items)  | ☐ all match ☐ partial mismatch ☐ no match | **\_**                      |
| KNOWN-PARTIAL (7 items)   | ☐ all match ☐ partial mismatch ☐ no match | **\_**                      |
| KNOWN-DEFERRED (15 items) | ☐ all match ☐ partial mismatch ☐ no match | **\_**                      |
| KNOWN-LIVE (14 items)     | ☐ all match ☐ partial mismatch ☐ no match | **\_**                      |

**New gaps you found NOT listed in `06_KNOWN_GAPS_v2.md`** (this is the highest-value section · please be thorough):

> ---

---

## Section 5 · The 4 PoT axes · do they hold for you?

Per the operating canon, BIZRA / Dema should pass on Formal · Cryptographic · Empirical · Economic. After your verification, your verdict:

| Axis                                                   | Your verdict on your machine                           | Evidence |
| ------------------------------------------------------ | ------------------------------------------------------ | -------- |
| **Formal** (tests · ADRs · gates)                      | ☐ STRONG ☐ STRONG-WITH-CAVEATS ☐ INCONSISTENT · **\_** |
| **Cryptographic** (receipt chain · OTS)                | ☐ STRONG ☐ STRONG-WITH-CAVEATS ☐ INCONSISTENT · **\_** |
| **Empirical** (does it run · does it refuse correctly) | ☐ STRONG ☐ STRONG-WITH-CAVEATS ☐ INCONSISTENT · **\_** |
| **Economic** (N/A at v0.1 · do you agree?)             | ☐ correctly N/A ☐ should be in scope · **\_**          |

---

## Section 6 · GTM verdict

After reading `01_BIZRA_90_Day_GTM_v0.1.1.md`:

| Question                                                                | Your answer                                         |
| ----------------------------------------------------------------------- | --------------------------------------------------- |
| Is the 90-day phased plan realistic?                                    | ☐ yes ☐ no · details: \_\_\_\_                      |
| Are the 7 named risks reasonable? Any missing?                          | ☐ reasonable ☐ missing: \_\_\_\_                    |
| Is the Ring 1 → 2 → 3 sequence sound (vs jumping to public)?            | ☐ sound ☐ unsound · details: \_\_\_\_               |
| Is the "no token mint at v0.1" position credible?                       | ☐ credible ☐ not credible · why: \_\_\_\_           |
| Would you be willing to be Ring-2 reviewer (after Ring-1 = you closes)? | ☐ yes ☐ no ☐ maybe ☐ already done · contact: **\_** |

---

## Section 7 · ADR verdicts

### ADR-009 POI Design (`03_ADR_009_POI_accepted.md`)

| Element                                                                                                            | Your verdict                                   |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| The 5 canonical refusals (no token · no comparison · no attestation · no time-weighting · no speculation) — sound? | ☐ sound ☐ unsound · details: \_\_\_\_          |
| The 5 rules of POI v0.1 (function of receipts not intent · local · deterministic · non-mutable · bounded) — sound? | ☐ sound ☐ unsound · details: \_\_\_\_          |
| The 8 binding constraints (POI-C1..C8) — any you'd amend?                                                          | ☐ no amendments ☐ amendments: \_\_\_\_         |
| The 5 activation gates — are they too strict · just right · too loose?                                             | ☐ too strict ☐ just right ☐ too loose · **\_** |
| Any hidden flaw the architect missed?                                                                              | **\_**                                         |

### ADR-014 Three-Runtime Architecture (`04_ADR_014_three_runtime_accepted.md`)

| Element                                                                                      | Your verdict                          |
| -------------------------------------------------------------------------------------------- | ------------------------------------- |
| Is the Python data-lake / Rust bizra-omega / JS Dema split intentional and sound?            | ☐ sound ☐ unsound · details: \_\_\_\_ |
| Does the wrong-codebase-pattern protection feel real or theatre?                             | ☐ real ☐ theatre · why: \_\_\_\_      |
| Should there be a 4th runtime (e.g., mobile-native)?                                         | ☐ no ☐ yes: \_\_\_\_                  |
| Are the cross-runtime bridges right (PyO3 between A&B · design-only between B&C · none A&C)? | ☐ right ☐ should add: \_\_\_\_        |

---

## Section 8 · The Daughter Test (the final filter)

Per BIZRA canon: _"Would Mumu willingly subject his own family to this output?"_

After reviewing the binder + the code, your verdict:

| Daughter Test question                                                                  | Your verdict                                                                                                  |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Would you be willing to recommend a family member install Dema today (preview-only)?    | ☐ yes ☐ no ☐ with caveats · **\_**                                                                            |
| Would you be willing to recommend a family member install Dema if a token mint existed? | ☐ yes ☐ no ☐ with caveats · **\_** (this is the architect-self-binding test · NO is the right answer at v0.1) |
| If the Daughter Test failed for you, what specifically failed?                          | **\_**                                                                                                        |

---

## Section 9 · One sentence summary

If you had to summarize Dema / BIZRA in one sentence after this verification, what would you say?

> ---

---

## Section 10 · How to return this form

Email · Telegram · Signal · USB · GitHub gist · whatever channel Mumu specified when sending you the binder. Plain text or Markdown. **No format constraints.**

If you found a critical security issue, send it ENCRYPTED. Mumu's public Ed25519 key is at `~/.bizra/mumo/node0-key.pub.hex` in your clone. Use age or GPG.

---

## What happens after you return this form

1. Mumu reads your feedback
2. Coordinator parses your findings · identifies amendments needed
3. Each significant finding gets an amendment ADR (or supersedes an existing ADR)
4. A content-addressed receipt for your feedback is recorded locally · truth label includes your pseudonym (chain-anchoring is DESIGNED_NOT_LIVE / preview)
5. Phase 1 of 90-Day GTM v0.1.1 closes
6. You may be invited to Ring-2 (after Phase 1 close) if you indicated willingness in §6

Your feedback is recorded in BIZRA's local proof history (a live, permanent chain is DESIGNED_NOT_LIVE / preview).

---

**Thank you for being the first witness.**
