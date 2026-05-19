# Dema UX Blueprint

This document defines the first shippable Dema experience: a sovereign journey
OS that starts with trust and ends with proof. It does not authorize runtime
execution, Node0 handoff, model inference, receipt minting, token claims,
deployment, or external posting.

## Product thesis

Dema should feel like one continuous journey:

```text
first launch
-> ambient boundary
-> local model inventory
-> mission draft
-> micro-consent preview
-> governed Node0 handoff later
-> receipts and impact posture
```

The first screen must answer four questions:

1. What can Dema see?
2. What will Dema refuse to touch?
3. What would this mission require?
4. What proof would exist when governed runtime work completes later?

## Prior-art signals

| Prior art | Signal to keep | Dema interpretation |
| --- | --- | --- |
| OpenClaw | One understandable agent shape on user hardware. | One local `dema` entry point with visible boundaries. |
| Hermes Agent | Memory, skills, and improving workflow posture. | Diagnostics and self-critique previews before runtime claims. |
| Pi.dev | Small composable terminal harness. | Zero-dependency CLI/TUI surfaces with JSON envelopes. |

Dema's distinction is that sovereignty, micro-consent, and proof are visible UX
objects, not hidden policy notes.

## Journey chapters

| Chapter | User question | Dema surface | Boundary |
| --- | --- | --- | --- |
| 0. First launch | Is this safe on my machine? | `dema setup`, `dema ambient`, `dema models` | Read-only; no model invoked. |
| 1. Mission and consent | What would happen if I asked this? | `dema journey`, `dema mission draft`, `dema consent plan` | Preview-only; no approval. |
| 2. Node0 handoff | When does real work begin? | `dema diagnostics plan`, future handoff JSON | Blocked until governed Node0 consent. |
| 3. Receipts and impact | What evidence remains? | `dema receipts`, `dema report safety` | Local evidence posture only. |

## First mission flow

The target first mission UX is:

```bash
dema journey "Fix auth.py and run pytest"
```

The output must show:

- the mission category and risk,
- proposed file and command permissions,
- analogical warnings when the intent combines audit and external delivery,
- the Node0 handoff status as future/governed,
- the receipt and impact posture as evidence-only,
- a final boundary line.

## Terminal design direction

The TUI style is disciplined cockpit, not chat. Use short headers, chapter
numbers, stable labels, and one final boundary line. Keep dense operator data
scan-friendly without decorative blocks or marketing copy.

Allowed visual language:

- compact chapter labels,
- explicit command paths,
- one-line outcome summaries,
- schema-tagged JSON mirrors.

Avoid:

- hype words,
- hidden background-process language,
- claims of certification,
- value, reward, or public network claims,
- any wording that suggests Dema can execute before governed Node0 consent.

## Current implementation

The first slice is `dema journey [--json] ["<intent>"]`.

It composes the already-safe preview surfaces into one UX path:

- `packages/mission/src/journey.js` builds and formats the journey.
- `dema journey` prints the human terminal preview.
- `dema journey --json` emits `bizra.dema.sovereign_journey_preview.v0.1`.
- `tests/journey.test.js` proves the command is preview-only.

## Boundary

This blueprint is preview-only. It does not approve consent, mint capabilities,
handoff to Node0, execute commands, mutate files, invoke models, create
receipts, or claim impact certification.
