// DEMA-QUALITY-DELIVERY-SPINE-1A · human-first default home (companion, not debug dump).
//
// NO file write. NO network. NO runtime. Pure read-and-render.

import { readFile, access, constants as fsConstants } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { hasAuthorshipKey } from "../../receipts/src/authorship-key-store.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { GREETING_TEMPLATES } from "./homebase-language-picker.js";
import {
  DEFAULT_RENDER_EFFECT_BOUNDARY,
  TRUTH_LABELS,
} from "./delivery-readiness-score.js";

export const FIRST_LOOK_HOME_SCHEMA = "bizra.dema.first_look_home.v1";

const PKG_VERSION = (() => {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(join(here, "..", "..", "..", "package.json"), "utf8");
    return JSON.parse(raw).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

const SIMPLE_ACTIONS = Object.freeze([
  Object.freeze({
    label: "Check health",
    command: "dema doctor",
    hint: "Diagnostics and readiness details",
  }),
  Object.freeze({
    label: "Draft a mission",
    command: "dema mission draft",
    hint: "Start a consent-gated mission draft",
  }),
  Object.freeze({
    label: "View receipts",
    command: "dema receipts",
    hint: "Read local proof receipts",
  }),
]);

async function fileReadable(path) {
  try {
    await access(path, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function readProfile(home) {
  const candidates = [
    join(home, "profile.json"),
    join(home, "memory", "profile.json"),
  ];
  for (const path of candidates) {
    if (!(await fileReadable(path))) continue;
    try {
      const data = JSON.parse(await readFile(path, "utf8"));
      const name =
        (typeof data.preferred_name === "string" && data.preferred_name) ||
        (typeof data.name === "string" && data.name) ||
        null;
      const language_code =
        typeof data.language_code === "string" ? data.language_code : null;
      return { name, language_code, source_present: true };
    } catch {
      return { name: null, language_code: null, source_present: false };
    }
  }
  return { name: null, language_code: null, source_present: false };
}

function buildGreeting(profile) {
  const langCode = profile.language_code;
  const tmpl =
    langCode && GREETING_TEMPLATES[langCode]
      ? GREETING_TEMPLATES[langCode]
      : GREETING_TEMPLATES.en;
  if (!profile.source_present || !profile.name) {
    return Object.freeze({
      text: tmpl.welcome_new,
      has_name: false,
      language_code: langCode,
    });
  }
  return Object.freeze({
    text: tmpl.welcome_back.replace("{name}", profile.name),
    has_name: true,
    language_code: langCode,
  });
}

function buildRecommendedNextStep(profile, keyPresent) {
  if (!profile.source_present) {
    return "Complete first setup with dema setup — your local companion stays preview-only until you choose.";
  }
  if (!keyPresent) {
    return "Initialize your authorship key with dema authorship init when you are ready to sign local work.";
  }
  return "Review your latest receipts with dema receipts — proof stays local until you explicitly share.";
}

export async function gatherFirstLookContext({ demaHome, now = new Date() } = {}) {
  const home = demaHome || process.env.DEMA_HOME || join(homedir(), ".dema");
  const profile = await readProfile(home);
  const keyPresent = await hasAuthorshipKey(home);
  return Object.freeze({
    dema_home: home,
    profile,
    key_present: keyPresent,
    now,
  });
}

export function buildFirstLookHome(ctx) {
  const greeting = buildGreeting(ctx.profile);
  const recommended_next_step = buildRecommendedNextStep(
    ctx.profile,
    ctx.key_present,
  );
  const boundary = Object.freeze({
    mode: "preview_only",
    runtime_execution_performed: false,
    network_used: false,
    ...DEFAULT_RENDER_EFFECT_BOUNDARY,
  });
  const proof_boundary = Object.freeze({
    truth_label: TRUTH_LABELS[2], // TESTED_LOCAL when gates pass in CI
    what_this_proves:
      "The default Dema face renders a human-first companion home without internal debug jargon.",
    what_this_does_not_prove:
      "Does not prove Node0 runtime readiness, gateway connectivity, federation, or signed economic claims.",
  });
  const envelope = Object.freeze({
    schema: FIRST_LOOK_HOME_SCHEMA,
    truth_label: "IMPLEMENTED_LOCAL",
    mode: "preview_only",
    rendered_at: ctx.now.toISOString(),
    dema_version: PKG_VERSION,
    greeting,
    recommended_next_step,
    simple_actions: SIMPLE_ACTIONS,
    preview_boundary:
      "Preview-only · no runtime execution from this screen. Governed work stays behind explicit consent.",
    operator_paths: Object.freeze({
      diagnostics: "dema doctor",
      internal_debug: "dema realm --debug",
      technical_homebase: "dema homebase",
    }),
    boundary,
    proof_boundary,
    effect_boundary: DEFAULT_RENDER_EFFECT_BOUNDARY,
  });
  const rendered_text = renderFirstLookHome(envelope, { noColor: true });
  return Object.freeze({ ...envelope, rendered_text });
}

export function renderFirstLookHome(envelope, { noColor = false, useColor } = {}) {
  const colorOn = useColor !== undefined ? useColor : !noColor;
  const bold = (s) => (colorOn ? `\x1b[1m${s}\x1b[0m` : s);
  const dim = (s) => (colorOn ? `\x1b[2m${s}\x1b[0m` : s);

  const lines = [
    bold("Dema"),
    dim(`companion · v${envelope.dema_version}`),
    "",
    envelope.greeting.text,
    "",
    bold("Recommended next step"),
    `  ${envelope.recommended_next_step}`,
    "",
    bold("Three simple actions"),
    ...envelope.simple_actions.map(
      (a, i) => `  ${i + 1}. ${a.label} — ${dim(a.command)}`,
    ),
    "",
    dim(envelope.preview_boundary),
    "",
    dim(`Diagnostics: ${envelope.operator_paths.diagnostics}`),
    dim(`Internal detail: ${envelope.operator_paths.internal_debug}`),
  ];
  return lines.join("\n");
}
