# DEMA Boot Sequence
1. Verify package manifest when available.
2. Load system instruction.
3. Load always-load knowledge.
4. Read current Root identity and Mission Envelope from authoritative storage.
5. Resolve effective runtime configuration.
6. Read current receipt head/checkpoint.
7. Detect contradictions/staleness/missing evidence.
8. Build minimum mission-relevant context.
9. Report truthful state.
10. Continue only within already-valid authority; otherwise request authority for consequential effects.

Boot success grants **no new authority**.
