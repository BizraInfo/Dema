#!/usr/bin/env node
// dema-slice-scaffold — generate a red-first Dema/Node0 proof slice + wire it in.
//
// Scaffold-only. Writes 5 new files and performs 4 anchored wiring edits so the
// slice is shaped exactly like the merged ones, then stops. It deliberately
// leaves the slice RED: the kernel's slice-specific bodies throw `not_implemented`
// and the mirrored test encodes the proof contract that must be turned green
// before any commit. Pure stdlib (matches the repo's 0-dependency posture).
//
// Usage:
//   node scaffold_slice.mjs --id NODE0-FOO-BAR-1A --intent "one-line capability"
//        [--go-phrase "GO: ..."] [--truth-label NODE0_FOO_BAR_MEASURED_REPO]
//        [--no-arch] [--repo <root>] [--dry-run] [--force] [--json]
//
// Exit codes: 0 ok, 1 usage/validation error, 2 target collision (use --force).

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// arg parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const out = { arch: true, dryRun: false, force: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[(i += 1)];
    if (a === "--id") out.id = next();
    else if (a === "--intent") out.intent = next();
    else if (a === "--go-phrase") out.goPhrase = next();
    else if (a === "--truth-label") out.truthLabel = next();
    else if (a === "--repo") out.repo = next();
    else if (a === "--no-arch") out.arch = false;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--force") out.force = true;
    else if (a === "--json") out.json = true;
    else if (a === "-h" || a === "--help") out.help = true;
    else throw new Error(`unknown_arg:${a}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// name derivation
// ---------------------------------------------------------------------------
const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "twenty-one",
  "twenty-two", "twenty-three", "twenty-four", "twenty-five", "twenty-six",
  "twenty-seven", "twenty-eight", "twenty-nine", "thirty",
];
const numberWord = (n) => NUMBER_WORDS[n] ?? String(n);

function deriveNames(id) {
  // Expected shape: UPPER segments separated by '-', trailing version like 1A.
  if (!/^[A-Z0-9]+(-[A-Z0-9]+)*-\d+[A-Z]$/.test(id)) {
    throw new Error(
      `bad_id:${id} (expected e.g. NODE0-RECEIPT-SIGNING-ED25519-1A)`,
    );
  }
  const segments = id.split("-");
  const version = segments[segments.length - 1]; // e.g. 1A
  const baseSegments = segments.slice(0, -1); // drop version
  const kebab = baseSegments.join("-").toLowerCase(); // node0-receipt-signing-ed25519
  const prefix = baseSegments.join("_").toUpperCase(); // NODE0_RECEIPT_SIGNING_ED25519
  const capId = segments.join("_").toUpperCase(); // NODE0_RECEIPT_SIGNING_ED25519_1A
  const schema = `bizra.dema.${prefix.toLowerCase()}.v0.1`;
  const camel = baseSegments
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(""); // Node0ReceiptSigningEd25519
  const camelLower = camel.charAt(0).toLowerCase() + camel.slice(1);
  return { id, version, kebab, prefix, capId, schema, camel, camelLower };
}

// ---------------------------------------------------------------------------
// templates (token-substituted; tokens avoid nested-template-literal escaping)
// ---------------------------------------------------------------------------
function fill(template, tokens) {
  let out = template;
  for (const [k, v] of Object.entries(tokens)) {
    out = out.split(`%%${k}%%`).join(v);
  }
  return out;
}

const KERNEL_TEMPLATE = `// %%ID%% — %%INTENT%%
//
// RED-FIRST kernel scaffold. \`plan\` and \`build...Payload\` are real (consent gate +
// content addressing are universal); the slice-specific \`verify\` / \`run\` bodies
// throw \`not_implemented\` until you build them. Turn the mirrored test green
// before any commit — do not weaken the test to match an empty kernel.
//
// Pure kernel: no fs / network / process / clock / random unless injected and
// documented in this header. Every claim here is a preview; the boundary is all-false.

// M5.1B: hash-bearing slices use the ONE canonical byte contract — no local
// serializer copy. Unsupported values (undefined, NaN, sparse arrays,
// accessors, ...) fail closed inside packages/canon with registered error
// codes. The scaffold auto-registers this kernel's path in
// CANONICAL_JSON_V1_REGISTERED_CONSUMERS (scripts/review/canonical-json-v1-check.mjs);
// review that one-line diff in this slice's PR.
import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const %%PREFIX%%_SCHEMA = "%%SCHEMA%%";
export const %%PREFIX%%_TRUTH_LABEL = "%%TRUTH%%";
export const %%PREFIX%%_GO_PHRASE = "%%GO%%";

// All-false boundary invariant. These keys mirror the capability-truth-registry
// row boundary — keep them all false; flipping any one is an execution claim.
export function %%CAMELLOWER%%Boundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

// Fail-closed plan. Collect every reason the action is blocked; eligible only
// when nothing blocks. Exact GO-phrase byte match — no fuzzy / partial consent.
// Absence of a block is NEVER validation: push a block until you can POSITIVELY
// prove the input is well-formed for this slice's ontology.
export function plan%%CAMEL%%({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== %%PREFIX%%_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
  }
  // TODO(%%ID%%): positively validate \`input\` against this slice's ontology and
  // push a named block for each unmet precondition.
  return Object.freeze({
    schema: %%PREFIX%%_SCHEMA,
    truth_label: %%PREFIX%%_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Canonical, content-addressed payload. Reshape \`body\` to carry the real fields
// this slice attests; the content_hash binds the whole body.
export function build%%CAMEL%%Payload(input) {
  const body = {
    schema: %%PREFIX%%_SCHEMA,
    truth_label: %%PREFIX%%_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
    input,
    boundary: %%CAMELLOWER%%Boundary(),
  };
  const content_hash = sha256CanonicalJsonV1(body);
  return Object.freeze({ ...body, content_hash });
}

// Body-bound re-derivation verifier (REQUIRED by the core-kernels rule).
// Recompute the hash over the body MINUS its hash field and reject any mismatch,
// then add the slice-specific field checks. Body-bound, not seed-bound: a forged
// field with a recomputed hash must still fail because verify binds the WHOLE body
// against an independent anchor (e.g. a signature or an externally supplied hash).
export function verify%%CAMEL%%(/* payload */) {
  throw new Error("not_implemented:verify%%CAMEL%%");
}

// Orchestrator the review gate consumes. Run plan -> build -> verify -> tamper-reject
// and return the proof envelope: { ok, schema, truth_label, content_hash, boundary,
// blocked_by }. Push a named block on any failure so the gate fails closed.
export function run%%CAMEL%%(/* { consent, input } */) {
  throw new Error("not_implemented:run%%CAMEL%%");
}
`;

const TEST_TEMPLATE = `import test from "node:test";
import assert from "node:assert/strict";

import {
  plan%%CAMEL%%,
  build%%CAMEL%%Payload,
  verify%%CAMEL%%,
  run%%CAMEL%%,
  %%PREFIX%%_SCHEMA,
  %%PREFIX%%_TRUTH_LABEL,
  %%PREFIX%%_GO_PHRASE,
} from "../packages/core/src/%%KEBAB%%.js";
import { run%%CAMEL%%Check } from "../scripts/review/%%KEBAB%%-check.mjs";

// RED-FIRST: each test encodes part of the %%ID%% proof contract. They fail until
// the kernel bodies are implemented. Build to green — do not soften the asserts.
// Replace every \`/* TODO */\` with the slice's real fixture input.

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = plan%%CAMEL%%({ consent: "wrong", input: {} });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = plan%%CAMEL%%({ consent: %%PREFIX%%_GO_PHRASE, input: { /* TODO */ } });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = build%%CAMEL%%Payload({ /* TODO */ });
  assert.equal(payload.schema, %%PREFIX%%_SCHEMA);
  assert.equal(payload.truth_label, %%PREFIX%%_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = build%%CAMEL%%Payload({ /* TODO */ });
  assert.equal(verify%%CAMEL%%(payload).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = build%%CAMEL%%Payload({ /* TODO */ });
  const tampered = { ...payload, content_hash: \`sha256:\${"0".repeat(64)}\` };
  assert.equal(verify%%CAMEL%%(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  // Internal-consistency check: a field changed but the stored hash did not, so
  // recompute-over-body must differ from content_hash.
  //
  // NOTE the harder launder this scaffold does NOT yet defend against: changing a
  // field AND recomputing the hash so the body is self-consistent. Internal
  // consistency alone cannot catch that — you need an INDEPENDENT anchor
  // (a signature over the payload, or an externally measured state hash). When
  // this slice gains one, add a test that forges + recomputes and still expects
  // rejection. Until then, do not claim launder-resistance.
  const payload = build%%CAMEL%%Payload({ /* TODO */ });
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verify%%CAMEL%%(forged).ok, false);
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = run%%CAMEL%%Check();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, %%PREFIX%%_SCHEMA);
  assert.equal(result.truth_label, %%PREFIX%%_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = run%%CAMEL%%({ consent: %%PREFIX%%_GO_PHRASE, input: { /* TODO */ } });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});
`;

const CHECK_TEMPLATE = `#!/usr/bin/env node
// %%ID%% — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  run%%CAMEL%%,
  %%PREFIX%%_SCHEMA,
  %%PREFIX%%_TRUTH_LABEL,
  %%PREFIX%%_GO_PHRASE,
} from "../../packages/core/src/%%KEBAB%%.js";

const JSON_MODE = process.argv.includes("--json");

export function run%%CAMEL%%Check() {
  // TODO(%%ID%%): supply the canonical fixture input this gate proves against.
  return run%%CAMEL%%({ consent: %%PREFIX%%_GO_PHRASE, input: { /* fixture */ } });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = run%%CAMEL%%Check();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - %%ID%%");
    console.log(\`  schema: \${%%PREFIX%%_SCHEMA}\`);
    console.log(\`  truth: \${%%PREFIX%%_TRUTH_LABEL}\`);
    console.log(\`  result: \${result.ok ? "PASS" : "FAIL"}\`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(\`    \${code}\`);
    }
  }

  if (!result.ok) process.exit(1);
}
`;

const RECEIPT_TEMPLATE = `# Receipt: %%ID%%

Truth label: \`%%TRUTH%%\`

## Slice

%%INTENT%%

\`\`\`text
plan → build → verify → tamper-reject
\`\`\`

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the canonical payload is content-addressed,
- verification re-derives from the body and rejects tamper,
- a forged body with a recomputed hash is still rejected,
- the boundary stays all-false (no execution authority).

\`npm run check\` runs \`%%KEBAB%%-check.mjs\` and keeps \`%%CAPID%%\` at \`MEASURED_REPO\`.

## Commands

\`\`\`bash
node --test tests/%%KEBAB%%.test.js
node scripts/review/%%KEBAB%%-check.mjs --json
npm run check
\`\`\`
`;

const ARCH_TEMPLATE = `# %%ID%%

Truth label: \`%%TRUTH%%\`

## Purpose

%%INTENT%%

## Input Contract

\`\`\`js
run%%CAMEL%%({ consent, input })
\`\`\`

Exact consent:

\`\`\`text
%%GO%%
\`\`\`

## Output Contract

\`\`\`text
schema
truth_label
ok
content_hash
boundary.execution_allowed (false)
blocked_by[]
\`\`\`

## Verification

\`\`\`js
verify%%CAMEL%%(payload)
\`\`\`

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

\`\`\`text
packages/core/src/%%KEBAB%%.js
tests/%%KEBAB%%.test.js
scripts/review/%%KEBAB%%-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/%%CAPID%%.md
docs/02-architecture/%%PREFIX%%_v0_1.md
\`\`\`

## Commands

\`\`\`bash
node --test tests/%%KEBAB%%.test.js
node scripts/review/%%KEBAB%%-check.mjs --json
npm test
npm run check
\`\`\`
`;

// Registry capability row (inserted into defaultCapabilityRows()).
const REGISTRY_ROW_TEMPLATE = `    capability({
      capability_id: "%%CAPID%%",
      truth_label: "%%TRUTH%%",
      summary:
        "%%INTENT%%",
      evidence: evidence({
        source_paths: ["packages/core/src/%%KEBAB%%.js"],
        test_paths: ["tests/%%KEBAB%%.test.js"],
        review_gate_paths: [
          "scripts/review/%%KEBAB%%-check.mjs",
        ],
        receipt_paths: ["docs/receipts/%%CAPID%%.md"],
        documentation_paths: [%%DOCPATHS%%
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "TODO(%%ID%%): state precisely what this slice proves once green.",
      what_this_does_not_prove:
        "It does not prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
`;

// ---------------------------------------------------------------------------
// wiring helpers (idempotent, anchored)
// ---------------------------------------------------------------------------
function insertBefore(content, anchorSubstr, insertion, alreadyMarker) {
  if (alreadyMarker && content.includes(alreadyMarker)) {
    return { content, changed: false, note: "already present" };
  }
  const idx = content.indexOf(anchorSubstr);
  if (idx === -1) return { content, changed: false, note: "anchor not found" };
  return {
    content: content.slice(0, idx) + insertion + content.slice(idx),
    changed: true,
    note: "inserted",
  };
}

// Splice a whole line before the line containing `anchorSubstr`. Preserves the
// anchor line's own indentation (anchoring mid-line would split it).
function insertLineBefore(content, anchorSubstr, newLine, alreadyMarker) {
  if (alreadyMarker && content.includes(alreadyMarker)) {
    return { content, changed: false, note: "already present" };
  }
  const lines = content.split("\n");
  const idx = lines.findIndex((l) => l.includes(anchorSubstr));
  if (idx === -1) return { content, changed: false, note: "anchor not found" };
  lines.splice(idx, 0, newLine);
  return { content: lines.join("\n"), changed: true, note: "inserted" };
}

// Insert a markdown table row at the end of the table that contains `headerHint`.
function appendTableRow(content, headerHint, row, alreadyMarker) {
  if (alreadyMarker && content.includes(alreadyMarker)) {
    return { content, changed: false, note: "already present" };
  }
  const lines = content.split("\n");
  const headerIdx = lines.findIndex((l) => l.includes(headerHint));
  if (headerIdx === -1) return { content, changed: false, note: "table not found" };
  // Walk forward to the last contiguous table row (lines starting with '|').
  let i = headerIdx;
  while (i + 1 < lines.length && lines[i + 1].trimStart().startsWith("|")) i += 1;
  lines.splice(i + 1, 0, row);
  return { content: lines.join("\n"), changed: true, note: "appended to table" };
}

function bumpCountDigits(content, field, oldN, newN) {
  const re = new RegExp(`(${field},\\s*)${oldN}\\b`, "g");
  let changed = false;
  const out = content.replace(re, (_m, p1) => {
    changed = true;
    return `${p1}${newN}`;
  });
  return { content: out, changed };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(
      "Usage: node scaffold_slice.mjs --id NODE0-FOO-BAR-1A --intent \"...\"\n" +
        "  [--go-phrase \"GO: ...\"] [--truth-label LABEL] [--no-arch]\n" +
        "  [--repo <root>] [--dry-run] [--force] [--json]",
    );
    process.exit(0);
  }
  if (!opts.id) throw new Error("missing --id");
  if (!opts.intent) throw new Error("missing --intent");

  const repo = resolve(opts.repo || process.cwd());
  const n = deriveNames(opts.id);
  const truthLabel = opts.truthLabel || `${n.prefix}_MEASURED_REPO`;
  const goPhrase =
    opts.goPhrase || `GO: ${n.kebab.split("-").join(" ")} preview`;

  // registry documentation_paths: omit the arch doc when --no-arch so the
  // registry check (which verifies evidence-file existence) stays green.
  const docPaths = opts.arch
    ? `\n          "docs/02-architecture/${n.prefix}_v0_1.md",\n          "docs/TESTING.md",`
    : `\n          "docs/TESTING.md",`;

  const tokens = {
    ID: n.id,
    CAPID: n.capId,
    KEBAB: n.kebab,
    PREFIX: n.prefix,
    SCHEMA: n.schema,
    CAMEL: n.camel,
    CAMELLOWER: n.camelLower,
    VERSION: n.version,
    TRUTH: truthLabel,
    GO: goPhrase,
    INTENT: opts.intent.replace(/"/g, '\\"'),
    DOCPATHS: docPaths,
  };

  // --- new files ---------------------------------------------------------
  const files = [
    {
      path: `packages/core/src/${n.kebab}.js`,
      body: fill(KERNEL_TEMPLATE, tokens),
    },
    {
      path: `tests/${n.kebab}.test.js`,
      body: fill(TEST_TEMPLATE, tokens),
    },
    {
      path: `scripts/review/${n.kebab}-check.mjs`,
      body: fill(CHECK_TEMPLATE, tokens),
    },
    {
      path: `docs/receipts/${n.capId}.md`,
      body: fill(RECEIPT_TEMPLATE, tokens),
    },
  ];
  if (opts.arch) {
    files.push({
      path: `docs/02-architecture/${n.prefix}_v0_1.md`,
      body: fill(ARCH_TEMPLATE, tokens),
    });
  }

  const collisions = files
    .map((f) => f.path)
    .filter((p) => existsSync(join(repo, p)));
  if (collisions.length && !opts.force) {
    const msg = `target files already exist (use --force):\n  ${collisions.join("\n  ")}`;
    if (opts.json) console.log(JSON.stringify({ ok: false, error: msg }, null, 2));
    else console.error(msg);
    process.exit(2);
  }

  // --- wiring edits (computed against current disk) ----------------------
  const edits = [];

  // 1. scripts/check.mjs — add the review command line.
  {
    const p = "scripts/check.mjs";
    const abs = join(repo, p);
    const content = readFileSync(abs, "utf8");
    const line = `  ["node", ["scripts/review/${n.kebab}-check.mjs"]],`;
    const r = insertLineBefore(
      content,
      "dema-capability-truth-registry-check.mjs",
      line,
      `${n.kebab}-check.mjs`,
    );
    edits.push({ path: p, ...r });
    if (r.changed && !opts.dryRun) writeFileSync(abs, r.content);
  }

  // 2. registry source — REQUIRED_CAPABILITY_IDS + capability row + count prose.
  {
    const p = "packages/core/src/dema-capability-truth-registry.js";
    const abs = join(repo, p);
    let content = readFileSync(abs, "utf8");

    // Idempotency anchor: if this capId is already wired, the count was already
    // bumped on the run that added it — do NOT bump again (that would over-count).
    const capPresent = content.includes(`"${n.capId}"`);

    // current count = number of "..._1A"/"..._NX" entries before insert
    const idsBlock = content.match(
      /REQUIRED_CAPABILITY_IDS = Object\.freeze\(\[([\s\S]*?)\]\);/,
    );
    const oldCount = idsBlock
      ? (idsBlock[1].match(/"/g) || []).length / 2
      : null;
    const newCount = oldCount != null ? oldCount + 1 : null;

    // 2a. append id to REQUIRED_CAPABILITY_IDS (before its closing `]);`)
    if (!content.includes(`"${n.capId}"`)) {
      const anchor = "REQUIRED_CAPABILITY_IDS = Object.freeze([";
      const start = content.indexOf(anchor);
      const close = content.indexOf("]);", start);
      if (start !== -1 && close !== -1) {
        content =
          content.slice(0, close) +
          `  "${n.capId}",\n` +
          content.slice(close);
        edits.push({ path: p, changed: true, note: "REQUIRED_CAPABILITY_IDS += capId" });
      } else {
        edits.push({ path: p, changed: false, note: "REQUIRED_CAPABILITY_IDS anchor not found" });
      }
    } else {
      edits.push({ path: p, changed: false, note: "REQUIRED_CAPABILITY_IDS already has capId" });
    }

    // 2b. insert capability row before the close of defaultCapabilityRows()
    if (!content.includes(`capability_id: "${n.capId}"`)) {
      const fnStart = content.indexOf("function defaultCapabilityRows()");
      const close = content.indexOf("\n  ]);", fnStart);
      if (fnStart !== -1 && close !== -1) {
        content =
          content.slice(0, close + 1) +
          fill(REGISTRY_ROW_TEMPLATE, tokens) +
          content.slice(close + 1);
        edits.push({ path: p, changed: true, note: "defaultCapabilityRows += row" });
      } else {
        edits.push({ path: p, changed: false, note: "defaultCapabilityRows anchor not found" });
      }
    } else {
      edits.push({ path: p, changed: false, note: "defaultCapabilityRows already has row" });
    }

    // 2c. bump count prose: "the <word> shipped pre-action spine capabilities"
    if (oldCount != null && !capPresent) {
      const oldWord = numberWord(oldCount);
      const newWord = numberWord(newCount);
      const re = new RegExp(
        `the ${oldWord} shipped pre-action spine capabilities`,
        "g",
      );
      if (re.test(content)) {
        content = content.replace(
          re,
          `the ${newWord} shipped pre-action spine capabilities`,
        );
        edits.push({ path: p, changed: true, note: `count prose ${oldWord}->${newWord}` });
      }
    }

    if (!opts.dryRun) writeFileSync(abs, content);
    else edits.push({ path: p, changed: false, note: "(dry-run: registry not written)" });
    // stash for digit-bump step below; doBump false on idempotent re-run
    main._registryCount = { oldCount, newCount, doBump: !capPresent };
  }

  // 3. registry test — bump hardcoded capability_count / measured_repo_count.
  {
    const p = "tests/dema-capability-truth-registry.test.js";
    const abs = join(repo, p);
    let content = readFileSync(abs, "utf8");
    const { oldCount, newCount, doBump } = main._registryCount || {};
    if (oldCount != null && doBump) {
      let any = false;
      for (const field of ["capability_count", "measured_repo_count"]) {
        const r = bumpCountDigits(content, field, oldCount, newCount);
        content = r.content;
        any = any || r.changed;
      }
      // test-name / prose number-word
      const oldWord = numberWord(oldCount);
      const newWord = numberWord(newCount);
      const wre = new RegExp(`${oldWord}-capability truth registry`, "g");
      if (wre.test(content)) {
        content = content.replace(wre, `${newWord}-capability truth registry`);
        any = true;
      }
      edits.push({
        path: p,
        changed: any,
        note: any ? `count ${oldCount}->${newCount}` : "no count anchors matched",
      });
      if (any && !opts.dryRun) writeFileSync(abs, content);
    }
  }

  // 4. docs/TESTING.md — table row + review command line.
  {
    const p = "docs/TESTING.md";
    const abs = join(repo, p);
    let content = readFileSync(abs, "utf8");
    const row =
      `| \`tests/${n.kebab}.test.js\`        | ${n.id} (\`packages/core/src/${n.kebab}.js\` + ` +
      `\`scripts/review/${n.kebab}-check.mjs\`): ${opts.intent} Red-first scaffold — ` +
      `fill the kernel bodies and turn the proof contract green. N tests. Wired into \`npm run check\`. |`;
    const r1 = appendTableRow(content, "| `tests/", row, `tests/${n.kebab}.test.js`);
    content = r1.content;
    const cmdLine = `node scripts/review/${n.kebab}-check.mjs`;
    const r2 = insertBefore(
      content,
      "node scripts/review/dema-capability-truth-registry-check.mjs",
      `${cmdLine}\n`,
      cmdLine,
    );
    content = r2.content;
    const changed = r1.changed || r2.changed;
    edits.push({ path: p, changed, note: `row:${r1.note}; cmd:${r2.note}` });
    if (changed && !opts.dryRun) writeFileSync(abs, content);
  }

  // 5. docs/CURRENT_LIMITS.md — capability table row.
  {
    const p = "docs/CURRENT_LIMITS.md";
    const abs = join(repo, p);
    let content = readFileSync(abs, "utf8");
    const archRef = opts.arch
      ? `\`docs/02-architecture/${n.prefix}_v0_1.md\` + `
      : "";
    const row =
      `| ${opts.intent} (${n.id}) | \`packages/core/src/${n.kebab}.js\` + ` +
      `\`tests/${n.kebab}.test.js\` + \`scripts/review/${n.kebab}-check.mjs\` + ` +
      `${archRef}\`docs/receipts/${n.capId}.md\`. ` +
      `Red-first scaffold — promote to [MEASURED] only once the focused test and \`npm run check\` pass. ` +
      `No execution, daemon, network, token, wallet, or federation. |`;
    const r = insertBefore(
      content,
      "| Stdlib-only dependency posture",
      `${row}\n`,
      `(${n.id})`,
    );
    edits.push({ path: p, ...r });
    if (r.changed && !opts.dryRun) writeFileSync(abs, r.content);
  }

  // 6. canonical-json-v1 gate — register the generated kernel as an authorized
  //    canon consumer (M5.1B). The kernel imports packages/canon; without this
  //    anchored one-line insert the adoption-freeze scan fails closed.
  {
    const p = "scripts/review/canonical-json-v1-check.mjs";
    const abs = join(repo, p);
    const content = readFileSync(abs, "utf8");
    const r = insertLineBefore(
      content,
      "// scaffold:register-consumer",
      `  "packages/core/src/${n.kebab}.js",`,
      `"packages/core/src/${n.kebab}.js"`,
    );
    edits.push({ path: p, ...r });
    if (r.changed && !opts.dryRun) writeFileSync(abs, r.content);
  }

  // --- write new files ---------------------------------------------------
  if (!opts.dryRun) {
    for (const f of files) {
      const abs = join(repo, f.path);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, f.body);
    }
  }

  // --- report ------------------------------------------------------------
  const report = {
    ok: true,
    dry_run: opts.dryRun,
    id: n.id,
    names: n,
    truth_label: truthLabel,
    go_phrase: goPhrase,
    files_written: files.map((f) => f.path),
    wiring: edits,
    next: [
      `node --test tests/${n.kebab}.test.js   # expect RED (not_implemented)`,
      `# build packages/core/src/${n.kebab}.js until the test goes green`,
      `node scripts/review/${n.kebab}-check.mjs --json`,
      `# review the one-line canon consumer registration in scripts/review/canonical-json-v1-check.mjs`,
      `npm test && npm run check`,
    ],
  };

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`${opts.dryRun ? "[DRY-RUN] " : ""}Scaffolded ${n.id}`);
    console.log(`  truth_label: ${truthLabel}`);
    console.log(`  go_phrase:   ${goPhrase}`);
    console.log("  files:");
    for (const f of files) console.log(`    + ${f.path}`);
    console.log("  wiring:");
    for (const e of edits) {
      const mark = e.changed ? "✓" : "·";
      console.log(`    ${mark} ${e.path} — ${e.note}`);
    }
    console.log("  next:");
    for (const step of report.next) console.log(`    ${step}`);
    console.log("\n  RED-FIRST: the slice is intentionally failing. Build to green");
    console.log("  before any commit. Do not weaken the test to match an empty kernel.");
  }
}

try {
  main();
} catch (err) {
  console.error(`scaffold_slice: ${err.message}`);
  process.exit(1);
}
