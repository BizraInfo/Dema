# Phase 03 - TDD Anchors

## Test-first sequence

### Slice 1 - Actuator review gate

Write or maintain tests that confirm:

- `buildActuatorCheckReport()` emits
  `bizra.dema.review.actuator_check.v0.1`;
- current source tree passes with `ok: true`;
- analyzer rejects `exec("...")`;
- analyzer rejects `execSync("...")`;
- analyzer rejects `spawn(..., { shell: true })`;
- analyzer allows `execFile("node", ["--test"])`;
- analyzer allows `spawnSync("python3", [script])` without shell mode.

Implementation target:

- `scripts/review/actuator-check.mjs`
- `tests/actuator-check.test.js`

### Slice 2 - Ambient boundary proof labels

Write tests that confirm:

- `dema ambient` still says preview-only;
- Bash risk remains `maximal`;
- blocked actions include `raw_bash_execution`;
- Proof-of-Truth formal label references the review guard;
- economic channel remains closed until verified impact.

Implementation target:

- `packages/core/src/ambient.js`
- `tests/ambient.test.js`

### Slice 3 - Consent planner actuator classes

Write failing tests before implementation for:

- `npm test` or `pytest` intent includes a Bash-like actuator warning;
- file write intent includes filesystem mutation classification;
- service delivery intent includes external call classification;
- unsafe file paths are not converted to permissions;
- no permission case tells the operator to narrow intent.

Implementation target:

- `packages/consent/src/consent-extract.js`
- `packages/consent/src/consent-planner.js`
- `tests/consent-planner.test.js`

### Slice 4 - Consent spine preview command

Write failing tests before implementation for:

- `dema consent spine --json "<intent>"` emits a schema-tagged preview;
- preview includes actuator classes, policy decisions, and proof labels;
- preview never mints runtime capability;
- preview never records approval;
- formatted output says governed runtime handoff is required for execution.

Implementation target:

- `packages/consent/src/`
- `apps/cli/src/index.js`
- `tests/consent-planner.test.js`

### Slice 5 - Future runtime handoff contract

When runtime handoff is introduced, write tests that confirm:

- denied policy prevents request construction;
- missing exact consent prevents request construction;
- expired consent prevents request construction;
- runtime client is a test double, not local Bash execution;
- output labels the result as handoff-requested, not executed by Dema.

Implementation target:

- new handoff module under `packages/consent/src/` or `packages/core/src/`
- no runtime dependency without written justification.

## Completion gates

For code changes:

```bash
node --test tests/actuator-check.test.js tests/ambient.test.js
npm test
npm run check
npm run llm:guidance
git diff --check
```

For docs-only updates:

```bash
npm run llm:guidance
git diff --check
```

## Anti-regression assertions

- No Dema command executes raw Bash.
- No hidden daemon starts.
- No preview command records approval.
- No local command mints runtime receipt or runtime capability.
- No economic claim is upgraded without verified impact governance.
- No unsafe path becomes a consent permission.
