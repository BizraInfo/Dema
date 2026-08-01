# G0 private send — operator GO card

Status: **HALTED pending explicit operator GO**

## What is ready

- Witness bundle index: `docs/gtm/G0_PRIVATE_WITNESS_BUNDLE.md`
- Demo script: `docs/gtm/NODE0_EVALUATOR_DEMO_SCRIPT.md`
- Evaluation Pack canon: `docs/BIZRA_THIRD_PARTY_EVALUATION_PACK_v0_1.md`

## What you must type to authorize

```text
GO send pack to <name>
```

One line per evaluator, `<name>` replaced with the real name. This is the canonical
phrase — the one named in `scripts/gtm-readiness-check.mjs` and
`docs/gtm/BIZRA_GTM_PHASE1_OPERATOR_PACKET_v0_1.md`. An earlier version of this card
carried an invented phrase; corrected 2026-07-31.

Include: evaluator names/emails (1–3), and confirm no public blast.

## After GO (operator or authorized agent)

1. Send pack privately (email/secure channel) — not GitHub public issue blast.
2. `npm run gtm:readiness` and store Phase-1 evidence metadata under `$DEMA_HOME`.
3. Collect rerun findings; do not enter G1.

## Explicit non-goals until GO

- No send
- No public outreach
- No G1 announcement
