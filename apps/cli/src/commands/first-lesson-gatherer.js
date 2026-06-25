// DEMA-FIRST-LESSON-CANON-1A — read-only lesson file gatherer (apps/cli).
//
// Reads a single operator-authored markdown file. No network, no mutation.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

import { DEFAULT_FIRST_LESSON_PATH } from "../../../../packages/core/src/dema-first-lesson-canon.js";

export function resolveFirstLessonPath({
  explicitPath = null,
  env = process.env,
  homedirImpl = homedir,
  existsSyncImpl = existsSync,
} = {}) {
  if (typeof explicitPath === "string" && explicitPath.length > 0) {
    if (!isAbsolute(explicitPath)) {
      throw new Error("`dema canon first-lesson --path` requires an absolute path.");
    }
    return explicitPath;
  }
  const envPath = env.DEMA_FIRST_LESSON_PATH;
  if (typeof envPath === "string" && envPath.length > 0) {
    return envPath;
  }
  const homeCanon = join(homedirImpl(), ".dema", "canon", "DEMA_FIRST_LESSON.md");
  if (existsSyncImpl(homeCanon)) return homeCanon;
  return DEFAULT_FIRST_LESSON_PATH;
}

export function readFirstLessonMarkdown({
  path = null,
  readFileImpl = readFileSync,
  ...resolveOpts
} = {}) {
  const abs = resolveFirstLessonPath({ explicitPath: path, ...resolveOpts });
  try {
    const lesson_markdown = readFileImpl(abs, "utf8");
    return { ok: true, lesson_markdown, source_path: abs };
  } catch (err) {
    return {
      ok: false,
      source_path: abs,
      error: err && err.message ? err.message : String(err),
    };
  }
}
