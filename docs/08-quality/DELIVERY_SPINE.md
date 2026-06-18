# Delivery Spine (quality enforcement)

This document describes the **DEMA-QUALITY-DELIVERY-SPINE-1A** slice: one delivery spine connecting UX, proof, security effect boundaries, performance budgets, and `npm run check`.

Related canon:

- `docs/DELIVERY_SPINE_v0_1.md` — historical delivery spine narrative
- `docs/DELIVERY_BLUEPRINT.md` — elite full-stack blueprint
- `docs/08-quality/QUALITY_GATES.md` — gate reference

## Problem

Design intent existed (cockpit, realm home, homebase preview) but **default `dema` showed internal debug language** (Ring 0, URP, gateway unreachable, gather timing). Delivery enforcement was missing.

## Fix

1. **Default face** → `packages/core/src/dema-first-look-home.js`
2. **Technical preview** → `dema homebase` (former bare `dema` behavior)
3. **Automated gates** → `scripts/review/ux-first-look-gate.mjs`, `delivery-readiness-gate.mjs`, `performance-budget-gate.mjs`
4. **CI wiring** → `scripts/check.mjs`

## PR boundary

```text
No runtime activation.
No mission execution.
No daemon.
No key generation.
No signing.
No Block0 seal.
No federation.
No token/PoI runtime.
No broad scan.
Rendering and quality gates only.
```

## Definition of done

- [x] `dema` renders human-first home
- [x] `dema doctor` preserves technical diagnostics
- [x] `dema homebase` preserves technical homebase preview
- [x] `dema realm --debug` exposes internal status
- [x] Gates wired into `npm run check`
- [x] Unit tests for first-look, UX gate, delivery readiness
