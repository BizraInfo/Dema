# Phase 03 — TDD Anchors

## Test file

`tests/external-pattern-registry-preview.test.js`

Mirrors the existing test pattern of `tests/node0-homebase-state-preview.test.js` (commit `13f32c5`) and `tests/shared-urp-world-preview.test.js` (commit `13f32c5`).

## Test cases

### T-01 · Schema constant is emitted

```text
const preview = buildExternalPatternRegistryPreview();
assert.equal(preview.schema, EXTERNAL_PATTERN_REGISTRY_PREVIEW_SCHEMA);
assert.equal(preview.schema, "bizra.dema.external_pattern_registry_preview.v0.1");
```

### T-02 · Mode and truth label are PREVIEW_ONLY and DECLARED

```text
assert.equal(preview.mode, "PREVIEW_ONLY");
assert.equal(preview.truth_label, "DECLARED");
```

### T-03 · Operating canon is exactly 7 lines

```text
assert.equal(preview.operating_canon.length, 7);
assert.deepEqual(preview.operating_canon, [
  "Observe the giant.",
  "Extract the pattern.",
  "Translate into BIZRA primitive.",
  "Put behind consent + EffectCap.",
  "Record with EvidenceChain.",
  "Expose through DEMA UX.",
  "Only then allow use."
]);
```

### T-04 · Pattern set has 8-16 entries

```text
assert.ok(preview.pattern_count >= 8);
assert.ok(preview.pattern_count <= 16);
assert.equal(preview.patterns.length, preview.pattern_count);
```

### T-05 · Every pattern has the required keys

```text
const REQUIRED_KEYS = [
  "source", "extracted_peak", "bizra_binding",
  "micro_consent_field_required", "sat_verdict_required",
  "evidence_schemas_required", "effects_declared",
  "effects_denied", "current_status", "blocked_by"
];
for (const pattern of preview.patterns) {
  for (const key of REQUIRED_KEYS) {
    assert.ok(key in pattern, `pattern ${pattern.source} missing ${key}`);
  }
}
```

### T-06 · Every pattern's status is in the valid enum

```text
const VALID_STATUSES = new Set(["PLANNED", "PREVIEW", "BLOCKED"]);
for (const pattern of preview.patterns) {
  assert.ok(VALID_STATUSES.has(pattern.current_status));
}
```

### T-07 · Zero patterns are LIVE

```text
const live = preview.patterns.filter((p) => p.current_status === "LIVE");
assert.equal(live.length, 0);
```

### T-08 · Every sat_verdict_required is in GateVerdict

```text
const VALID = new Set(["PERMIT", "REJECT", "REVIEW", "SCORE_ONLY"]);
for (const pattern of preview.patterns) {
  assert.ok(VALID.has(pattern.sat_verdict_required));
}
```

### T-09 · Every micro_consent_field is in MICRO_CONSENT_SHAPE or null

```text
const VALID_FIELDS = new Set([
  "mission_id", "agent_id", "resource_id", "action",
  "purpose", "expires_at", "commitment_hash"
]);
for (const pattern of preview.patterns) {
  const f = pattern.micro_consent_field_required;
  assert.ok(f === null || VALID_FIELDS.has(f),
    `pattern ${pattern.source} field ${f} not in MICRO_CONSENT_SHAPE`);
}
```

### T-10 · Every effect is a valid OPERATION

```text
const VALID_OPS = new Set(["read", "write", "execute", "call"]);
for (const pattern of preview.patterns) {
  for (const op of pattern.effects_declared) assert.ok(VALID_OPS.has(op));
  for (const op of pattern.effects_denied) assert.ok(VALID_OPS.has(op));
}
```

### T-11 · No pattern declares an effect it also denies

```text
for (const pattern of preview.patterns) {
  const declared = new Set(pattern.effects_declared);
  for (const denied of pattern.effects_denied) {
    assert.ok(!declared.has(denied),
      `pattern ${pattern.source} both declares and denies ${denied}`);
  }
}
```

### T-12 · Every on_disk_anchor exists at acceptance time

```text
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
for (const pattern of preview.patterns) {
  const path = join(repoRoot, pattern.bizra_binding.on_disk_anchor);
  assert.ok(existsSync(path),
    `anchor missing for ${pattern.source}: ${pattern.bizra_binding.on_disk_anchor}`);
}
```

This is the only test allowed to use `node:fs`, and only for an existence check (no read, no mutation). Justification: the spec requires every anchor to point at an existing file, and the cheapest verification is `existsSync`.

### T-13 · Boundary keeps every authority flag false

```text
for (const key of [
  "runtime", "federation", "mint", "node_connection",
  "economic_settlement", "raw_data_exchange",
  "authority_imported", "mcp_server_invoked",
  "a2a_network_call_made", "hook_executed",
  "automation_run", "contract_executed"
]) {
  assert.equal(preview.boundary[key], false,
    `boundary.${key} must be false`);
}
```

### T-14 · Deterministic + deeply frozen

```text
const a = buildExternalPatternRegistryPreview();
const b = buildExternalPatternRegistryPreview();
assert.deepEqual(a, b);
assert.ok(Object.isFrozen(a));
assert.ok(Object.isFrozen(a.boundary));
assert.ok(Object.isFrozen(a.patterns));
assert.ok(Object.isFrozen(a.patterns[0]));
```

### T-15 · Fresh objects per call

```text
const a = buildExternalPatternRegistryPreview();
const b = buildExternalPatternRegistryPreview();
assert.notEqual(a, b);
assert.notEqual(a.boundary, b.boundary);
assert.notEqual(a.patterns, b.patterns);
```

### T-16 · Module is pure (no fs/net/child_process imports beyond the existence-check)

```text
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(
  new URL("../packages/core/src/external-pattern-registry-preview.js",
    import.meta.url));
const body = await readFile(modulePath, "utf8");

assert.ok(!/from ['"]node:fs/.test(body),
  "module must not import node:fs");
assert.ok(!/from ['"]node:http/.test(body),
  "module must not import node:http");
assert.ok(!/from ['"]node:net/.test(body),
  "module must not import node:net");
assert.ok(!/from ['"]node:child_process/.test(body),
  "module must not import node:child_process");
assert.ok(!/spawn\(|execSync\(|execFile\(|spawnSync\(/.test(body),
  "module must not invoke processes");
```

### T-17 · Summary counts match status occurrences

```text
const expected = { PLANNED: 0, PREVIEW: 0, BLOCKED: 0 };
for (const pattern of preview.patterns) {
  expected[pattern.current_status] += 1;
}
assert.deepEqual(preview.summary, expected);
```

### T-18 · Boundary-invariant lint passes with the new module included

```text
import { buildBoundaryInvariantCheckReport } from
  "../scripts/review/boundary-invariant-check.mjs";
const report = buildBoundaryInvariantCheckReport();
assert.equal(report.ok, true);
assert.equal(report.modules_scanned, 23);
assert.equal(report.modules_clean, 23);
```

Total: 18 tests. Estimated runtime: ~30 ms on the existing 740 ms suite baseline.

## TESTING.md row (must be added at acceptance)

```text
| `tests/external-pattern-registry-preview.test.js` | External pattern registry preview module: schema check, mode+truth_label, 7-line operating canon, 8-16 pattern entries, required keys per pattern, status enum, no LIVE entries, GateVerdict validity, MICRO_CONSENT_SHAPE validity, OPERATIONS validity, effect mutual exclusion, on_disk_anchor existence check, boundary all-false, deterministic+frozen, fresh-object-per-call, pure-module imports, summary counts, and boundary-invariant lint inclusion. |
```

Alphabetical insertion point: between `tests/evidence-receipt-preview.test.js` (or similar `e-` entry) and `tests/network-blueprint.test.js` (`n-`).

## Acceptance gates (run order)

```text
node --test tests/external-pattern-registry-preview.test.js  # focused: 18/18 pass
node --test tests/*.test.js                                  # full: 549/549 pass
npm run check                                                # Node0 self-check PASS
npm run llm:guidance                                         # 7/7 PASS
npm run release:readiness                                    # clean, no risks
node scripts/review/boundary-invariant-check.mjs             # ok=true, scanned=23
git diff --check                                             # clean
```

## Explicit non-tests

The following are intentionally **not** tested in this spec, because they belong to later phases:

- Runtime invocation of any pattern → out of scope per F-04, F-05
- MCP server registration → out of scope
- A2A network message dispatch → out of scope
- Hook execution → out of scope
- AHK / AutoKey hotkey registration → out of scope
- Smart contract execution → out of scope
- Economic settlement → out of scope
- CLI verb `dema integration ...` → out of scope (programmatic consumers only)
- DEMA UX rendering → out of scope

Each of these requires its own spec + ADR + typed-GO before being addressed.
