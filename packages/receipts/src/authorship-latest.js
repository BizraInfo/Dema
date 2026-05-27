import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export const AUTHORSHIP_LATEST_SCHEMA = "bizra.dema.authorship_latest.v0.1";

const BOUNDARY = Object.freeze({
  read_only: true,
  private_key_loaded: false,
  public_key_loaded: false,
  signature_verified: false,
  network_used: false,
  federation_used: false,
  token_minted: false,
  receipt_mutated: false,
});

function resolveHome(demaHome) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

export async function findLatestAuthorshipReceipt(demaHome) {
  const home = resolveHome(demaHome);
  const receiptsDir = join(home, "receipts");
  try {
    const entries = await readdir(receiptsDir);
    const authorship = entries.filter(
      (f) => f.startsWith("authorship-") && f.endsWith(".json"),
    );
    if (authorship.length === 0) return null;

    let latest = null;
    let latestMtime = 0;
    for (const filename of authorship) {
      const p = join(receiptsDir, filename);
      const s = await stat(p);
      if (s.mtimeMs > latestMtime) {
        latestMtime = s.mtimeMs;
        latest = { path: p, filename, mtimeMs: s.mtimeMs };
      }
    }
    return latest;
  } catch {
    return null;
  }
}

export async function getLatestAuthorshipReceiptSummary(demaHome) {
  const result = await findLatestAuthorshipReceipt(demaHome);
  if (!result) {
    return Object.freeze({
      schema: AUTHORSHIP_LATEST_SCHEMA,
      found: false,
      receipt_path: null,
      receipt_filename: null,
      mtime_ms: null,
      boundary: BOUNDARY,
    });
  }
  return Object.freeze({
    schema: AUTHORSHIP_LATEST_SCHEMA,
    found: true,
    receipt_path: result.path,
    receipt_filename: result.filename,
    mtime_ms: result.mtimeMs,
    boundary: BOUNDARY,
  });
}
