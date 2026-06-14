import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// lib/ is one level deeper than src/ — need 4 levels to reach repo root
const pkgPath = join(here, "..", "..", "..", "..", "package.json");

export async function readPackageVersion() {
  try {
    const raw = await readFile(pkgPath, "utf8");
    return JSON.parse(raw).version ?? "0.0.0-unknown";
  } catch {
    return "0.0.0-unknown";
  }
}
