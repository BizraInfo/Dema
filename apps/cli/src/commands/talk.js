// `dema talk` command — DEMA-TALK-LOOP-1A (preview / consent ceremony only).
//
// Shows what a local-model talk request WOULD do: the model route, the exact
// consent phrase, the localhost-only boundary, the whitelist status, the prompt
// bound, and the safety posture. It makes NO model call — the live invocation
// (invokeLocalLLM) ships as DEMA-TALK-LOOP-1B under its own GO. No fs write, no
// memory, no runtime.
import { buildDemaTalkPreview } from "../../../../packages/core/src/dema-talk-loop-preview.js";
import {
  wantsJson,
  humanHintLine,
} from "../../../../packages/core/src/output-mode.js";

// Flags that consume the following token as their value; everything else after
// the command name (argv[0]) is treated as the positional prompt.
const VALUE_FLAGS = new Set(["--model", "--prompt"]);

function argValue(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function firstPositional(argv) {
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      if (VALUE_FLAGS.has(a)) i++;
      continue;
    }
    return a;
  }
  return "";
}

export async function cmd_talk(ctx) {
  const { argv } = ctx;
  const model = argValue(argv, "--model");
  const prompt = argValue(argv, "--prompt") ?? firstPositional(argv);
  const preview = buildDemaTalkPreview({ prompt, model });

  if (wantsJson(argv)) {
    console.log(JSON.stringify(preview, null, 2));
    process.exit(process.exitCode ?? 0);
  }

  const lines = [
    "DEMA · TALK PREVIEW (no model called)",
    `  Model route: ${preview.model} @ ${preview.target_endpoint} · localhost-only: ${preview.target_is_localhost}`,
    `  On the allow-list: ${preview.model_allowed_in_whitelist} · prompt length: ${preview.prompt_length_chars}${preview.prompt_too_long ? " (TOO LONG — would be refused)" : ""}`,
    "",
    ...preview.explanation_lines.map((l) => `  ${l}`),
    "",
    "  When the live call ships (DEMA-TALK-LOOP-1B), the exact phrase to allow it will be:",
    `    ${preview.consent_required}`,
    humanHintLine("talk"),
  ];
  console.log(lines.join("\n"));
  process.exit(process.exitCode ?? 0);
}
