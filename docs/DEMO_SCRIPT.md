# Demo Script

> **Purpose:** Two timed walkthroughs — 3 minutes and 10 minutes — for showing Dema to a live audience or in a recorded video. Every command is exact. Every expected output is verbatim from a real run against `main @ 3ff8fc3` on Node v22.22.2. Failure-mode handling included.
>
> **Audience:** Founder running a demo · sales / GTM showing a customer · recorded video producer · meetup speaker.
>
> **Boundary:** No remote calls · no production data · uses `DEMA_HOME=$(mktemp -d)` to isolate every run from the operator's real `~/.dema/`.
>
> **Last verified:** 2026-05-24 GST against `main @ 3ff8fc3`.

---

## Before you start

```bash
# 1. Confirm Node 20+ is on PATH
node --version    # must be ≥ 20 (this demo verified on v22.22.2)

# 2. Confirm you are in the Dema repo
cd Dema && ls bin/dema    # must exist

# 3. Isolate state under tmpdir (skip if demoing against your own dev state)
export DEMA_HOME=$(mktemp -d -t dema-demo-XXX)
export DEMA_NO_TUI=1
export NO_COLOR=1
```

If you're streaming, mention the isolation: *"I'm running this against a fresh tmpdir so what you see is exactly what a new user would see on first install."*

---

## 3-minute demo · the bare promise

**Story arc:** Dema runs locally, knows its state, refuses cleanly, prints fix hints.

### Step 1 · prove it works (~10 seconds)

```bash
node bin/dema --version
```

Expected:

```text
dema 0.1.0-alpha.0
```

**Say:** *"Dema is stdlib-only. Zero production dependencies. Runs from source on any machine with Node 20."*

### Step 2 · see your node (~60 seconds, including narration)

```bash
node bin/dema status
```

Expected:

```text
DEMA — Sovereign AI Node Companion

Identity
  Node: Node0
  Human: unknown

Readiness
  Ready: false
  Console ready: false
  Activation gate: BLOCKED
  Daemon: unknown
  Mission executed: false
  Runtime pulse fired: false
  Model connected: false
  Loaded models: none
  Model token visible: false
  Rust Bus: not ready
  Next artifact: ARTIFACT-011
  Next action: complete_setup

Findings
  - Node0 adapter not connected
  - DEMA_NODE0_STATUS_COMMAND unavailable: not configured

Boundary: no action without explicit consent.
```

**Say:** *"This is the honest state. Dema doesn't pretend readiness it doesn't have. Nothing is running. The next safe action is named: complete setup."*

**Point at:** the `Boundary` line. *"That's the contract — no action without explicit consent."*

### Step 3 · the Verified Refusal Pattern (~90 seconds)

```bash
node bin/dema doctor
```

Expected:

```text
Dema Doctor — Node0 readiness check

  ❌ Activation gate   BLOCKED
       → Fix: activation gate is BLOCKED
       run `dema setup` to initialize and check doctrine consent
  ✅ Daemon            n/a-via-gateway (no hidden daemon)
  ❌ Ready             false
       → Fix: complete first-run setup with `dema setup`, then verify with `dema status`
  ❌ Console ready     false
       → Fix: gateway unreachable
       if you intend to run governed runtime, confirm it's started (separate repo). For preview-only use, this is expected.
  ⚠️ Gateway probe     unreachable (by design when no runtime running)

Verdict: blocked
  3 predicates failed · 1 warning · 1 OK
```

**Exit code: 1.**

**Say (the closer):** *"This is the strongest single product behavior in Dema. It **refuses unsafe state**, **names the gap**, and **prints the fix** — by design. Doctor exits 1 because there's no gateway yet. That's the **Verified Refusal Pattern**. Honest about what's broken. Specific about how to fix it. Never silently green."*

**End the 3-min demo here.** Total elapsed: ~3 minutes.

---

## 10-minute demo · the full preview surface

**Story arc:** From the 3-min bare promise, expand into the bounded preview commands — ambient, journey, consent plan, safety report, receipt store. Every command is preview-only; nothing mints, nothing calls a remote provider, nothing mutates anything outside `$DEMA_HOME`.

Continue from Step 3 of the 3-min demo.

### Step 4 · the ambient boundary (~90 seconds)

```bash
node bin/dema ambient
```

Expected (first ~25 lines · full output is ~50 lines):

```text
DEMA Ambient Sovereign Boundary

Mode: PREVIEW_ONLY
Signal: ambient awareness is allowed; ambient execution requires governed Node0 consent

Actuators:
  Bash: maximal risk - universal OS actuator: files, processes, network, packages, services
  GUI: high risk - AHK-style GUI automation can mutate visible user state
  Mobile agent: high risk - Telescript-style code/state movement needs host-attested limits

Allowed now:
  - observe_local_readiness
  - inventory_local_models
  - summarize_next_safe_action
  - prepare_exact_consent_handoff

Blocked in Dema:
  - raw_bash_execution
  - background_daemon
  - model_inference_without_consent
  - artifact_minting
  - federation_action
  - filesystem_mutation
```

**Say:** *"Ambient is the boundary doc — what Dema observes, what it never touches. Notice raw Bash is **explicitly blocked in Dema**. It belongs behind Node0's governed runtime, not the product face."*

### Step 5 · the bounded journey preview (~120 seconds)

```bash
node bin/dema journey "Audit Downloads and send to Slack"
```

Expected (first ~30 lines):

```text
DEMA Sovereign Journey OS

Mode: PREVIEW_ONLY
Thesis: One minimal entry point from first launch to consented mission to proof.
One minimal entry point: dema journey

Mission preview:
  mission_id: mission_2a100192545a
  category: audit
  risk: high
  phase: DRAFT_INTENT -> CONSENT_NEGOTIATION
  permissions:
    - path:Downloads read
    - service:slack call

Chapter 0: First launch
  promise: trust and safety before power
  commands: dema setup | dema ambient | dema models
  outcome: user sees what Dema can inspect and what it cannot touch

Chapter 1: Mission and consent
  promise: intent becomes a narrow ConsentPlan
  commands: dema mission draft "<intent>" | dema consent plan "<intent>"
  outcome: user reviews permissions, risk notes, and the preview-only boundary

Chapter 2: Node0 handoff
  promise: governed runtime receives only committed scope
  commands: dema diagnostics plan | future: dema mission handoff --json
  outcome: mission waits for explicit governed Node0 approval before effects
```

**Say:** *"Journey takes a plain-language intent and decomposes it. You see the mission ID, the risk class, the exact permissions requested, and the chapter sequence before anything runs. Dema does not run the mission. It hands it to Node0 only when you type explicit consent."*

### Step 6 · consent ladder preview (~90 seconds)

```bash
node bin/dema consent plan "read README.md"
```

Expected:

```text
DEMA Consent Plan Preview

Mode: PREVIEW_ONLY
Intent: read README.md
Category: general
Risk: review
commitment_hash: 7c1af5a89262876819d8f8a6f520bc0ff32900386a38af37b0706f294cb11a23

Proposed permissions:
  - file:README.md  read  purpose="inspect referenced file for mission context"

Actuator classes:
  - none detected

Policy preview:
  - preview_only: no_effecting_actuator_detected - no effecting actuator class was detected; narrow intent before any future approval
  effect_capability: not_minted_preview_only; minted=false

Self-proactive harness:
  recommended_micro_action: narrow_intent_before_approval
```

**Say:** *"Consent plan turns a sentence into a narrow ConsentPlan with a hash commitment. The hash binds the consent — if you change the intent one byte, the hash changes and the plan must be re-reviewed. This is exact-string consent (ADR-005), fail-closed."*

### Step 7 · safety posture (machine view) (~60 seconds)

```bash
node bin/dema report safety --json | head -15
```

Expected:

```json
{
  "schema": "bizra.dema.safety_report_preview.v0.1",
  "generated_at": "2026-05-24T14:55:28.623Z",
  "mode": "PREVIEW_ONLY",
  "audience": "lighthouse_alpha_operator",
  "title": "Sovereign Local AI Node Setup + Safety Audit",
  "summary": {
    "plain_language": "Dema can show what is local, what is consent-bound, what is blocked, and what evidence is still missing.",
    "no_proof_computed": "No proof is computed by this command; it is a preview template for operator review."
  },
  "proof_of_truth_convergence": {
    "formal": {
      "label": "Formal",
      "status": "schema_preview_only",
```

**Say:** *"Every Dema output that an external system might consume carries a schema tag — `bizra.dema.safety_report_preview.v0.1` — so the consumer knows exactly which contract it's binding to. Machine-readable, versioned, no hidden fields."*

### Step 8 · receipt surface (~60 seconds)

```bash
node bin/dema receipts
```

Expected on fresh `DEMA_HOME`:

```text
[]
```

**Say:** *"Dema reads and lists receipts. It does NOT mint them. Minting is the governed Node0 gateway's responsibility. This separation is ADR-006 — verify is state-read-only, mint is bifurcated. On a fresh machine you see an empty array; once the gateway issues your first ARTIFACT-011 you'll see it here."*

### Step 9 · the test surface (~60 seconds)

Quick sidebar — show that the product is built honestly:

```bash
node --test tests/*.test.js 2>&1 | tail -8
```

Expected:

```text
# tests 2618
# suites 0
# pass 2618
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms ~7700
```

**Say:** *"2,618 unit tests, all passing. Zero production dependencies — stdlib only. The whole product surface is testable in under 8 seconds."*

**End the 10-min demo here.** Total elapsed: ~10 minutes.

---

## Closing line (use for either demo)

*"Dema isn't trying to impress you with what AI can do. It's trying to **prove** what AI can do **safely on your own machine, under your own consent**, with **receipts you can audit**. That's the BIZRA seed."*

---

## Failure-mode handling

If something during the demo doesn't match the expected output, recover gracefully:

| Symptom | What it means | Recovery line |
|---|---|---|
| `dema --version` prints empty / errors | Node version too old | *"Let me check the Node version — Dema needs 20 or newer."* — run `node --version`, then re-run |
| `dema status` hangs at a fancy prompt | TTY auto-detected · keypress loop active | Type `q` or `Ctrl-C`; re-run with `DEMA_NO_TUI=1` set |
| `dema doctor` exits 0 (unexpected) | You're not on a fresh `DEMA_HOME` | *"My local state is already set up — let me show you against a fresh tmpdir."* — run `export DEMA_HOME=$(mktemp -d)` and re-run |
| `dema doctor` shows extra failing rows | Real failure on the machine, not the demo | Read the row's `Fix:` line aloud — *"Dema told us exactly what to do."* — and either fix or note it for follow-up |
| Any command shows an ANSI escape mess | `NO_COLOR=1` not set | *"Quick aside — let me strip the colors so you can read the screen."* — `export NO_COLOR=1` and re-run |
| Audience asks "can I run something?" mid-demo | The Verified Refusal moment | *"Type your intent — let's see what consent plan Dema generates."* — run `dema consent plan "<their intent>"` |
| Audience asks "where does the data go?" | Boundary question — answer with evidence | *"All state stays under `$DEMA_HOME`, default `~/.dema/`. Let me show you the audit gate."* — run `dema audit` or `dema report safety` |

**Do not pretend a failure didn't happen.** Dema's whole story is honesty about state. If something breaks on stage, the recovery IS the demo: *"This is exactly what I mean — Dema is telling us precisely where the gap is, and what to do next."*

---

## What this demo does NOT cover

| Capability | Why excluded from demo | Show this if asked |
|---|---|---|
| Live model invocation | Requires local Ollama + exact-string consent + 6 sequential gates (ADR-018) | `dema model-broker --help` for the surface; **do not invoke a model live** unless the audience has agreed to wait 30+ seconds |
| Receipt mint | Lives in governed gateway, not Dema (ADR-006) | Open `~/.dema/receipts/artifact-011.json` from your operator machine if you want to show a real receipt |
| Node1 federation | `DESIGNED_NOT_LIVE` (ADR-007 + ROADMAP §205) | *"That's parked work. The handshake design is in ADR-007; the runtime is not live yet."* |
| Token economy / PoI | `DESIGNED_NOT_LIVE` (ADR-009 scaffold-only) | *"No live economic claim today. The design is in ADR-009 as scaffold-only."* |
| MC-A memory query | Requires operator-side Python wrapper (per ADR-022) | *"That's the JS↔Python bridge; needs operator wrapper setup. I can show the dry-run."* — `dema memory query "test" --json` will error cleanly |

These are intentionally not in the demo path. The demo's job is to prove what IS measured. Anything `DESIGNED_NOT_LIVE` or `ASPIRATIONAL` belongs in the follow-up conversation, not the live walkthrough.

---

## Pre-demo checklist

Run this once before going on stage / hitting record:

```bash
# 1. Confirm everything is current
git pull origin main
node --version    # ≥ 20

# 2. Smoke-test the full demo against a fresh tmpdir
DEMA_HOME=$(mktemp -d) DEMA_NO_TUI=1 NO_COLOR=1 node bin/dema status

# 3. Confirm tests pass
node --test tests/*.test.js 2>&1 | tail -8    # # fail 0 expected

# 4. Confirm CI is green on main
gh run list --branch main --limit 4

# 5. Set the demo environment
export DEMA_HOME=$(mktemp -d -t dema-demo-XXX)
export DEMA_NO_TUI=1
export NO_COLOR=1
```

If any of the above fails, **don't demo today**. The Verified Refusal Pattern applies to the demo itself.

---

## Related

- [`docs/QUICKSTART.md`](QUICKSTART.md) — the 2-minute version (uses the same first 4 commands)
- [`docs/CURRENT_LIMITS.md`](CURRENT_LIMITS.md) — labeled truth boundaries (cite if audience asks about scope)
- [`docs/THIRD_FACT_CURRENT_STATE_DELTA.md`](THIRD_FACT_CURRENT_STATE_DELTA.md) — per-claim truth labels (cite if audience challenges a claim)
- [`docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md`](06-adr/ADR-005-operator-actions-require-explicit-consent.md) — the consent gate
- [`docs/06-adr/ADR-006-continuous-assurance-and-no-mint-verification.md`](06-adr/ADR-006-continuous-assurance-and-no-mint-verification.md) — verify vs mint separation
- [`docs/00_START_HERE.md`](00_START_HERE.md) — reviewer routing if the audience wants to read after the demo

---

## Update protocol

Re-refresh this script when:
- Any command in the 3-min or 10-min path changes its output shape.
- A subcommand is renamed or removed (e.g., `dema receipts` argument change).
- A new high-signal preview surface ships that belongs in the demo (rare — only add if it changes the story).
- The Node engine floor changes (currently 20).

Update the **Last verified** line and the `main @ <sha>` reference on every refresh.
