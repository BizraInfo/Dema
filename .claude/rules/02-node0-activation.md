# 02 — Node0 activation

Activation sequence (never skip steps):

```text
observe → verify → benchmark → route → dry-run → activate
```

| Step | Dema surfaces |
| --- | --- |
| observe | `dema node0 activation observe` · `packages/core/src/node0-activation-observe.js` |
| verify | receipts, proof-room, onboarding seal |
| benchmark | `dema models discover` · `dema eval baseline` · `dema eval compare` |
| route | `dema eval route` routing preview (PREVIEW_ONLY; `eval compare` is the baseline delta) |
| dry-run | council/mission previews with boundary all-false |
| activate | **outside Dema repo** — requires BIZRA-DATA-LAKE + explicit GO |

The executable status mirror is the 9-rung kernel ladder (`dema node0 ladder` ·
`packages/core/src/node0-activation-ladder.js`) — the disk source of truth. This
6-step sequence is the canonical summary; `SHIPPED` on a rung means the surface
exists on disk, not that the rung is runtime-correct.

If Node0 cannot be observed truthfully, do not activate or claim live runtime.

Proactive pilot (`node0_activate.py`) lives in BIZRA-DATA-LAKE, not this repo.
