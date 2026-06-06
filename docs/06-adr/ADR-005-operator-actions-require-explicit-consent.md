# ADR-005: Operator Actions Require Explicit Consent

**Status:** Accepted
**Date:** 2026-04-17
**Decision makers:** Mumu (Mohamed Beshr)

## Context

Browser and computer operator modes give DEMA real-world agency — clicking links, reading files, running commands, launching apps. This is powerful but dangerous.

Market products handle this inconsistently:

- Some auto-act and apologize later
- Some ask for permission in ways that train users to click "yes" reflexively
- Some provide no audit trail of what was done

BIZRA doctrine requires constitutional proof. Every action must be sanctioned, visible, and reversible where possible.

## Decision

All operator actions (Browser mode, Computer mode) require explicit consent:

1. **Pre-action disclosure:** DEMA shows exactly what it intends to do before doing it
2. **Granular consent:** per-action, not blanket "allow all"
3. **Visible action log:** every action produces a timestamped, inspectable entry
4. **Stop anytime:** user can halt execution mid-action with immediate effect
5. **Reversibility signal:** each action is tagged as reversible or irreversible
6. **Sandbox default:** browser operator uses isolated context; computer operator uses bounded path access
7. **Receipt generation:** completed actions produce receipts in the BIZRA chain

## Consequences

- No "surprise" actions — user always sees before it happens
- Action panel shows pending, active, and completed actions
- Irreversible actions get a distinct visual warning
- Bulk-approve is available but opt-in and scoped
- Audit log captures full action history for compliance
- Human takeover is instant — DEMA yields control immediately on stop
