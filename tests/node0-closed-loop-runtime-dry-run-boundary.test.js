/**
 * ADR-035 Node0 Closed-Loop Runtime Dry-Run Boundary - Test-only scaffold
 * [PROTOTYPE]
 * [DESIGNED_NOT_LIVE]
 * TEST_BOUNDARY_ONLY
 *
 * This scaffold proves the Section 2 runtime-readiness boundary document exists
 * and carries the dry-run-only runtime constraints. It does not implement a
 * live runtime, command runner, daemon, hidden loop, cross-repo bridge, public
 * network path, token logic, contract logic, marketplace behavior, or
 * Shariah-compliance claim.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const adr = () => readFileSync(
  new URL('../docs/06-adr/ADR-035-node0-closed-loop-runtime-dry-run-boundary.md', import.meta.url),
  'utf8'
);

test('ADR-035 defines the first real closed-loop runtime boundary without live activation', () => {
  const text = adr();
  assert.match(text, /first real closed-loop runtime boundary/i);
  assert.match(text, /dry-run only/i);
  assert.match(text, /No live runtime execution/i);
  assert.match(text, /\[PROTOTYPE\]/);
  assert.match(text, /\[DESIGNED_NOT_LIVE\]/);
  assert.match(text, /LOCAL_ONLY/);
});

test('ADR-035 defines the full runtime loop state boundary', () => {
  const text = adr();
  for (const state of [
    'input',
    'validation',
    'planning',
    'execution',
    'reflection',
    'receipt',
    'digest',
    'index'
  ]) {
    assert.match(text, new RegExp(`\\b${state}\\b`, 'i'));
  }
});

test('ADR-035 carries failure-safe abort, retry, timeout, and idempotency policy boundaries', () => {
  const text = adr();
  assert.match(text, /failure-safe abort/i);
  assert.match(text, /retry policy/i);
  assert.match(text, /timeout policy/i);
  assert.match(text, /idempotency policy/i);
});

test('ADR-035 carries local-only locks, operator approval gates, and trace IDs', () => {
  const text = adr();
  assert.match(text, /local-only execution locks/i);
  assert.match(text, /operator approval gates/i);
  assert.match(text, /runtime trace IDs/i);
});

test('ADR-035 carries replay-safe receipt and still-blocked invariant boundaries', () => {
  const text = adr();
  assert.match(text, /replay-safe execution receipts/i);
  assert.match(text, /never bypasses still-blocked invariants/i);
  assert.match(text, /NO_PRODUCTION_SCORING/);
  assert.match(text, /NO_PUBLIC_URP_BRIDGE/);
  assert.match(text, /NO_SHARIAH_COMPLIANCE_CLAIM/);
});

test('ADR-035 declares allowed and forbidden runtime dry-run envelope surfaces', () => {
  const text = adr();
  assert.match(text, /Allowed Inputs/);
  assert.match(text, /Forbidden Inputs/);
  assert.match(text, /Allowed Outputs/);
  assert.match(text, /Forbidden Outputs/);
  assert.match(text, /live_runtime_request/);
  assert.match(text, /network_call_request/);
  assert.match(text, /cross_repo_write_request/);
  assert.match(text, /token_amount/);
  assert.match(text, /public_url/);
});

test('ADR-035 next micro remains scaffold only', () => {
  const text = adr();
  assert.match(text, /GO: NODE0 CLOSED-LOOP RUNTIME DRY-RUN TEST SCAFFOLD/);
  assert.doesNotMatch(text, /GO: NODE0 CLOSED-LOOP RUNTIME IMPLEMENTATION/);
});
