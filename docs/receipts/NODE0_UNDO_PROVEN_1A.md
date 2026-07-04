# Receipt: NODE0-UNDO-PROVEN-1A

Truth label: `NODE0_UNDO_PROVEN_PREVIEW_ONLY`

## Slice

Measured inverse-correction preview: compose reversible execute gate output with
backup-anchored undo proof (`restored_hash === backup_hash`).

## Proof

```bash
node --test tests/node0-undo-proven-preview.test.js
node scripts/review/node0-undo-proven-preview-check.mjs
npm test
npm run check
```

## Boundaries

Sandbox-only preview. No live RL, no mint, no production rollback claims.
