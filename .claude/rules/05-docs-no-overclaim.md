# 05 — Docs and no-overclaim

Before public-facing or README/GTM wording: read `docs/CLAIM_REGISTER_v0_1.md` and `docs/CURRENT_LIMITS.md`.

Promoting `PLANNED` → `MEASURED` requires:

1. Implementing code + tests in the same slice.
2. Updating `CURRENT_LIMITS.md` in the same PR.
3. Passing `npm run eval:layer1` for structured artifacts where applicable.

`docs/ARCHITECTURE.md` is large — prefer narrow ADRs (`docs/06-adr/`) for new boundaries.

Historical/noise lives under `docs/_absorbed/` and `docs/archive/` — do not treat as live canon.

Skill: `.claude/skills/no-overclaim-review/` for paste-back reviews.
