# Dema In-Room Walkthrough · v0.1

**For:** Mumu showing Dema to 2 trusted friends physically present.
**Duration:** 30-45 minutes.
**Setting:** Your laptop. Three chairs. Three pairs of eyes on one screen.
**Goal:** The 2 friends see what Dema actually does, ask honest questions, and tell you what surprises / worries / interests them.

This is NOT the Lighthouse Pack v1.0 (which was designed for async review by a stranger). This is the **in-room version**: you walk through it together, in real time, with the friends asking questions as they come up.

---

## §0 · Before the friends sit down (5 minutes · your prep)

```bash
# Confirm the system is responsive
cd ~/Downloads/Dema
git status                                    # should be clean
npm test --silent 2>&1 | tail -5              # should show 737/737 PASS

# Confirm Dema responds
node apps/cli/src/index.js                    # should show banner with "Mumu" identified
```

If any of those don't work, **stop and fix before the friends sit down.** The walkthrough assumes the basics work.

---

## §1 · The opening (2 minutes · what you say first)

Sit them at the screen with you. Open a terminal. Say something like:

> *"Hey. So I've been working on this thing for three years. It's called Dema. It is local-first — everything runs on my laptop, nothing in the cloud. I want to show you what it does and try to find out from you what makes sense and what doesn't. Two things up front: First, this is preview-only — nothing executes outside the screen we're looking at. Second, I'm not trying to convince you it's good. I'm trying to find out what's confusing or worrying so I can fix it before showing it to anyone else. Sound good?"*

That's the entire opening. **Do not pitch. Do not explain the vision. Show.**

---

## §2 · The 8-command walkthrough (15-20 minutes · together)

Run these 8 commands one by one. For each, before you press enter, say one sentence about what it does. After it runs, **pause** and ask the friend "does that make sense?" before moving on.

### Command 1 of 8 — `dema` (the homebase)

```bash
node apps/cli/src/index.js
```

**Say:** *"This is what I see when I open Dema. It shows who I am, what node I'm on, where I am in the journey, and what the next safe action is."*

**Friend may notice:** "Gateway unreachable" — this is the moment to clarify:

> *"Gateway unreachable is BY DESIGN. The runtime that would do real work lives in a different system, separate from this repo. This face — this terminal — is intentionally preview-only. The unreachable line is the system telling the truth about its scope."*

### Command 2 of 8 — `dema state` (node truth)

```bash
node apps/cli/src/index.js state
```

**Say:** *"This is Node0's state as a structured JSON object. Notice the `truth_label: NODE0_LOCAL_SEED` — every line of JSON Dema emits binds to one of four truth states (verified · derived · assumed-with-Ihsan · unknown)."*

**Friend may notice:** The `boundary` object with 16 keys all `false`. This is the moment to point:

> *"All 16 of those `false` values are pinned by code. They mean: this command did not write a file, did not call the network, did not run a model, did not mint a receipt. Every Dema command has this same 16-key boundary. It's the system's signature."*

### Command 3 of 8 — `dema profiles --summary` (identity)

```bash
node apps/cli/src/index.js profiles --summary
```

**Say:** *"This is who can act on the node. There are 5 named actors: the user (me), my private agents (PAT), the system agents (SAT), my current mission, and the context capsule that connects them. The `--summary` flag gives you the compact view; without it you get the full ~205 lines."*

### Command 4 of 8 — `dema consent-card` (the gate)

```bash
node apps/cli/src/index.js consent-card
```

**Say:** *"This is the consent gate. Before any meaningful action, the system shows you exactly what's allowed and what's blocked. Look at `blocked_effects` — runtime, federation, mint, connection to other nodes, raw scan, public network — all of those are blocked unless you type an exact consent phrase."*

### Command 5 of 8 — `dema mission-loop --summary` (lifecycle)

```bash
node apps/cli/src/index.js mission-loop --summary
```

**Say:** *"This is the full mission lifecycle in preview form. Even when the mission is 'approved', look at `preview_lifecycle_status: HOLD`. That field is pinned to HOLD by code — the lifecycle never actually advances inside this repo."*

### Command 6 of 8 — `dema evidence-event` (proof preview)

```bash
node apps/cli/src/index.js evidence-event
```

**Say:** *"This is what an EvidenceChain event would look like IF a mission were approved. Notice `chain_advance: false` — the chain does not move. This is a preview of what proof would look like, not the proof itself."*

### Command 7 of 8 — `dema process-mining --summary` (the mirror)

```bash
node apps/cli/src/index.js process-mining --summary
```

**Say:** *"This one is different. It mirrors back where I am as the operator. Look at `ring_advancement_status` — it surfaces the honest truth: I have verified Ring 0 myself, the pack is sealed, but Ring 1 is not yet earned. The system tells me where I am — it doesn't pretend."*

### Command 8 of 8 — `dema key-maker-check --door "show this to friends"` (self-audit)

```bash
node apps/cli/src/index.js key-maker-check --door "show this to friends" --summary
```

**Say:** *"This is Dema auditing its own reasoning. The 'door' is what I'm trying to do — show this to friends. The envelope tells me whether the reasoning shape satisfies 5 invariants from the Key Maker doctrine I shipped today. Right now it says 'overall_compliant: true' because the trivial empty envelope passes by default. The real use is when I make a real recommendation — the envelope tells me whether the recommendation was reasoned correctly."*

---

## §3 · One real artifact on disk (3 minutes)

After the 8 commands, show them the actual receipts and memory:

```bash
ls ~/.dema/receipts/                          # show 3 real receipts on disk
cat ~/.dema/receipts/artifact-011.json | head -15   # show one with real hash
ls ~/.dema/memory/ | head -10                 # show local memory entries
du -sh ~/.dema/                                # show 5.8 GB of real state
```

**Say:** *"This isn't theoretical. Look — 5.8 gigabytes of actual state on my disk. Three real receipts with cryptographic hashes. Twenty-four memory entries persisted across sessions. The system has been recording me being here, day by day, for months."*

---

## §4 · The Bitcoin anchor (2 minutes · optional)

If they seem technically curious:

```bash
ls *.pdf                                       # show 3 founding PDFs
sha256sum themassage.pdf bizra.pdf BIZRA_Third_Fact_v0_1_FINAL.pdf
cat proof-of-priority/manifest.json | head -20
```

**Say:** *"Three founding PDFs from 3 years ago. Their SHA-256 hashes are anchored to Bitcoin block headers 948027, 948028, and 948029. Anyone in the world can verify that on a public block explorer. The origin of this work has a cryptographic timestamp that I cannot fake, retroactively or otherwise."*

---

## §5 · The 3 questions (10 minutes · the actual Ring-1 act)

After the walkthrough, ask each friend these three questions. Take notes (paper or a memo file). Do NOT defend. Do NOT explain. Just listen.

```
Q1.  What surprised you?
     (anything · the architecture · the discipline · the empty fields ·
      the refusal patterns · the language Dema uses · the boundary
      objects · how much you didn't understand at first)

Q2.  What worried you?
     (anything · the complexity · what you couldn't follow · what
      seemed over-engineered · what seemed underspecified · what
      you don't believe yet)

Q3.  What would you want to see next?
     (anything · a feature · a clarification · a different surface ·
      a different first-screen · documentation that doesn't exist ·
      something I haven't thought of)
```

**Critical rule for you (Mumu):** when they answer Q2 (worried), do NOT explain why they shouldn't be worried. Their worry IS the data. If they're worried about something you've already addressed, that means YOUR ADDRESS WAS INVISIBLE — that's a finding.

The most valuable thing they can tell you is what they DIDN'T understand. That gap is your next 30 days of work.

---

## §5b · Adversarial-mode addendum (use IF a reviewer specializes in red-teaming)

This section is for the case where one of your reviewers is a known adversarial
tester — someone whose specialty is finding where systems fail under pressure.
Skip §5 entirely with them. Use this instead.

### Opening for an adversarial reviewer (60 seconds · what you say)

> *"I know what you do. I'm not here to show you it works. I'm here to find out where it fails. Treat this as a red-team engagement. I will not defend. I will not explain why something is fine. I will write down every break and thank you for it. The goal is for you to find as many failure modes as possible in the next 2-3 hours. The harder you push, the more I learn."*

That's the entire opening. Then hand him the keyboard if he wants it.

### The attack-vector pre-map (give him this list as a starting menu)

These are the 15 vectors I'd expect an LLM-breaker to try. For each, here is the honest current state — DEFENDED, PARTIAL, or GAP. **Show him this table at the start.** It saves him from probing closed doors and points him at the open ones.

| # | Vector | Current state | Where to probe |
|---|---|---|---|
| 1 | Schema injection (force a non-canonical schema field) | DEFENDED | Each builder hardcodes schema string · `spine-contract.test.js` enforces regex |
| 2 | Boundary corruption (set a 16-key to true via input) | DEFENDED | `buildPreviewBoundary()` returns frozen fresh object · caller cannot mutate |
| 3 | Frozen-object mutation (try to write to output post-build) | DEFENDED | `Object.freeze` + ESM strict mode · throws on write |
| 4 | Symbol / function / object pollution in array fields | DEFENDED | Per-builder filters drop non-primitives silently · 22 adversarial tests in `key-maker-compliance.test.js` |
| 5 | Race conditions / concurrent calls | DEFENDED | All builders are pure · deterministic · no shared state |
| 6 | Side-channel leak via output paths | DEFENDED | Builders have no I/O · output is fully visible JSON |
| 7 | Adversarial CLI `--door` strings (long · binary · injection-style) | LIKELY DEFENDED | `safeString` filter · please try anyway |
| 8 | Receipt forgery (write fake JSON to `~/.dema/receipts/`) | PARTIAL | OS-level write works · chain semantics defends · contract says gateway issues |
| 9 | Memory corruption (write fake entry to `~/.dema/memory/`) | PARTIAL | Same as #8 |
| 10 | Prototype pollution via crafted input objects | PARTIAL | Audit not done end-to-end · please probe |
| 11 | Doctrine bypass (find a path where canon doesn't apply) | **GAP** | Doctrine is documented; not all of it is code-enforced |
| 12 | Constitutional anchors as gates (Ihsān · Adl · Riba_Zero) | **GAP** | Named in docs · NOT enforced by automated tests · honest finding |
| 13 | Untested invariants in canon docs | **GAP** | Canon §9 5 invariants are tested · others (e.g., L0/L1/L2 levels in autonomy envelope) are not all code-enforced |
| 14 | Cross-builder integration adversarial scenarios | **GAP** | The 8 spine builders pass solo · joint adversarial scenarios not yet fuzzed |
| 15 | Cross-session chain mutation behaviors | **GAP** | ADR-007 Accepted with CC1-3 RESOLVED · still a known surface area · the most active known weakness |

**Tell him: "The DEFENDED items will frustrate you; you may still find a bug · please try anyway. The PARTIAL items are where I expect the first real findings. The GAPs are where I expect the deepest findings. Spend the first hour on GAPs."**

### Specific commands he can run to probe each vector

```bash
# Vector 1-3: try to corrupt outputs
node -e "import('./packages/core/src/state.js').then(m => { const s = m.buildNode0StatePreview(); s.boundary.runtime_execution_performed = true; console.log(s.boundary.runtime_execution_performed); })"
# Expected: still false (or throws) · if true, BUG FOUND

# Vector 4: adversarial input filtering
node -e "import('./packages/core/src/key-maker-compliance.js').then(m => console.log(m.buildKeyMakerCompliancePreview({ door: 'test', known: [() => 'malicious', Symbol('x'), { proto: 'pollute' }] }).certainty.known))"
# Expected: empty array · if any of the three appears, BUG FOUND

# Vector 7: weird --door strings
node apps/cli/src/index.js key-maker-check --door "$(printf 'A%.0s' {1..10000})"
node apps/cli/src/index.js key-maker-check --door "<script>alert(1)</script>"
node apps/cli/src/index.js key-maker-check --door "$(cat /etc/passwd | head -1)"
# Expected: clean output · contained · no error · door echoed verbatim

# Vector 8-9: forgery surface
echo '{"forged":"yes","receipt_id":"fake","truth_label":"FAKE"}' > ~/.dema/receipts/forged.json
node apps/cli/src/index.js receipts | grep -A 2 forged
# Expected: appears in list (read-only list) but no verification
# Bug if: dema treats it as a real receipt with truth_label="FAKE"

# Vector 11: doctrine bypass — try to invoke a "real" effect
node apps/cli/src/index.js mission-loop  # check that NO boundary key flips to true
node apps/cli/src/index.js mission-loop | grep -E '"true"|true,' | grep -v can_  # any true value in boundary?
# Expected: empty · if any boundary key shows true, BUG FOUND

# Vector 12: ethical-anchor enforcement
grep -rE "IHSAN_FLOOR|RIBA_ZERO|Daughter Test" packages/ tests/ scripts/ 2>/dev/null
# Expected: appearance in docs/strings · NOT in code-enforced gates
# Honest gap: these are doctrinal not enforced

# Vector 15: cross-session chain
# Read ADR-007 first · then attempt the scenarios it names as unresolved
cat docs/06-adr/ADR-007*.md | grep -A 5 "Option A\|Option B\|Option C"
```

### The adversarial-mode questions (use INSTEAD of §5's 3 questions)

```
Q1.  Show me the SINGLE WORST FAILURE you found.
     (one is enough · the worst one)

Q2.  Of the failures you found, which are:
     (a) bugs that should be fixed before any further reviewer sees this
     (b) gaps that are acceptable for Ring 1 but must be closed for Ring 2
     (c) doctrinal gaps that need code · not docs · to resolve

Q3.  What's the THREAT MODEL I haven't articulated yet?
     (the attack vector you'd try that's NOT in the 15-row table above ·
      most-valuable finding · your specialty)

Q4.  If you were going to certify or refuse to certify this for
     someone you trust to use it daily, what's the single line you'd
     write on the certificate?

Q5.  What's the FIRST thing I should fix on Monday morning?
```

### What to do with his findings

```
FAILURE                     RESPONSE
─────────                   ────────
DEFENDED-but-bug found       Highest priority · log issue · fix this week
                             · convert to test that fails-then-passes
PARTIAL-class finding        Triage · decide if Ring 1 must-fix or Ring 2 hold
GAP-class finding            Most valuable · file as ADR or canon amendment
                             · these are the "where doctrine becomes code"
                             roadmap items
THREAT MODEL ADDITION        Treat as new vector · add row to table above
                             · ship the table update before next reviewer
```

### One critical rule for you (Mumu)

**Do not defend.** When he says "this is a bug," your only verbal responses should be one of:

```
"Show me."
"Got it. What would you have expected?"
"Anything else in that area?"
"Thank you."
```

The moment you start explaining why it's not really a bug, you have stopped Ring-1 review and started PR defense. PR defense burns reviewer time. **Save it for never.** A real bug stays real even if you have a reason for it.

If you genuinely think he's misunderstanding something, write it down and address it after he leaves. Then revisit only if it's still confusing in 24 hours.

### Time-budget for adversarial review

```
0:00 - 0:05     opening + hand him the table
0:05 - 1:30     he probes solo · you watch · take notes silently
1:30 - 2:00     break · he stretches · you read your notes
2:00 - 3:00     deeper probes · he asks questions if needed
3:00 - 3:30     the 5 questions above
3:30 - 4:00     wrap · he leaves · you save notes to disk

Total: 3-4 hours · NOT 30 minutes. This is the cost of a real
red-team engagement and it is worth every minute.
```

---

## §6 · After they leave (5 minutes · your work)

Open a fresh file. Write down:

```
2026-05-18 in-room walkthrough · friend_1 + friend_2 notes

Q1 (surprised):
  friend_1: ...
  friend_2: ...

Q2 (worried):
  friend_1: ...
  friend_2: ...

Q3 (want next):
  friend_1: ...
  friend_2: ...

What patterns showed up in both responses:
  ...

The 3 things I want to fix THIS WEEK based on this:
  1. ...
  2. ...
  3. ...
```

Save this to `~/.dema/memory/ring1_inroom_2026_05_18.md` or similar.

**That file is your first real Ring-1 evidence.** Two trusted humans inspected the system in person and told you what they saw. The trail now includes external witness.

---

## §7 · The next 2 friends

Once you have the notes from the first 2 friends, you have a choice:

```
PATH A · Fix-then-show
   - Address the top 1-3 gaps the first pair identified
   - Then show the next pair the improved version
   - The next pair has a different starting point
   - Total time: maybe 1-2 weeks per gap-fix cycle

PATH B · Show-then-fix
   - Show the next pair the SAME version the first pair saw
   - Compare what they noticed independently
   - Some signals only emerge across multiple reviewers
   - Total time: faster (no fix delay)
   - Risk: you may waste their attention on issues already identified

RECOMMENDED: Path A for the SECOND friend pair, Path B for the third.
   First pair → gap list → fix top 1-3 → second pair → compare → decide.
```

---

## §8 · What this walkthrough does NOT cover (honest negative scope)

```
✗ Installation on a different machine
   The 2 friends are looking at YOUR laptop. If they later want to
   install Dema on their own machine, that's a separate readiness
   conversation. The installer hasn't been hardened for multi-machine
   smooth-onboarding yet.

✗ Connecting their machines as Node1 / Node2
   The 5-node mesh requires Phase 3 readiness (per node0-dema-goal-v0.2).
   That is the next major chapter, not tonight's chapter.

✗ Running missions for real
   Tonight is preview-only inspection. Real mission execution requires
   the governed runtime (separate repo, gated by typed consent phrases).

✗ The full doctrine
   You have ~700 pages of canon, ADRs, memory entries, and field notes.
   Friends in the room do NOT need to read all of it. The 8-command
   walkthrough is the entry point. Doctrine is the depth they can read
   later if they choose.
```

---

## Closing law

```text
Friends in the room beat strangers on the internet.
In-person walkthroughs beat sealed packs sent to inboxes.
Honest questions beat carefully scripted demos.
The 3 questions beat the 5-criterion rubric for a first review.

What I learn from 2 friends tonight will reshape what I show
the next 2 friends. That feedback loop IS the Ring-1 mechanism.
The Lighthouse Pack v1.0 is the BACKUP — for strangers who
will never sit in your room. The walkthrough is the PRIMARY.
```

---

**Authored:** 2026-05-18 GST · Mumu · Dubai
**Use freely tonight.** Adjust the language to your actual voice. The structure is the load-bearing part.
