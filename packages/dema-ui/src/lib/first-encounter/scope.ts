import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * The demo scope is pinned to the corpus directory itself — never its parent.
 *
 * `CHALLENGE_KEY.md` lives one level above and must stay unreachable. Two
 * independent things keep it out: this constant never asks for the parent, and
 * the kernel's realpath clamp would refuse it if it did. The directory layout
 * alone is not protection — only the clamp is.
 */
export const DEMO_ROOT = resolve(
  process.cwd(),
  "../../artifacts/demo/dema-neutral-mission-corpus-1a/corpus",
);

export const MANIFEST_PATH = resolve(DEMO_ROOT, "../MANIFEST.sha256");

export const MISSION_QUESTION =
  "We inherited this project folder. Tell us what was actually decided, what remains unfinished, what contradicts what, and the safest next action.";

export async function manifestHash(): Promise<string | null> {
  try {
    return createHash("sha256").update(await readFile(MANIFEST_PATH)).digest("hex");
  } catch {
    return null;
  }
}
