// `dema foundation create` command handler — the consent-gated foundation write.
//
// Surfaces the root-hardened kernel bootstrapFoundationPersist
// (packages/core/src/bootstrap-foundation-persist.js). Resolves the write
// location EXPLICITLY at the call site (the kernel refuses an ambient default),
// extracts the exact consent phrase, and renders the consent moment / result.
// Default human output; --json emits the frozen envelope. Exit 1 when no/invalid
// consent (action not performed); exit 0 on write or deliberate ephemeral decline.
// Changes no existing command — dema setup / first-run stay un-gated.

import { join } from "node:path";
import { homedir } from "node:os";
import {
  bootstrapFoundationPersist,
  FOUNDATION_PERSIST_CONSENT_PHRASE,
  FOUNDATION_EPHEMERAL_PHRASE,
} from "../../../../packages/core/src/bootstrap-foundation-persist.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function formatConsentMoment(result) {
  return [
    "Dema · create local node foundation",
    "",
    "  I will create your local node foundation under:",
    `    ${result.root}`,
    "    (profile.json · config.local.json · receipts/ · memory/ · logs/ · skills/)",
    "",
    "  I will NOT: scan files · connect to any network · create a public identity · store any secret.",
    "",
    "  To grant, re-run with:",
    `    dema foundation create --consent "${FOUNDATION_PERSIST_CONSENT_PHRASE}"`,
    "  To decline and continue with nothing saved:",
    `    dema foundation create --consent "${FOUNDATION_EPHEMERAL_PHRASE}"`,
  ].join("\n");
}

function formatResult(result) {
  if (result.mode === "ephemeral") {
    return "Session ready. Nothing was saved.";
  }
  if (result.reason === "dry_run") {
    return `Dry run — would create the foundation under ${result.root}. Nothing was written.`;
  }
  if (result.persisted) {
    const paths = result.setup_result?.createdPaths ?? [];
    const lines = [`Foundation created under ${result.root}`];
    for (const p of paths) lines.push(`  + ${p}`);
    if (paths.length === 0) {
      lines.push("  (already present — nothing new written)");
    }
    return lines.join("\n");
  }
  // refused / explicit_root_required → show the consent moment.
  return formatConsentMoment(result);
}

export async function cmd_foundation(ctx) {
  const { argv } = ctx;
  const sub = argv[1] ?? "";

  if (sub !== "create") {
    console.error(
      'Usage: dema foundation create [--consent "<phrase>"] [--json] [--dry-run]',
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  const root = process.env.DEMA_HOME ?? join(homedir(), ".dema");
  const consent = argValue(argv, "--consent") ?? "";
  const dryRun = argv.includes("--dry-run");

  const result = await bootstrapFoundationPersist({ consent, root, dryRun });

  if (wantsJson(argv)) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatResult(result));
  }

  // Exit-code contract: a refused write (no/invalid consent, or no explicit root)
  // is "action not performed" → exit 1. Write done, dry-run, and deliberate
  // ephemeral decline all → exit 0.
  if (result.mode === "refused") {
    process.exitCode = 1;
  }
  process.exit(process.exitCode ?? 0);
}
