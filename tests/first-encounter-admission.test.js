import test from "node:test";
import assert from "node:assert/strict";

import {
  FIRST_ENCOUNTER_ADMISSION_SCHEMA,
  FORBIDDEN_CONTENT_KEYS,
  METADATA_FIELDS,
  assertMetadataOnly,
  isWithinRoot,
  normalizeInventory,
  buildConsentContract,
  evaluateAdmission,
} from "../packages/core/src/first-encounter-admission.js";

const rec = (over = {}) => ({
  relative_path: "docs/requirements.md",
  extension: ".md",
  size: 1024,
  modified_time: "2025-10-01T00:00:00.000Z",
  file_hash: "a".repeat(64),
  ...over,
});

/* ---------------------------------------------------------------- law 1:
 * the metadata phase must PHYSICALLY prevent content access.
 * Enforced in the kernel, not displayed by the UI. */

test("law1 metadata record carrying content is rejected, not sanitised", () => {
  for (const key of FORBIDDEN_CONTENT_KEYS) {
    assert.throws(
      () => assertMetadataOnly(rec({ [key]: "the quick brown fox" })),
      /CONTENT_LEAK_IN_METADATA_PHASE/,
      `expected ${key} to be refused`,
    );
  }
});

test("law1 forbidden key set covers the named leak vectors", () => {
  for (const k of ["content", "preview", "text", "excerpt", "body", "embedding", "snippet"]) {
    assert.ok(FORBIDDEN_CONTENT_KEYS.includes(k), `${k} must be forbidden`);
  }
});

test("law1 an unknown extra key fails closed", () => {
  assert.throws(() => assertMetadataOnly(rec({ surprise: 1 })), /UNDECLARED_METADATA_FIELD/);
});

test("law1 a clean record carries exactly the five declared fields", () => {
  const clean = assertMetadataOnly(rec());
  assert.deepEqual(Object.keys(clean).sort(), [...METADATA_FIELDS].sort());
});

test("law1 a missing declared field fails closed", () => {
  const { file_hash, ...missing } = rec();
  assert.throws(() => assertMetadataOnly(missing), /MISSING_METADATA_FIELD/);
});

/* ---------------------------------------------------------------- law 2:
 * the challenge key must be outside every runtime scope. */

test("law2 paths inside the root are admitted", () => {
  assert.equal(isWithinRoot("/demo/corpus", "/demo/corpus/docs/requirements.md"), true);
  assert.equal(isWithinRoot("/demo/corpus", "/demo/corpus"), true);
});

test("law2 traversal to the challenge key is refused", () => {
  assert.equal(isWithinRoot("/demo/corpus", "/demo/CHALLENGE_KEY.md"), false);
  assert.equal(isWithinRoot("/demo/corpus", "/demo/corpus/../CHALLENGE_KEY.md"), false);
});

test("law2 a sibling directory sharing a name prefix is refused", () => {
  // /demo/corpus-secret must NOT pass a naive startsWith check
  assert.equal(isWithinRoot("/demo/corpus", "/demo/corpus-secret/key.md"), false);
});

test("law2 an empty or relative root fails closed", () => {
  assert.equal(isWithinRoot("", "/demo/corpus/a.md"), false);
  assert.equal(isWithinRoot("relative/root", "/demo/corpus/a.md"), false);
});

/* ---------------------------------------------------------------- inventory */

test("inventory is deterministically ordered and counted", () => {
  const a = normalizeInventory([rec({ relative_path: "z.md" }), rec({ relative_path: "a.md" })]);
  const b = normalizeInventory([rec({ relative_path: "a.md" }), rec({ relative_path: "z.md" })]);
  assert.deepEqual(a, b);
  assert.equal(a.file_count, 2);
  assert.deepEqual(a.files.map((f) => f.relative_path), ["a.md", "z.md"]);
});

test("inventory totals bytes and refuses a duplicate path", () => {
  const inv = normalizeInventory([rec({ size: 10 }), rec({ relative_path: "b.md", size: 5 })]);
  assert.equal(inv.total_bytes, 15);
  assert.throws(() => normalizeInventory([rec(), rec()]), /DUPLICATE_RELATIVE_PATH/);
});

/* ---------------------------------------------------------------- consent */

const contractOf = (over = {}) =>
  buildConsentContract({
    root_label: "corpus",
    root_real_path: "/demo/corpus",
    inventory: normalizeInventory([rec({ size: 10 }), rec({ relative_path: "b.md", size: 5 })]),
    mission_question: "What was actually decided?",
    ...over,
  });

test("consent contract states exact scope, count, bytes and permission", () => {
  const c = contractOf();
  assert.equal(c.schema, FIRST_ENCOUNTER_ADMISSION_SCHEMA);
  assert.equal(c.scope.root_real_path, "/demo/corpus");
  assert.equal(c.scope.file_count, 2);
  assert.equal(c.scope.total_bytes, 15);
  assert.equal(c.permission.effect, "READ_FILE_CONTENT");
  assert.equal(c.permission.write_permitted, false);
  assert.equal(c.permission.network_permitted, false);
  assert.ok(c.required_phrase.length > 0);
  assert.ok(c.reject_option.available);
});

test("consent phrase is bound to the exact scope — a wider scope is a different phrase", () => {
  const narrow = contractOf();
  const wider = contractOf({ root_real_path: "/demo" });
  assert.notEqual(narrow.required_phrase, wider.required_phrase);
});

test("admission refuses when no phrase is given", () => {
  const v = evaluateAdmission({ contract: contractOf(), provided_phrase: "" });
  assert.equal(v.state, "REFUSED");
  assert.equal(v.content_admitted, false);
  assert.ok(v.reason_codes.includes("CONSENT_PHRASE_ABSENT"));
});

test("admission refuses a near-miss phrase — no fuzzy consent", () => {
  const c = contractOf();
  const v = evaluateAdmission({ contract: c, provided_phrase: c.required_phrase.toLowerCase() + " " });
  assert.equal(v.state, "REFUSED");
  assert.ok(v.reason_codes.includes("CONSENT_PHRASE_MISMATCH"));
});

test("admission grants only on the exact phrase", () => {
  const c = contractOf();
  const v = evaluateAdmission({ contract: c, provided_phrase: c.required_phrase });
  assert.equal(v.state, "ADMITTED");
  assert.equal(v.content_admitted, true);
  assert.deepEqual(v.reason_codes, []);
});

test("admission never widens: the granted scope equals the contract scope", () => {
  const c = contractOf();
  const v = evaluateAdmission({ contract: c, provided_phrase: c.required_phrase });
  assert.deepEqual(v.granted_scope, c.scope);
  assert.equal(v.granted_scope.root_real_path, "/demo/corpus");
});

test("admission refuses a phrase minted for a different scope", () => {
  const narrow = contractOf();
  const wider = contractOf({ root_real_path: "/demo" });
  const v = evaluateAdmission({ contract: narrow, provided_phrase: wider.required_phrase });
  assert.equal(v.state, "REFUSED");
  assert.ok(v.reason_codes.includes("CONSENT_PHRASE_MISMATCH"));
});

/* ---------------------------------------------------------------- boundary */

test("every admission verdict carries an all-false runtime boundary", () => {
  const c = contractOf();
  for (const phrase of ["", c.required_phrase]) {
    const v = evaluateAdmission({ contract: c, provided_phrase: phrase });
    assert.deepEqual(v.boundaries, {
      content_read_before_consent: false,
      network_used: false,
      source_mutation_performed: false,
      scope_widened_after_consent: false,
      challenge_key_in_scope: false,
    });
  }
});

test("truth label stays local and unsigned until the signer lane closes", () => {
  assert.equal(contractOf().truth_label, "LOCAL_CONTENT_ADDRESSED");
});
