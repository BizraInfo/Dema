import {
  buildOnboardingLifecyclePreview,
  ONBOARDING_LIFECYCLE_STAGE_COUNT,
} from "../../../../packages/core/src/onboarding-lifecycle.js";

// ONBOARD-ALIAS-1A: renders the canonical 7-stage lifecycle as a readable path.
// Dema is one-shot with no prompting except exact-string consent, so this is a
// PATH PREVIEW the operator reads and follows — the same posture as
// `dema diagnostics plan` — not an interactive wizard.
function formatGuidedPath(preview) {
  const lines = [
    "Dema — guided setup path",
    "",
    `  ${ONBOARDING_LIFECYCLE_STAGE_COUNT} stages · preview only · nothing is created or sent`,
    "",
  ];
  for (const stage of preview.stages) {
    lines.push(`${stage.order + 1}. ${stage.title}`);
    lines.push(`   stage   : ${stage.id}`);
    if (stage.prompt_intent) lines.push(`   why     : ${stage.prompt_intent}`);
    if (Array.isArray(stage.options) && stage.options.length > 0) {
      const shown = stage.options
        .slice(0, 6)
        .map((o) => o.label ?? o.code ?? String(o))
        .join(" · ");
      const more =
        stage.options.length > 6 ? ` (+${stage.options.length - 6} more)` : "";
      lines.push(`   choices : ${shown}${more}`);
    }
    lines.push("");
  }
  lines.push("Boundary:");
  lines.push(
    "  Preview only. No mission is created, no runtime starts, no receipt is minted,",
  );
  lines.push(
    "  and nothing leaves this machine. Each stage acts only on your typed consent.",
  );
  lines.push("");
  lines.push("Next:");
  lines.push("  dema welcome    — read the first-run orientation");
  lines.push("  dema status     — see what is true, safe, and blocked");
  return lines.join("\n");
}

export async function cmd_onboard(ctx) {
  const { argv } = ctx;
  if (argv.includes("--preview-card")) {
    const { join: pcJoin } = await import("node:path");
    const { homedir: pcHd } = await import("node:os");
    const { buildGenesisPreviewCard } =
      await import("../../../../packages/core/src/genesis-preview-card.js");
    const { writeGenesisPreviewCard, readOperatorLanguage } =
      await import("../../../../packages/core/src/operator-profile.js");
    const pcHome = process.env.DEMA_HOME || pcJoin(pcHd(), ".dema");
    const langResult = await readOperatorLanguage(pcHome);
    const timestamp = new Date().toISOString();
    const card = buildGenesisPreviewCard({
      candidate: {
        primary_language: langResult.language_code,
        secondary_language: langResult.secondary_language_code,
      },
      timestamp,
    });
    await writeGenesisPreviewCard({ home: pcHome, card });
    if (argv.includes("--json")) {
      console.log(JSON.stringify(card, null, 2));
    } else {
      console.log(`Genesis Preview Card`);
      console.log(`  schema:             ${card.schema}`);
      console.log(`  mode:               ${card.mode}`);
      console.log(`  truth_label:        ${card.truth_label}`);
      console.log(
        `  receipt_id_preview: ${card.would_mint_if_consented.receipt_id_preview}`,
      );
      console.log(
        `  consent_phrase:     ${card.would_mint_if_consented.consent_phrase_required}`,
      );
      console.log(`  stored_at:          ${card.card_storage.path}`);
      console.log(
        `\nNo mint has occurred. Type the consent phrase to mint (separate typed-GO required).`,
      );
    }
    process.exit(process.exitCode ?? 0);
  }
  const preview = buildOnboardingLifecyclePreview({});
  console.log(
    argv.includes("--json")
      ? JSON.stringify(preview, null, 2)
      : formatGuidedPath(preview),
  );
  process.exit(process.exitCode ?? 0);
}
