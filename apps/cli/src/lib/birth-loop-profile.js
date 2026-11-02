// Shared CLI read of DEMA_HOME/profile.json for birth-loop classification.
// Keeps packages/core/dema-birth-loop.js pure (no fs).

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildDemaBirthLoop } from "../../../../packages/core/src/dema-birth-loop.js";
import { defaultDemaHome } from "../../../../packages/core/src/operator-profile.js";

export async function readProfileState(home = defaultDemaHome()) {
  const profilePath = join(home, "profile.json");
  let raw;
  try {
    raw = await readFile(profilePath, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return { profile: null };
    return { profileError: "unreadable" };
  }
  try {
    return { profile: JSON.parse(raw) };
  } catch {
    return { profileError: "invalid_json" };
  }
}

/** @returns {Promise<{ node_state: string, birth_loop: object }>} */
export async function loadBirthLoopFace(home = defaultDemaHome()) {
  const { profile = null, profileError = null } = await readProfileState(home);
  const birth_loop = buildDemaBirthLoop({ profile, profileError });
  return { node_state: birth_loop.node_state, birth_loop };
}
