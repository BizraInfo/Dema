// scripts/verify-root-canon.mjs
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(
  repoRoot,
  "docs/root-canon/root-canon.manifest.json",
);

function digest(buffer, algorithm) {
  return createHash(algorithm).update(buffer).digest("hex");
}

function fail(reason, extra = {}) {
  return {
    verified: false,
    reason,
    ...extra,
  };
}

export async function verifyRootCanon() {
  const manifestRaw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw);

  if (manifest.status !== "IMMUTABLE") {
    return fail("ROOT_CANON_NOT_IMMUTABLE");
  }

  // --- Authority contract: all six predicates must hold exactly ---
  const REQUIRED_AUTHORITY = {
    founder_can_modify: false,
    network_vote_can_modify: false,
    agent_can_modify: false,
    model_can_modify: false,
    validator_can_modify: false,
    fork_if_modified: true,
  };

  if (!manifest.authority || typeof manifest.authority !== "object") {
    return fail("ROOT_CANON_AUTHORITY_MISSING");
  }

  for (const [key, requiredValue] of Object.entries(REQUIRED_AUTHORITY)) {
    if (manifest.authority[key] !== requiredValue) {
      return fail(`ROOT_CANON_AUTHORITY_PREDICATE_INVALID_${key.toUpperCase()}`, {
        expected: { [key]: requiredValue },
        actual: { [key]: manifest.authority[key] },
      });
    }
  }

  // Reject unexpected authority members (no silent expansion)
  const knownKeys = new Set(Object.keys(REQUIRED_AUTHORITY));
  for (const key of Object.keys(manifest.authority)) {
    if (!knownKeys.has(key)) {
      return fail("ROOT_CANON_AUTHORITY_UNEXPECTED_MEMBER", {
        unexpected: key,
      });
    }
  }

  // --- Root identity set: exactly three canonical roots, exact ID/path pairing ---
  if (!Array.isArray(manifest.roots) || manifest.roots.length !== 3) {
    return fail("ROOT_CANON_REQUIRES_EXACTLY_THREE_ROOTS");
  }

  const EXPECTED_ROOTS = Object.freeze([
    { id: "ROOT_1_THE_MESSAGE", path: "docs/root-canon/source/themassage.pdf" },
    { id: "ROOT_2_THE_SEED", path: "docs/root-canon/source/bizra.pdf" },
    {
      id: "ROOT_3_THE_THIRD_FACT",
      path: "docs/root-canon/source/BIZRA_Third_Fact_v0_1_FINAL.pdf",
    },
  ]);

  const observedIds = manifest.roots.map((r) => r.id);
  const observedPaths = manifest.roots.map((r) => r.path);

  // No duplicate IDs
  if (new Set(observedIds).size !== observedIds.length) {
    return fail("ROOT_CANON_DUPLICATE_ROOT_ID");
  }

  // No duplicate paths
  if (new Set(observedPaths).size !== observedPaths.length) {
    return fail("ROOT_CANON_DUPLICATE_ROOT_PATH");
  }

  // No extra roots
  for (const id of observedIds) {
    if (!EXPECTED_ROOTS.find((e) => e.id === id)) {
      return fail("ROOT_CANON_UNEXPECTED_ROOT", { unexpected: id });
    }
  }

  // No missing roots
  for (const expected of EXPECTED_ROOTS) {
    if (!observedIds.includes(expected.id)) {
      return fail("ROOT_CANON_MISSING_ROOT", { missing: expected.id });
    }
  }

  // ID/path pairs must match canonical pairing (no swaps)
  for (const root of manifest.roots) {
    const expected = EXPECTED_ROOTS.find((e) => e.id === root.id);
    if (!expected || expected.path !== root.path) {
      return fail("ROOT_CANON_ID_PATH_MISMATCH", {
        id: root.id,
        observed_path: root.path,
        expected_path: expected?.path,
      });
    }
  }

  // --- Hash verification ---
  const results = [];

  for (const root of manifest.roots) {
    const absolute = path.join(repoRoot, root.path);
    const bytes = await readFile(absolute);

    const sha256 = digest(bytes, "sha256");
    const sha3_512 = digest(bytes, "sha3-512");

    const ok256 = sha256 === root.sha256;
    const ok512 = sha3_512 === root.sha3_512;

    results.push({
      id: root.id,
      path: root.path,
      sha256_ok: ok256,
      sha3_512_ok: ok512,
      verified: ok256 && ok512,
    });
  }

  const failed = results.filter((r) => !r.verified);

  if (failed.length > 0) {
    return fail("ROOT_CANON_HASH_MISMATCH", { failed, results });
  }

  return {
    verified: true,
    canon_id: manifest.canon_id,
    status: manifest.status,
    roots_verified: results.length,
    result: "BIZRA_ROOT_CANON_SEALED",
    results,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await verifyRootCanon();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.verified ? 0 : 1);
}
