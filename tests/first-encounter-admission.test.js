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

/* ── scan resilience (real filesystem) ────────────────────────────────────────
 *
 * DEMA-FIRST-ENCOUNTER-SCAN-RESILIENCE-1B. Until this existed, nothing
 * exercised scanMetadataOnly against a real filesystem at all: readdir, lstat
 * and the digest's createReadStream were unguarded, so one permission-denied
 * entry rejected the whole scan and discarded every record already collected.
 * The P4 acceptance harness asserted `Array.isArray(payload.skipped)` and never
 * that it POPULATES, so 31/31 passed straight over the gap.
 *
 * These use real chmod because the failure is a real primitive error — a fake
 * fs that returns a benign value would hide exactly the bug under test. When
 * the process can read anything regardless of mode (root, or a filesystem that
 * ignores permissions), the restriction is not observable and the test skips
 * rather than asserting something it did not create.
 */

const canEnforceModes = async (fsp, dir, path) => {
  await fsp.chmod(path, 0o000);
  try {
    await fsp.readdir(path);
    return false; // permissions not enforced here (root / no-perm filesystem)
  } catch {
    return true;
  } finally {
    await fsp.chmod(path, 0o755);
  }
};

test("an unreadable directory is ledgered, and its siblings still scan", async (t) => {
  const fsp = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { scanMetadataOnly } = await import("../packages/core/src/first-encounter-scan.js");

  const root = await fsp.mkdtemp(join(tmpdir(), "fe-scan-"));
  try {
    await fsp.mkdir(join(root, "locked"));
    await fsp.writeFile(join(root, "locked", "hidden.md"), "x");
    await fsp.mkdir(join(root, "open"));
    await fsp.writeFile(join(root, "open", "visible.md"), "hello");
    await fsp.writeFile(join(root, "top.md"), "hi");

    if (!(await canEnforceModes(fsp, root, join(root, "locked")))) {
      t.skip("filesystem does not enforce modes for this process");
      return;
    }
    await fsp.chmod(join(root, "locked"), 0o000);

    const out = await scanMetadataOnly(root);

    // The whole scan survived: both readable files are present.
    const paths = out.inventory.files.map((r) => r.relative_path).sort();
    assert.deepEqual(paths, ["open/visible.md", "top.md"]);

    // And the failure is disclosed, not swallowed.
    const entry = out.skipped.find((s) => s.relative_path === "locked");
    assert.ok(entry, `expected a ledger entry for "locked", got ${JSON.stringify(out.skipped)}`);
    assert.equal(entry.reason, "UNREADABLE_DIRECTORY");
  } finally {
    await fsp.chmod(join(root, "locked"), 0o755).catch(() => {});
    await fsp.rm(root, { recursive: true, force: true });
  }
});

test("an unreadable file is ledgered at the digest, not thrown", async (t) => {
  const fsp = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { scanMetadataOnly } = await import("../packages/core/src/first-encounter-scan.js");

  const root = await fsp.mkdtemp(join(tmpdir(), "fe-scan-"));
  try {
    const secret = join(root, "secret.md");
    await fsp.writeFile(secret, "unreadable bytes");
    await fsp.writeFile(join(root, "readable.md"), "fine");

    await fsp.chmod(secret, 0o000);
    let enforced = true;
    try {
      await fsp.readFile(secret);
      enforced = false;
    } catch {
      /* enforced */
    }
    if (!enforced) {
      t.skip("filesystem does not enforce modes for this process");
      return;
    }

    const out = await scanMetadataOnly(root);

    assert.deepEqual(
      out.inventory.files.map((r) => r.relative_path),
      ["readable.md"],
    );
    const entry = out.skipped.find((s) => s.relative_path === "secret.md");
    assert.ok(entry, `expected a ledger entry, got ${JSON.stringify(out.skipped)}`);
    assert.equal(entry.reason, "UNREADABLE_FILE");
  } finally {
    await fsp.chmod(join(root, "secret.md"), 0o644).catch(() => {});
    await fsp.rm(root, { recursive: true, force: true });
  }
});

test("a clean tree still scans, and the ledger stays empty and sorted", async () => {
  const fsp = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { scanMetadataOnly } = await import("../packages/core/src/first-encounter-scan.js");

  const root = await fsp.mkdtemp(join(tmpdir(), "fe-scan-"));
  try {
    await fsp.mkdir(join(root, "b"));
    await fsp.writeFile(join(root, "b", "two.md"), "two");
    await fsp.writeFile(join(root, "a.md"), "one");

    const first = await scanMetadataOnly(root);
    const second = await scanMetadataOnly(root);

    assert.deepEqual(first.skipped, []);
    assert.deepEqual(
      first.inventory.files.map((r) => r.relative_path),
      ["a.md", "b/two.md"],
    );
    // Deterministic across runs — the ledger must not depend on traversal timing.
    assert.deepEqual(first.inventory, second.inventory);
    assert.deepEqual(first.skipped, second.skipped);
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
});

test("isWithinRoot strips trailing slashes without polynomial backtracking", () => {
  // Behaviour is unchanged by the de-regex fix.
  assert.equal(isWithinRoot("/demo/corpus/", "/demo/corpus/a"), true);
  assert.equal(isWithinRoot("/demo/corpus///", "/demo/corpus/a"), true);
  assert.equal(isWithinRoot("/demo/corpus", "/demo/corpus"), true);
  // The original bug this root check exists for: a sibling prefix is NOT inside.
  assert.equal(isWithinRoot("/demo/corpus", "/demo/corpus-secret"), false);
  assert.equal(isWithinRoot("/", "/anything"), false, "a bare root normalises to empty and fails closed");

  // CodeQL js/polynomial-redos. The attack input is a long run of slashes followed
  // by a NON-slash: `\/+$` then fails at every start position and the engine retries
  // from each one, costing O(n^2). An all-slashes string is NOT the attack — it
  // matches greedily to `$` on the first try and stays fast even with the bug, so a
  // fixture without the trailing character silently proves nothing.
  // Measured at n=50k: regex form 560ms, this fix 0.005ms.
  const pathological = "/".repeat(50_000) + "x";
  const started = process.hrtime.bigint();
  assert.equal(isWithinRoot(pathological, "/demo/corpus/a"), false);
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(elapsedMs < 250, `trailing-slash strip must stay linear, took ${elapsedMs}ms`);
});
