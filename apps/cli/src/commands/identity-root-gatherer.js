// TALK-IDENTITY-1A — read-only root-file gatherer (apps/cli).
//
// Reads the five founding root PDFs and measures their sha256 so the pure
// identity kernel can compare against its pins. No network, no mutation, no
// interpretation — bytes in, hashes out. Roots dir resolves from
// DEMA_ROOTS_DIR, else the estate default.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

import {
  DEFAULT_IDENTITY_ROOTS_DIR,
  IDENTITY_ROOT_PINS,
} from "../../../../packages/core/src/dema-identity-root-canon.js";

export function resolveIdentityRootsDir({ env = process.env } = {}) {
  const envDir = env.DEMA_ROOTS_DIR;
  if (typeof envDir === "string" && envDir.length > 0) return envDir;
  return DEFAULT_IDENTITY_ROOTS_DIR;
}

export function readIdentityRoots({
  env = process.env,
  readFileImpl = readFileSync,
} = {}) {
  const dir = resolveIdentityRootsDir({ env });
  const root_files = [];
  for (const pin of IDENTITY_ROOT_PINS) {
    const abs = join(dir, pin.file);
    try {
      const bytes = readFileImpl(abs);
      root_files.push({
        file: pin.file,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    } catch (err) {
      return {
        ok: false,
        roots_dir: dir,
        error: `root_unreadable · ${pin.file} · ${err?.message ?? String(err)}`,
      };
    }
  }
  return { ok: true, roots_dir: dir, root_files };
}
