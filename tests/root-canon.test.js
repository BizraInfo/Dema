// tests/root-canon.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { verifyRootCanon } from "../scripts/verify-root-canon.mjs";

const MANIFEST_PATH = join(
  process.cwd(),
  "docs/root-canon/root-canon.manifest.json",
);

// Helper: snapshot raw bytes, tamper JSON, restore raw bytes (exact fidelity)
async function withTamperedManifest(updater, fn) {
  const originalBytes = await readFile(MANIFEST_PATH, "utf8");
  const tampered = JSON.parse(originalBytes);
  updater(tampered);
  await writeFile(MANIFEST_PATH, JSON.stringify(tampered, null, 2) + "\n");
  try {
    await fn();
  } finally {
    // Restore exact original bytes (preserves trailing newline, BOM, etc.)
    await writeFile(MANIFEST_PATH, originalBytes);
  }
}

// RC-01: Positive
test("RC-01 the root canon verifies correctly on canonical bytes", async () => {
  const result = await verifyRootCanon();
  assert.equal(result.verified, true);
  assert.equal(result.status, "IMMUTABLE");
  assert.equal(result.roots_verified, 3);
  assert.equal(result.result, "BIZRA_ROOT_CANON_SEALED");
  assert.equal(typeof result.canon_id, "string");
});

// Authority predicate negative controls
const AUTHORITY_FIELDS_TO_FLIP = [
  ["founder_can_modify", false, true],
  ["network_vote_can_modify", false, true],
  ["agent_can_modify", false, true],
  ["model_can_modify", false, true],
  ["validator_can_modify", false, true],
  ["fork_if_modified", true, false],
];

for (const [field, _expected, bad] of AUTHORITY_FIELDS_TO_FLIP) {
  test(`RC-AUTH flip ${field} to ${bad} - refuses`, async () => {
    await withTamperedManifest(
      (m) => { m.authority[field] = bad; },
      async () => {
        const result = await verifyRootCanon();
        assert.equal(result.verified, false);
        assert.ok(
          result.reason.includes(field.toUpperCase()),
          `expected reason to contain ${field.toUpperCase()}, got ${result.reason}`,
        );
      },
    );
  });
}

test("RC-AUTH missing authority object - refuses", async () => {
  await withTamperedManifest(
    (m) => { delete m.authority; },
    async () => {
      const result = await verifyRootCanon();
      assert.equal(result.verified, false);
      assert.equal(result.reason, "ROOT_CANON_AUTHORITY_MISSING");
    },
  );
});

test("RC-AUTH unexpected authority member - refuses", async () => {
  await withTamperedManifest(
    (m) => { m.authority.future_council_can_modify = false; },
    async () => {
      const result = await verifyRootCanon();
      assert.equal(result.verified, false);
      assert.equal(result.reason, "ROOT_CANON_AUTHORITY_UNEXPECTED_MEMBER");
    },
  );
});

// Root identity negative controls

test("RC-ID fewer than 3 roots - refuses", async () => {
  await withTamperedManifest(
    (m) => { m.roots = m.roots.slice(0, 2); },
    async () => {
      const r = await verifyRootCanon();
      assert.equal(r.verified, false);
      assert.equal(r.reason, "ROOT_CANON_REQUIRES_EXACTLY_THREE_ROOTS");
    },
  );
});

test("RC-ID more than 3 roots - refuses", async () => {
  await withTamperedManifest(
    (m) => { m.roots.push({ ...m.roots[0], id: "ROOT_4_FAKE" }); },
    async () => {
      const r = await verifyRootCanon();
      assert.equal(r.verified, false);
      assert.equal(r.reason, "ROOT_CANON_REQUIRES_EXACTLY_THREE_ROOTS");
    },
  );
});

test("RC-ID duplicate root ID - refuses", async () => {
  await withTamperedManifest(
    (m) => { m.roots[1] = { ...m.roots[0] }; },
    async () => {
      const r = await verifyRootCanon();
      assert.equal(r.verified, false);
      assert.equal(r.reason, "ROOT_CANON_DUPLICATE_ROOT_ID");
    },
  );
});

test("RC-ID duplicate root path - refuses", async () => {
  await withTamperedManifest(
    (m) => { m.roots[1] = { ...m.roots[1], path: m.roots[0].path }; },
    async () => {
      const r = await verifyRootCanon();
      assert.equal(r.verified, false);
      assert.equal(r.reason, "ROOT_CANON_DUPLICATE_ROOT_PATH");
    },
  );
});

test("RC-ID unexpected root ID - refuses", async () => {
  await withTamperedManifest(
    (m) => { m.roots[0] = { ...m.roots[0], id: "ROOT_FAKE" }; },
    async () => {
      const r = await verifyRootCanon();
      assert.equal(r.verified, false);
      assert.equal(r.reason, "ROOT_CANON_UNEXPECTED_ROOT");
    },
  );
});

test("RC-ID missing root replaced by fake - refuses", async () => {
  await withTamperedManifest(
    (m) => { m.roots[2] = { ...m.roots[2], id: "ROOT_FAKE" }; },
    async () => {
      const r = await verifyRootCanon();
      assert.equal(r.verified, false);
      assert.equal(r.reason, "ROOT_CANON_UNEXPECTED_ROOT");
    },
  );
});

test("RC-ID ID/path swap - refuses", async () => {
  await withTamperedManifest(
    (m) => {
      const tmpPath = m.roots[0].path;
      m.roots[0].path = m.roots[1].path;
      m.roots[1].path = tmpPath;
    },
    async () => {
      const r = await verifyRootCanon();
      assert.equal(r.verified, false);
      assert.equal(r.reason, "ROOT_CANON_ID_PATH_MISMATCH");
    },
  );
});

test("RC-ID wrong path for correct ID - refuses", async () => {
  await withTamperedManifest(
    (m) => { m.roots[0].path = "docs/root-canon/source/fake.pdf"; },
    async () => {
      const r = await verifyRootCanon();
      assert.equal(r.verified, false);
      assert.equal(r.reason, "ROOT_CANON_ID_PATH_MISMATCH");
    },
  );
});

// Hash drift controls

test("RC-HASH SHA-256 drift - refuses", async () => {
  await withTamperedManifest(
    (m) => { m.roots[0].sha256 = "0".repeat(64); },
    async () => {
      const r = await verifyRootCanon();
      assert.equal(r.verified, false);
      assert.equal(r.reason, "ROOT_CANON_HASH_MISMATCH");
    },
  );
});

test("RC-HASH SHA3-512 drift - refuses", async () => {
  await withTamperedManifest(
    (m) => { m.roots[0].sha3_512 = "0".repeat(128); },
    async () => {
      const r = await verifyRootCanon();
      assert.equal(r.verified, false);
      assert.equal(r.reason, "ROOT_CANON_HASH_MISMATCH");
    },
  );
});
