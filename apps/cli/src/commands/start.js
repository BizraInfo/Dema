// `dema start` command handler — DEMA-BIRTH-LOOP-1A.
//
// Reads the local operator profile (DEMA_HOME/profile.json), classifies the
// node state via the pure birth-loop kernel, and greets/routes accordingly.
// Preview-only: it performs no home-base scan, no model invocation, no task,
// and activates no runtime. The filesystem read lives HERE (the CLI layer), so
// packages/core/src/dema-birth-loop.js stays pure under kernel-purity-check.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildDemaBirthLoop } from "../../../../packages/core/src/dema-birth-loop.js";
import { defaultDemaHome } from "../../../../packages/core/src/operator-profile.js";
import {
  wantsJson,
  humanHintLine,
} from "../../../../packages/core/src/output-mode.js";
import { humanizeNextAction } from "../../../../packages/core/src/next-action-humanizer.js";

// Resolve the profile into the kernel's input shape, distinguishing absent
// (NEW_NODE) from unreadable/malformed (CORRUPT_NODE) so classification is
// faithful. Reads only Dema's own profile card — never user file content.
async function readProfileState() {
  const profilePath = join(defaultDemaHome(), "profile.json");
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

export async function cmd_start(ctx) {
  const { argv } = ctx;
  const { profile = null, profileError = null } = await readProfileState();
  const env = buildDemaBirthLoop({ profile, profileError });

  if (wantsJson(argv)) {
    console.log(JSON.stringify(env, null, 2));
    process.exit(process.exitCode ?? 0);
  }

  console.log(
    [
      env.greeting,
      `  Node state: ${env.node_state}`,
      "  Next safe actions:",
      ...env.next_safe_actions.map((a) => `    • ${humanizeNextAction(a)}`),
      "  (Preview only — no scan, model, task, or runtime was performed.)",
      humanHintLine("start"),
    ].join("\n"),
  );
  process.exit(process.exitCode ?? 0);
}
