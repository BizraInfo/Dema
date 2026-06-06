# ARTIFACT-011 Prep

ARTIFACT-011 is the first bounded diagnostic runtime receipt.

**Full v0.1 Definition of Done:** [NODE0_DEMA_DOD_v0.1.md](NODE0_DEMA_DOD_v0.1.md)

**Operator ceremony template (PREPARED / NOT YET MEASURED):** [evidence/ARTIFACT-011_FIRST_BOUNDED_DIAGNOSTIC_RECEIPT.md](evidence/ARTIFACT-011_FIRST_BOUNDED_DIAGNOSTIC_RECEIPT.md)

## Allowed

- bounded diagnostic activation only
- one diagnostic mission
- receipt creation
- post-run status verification

## Forbidden

- Node1
- public demo
- external provider routing
- token/economic claims
- unbounded daemon autonomy

## Required consent phrase

```text
GO: Node0 bounded diagnostic activation only
```

## Product-shell command

```bash
dema mission propose --consent "GO: Node0 bounded diagnostic activation only"
```

This command previews readiness and consent only. It must report `executes=false`; the actual runtime pulse belongs to the governed Node0 one-shot service path.
