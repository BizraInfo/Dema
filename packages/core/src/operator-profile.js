import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
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

function pickIso639_1(obj, key) {
  const v = obj?.[key];
  if (typeof v !== "string") return null;
  if (/^[a-z]{2}$/.test(v) || v === "other") return v;
  return null;
}

export async function readOperatorLanguage(home = defaultDemaHome()) {
  try {
    const raw = await readFile(join(home, "profile.json"), "utf8");
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return { language_code: null, secondary_language_code: null, source: "malformed" };
    }
    return {
      language_code: pickIso639_1(data, "language_code") ?? pickIso639_1(data, "language"),
      secondary_language_code: pickIso639_1(data, "secondary_language_code"),
      source: "profile_json",
    };
  } catch {
    return { language_code: null, secondary_language_code: null, source: "absent" };
  }
}

export async function writeOperatorLanguage({ home = defaultDemaHome(), language_code, secondary_language_code = null } = {}) {
  const profilePath = join(home, "profile.json");
  const tmpPath = profilePath + ".tmp";

  // Read existing profile or start fresh
  let existing = {};
  try {
    const raw = await readFile(profilePath, "utf8");
    try { existing = JSON.parse(raw); } catch { /* malformed — overwrite */ }
  } catch { /* absent — create */ }

  const now = new Date().toISOString();
  const merged = Object.assign(
    {
      schema: "bizra.dema.profile.v0.1",
      preferred_name: null,
      memory_consent: "local",
      hidden_autonomy: false,
      created_at: now,
    },
    existing,
    {
      language_code: language_code ?? null,
      secondary_language_code: secondary_language_code ?? null,
    }
  );

  await mkdir(dirname(profilePath), { recursive: true });
  await writeFile(tmpPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  await rename(tmpPath, profilePath);
}
