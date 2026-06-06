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

  if (manifest.authority?.founder_can_modify !== false) {
    return fail("ROOT_CANON_FOUNDER_MUTABILITY_FORBIDDEN");
  }

  if (manifest.authority?.network_vote_can_modify !== false) {
    return fail("ROOT_CANON_NETWORK_MUTABILITY_FORBIDDEN");
  }

  if (!Array.isArray(manifest.roots) || manifest.roots.length !== 3) {
    return fail("ROOT_CANON_REQUIRES_EXACTLY_THREE_ROOTS");
  }

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
