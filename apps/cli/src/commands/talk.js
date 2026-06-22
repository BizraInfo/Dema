// `dema talk` command — DEMA-TALK-LOOP-1A (preview / consent ceremony only).
//
// Shows what a local-model talk request WOULD do: the model route, the exact
// consent phrase, the localhost-only boundary, the whitelist status, the prompt
// bound, and the safety posture. It makes NO model call — the live invocation
// (invokeLocalLLM) ships as DEMA-TALK-LOOP-1B under its own GO. No fs write, no
// memory, no runtime.
import { mkdir, writeFile, rename, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { buildDemaTalkPreview } from "../../../../packages/core/src/dema-talk-loop-preview.js";
import { invokeDemaTalkLive } from "../../../../packages/core/src/dema-talk-loop-live.js";
import { buildTalkRuntimeReceipt } from "../../../../packages/core/src/talk-runtime-receipt.js";
import {
  wantsJson,
  humanHintLine,
} from "../../../../packages/core/src/output-mode.js";

// Opt-in (`--receipt`) atomic write of a runtime-evidence receipt under
// $DEMA_HOME/receipts. Metadata only — the kernel never receives the raw
// prompt/response, and the consent phrase is hashed. Returns the written path.
async function writeTalkRuntimeReceipt(result, consentPhrase) {
  const receipt = buildTalkRuntimeReceipt({
    result,
    consentPhrase,
    recordedAtIso: new Date().toISOString(),
  });
  const home = process.env.DEMA_HOME || join(homedir(), ".dema");
  const receiptsDir = join(home, "receipts");
  await mkdir(receiptsDir, { recursive: true });
  const realDir = await realpath(receiptsDir);
  const finalPath = join(realDir, `talk-runtime-${receipt.receipt_id}.json`);
  const tmpPath = `${finalPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(receipt, null, 2), {
    encoding: "utf8",
    mode: 0o600,
    flag: "w",
  });
  await rename(tmpPath, finalPath);
  return finalPath;
}

// Flags that consume the following token as their value; everything else after
// the command name (argv[0]) is treated as the positional prompt.
const VALUE_FLAGS = new Set(["--model", "--prompt", "--provider", "--consent"]);

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
  const provider = argValue(argv, "--provider");
  const prompt = argValue(argv, "--prompt") ?? firstPositional(argv);
  const consent = argValue(argv, "--consent");

  // LIVE PATH (DEMA-TALK-LOOP-1B) — only when --consent is supplied. The call is
  // localhost-bound, whitelisted, exact-consent-gated, and SUGGESTION-only. No
  // --consent → preview ceremony (no call), unchanged below. The model default
  // matches the preview path so the required consent phrase lines up.
  if (typeof consent === "string") {
    const liveModel = model && model.length > 0 ? model : "qwen2.5";
    const result = await invokeDemaTalkLive({ provider, model: liveModel, prompt, consentPhrase: consent });
    let receiptPath = null;
    if (argv.includes("--receipt")) {
      receiptPath = await writeTalkRuntimeReceipt(result, consent);
    }
    if (wantsJson(argv)) {
      console.log(JSON.stringify(receiptPath ? { ...result, receipt_path: receiptPath } : result, null, 2));
      process.exit(result.invocation_status === "completed" ? 0 : 1);
    }
    const lines = [`DEMA · TALK LIVE — ${result.invocation_status.toUpperCase()} (suggestion only)`];
    if (result.invocation_status === "completed") {
      lines.push(`  Provider: ${result.provider} · model: ${result.model} @ ${result.target_endpoint}`);
      lines.push("");
      lines.push("  Dema (a SUGGESTION — not an authority, nothing was executed):");
      lines.push(`    ${result.response_text_preview}`);
    } else {
      lines.push(`  ${result.error_reason}`);
      if (result.required_consent) {
        lines.push(`  Exact consent required: "${result.required_consent}"`);
      }
    }
    lines.push("  No task ran. No runtime activated. No token, PoI, or federation.");
    if (receiptPath) {
      lines.push(`  Runtime-evidence receipt written (metadata only): ${receiptPath}`);
    }
    lines.push(humanHintLine("talk"));
    console.log(lines.join("\n"));
    process.exit(result.invocation_status === "completed" ? 0 : 1);
  }

  const preview = buildDemaTalkPreview({ prompt, model, provider });

  if (wantsJson(argv)) {
    console.log(JSON.stringify(preview, null, 2));
    process.exit(process.exitCode ?? 0);
  }

  // Unknown provider → fail closed, no silent fallback.
  if (!preview.provider) {
    const lines = [
      "DEMA · TALK PREVIEW (no model called)",
      `  Unknown provider: ${preview.requested_provider}`,
      ...preview.explanation_lines.map((l) => `  ${l}`),
      `  Known providers: ${preview.known_providers.join(", ")} (default: lmstudio)`,
      humanHintLine("talk"),
    ];
    console.log(lines.join("\n"));
    process.exit(process.exitCode ?? 0);
  }

  const lines = [
    "DEMA · TALK PREVIEW (no model called)",
    `  Provider: ${preview.provider}${preview.provider_is_default ? " (default)" : ""}${preview.provider_is_legacy ? " (legacy)" : ""} · ${preview.endpoint_family}`,
    `  Model route: ${preview.model} @ ${preview.target_endpoint} · localhost-only: ${preview.target_is_localhost}`,
    `  On the allow-list: ${preview.model_allowed_in_whitelist} · prompt length: ${preview.prompt_length_chars}${preview.prompt_too_long ? " (TOO LONG — would be refused)" : ""}`,
    "",
    ...preview.explanation_lines.map((l) => `  ${l}`),
    "",
    "  To run this live (suggestion only), re-run with the exact consent phrase:",
    `    dema talk … --consent "${preview.consent_required}"`,
    humanHintLine("talk"),
  ];
  console.log(lines.join("\n"));
  process.exit(process.exitCode ?? 0);
}
