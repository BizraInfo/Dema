import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

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
