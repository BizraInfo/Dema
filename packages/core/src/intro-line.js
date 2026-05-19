import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

const COUNTER_SCHEMA = "bizra.dema.intro_state.v0.1";
const COUNTER_REL = join("state", "intro-seen-count.json");
const RECEIPTS_DIR = "receipts";
const PROFILE_FILE = "profile.json";
const NEW_OPERATOR_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const SUPPRESS_AFTER = 3;

const INTRO_TEXT = [
  "Dema is a local-first sovereign-AI node companion.",
  "It shows what is true, what is safe, what is blocked.",
  "Type `dema explain dema` for more.",
].join("\n");

async function readCounter(home) {
  try {
    const raw = await readFile(join(home, COUNTER_REL), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && parsed.schema === COUNTER_SCHEMA && typeof parsed.seenCount === "number") {
      return parsed;
    }
    // Malformed but parseable — treat as first-time.
    return null;
  } catch {
    // Missing or unparseable — treat as first-time.
    return null;
  }
}

async function receiptCount(home) {
  try {
    const files = await readdir(join(home, RECEIPTS_DIR));
    return files.filter((f) => f.endsWith(".json")).length;
  } catch {
    return 0;
  }
}

async function profileCreatedAt(home) {
  try {
    const raw = await readFile(join(home, PROFILE_FILE), "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed?.created_at === "string") {
      return new Date(parsed.created_at);
    }
    return null;
  } catch {
    return null;
  }
}

export async function shouldShowIntro({ home, now = new Date() }) {
  const counter = await readCounter(home);

  // Explicitly suppressed.
  if (counter && (counter.suppressedBy === "user-explain" || counter.seenCount >= SUPPRESS_AFTER)) {
    return false;
  }

  // Count-based: fewer than SUPPRESS_AFTER sightings → show.
  if (!counter || counter.seenCount < SUPPRESS_AFTER) {
    // If counter is absent, also check receipt count and profile age as secondary signals.
    if (!counter) {
      const count = await receiptCount(home);
      if (count === 0) return true;
      const createdAt = await profileCreatedAt(home);
      if (createdAt && (now - createdAt) < NEW_OPERATOR_WINDOW_MS) return true;
      // Fall through to seenCount check — counter absent means 0.
    }
    return true;
  }

  return false;
}

export function renderIntroLine() {
  return INTRO_TEXT;
}

export async function recordIntroSeen({ home, now = new Date(), suppressedBy = null }) {
  const counter = await readCounter(home);
  const seenCount = (counter?.seenCount ?? 0) + 1;
  const updated = {
    schema: COUNTER_SCHEMA,
    seenCount,
    lastSeen: (now instanceof Date ? now : new Date(now)).toISOString(),
    suppressedBy: suppressedBy ?? (seenCount >= SUPPRESS_AFTER ? "count-cap" : null),
  };
  await mkdir(join(home, "state"), { recursive: true });
  await writeFile(join(home, COUNTER_REL), JSON.stringify(updated, null, 2) + "\n", "utf8");
}
