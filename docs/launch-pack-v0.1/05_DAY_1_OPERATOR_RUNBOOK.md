# Day-1 Dema Operator Runbook

> Read time: **10 minutes** · Install time: **5 minutes** (no dependencies to install) · Verification time: **5 minutes**
> Prerequisites: `git` · `node >= 20` · `npm` · standard POSIX shell (bash/zsh/fish)
> Optional: `python3` (only for receipt-chain verification · ships pre-installed on most systems)

This runbook gets a new reviewer from cold clone to verified Dema preview surface in 10 minutes. **No vendor account · no API key · no network access · no telemetry.**

---

## Step 0 · Quick context (read first · 30 seconds)

You are about to install and verify **Dema** — the JavaScript preview face of the BIZRA ecosystem (the C runtime of the three-runtime architecture canonized in ADR-014). Dema is:

- **Local-first** — runs entirely on your machine
- **Zero runtime dependencies** — only Node.js stdlib (`node --test`)
- **Preview-only** — every command shows what WOULD happen but refuses to execute without explicit operator consent
- **Receipt-emitting** — every preview event can produce a chain entry

**Dema is NOT**:

- A token / wallet / DEX / NFT thing
- A SaaS or cloud service
- A coding agent that runs Bash without your typed consent
- A federation member (federation requires Node1+ which is gated)

Your verification job is to **try to falsify the claims** in the GTM document (`01_*.md`) and the two ADRs (`03_*.md`, `04_*.md`). If a claim can be reproduced on your machine, that's evidence. If not, that's also evidence.

---

## Step 1 · Get the code (1 minute)

```bash
git clone https://github.com/BizraInfo/Dema.git
cd Dema
git log -1 --format='%h %s'
```

**Expected**: HEAD shows a recent merge commit. The binder you received was sealed at a specific HEAD; your `git log` should be at or after that HEAD.

**Truth label**: This step is `VERIFIED` (verifiable by you).

---

## Step 2 · Install + verify there are zero runtime dependencies (1 minute)

```bash
npm install --no-audit --no-fund
```

**Expected**: completes in ~1 second with `added 0 packages`. The `package.json` declares no `dependencies` and no `devDependencies`.

```bash
# Confirm zero deps
grep -E '"dependencies"|"devDependencies"' package.json
```

**Expected**: returns nothing (no matches). This is the **zero-dep moat** named in `01_*.md §II.A`.

**Truth label**: `VERIFIED` (one grep command proves it).

---

## Step 3 · Run the full test suite (1 minute)

```bash
npm test
```

**Expected**: tail of output shows:

```text
# tests <N>
# pass <N>
# fail 0
```

Where `<N>` is at least 2223 at the time this runbook was authored (current main `ea4c231`). The exact number may be higher; it must not be lower, and `# fail 0` must hold.

**Truth label**: `VERIFIED` (your `npm test` either passes or fails · the result is the evidence).

---

## Step 4 · Run the 4 review gates (2 minutes)

These are the constitutional gates every commit on `main` must pass. Run them to verify the discipline is real:

```bash
npm test                # already done in Step 3
npm run check           # static review · ~3 seconds
npm run llm:guidance    # canon guidance check · ~1 second
git diff --check        # whitespace + diff cleanliness · instant
```

**Expected**: all 4 exit 0. If any fails on a fresh clone of main, the discipline has slipped — report this as a finding.

**Truth label**: `VERIFIED`.

---

## Step 5 · Verify the receipt chain integrity (1 minute · optional · requires python3)

```bash
python3 scripts/forge_evidence.py --project-dir . --verify
```

**Expected**: output ends with:

```json
"ok": true,
```

Possibly with a `warnings` array listing legacy hash-shape items (these are honest history of older receipts and do NOT invalidate the chain).

**Truth label**: `VERIFIED` (`ok: true` is the chain's own verdict on its own integrity).

---

## Step 6 · Run the homebase TUI · the operator-facing surface (1 minute)

```bash
bin/dema
```

**Expected**:

- A bordered TUI banner renders
- Top line: `DEMA · Node0` (rendered Ihsān-gold in true-color terminals · per ADR-013)
- Body shows: "Welcome back, Mumu" (or your operator name if you've run `dema setup`)
- "Three things I remember" with 3 memory anchors
- State bars: Node0 / Mission / Gateway / Memory
- **"Next safe action:" line is a human sentence** (per ADR-013 humanizer) — NOT a snake_case identifier
- Bottom: key hints `[m] Mission [j] Journal [r] Receipts [b] Browse [?] Help [q] Quit`
- Footer: `Boundary: preview-only · no action without explicit consent.`

**Test the key dispatch loop**: press `m`. The TUI dispatches `dema mission propose` which shows:

```text
Dema mission propose
  Action: bounded_diagnostic_activation
  Executes: false
  Proposal allowed: false
  Consent accepted: false
  Next: No runtime action executed. Resolve readiness and provide the exact consent phrase first.
```

This is **refusal-as-product working as designed** — the system explicitly refuses to run without exact-string consent per ADR-005.

**Truth label**: `VERIFIED`.

---

## Step 7 · Run the 6-command demo (3 minutes)

```bash
bash docs/launch-pack-v0.1/../../docs/lighthouse-pack-v1.0/05_SIX_COMMAND_DEMO.sh
```

If that path isn't valid in your clone, run the 6 commands directly:

```bash
node apps/cli/src/index.js status
node apps/cli/src/index.js doctor
node apps/cli/src/index.js state --json | python3 -m json.tool | head -20
node apps/cli/src/index.js explain bizra
node apps/cli/src/index.js receipts
node apps/cli/src/index.js report safety
```

**Expected**: all 6 commands exit 0 in well under 1 second each.

**Truth label**: `VERIFIED`.

---

## Step 8 · Falsification time · try to break a claim (5 minutes)

Pick **3 claims** from the GTM document (`01_BIZRA_90_Day_GTM_v0.1.1.md`) and **2 claims** from each ADR (`03_*.md`, `04_*.md`) — 7 total. For each one:

1. Read the claim
2. Identify what would falsify it
3. Run the falsifier (grep, file read, command execution)
4. Record: VERIFIED (still holds) · FALSIFIED (does not hold) · UNCLEAR (couldn't reproduce)

**Examples of high-value falsification attempts**:

- "Zero runtime dependencies" → `grep '"dependencies"' package.json` (returns nothing? then claim holds)
- "All halt-gates respected this session" → `git log --oneline | grep -i 'force\|--no-verify\|hard.*reset'` (any results? potential falsification)
- "70 receipts at HEAD" → `ls .proof-forge/receipts/*.json | wc -l` (matches claim?)
- "Three-runtime architecture" → does `~/Downloads/Dema` exist as one of three? Find the other two in `~/BIZRA Node0/bizra-data-lake/` if available
- "POI v0.1 designed but not implemented" → `find . -name 'poi*' -type f` (no implementation file? claim holds)
- "Operator can stop the agent at any time" → press Ctrl+C during the homebase TUI · does it exit cleanly?
- "Refusal-as-product" → `grep -c 'refused\|REFUSED\|Refusal' packages/core/src/*.js` (≥30 refusal sentinels? claim holds)

Document your findings in **`07_REVIEWER_FEEDBACK_FORM_v2.md`**.

---

## Step 9 · Optional · run the live ANSI-color smoke (1 minute)

In a true-color terminal (Windows Terminal · iTerm2 · kitty · alacritty · most VS Code integrated terminals):

```bash
COLORTERM=truecolor bin/dema 2>&1 | head -3
```

**Expected**: the `DEMA · Node0` header renders in **Ihsān-gold** (RGB `212, 175, 55`). If you see escape codes literally (like `\x1b[38;2;212;175;55m`) instead of colored text, your terminal doesn't support 24-bit color · run with:

```bash
NO_COLOR=1 bin/dema 2>&1 | head -3
```

**Expected**: plain text · no escape codes. Both modes are correct behavior · the discipline is in the palette resolver (`packages/core/src/tui-formatter.js` `resolvePaletteFromEnv`) per ADR-013 + the integration slice (PR #61).

**Truth label**: `VERIFIED`.

---

## What you do NOT need to do

| Action                 | Why not                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| Mint a token           | POI-C1 forbids · no economic activation at v0.1                  |
| Register on a website  | Dema has no website registration                                 |
| Connect a wallet       | Dema doesn't connect wallets                                     |
| Pay anything           | Dema costs nothing · MIT licensed                                |
| Sign a CLA             | No CLA at v0.1 · contribution path is through standard GitHub PR |
| Talk to a salesperson  | There is no salesperson                                          |
| Provide your real name | Pseudonym is fine for the reviewer form                          |

## What you SHOULD do

1. Read every claim in the GTM and the 2 ADRs · don't skim
2. Try to falsify · don't just verify · find things that don't reproduce
3. Note surprises · things that surprise you are signal
4. Note refusals · things the system refused to do are the product
5. Return `07_REVIEWER_FEEDBACK_FORM_v2.md` filled in

## If something is broken

1. Note the exact command + exact error output
2. Note your `node --version`, `git --version`, OS, terminal
3. Add to the reviewer feedback form
4. Send back · don't try to fix · the feedback IS the value

---

## Cross-references

- `01_BIZRA_90_Day_GTM_v0.1.1.md` — the strategic context for what you're verifying
- `03_ADR_009_POI_accepted.md` — the POI design contract you're falsifying against
- `04_ADR_014_three_runtime_accepted.md` — the architecture you're verifying
- `06_KNOWN_GAPS_v2.md` — the gaps already named (don't re-discover · find new ones)
- `07_REVIEWER_FEEDBACK_FORM_v2.md` — where you write findings
- `08_TRUTH_LABEL_PAGE.md` — how to read the V/D/A/U labels

---

**Time check**: if you've reached this line in under 12 minutes, you've completed the Day-1 path. Send the feedback form back.

**Operating canon**: _A deterministic constitutional execution engine with replayable receipts._ You just verified that this is true on disk.
