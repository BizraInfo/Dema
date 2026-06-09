/**
 * BIZRA Node0 Dema Elite Full-Stack Production Blueprint - Doc Conformance Test
 * [PROTOTYPE]
 * [DESIGNED_NOT_LIVE]
 * TEST_BOUNDARY_ONLY
 *
 * This test verifies the structure and content of the production blueprint document.
 * It enforces that the blueprint is documentation + conformance only.
 * It does not implement runtime, writers, bridges, public release, token, reward,
 * contracts, marketplace, Node1, URP, or Shariah-compliant claims.
 *
 * It asserts the presence of all mandatory sections, MBOK/DevOps/CI/CD/perf-QA
 * integration, DoD levels, still-blocked invariants (verbatim), and that the
 * declared next micro is delivery-check integration (not implementation).
 *
 * It also guards against promotion of forbidden production/public/economic claims.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const BLUEPRINT_PATH = path.join(REPO_ROOT, 'docs', 'blueprints', 'BIZRA_NODE0_DEMA_ELITE_FULL_STACK_PRODUCTION_BLUEPRINT.md');

const blueprint = readFileSync(BLUEPRINT_PATH, 'utf8');

test('blueprint file exists and is non-empty', () => {
  assert.ok(blueprint && blueprint.length > 1000, 'blueprint document must be substantial');
});

test('contains all 17 mandatory top-level sections', () => {
  const required = [
    '## 1. Executive Production Vision',
    '## 2. System Architecture',
    '## 3. Full-Stack Blueprint',
    '## 4. Management Body of Knowledge Mapping',
    '## 5. DevOps Operating Model',
    '## 6. CI/CD Pipeline Blueprint',
    '## 7. Performance-Quality Assurance Blueprint',
    '## 8. Security Blueprint',
    '## 9. Testing Strategy',
    '## 10. Documentation Strategy',
    '## 11. Scalability Strategy (Staged)',
    '## 12. Error Handling and Recovery',
    '## 13. Dependency Management',
    '## 14. Production Readiness Checklist',
    '## 15. Definition of Done',
    '## 16. Still-Blocked Invariants',
    '## 17. Next Micro'
  ];
  for (const section of required) {
    assert.ok(blueprint.includes(section), `missing required section: ${section}`);
  }
});

test('MBOK / DevOps / CI/CD / performance-quality assurance integration present', () => {
  assert.ok(blueprint.includes('Management Body of Knowledge Mapping'), 'MBOK section required');
  assert.ok(blueprint.includes('| Integration Management'), 'MBOK table with Integration Management required');
  assert.ok(blueprint.includes('DevOps Operating Model'), 'DevOps section required');
  assert.ok(blueprint.includes('CI/CD Pipeline Blueprint'), 'CI/CD section required');
  assert.ok(blueprint.includes('Performance-Quality Assurance Blueprint'), 'perf-QA section required');
  assert.ok(blueprint.includes('A+'), 'A+ performance-quality assurance references required');
});

test('Definition of Done levels present (4 levels)', () => {
  assert.ok(blueprint.includes('**Layer DoD**'), 'Layer DoD required');
  assert.ok(blueprint.includes('**Local Alpha DoD**'), 'Local Alpha DoD required');
  assert.ok(blueprint.includes('**Local Production DoD**'), 'Local Production DoD required');
  assert.ok(blueprint.includes('**Public / Economic Production DoD**'), 'Public/Economic DoD required');
  assert.ok(blueprint.includes('BLOCKED'), 'Public/Economic DoD must declare BLOCKED');
});

test('still-blocked invariants present verbatim (Section 16)', () => {
  const blocked = [
    'No production scoring.',
    'No economic scoring.',
    'No reward eligibility implementation.',
    'No reward logic.',
    'No receipt minting.',
    'No public receipt writing.',
    'No publishing.',
    'No bridging.',
    'No contracts.',
    'No token logic.',
    'No marketplace.',
    'No public economic copy.',
    'No Node1.',
    'No public URP bridge.',
    'No Shariah-compliant claim.'
  ];
  for (const item of blocked) {
    assert.ok(blueprint.includes(item), `missing still-blocked invariant: ${item}`);
  }
  assert.ok(blueprint.includes('These invariants are living.'), 'still-blocked must be described as living');
});

test('forbidden production/public/economic/runtime/bridge claims are not promoted', () => {
  // Guard against positive promotional claims only. The "No X" still-blocked list items are required and must be present.
  const forbiddenPromotional = [
    /production scoring (is|has|enabled|ready|complete|activated)/i,
    /economic scoring (is|has|enabled|ready|complete|activated)/i,
    /reward logic (is|has|implemented|enabled|ready|complete|activated)/i,
    /token logic (is|has|implemented|enabled|ready|complete|activated)/i,
    /marketplace (is|has|activated|enabled|ready|complete)/i,
    /Node1 (is|has|activated|enabled|ready|complete)/i,
    /URP bridge (is|has|activated|enabled|ready|complete)/i,
    /Shariah-compliant (claim|production) (is|has|enabled|ready|complete|activated)/i,
    /public (release|publication|economic) (is|has|ready|complete|activated|enabled)/i,
    /Data Lake (mutation|write|bridge) (is|has|activated|enabled|ready|complete)/i,
    /live runtime (is|has|activated|enabled|ready|complete)/i
  ];
  for (const re of forbiddenPromotional) {
    assert.ok(!re.test(blueprint), `forbidden promotional claim detected: ${re}`);
  }
});

test('next micro is explicitly delivery-check integration (not implementation)', () => {
  assert.ok(blueprint.includes('GO: BIZRA NODE0 DEMA PRODUCTION BLUEPRINT DELIVERY-CHECK INTEGRATION'), 'exact next micro GO string required');
  assert.ok(blueprint.includes('delivery-check integration'), 'next micro must specify delivery-check integration');
  // Allow the correct disclaimer language ("blueprint for future implementation slices only").
  // Still reject bad promises in the "Next Micro" section itself.
  const badNext = /## 17\. Next Micro[\s\S]{0,200}?(implement|activate|write|runtime|writer|bridge|public) (is|has|ready|complete|activated)/i;
  assert.ok(!badNext.test(blueprint), 'next micro section must not promise forbidden implementation/activation');
});

test('references core repo artifacts and disciplines (LCC-6, G-Ladder, four rails, delivery-check, ADRs 033-036)', () => {
  assert.ok(blueprint.includes('LCC-6'), 'LCC-6 reference required');
  assert.ok(blueprint.includes('G-Ladder'), 'G-Ladder reference required');
  assert.ok(blueprint.includes('gitleaks') && blueprint.includes('CodeQL') && blueprint.includes('BIZRA Review Gate') && blueprint.includes('check'), 'four exact-head rails required');
  assert.ok(blueprint.includes('delivery-check.mjs'), 'delivery-check reference required');
  assert.ok(blueprint.includes('ADR-033') && blueprint.includes('ADR-034') && blueprint.includes('ADR-035') && blueprint.includes('ADR-036'), 'recent ADRs 033-036 references required');
});

test('declares prototype / designed-not-live / local-only posture', () => {
  assert.ok(blueprint.includes('[PROTOTYPE]') || blueprint.includes('PROTOTYPE') || blueprint.includes('DESIGNED_NOT_LIVE') || blueprint.includes('local alpha'), 'prototype / designed-not-live / local-only posture declaration required');
});

test('blueprint is documentation + conformance only (no implementation claims)', () => {
  const implClaims = /we (have |now )?(implemented|activated|shipped|released|enabled) (runtime|writer|bridge|token|reward|Node1|public)/i;
  assert.ok(!implClaims.test(blueprint), 'blueprint must not claim implementation of forbidden items');
  assert.ok(blueprint.includes('blueprint for future implementation slices only'), 'explicit "blueprint only" language required');
});
