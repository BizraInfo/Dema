# Dema

**Your sovereign AI node companion.**

Dema helps you run a private AI workspace on your own machine -- with memory, safe actions, receipts, and a clear next step.

Local-first.
Consent-bound.
Receipt-backed.
No coding required.

```text
Install Dema
-> create your profile
-> connect a local model
-> see your node health
-> approve one bounded action
-> receive your first proof receipt
```

BIZRA is the ecosystem.
Dema is the door.

---

## The 60-second version

Dema is for people who want local AI without invisible autonomy.

It shows:

- what is ready on your machine
- what is blocked
- what Dema can safely preview
- what requires your exact consent
- what receipt will prove the result

Dema does not ask you to trust a black box. It tells you what it knows, what it will not touch, and what the next safe action is.

---

## First run

```bash
dema welcome
dema setup
dema journey "Fix auth.py and run pytest"
dema models
dema ambient
dema ambient --manifest
dema ambient audit
dema diagnostics plan
dema consent plan "Fix auth.py and run pytest"
dema mission draft "Fix auth.py and run pytest"
dema report safety
dema status
dema doctor
dema mission propose
```

Expected first impression:

```text
Welcome to Dema.

Your node is local-first.
Your actions are consent-bound.
Your important steps can produce receipts.

Next:
1. Run setup
2. Check status
3. Preview first bounded diagnostic
```

`dema mission propose` is a preview command. It checks readiness and consent state, then stops. It does not start a daemon, execute work, or create the first runtime receipt.

---

## Sovereign journey

Use:

```bash
dema journey "Fix auth.py and run pytest"
```

This is the one-screen journey preview: first launch, safety boundary, mission
draft, consent scope, Node0 handoff, and receipt/impact posture. It is a
terminal UX guide, not a runtime command. It does not approve consent, hand work
to Node0, execute commands, mutate files, invoke models, or mint receipts.

For a schema-tagged machine view:

```bash
dema journey --json "Audit Downloads and send to Slack"
```

---

## Ambient boundary

Use:

```bash
dema ambient
```

This shows the Ambient Sovereign Execution boundary. Dema may observe local
readiness, inventory local models, and prepare a consent handoff. It does not
run Bash, start a daemon, invoke a model, mutate files, mint artifacts, or
federate. Raw Bash belongs behind Node0's governed EffectCap runtime, not in
the Dema product face.

For a schema-tagged machine view:

```bash
dema ambient:json
```

For a zero-trust capability manifest preview:

```bash
dema ambient --manifest
dema ambient --manifest --json
```

This emits a hash-committed machine-readable manifest for the current Dema
boundary: readable symbolic paths, no writable paths, no executable commands,
no network access, and no foreign personal data. Signing is explicitly deferred
to governed Node0 because Dema does not issue identity-bound artifacts.

For the SNR/SAPE compliance view:

```bash
dema ambient audit
dema ambient audit --json
```

This compresses the Bash/AHK/Telescript actuator risk into one preview-only
audit: intent, micro-consent, capability, effect, evidence, impact. It names the
HHMM phases, Proof-of-Truth posture, and next one-node/one-mission diagnostic
without enabling execution.

---

## Consent planning

Use:

```bash
dema consent plan "Fix auth.py and run pytest"
```

This drafts a micro-consent scope from a plain-language intent. It maps obvious
files, commands, and services into structured permissions, computes a
commitment hash over the proposed permission set, and flags risky analogies
such as audit-shaped work that requests external delivery.

This is still preview-only. It does not approve consent, mint capabilities, run
Bash, call a model, mutate files, or create a receipt. The resulting scope must
be reviewed and handed to Node0's governed EffectCap runtime before any effect.

For a schema-tagged machine view:

```bash
dema consent plan --json "Audit Downloads and send to Slack"
```

---

## Diagnostics plan

Use:

```bash
dema diagnostics plan
```

This previews the self-proactive diagnostics mission: local model inventory,
ambient boundary, safety report, `npm test`, `npm run check`, and Node0
self-check verification. It is the Dema-facing harness for self-critique, but it
still does not run commands. Execution belongs behind explicit consent in the
governed Node0 runtime.

For a schema-tagged machine view:

```bash
dema diagnostics plan --json
```

---

## Mission drafting

Use:

```bash
dema mission draft "Fix auth.py and run pytest"
```

This converts plain-language intent into a schema-tagged MissionDraft and embeds
the matching ConsentPlan preview. The mission stays in `DRAFT_INTENT`; the next
phase is `CONSENT_NEGOTIATION`. Dema does not approve the scope, mint EffectCaps,
execute commands, or create receipts.

For a schema-tagged machine view:

```bash
dema mission draft --json "Audit Downloads and send to Slack"
```

---

## Local models

Use:

```bash
dema models
```

This reads local model inventory from Ollama, LM Studio, and model files under
`~/Downloads` without invoking a model, mutating files, or minting a receipt. It
also flags model servers that appear LAN-exposed and model names that require an
explicit operator routing decision.

---

## Safety report

Use:

```bash
dema report safety
```

This previews Dema's safety posture for a lighthouse alpha operator: local-only
boundaries, proof gaps, self-critique, and the demo loop to run before talking
to another user. It is not a certification command. It does not compute proof,
invoke a model, execute work, mutate files, start a daemon, or mint a receipt.

For a schema-tagged machine view:

```bash
dema report safety --json
```

---

## Install

### Guided installer

Download Dema, open it, and follow the first-run wizard.

The wizard guides you through:

1. Welcome
2. Privacy mode
3. Profile
4. Model detection
5. Local health check
6. Receipt folder
7. First safe action preview

### Terminal install

The terminal installer endpoint is planned for the packaged alpha release. Until release assets are published, use the developer install below.

Planned Linux / macOS command:

```bash
curl -fsSL https://install.bizra.ai/dema/install.sh | sh
```

Planned Windows PowerShell command:

```powershell
irm https://install.bizra.ai/dema/install.ps1 | iex
```

Each script's SHA-256 hash is published in [docs/INSTALLER_ARCHITECTURE.md](docs/INSTALLER_ARCHITECTURE.md) at every release tag. Operators can verify the bytes match before execution. The endpoint also hosts uninstall scripts at `/dema/uninstall.sh` and `/dema/uninstall.ps1`, plus a small index page at `/dema/`.

### Developer install

```bash
git clone https://github.com/BizraInfo/Dema
cd Dema
npm install
npm test
npm run check
```

---

## What setup creates

`dema setup` creates local state in your Dema home directory, usually `~/.dema`:

```text
~/.dema/
  profile.json
  config.local.json
  receipts/
  memory/
  logs/
  skills/
```

Setup is idempotent and non-destructive. If a profile or config already exists, Dema leaves it in place.

Setup does not start a background process.
Setup does not execute a mission.
Setup does not issue ARTIFACT-011.

---

## Receipts

A receipt is Dema's way of saying:

```text
what happened,
what did not happen,
what evidence exists,
and what the next safe action is.
```

Use:

```bash
dema receipts
dema receipts ARTIFACT-011
```

Learn more in [`docs/RECEIPTS.md`](docs/RECEIPTS.md).

---

## Product promise

Dema says:

> Here is what I know.  
> Here is what is safe.  
> Here is what is blocked.  
> Here is what I can preview with your consent.
> Here is the receipt.

---

## Current boundary

ARTIFACT-011 — the first bounded-diagnostic receipt — was issued on
**2026-05-06** by the governed runtime path (gateway POST `/missions`,
admissibility verdict PERMIT). The local mirror lives at
`~/.dema/receipts/artifact-011.json` and is viewable via `dema receipts`.

The exact consent phrase that gated the issuance was:

```text
GO: Node0 bounded diagnostic activation only
```

That phrase is **not** a re-usable token. Each future L4 mission requires
its own typed phrase per the
[Dema Autonomy Envelope](docs/02-architecture/dema-autonomy-envelope.md).
Issuance never happened *inside* this repo — Dema reads and lists; the
governed runtime in `bizra-cognition-gateway` (upstream, in
`bizra-data-lake`) is what creates receipts. See
[`SPROUT_PIN.md`](SPROUT_PIN.md) for the captured chain head, Bitcoin
state, and replay recipe.

Dema's public language remains local-first, consent-bound, and proof-safe.

---

## Proof of priority

Dema's three founding documents are anchored on Bitcoin via OpenTimestamps. The algorithm and root are **reproducible from this repo** with Node ≥20:

```bash
npm run priority-anchor:verify
```

Canonical state lives in [`proof-of-priority/PIN.md`](proof-of-priority/PIN.md). Spec in [`docs/PRIORITY_ANCHOR.md`](docs/PRIORITY_ANCHOR.md).
