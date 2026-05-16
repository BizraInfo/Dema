# Phase 03 — TDD Anchors

## Test file

`tests/urp-carrying-cost-preview.test.js`

Mirrors the pattern established by `tests/external-pattern-registry-preview.test.js` and `tests/mobile-qr-challenge-preview.test.js`.

## Sample fixtures

```text
const FIXED_NOW = new Date("2026-05-16T11:40:00.000Z");

const VALID_ARGS = {
  resource_id: "skill.investor_pack_drafter",
  resource_type: "skill_pack",
  owner_node: "node0",
  self_assessed_value: 100,
  carrying_cost_rate: 0.02,
  license_challenge_allowed: true,
  no_raw_data_proof: "skill manifest contains only public templates and rubric metadata",
  now: FIXED_NOW
};
```

## Test cases

### T-01 · canonical schema

```
const env = buildUrpCarryingCostPreview(VALID_ARGS);
assert.equal(env.schema, URP_CARRYING_COST_PREVIEW_SCHEMA);
assert.equal(env.schema, "bizra.dema.urp_carrying_cost_preview.v0.1");
```

### T-02 · PREVIEW_ONLY and DECLARED

```
assert.equal(env.mode, "PREVIEW_ONLY");
assert.equal(env.truth_label, "DECLARED");
```

### T-03 · valid case has all required fields

```
assert.equal(env.valid, true);
assert.equal(env.resource_id, "skill.investor_pack_drafter");
assert.equal(env.resource_type, "skill_pack");
assert.equal(env.owner_node, "node0");
assert.equal(env.self_assessed_value, 100);
assert.equal(env.carrying_cost_rate, 0.02);
assert.equal(env.simulated_carrying_cost, 2);  // 100 * 0.02
assert.equal(env.license_challenge_allowed, true);
assert.equal(env.forced_transfer, false);
assert.equal(env.raw_data_shared, false);
assert.equal(env.settlement, "preview_only");
```

### T-04 · simulated_carrying_cost is computed, not user-supplied

The user can't pass `simulated_carrying_cost` directly; if they try, it's ignored and recomputed.

```
const env = buildUrpCarryingCostPreview({...VALID_ARGS, simulated_carrying_cost: 999});
assert.equal(env.simulated_carrying_cost, 2);
```

### T-05 · forbidden resource type returns fail-closed envelope

```
for (const type of [
  "private_conversation",
  "identity_data",
  "family_personal_data",
  "secrets",
  "raw_corpus",
  "unpublished_personal_memory",
  "credentials",
  "finance_data"
]) {
  const env = buildUrpCarryingCostPreview({...VALID_ARGS, resource_type: type});
  assert.equal(env.valid, false);
  assert.equal(env.denial.code, "forbidden_resource_type");
}
```

### T-06 · unknown resource type returns fail-closed envelope

```
const env = buildUrpCarryingCostPreview({...VALID_ARGS, resource_type: "random_unlisted_type"});
assert.equal(env.valid, false);
assert.equal(env.denial.code, "unknown_resource_type");
```

### T-07 · invalid value (zero / negative / NaN) is rejected

```
for (const value of [0, -1, NaN, Number.POSITIVE_INFINITY, "not a number"]) {
  const env = buildUrpCarryingCostPreview({...VALID_ARGS, self_assessed_value: value});
  assert.equal(env.valid, false);
  assert.equal(env.denial.code, "invalid_value");
}
```

### T-08 · invalid rate (≤0 or ≥1 or NaN) is rejected

```
for (const rate of [0, 1, 1.5, -0.1, NaN]) {
  const env = buildUrpCarryingCostPreview({...VALID_ARGS, carrying_cost_rate: rate});
  assert.equal(env.valid, false);
  assert.equal(env.denial.code, "invalid_rate");
}
```

### T-09 · missing required strings (resource_id / owner_node / no_raw_data_proof) rejected

```
for (const field of ["resource_id", "owner_node", "no_raw_data_proof"]) {
  const env = buildUrpCarryingCostPreview({...VALID_ARGS, [field]: ""});
  assert.equal(env.valid, false);
  assert.equal(env.denial.code, "missing_field");
}
```

### T-10 · boundary keeps all 9 authority flags false

```
for (const key of [
  "runtime",
  "federation",
  "mint",
  "economic_settlement",
  "forced_transfer_executed",
  "private_memory_accessed",
  "raw_data_exchange",
  "license_issued",
  "shared_urp_published"
]) {
  assert.equal(env.boundary[key], false);
}
```

The same boundary appears on both valid and failure envelopes (failure path still emits the full boundary discipline).

### T-11 · all 8 shareable resource types are accepted

```
for (const type of [
  "skill_pack", "knowledge_pack_manifest", "model_profile",
  "mission_template", "verified_proof_bundle", "resource_offer",
  "compute_offer", "agent_service_offer"
]) {
  const env = buildUrpCarryingCostPreview({...VALID_ARGS, resource_type: type});
  assert.equal(env.valid, true);
}
```

### T-12 · deterministic and frozen

```
const a = buildUrpCarryingCostPreview(VALID_ARGS);
const b = buildUrpCarryingCostPreview(VALID_ARGS);
assert.deepEqual(a, b);
assert.ok(Object.isFrozen(a));
assert.ok(Object.isFrozen(a.boundary));
```

### T-13 · fresh objects per call

```
const a = buildUrpCarryingCostPreview(VALID_ARGS);
const b = buildUrpCarryingCostPreview(VALID_ARGS);
assert.notEqual(a, b);
assert.notEqual(a.boundary, b.boundary);
```

### T-14 · pure-module imports

```
const body = await readFile(modulePath, "utf8");
assert.ok(!/from ['"]node:fs/.test(body));
assert.ok(!/from ['"]node:http/.test(body));
assert.ok(!/from ['"]node:net/.test(body));
assert.ok(!/from ['"]node:child_process/.test(body));
assert.ok(!/spawn\(|execSync\(|execFile\(|spawnSync\(/.test(body));
```

### T-15 · invalid `now` Date is rejected

```
const env = buildUrpCarryingCostPreview({...VALID_ARGS, now: new Date("not-a-date")});
assert.equal(env.valid, false);
assert.equal(env.denial.code, "invalid_now");
```

### T-16 · boundary-invariant lint passes with new module included

```
const report = buildBoundaryInvariantCheckReport();
assert.equal(report.ok, true);
assert.ok(report.modules_scanned >= 26);
assert.equal(report.modules_clean, report.modules_scanned);
```

## TESTING.md row

```
| `tests/urp-carrying-cost-preview.test.js` | URP Carrying Cost preview v0.1: schema/mode, valid-envelope shape with simulated_carrying_cost computation, 8 forbidden private-data types rejected with code=forbidden_resource_type, unknown_resource_type rejection, invalid value/rate/required-strings/now rejection, boundary all-9-false on both valid and failure envelopes, all 8 shareable types accepted, deterministic + frozen, fresh-object-per-call, pure-module imports, boundary-invariant lint inclusion. |
```

## Total

16 test anchors. Estimated test-file size: ~180-220 LOC.
