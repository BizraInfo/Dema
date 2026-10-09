import { readFile, writeFile, rename, mkdir, readdir } from "node:fs/promises";
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
      return {
        language_code: null,
        secondary_language_code: null,
        source: "malformed",
      };
    }
    return {
      language_code:
        pickIso639_1(data, "language_code") ?? pickIso639_1(data, "language"),
      secondary_language_code: pickIso639_1(data, "secondary_language_code"),
      source: "profile_json",
    };
  } catch {
    return {
      language_code: null,
      secondary_language_code: null,
      source: "absent",
    };
  }
}

export async function writeGenesisPreviewCard({
  home = defaultDemaHome(),
  card,
} = {}) {
  const stateDir = join(home, "state");
  await mkdir(stateDir, { recursive: true });

  // Derive a filename-safe ISO timestamp from card.candidate or card_storage.path
  let timestamp = "unknown";
  if (card?.card_storage?.path) {
    const match = String(card.card_storage.path).match(
      /genesis-preview-(.+)\.json$/,
    );
    if (match) timestamp = match[1];
  }

  const filename = `genesis-preview-${timestamp}.json`;
  const filePath = join(stateDir, filename);
  const tmpPath = filePath + ".tmp";

  await writeFile(tmpPath, `${JSON.stringify(card, null, 2)}\n`, "utf8");
  await rename(tmpPath, filePath);
  return filePath;
}

export async function readGenesisPreviewCards(home = defaultDemaHome()) {
  const stateDir = join(home, "state");
  try {
    const entries = await readdir(stateDir);
    const cardFiles = entries
      .filter((f) => /^genesis-preview-.+\.json$/.test(f))
      .sort()
      .reverse(); // most-recent first (ISO timestamp sort is lexicographic)

    const cards = [];
    for (const f of cardFiles) {
      try {
        const raw = await readFile(join(stateDir, f), "utf8");
        cards.push(JSON.parse(raw));
      } catch {
        // skip malformed files silently
      }
    }
    return cards;
  } catch {
    return [];
  }
}

export const OPERATOR_BOND_CONSENT_PHRASE = "SAVE LOCAL OPERATOR BOND";

export const OPERATOR_BOND_LANGUAGE_CODES = Object.freeze([
  "ar",
  "en",
  "fr",
  "es",
  "ur",
  "hi",
  "other",
]);

export const OPERATOR_BOND_SEASON_BLOCK_REASON =
  "Season semantic fields have no name or language slot. The bond is stored in profile.json only.";

const BOND_LANGUAGE = new Set(OPERATOR_BOND_LANGUAGE_CODES);

function bondRefusal(reason) {
  return Object.freeze({
    ok: false,
    written: false,
    reason,
    required_phrase: OPERATOR_BOND_CONSENT_PHRASE,
    season_binding: "BLOCKED",
    season_binding_reason: OPERATOR_BOND_SEASON_BLOCK_REASON,
    path: null,
  });
}

function cleanBondName(value) {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, reason: "preferred_name_malformed" };
  const name = value.trim();
  if (name.length === 0 || name.length > 80) return { ok: false, reason: "preferred_name_malformed" };
  if (/[\u0000-\u001f]/.test(name)) return { ok: false, reason: "preferred_name_malformed" };
  return { ok: true, value: name };
}

function cleanBondLanguage(value, field) {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string" || !BOND_LANGUAGE.has(value)) {
    return { ok: false, reason: `${field}_malformed` };
  }
  return { ok: true, value };
}

/**
 * Persist the operator bond into the existing profile.json.
 * Does not write season state: the season hash has no name or language field.
 * Exact phrase required. A mismatch writes nothing.
 * @param {{
 *   home?: string,
 *   consent?: string,
 *   preferred_name?: string | null,
 *   language_code?: string | null,
 *   secondary_language_code?: string | null,
 * }} [input]
 */
export async function writeOperatorBond({
  home = defaultDemaHome(),
  consent,
  preferred_name,
  language_code,
  secondary_language_code = null,
} = {}) {
  if (consent !== OPERATOR_BOND_CONSENT_PHRASE) return bondRefusal("consent_phrase_mismatch");

  const name = cleanBondName(preferred_name);
  if (!name.ok) return bondRefusal(name.reason);
  const language = cleanBondLanguage(language_code, "language_code");
  if (!language.ok) return bondRefusal(language.reason);
  const secondary = cleanBondLanguage(secondary_language_code, "secondary_language_code");
  if (!secondary.ok) return bondRefusal(secondary.reason);
  if (name.value === null && language.value === null) return bondRefusal("nothing_to_write");

  const profilePath = join(home, "profile.json");
  const tmpPath = profilePath + ".tmp";
  let existing = {};
  try {
    const raw = await readFile(profilePath, "utf8");
    try {
      existing = JSON.parse(raw);
    } catch {
      existing = {};
    }
  } catch {
    existing = {};
  }
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) existing = {};

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
    language.value === null
      ? {}
      : {
          language_code: language.value,
          secondary_language_code: secondary.value,
        },
    name.value === null ? {} : { preferred_name: name.value },
  );

  await mkdir(dirname(profilePath), { recursive: true });
  await writeFile(tmpPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  await rename(tmpPath, profilePath);
  return Object.freeze({
    ok: true,
    written: true,
    reason: null,
    path: profilePath,
    preferred_name: pickString(merged, "preferred_name"),
    language_code: pickIso639_1(merged, "language_code"),
    secondary_language_code: pickIso639_1(merged, "secondary_language_code"),
    season_binding: "BLOCKED",
    season_binding_reason: OPERATOR_BOND_SEASON_BLOCK_REASON,
    required_phrase: OPERATOR_BOND_CONSENT_PHRASE,
  });
}

export async function writeOperatorLanguage({
  home = defaultDemaHome(),
  language_code,
  secondary_language_code = null,
} = {}) {
  const profilePath = join(home, "profile.json");
  const tmpPath = profilePath + ".tmp";

  // Read existing profile or start fresh
  let existing = {};
  try {
    const raw = await readFile(profilePath, "utf8");
    try {
      existing = JSON.parse(raw);
    } catch {
      /* malformed — overwrite */
    }
  } catch {
    /* absent — create */
  }

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
    },
  );

  await mkdir(dirname(profilePath), { recursive: true });
  await writeFile(tmpPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  await rename(tmpPath, profilePath);
}
