import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

// Stricter than homebase-gather's pickString: empty string is treated as
// "not set" (returns null) so callers can fall back to the legacy `name`
// field. homebase-gather.js intentionally returns "" because it exposes
// the literal profile shape; this helper feeds a display surface where
// empty-string operator name is meaningless.
function pickString(obj, key) {
  const value = obj?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function defaultDemaHome() {
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

export async function readOperatorPreferredName(home = defaultDemaHome()) {
  try {
    const raw = await readFile(join(home, "profile.json"), "utf8");
    const data = JSON.parse(raw);
    return pickString(data, "preferred_name") ?? pickString(data, "name");
  } catch {
    return null;
  }
}
