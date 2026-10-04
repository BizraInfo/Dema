# Episodic Ledger

truth_status: TEMPLATE_WITH_RECENT_EVENTS

Use one entry per important mission episode. Do not treat chronological notes as proof unless each entry links to evidence.

## 2026-08-25 — remote-write correlation correction

- observation: non-loopback listeners existed;
- old diagnosis: listener exposure directly implied external write path;
- correction: `ExternalReachability != ExternalWriteAuthority`;
- new state: reachability-only evidence -> INCOMPLETE -> UNKNOWN;
- effect on Node0: remains OPEN; no false GREEN gained.

## 2026-08-25 — PAT/SAT negative control

- PAT proposal path live;
- advisory LLM judge incorrectly accepted invalid cases;
- deterministic SAT became authoritative and rejected malformed/forbidden cases;
- lesson: model judgment is advisory where deterministic acceptance law exists.

## 2026-08-25 — G6 promotion candidate

- local candidate qualified on exact candidate bytes in a fresh clone;
- TASK-080 red scaffold excluded by declared deterministic transform rather than weakening tests;
- status: awaiting/using exact local commit transition; not remote canon.
