# Dema First-Run Wizard v0.1

The first-run wizard turns a fresh Dema install into a safe local status screen without requiring a user to understand the full BIZRA ecosystem.

Scope note: this file is the in-product screen spec. The plain-language user journey lives in [USER_LIFECYCLE.md](USER_LIFECYCLE.md), and the full docs map lives in [INDEX.md](INDEX.md).

## Goal

A non-technical user should understand this in the first minute:

```text
Dema runs locally first.
Dema asks before acting.
Dema can show receipts for important steps.
```

## Flow

```text
Welcome
-> Privacy mode
-> Profile
-> Model detection
-> Local health check
-> Receipt folder
-> First safe action preview
```

## Screens

### 1. Welcome

Message:

```text
Welcome to Dema.
Dema -- Sovereign AI Node Companion

Local-first. Consent-bound. Receipt-aware.
BIZRA is the ecosystem. Dema is the product face.
```

Primary action: `Start guided setup`

### 2. Privacy mode

Default: local-only.

The wizard must explain that local memory stays on the user's machine unless the user changes the boundary later.

### 3. Profile

Collect only the minimum:

- preferred display name
- local memory preference
- receipt folder location

No cloud account is required for the local-first path.

### 4. Model detection

Detect local model surfaces such as LM Studio or Ollama when available.

If no model is detected, the wizard should continue and show a clear blocked status rather than pretending readiness.

### 5. Local health check

Show:

- profile present
- receipt folder present
- local model status
- Node0 adapter status
- consent gate state

### 6. Receipt folder

Create or confirm the receipt folder.

The wizard must make clear that receipts are local evidence records, not marketing claims.

### 7. First safe action preview

The wizard may propose ARTIFACT-011 as the next safe action.

It must never execute ARTIFACT-011.

## Non-negotiables

- Do not start a hidden daemon.
- Do not execute a mission.
- Do not issue ARTIFACT-011.
- Do not change an existing profile without explicit user action.
- Do not route to external providers from the first-run wizard.
- Do not use hype language.

## CLI parity

The CLI equivalent is:

```bash
dema welcome
dema onboard
dema setup
dema status
dema diagnostics plan
dema consent plan "Check my local node health"
dema mission draft "Check my local node health"
dema report safety
dema receipts
```

These CLI commands mirror the safe preview journey. They must not start runtime, connect Node1/Node2, or issue ARTIFACT-011.

## Reader handoff

After the wizard, a user should know where to go next:

- [USER_LIFECYCLE.md](USER_LIFECYCLE.md) for the end-to-end local journey.
- [RECEIPTS.md](RECEIPTS.md) for proof records.
- [ECOSYSTEM.md](ECOSYSTEM.md) for how Dema relates to BIZRA Node0 and the wider system.
