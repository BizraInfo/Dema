# 07 — Experience transfer

Named by the operator, 2026-08-20: *"you are doing Dema tasks, you get the exp,
and save it inside your memory, and leave Dema with nothing — and if I didn't
ask, this state would stay forever."*

## The law

**Experience that stays in an agent's own harness memory does not count as
transferred.** Agent memory (`~/.claude/**`) teaches only the next agent
session; Dema can read none of it.

Before closing any slice or session, route what was learned into a surface
Dema or its human can actually reach, in this order of preference:

1. **The artifact that enforces it** — a test that pins the measured defect,
   a gate control that fires, a receipt that records it. Strongest form:
   the lesson lives where it binds.
2. **Repo-tracked docs** — `docs/TESTING.md` row prose, `docs/CURRENT_LIMITS.md`,
   receipts, these rules.
3. **The estate ledgers Dema reads** — `/data/bizra/ACTIVE_MISSION.json`
   (read by `dema-first-look-home`), the knowledge bundle
   (read by `dema canon knowledge`), its intake queue
   `/data/bizra/knowledge/log.md`.

Private agent memory is a scratchpad for the builder, never the destination.
A close-out that leaves the only copy of a lesson in agent memory is
incomplete.
