import {
  buildOnboardingLifecyclePreview,
  ONBOARDING_LIFECYCLE_STAGE_COUNT,
} from "../../../../packages/core/src/onboarding-lifecycle.js";
import {
  localizeOnboardingStages,
  resolveOperatorSurfaceI18n,
} from "../../../../packages/core/src/operator-surface-i18n.js";
import { readOperatorLanguage } from "../../../../packages/core/src/operator-profile.js";
import { join } from "node:path";
import { homedir } from "node:os";

// ONBOARD-ALIAS-1A: renders the canonical 7-stage lifecycle as a readable path.
// Dema is one-shot with no prompting except exact-string consent, so this is a
// PATH PREVIEW the operator reads and follows — the same posture as
// `dema diagnostics plan` — not an interactive wizard.
function formatGuidedPath(preview, languageCode = null) {
  const i18n = resolveOperatorSurfaceI18n(languageCode);
  const t = i18n.strings.onboard;
  const dirMark = i18n.script_direction === "rtl" ? "\u200F" : "";
  const stages = localizeOnboardingStages(preview.stages, i18n.language_code);
  const lines = [
    `${dirMark}${t.header}`,
    "",
    `  ${ONBOARDING_LIFECYCLE_STAGE_COUNT} ${t.meta}`,
    "",
  ];
  for (const stage of stages) {
    lines.push(`${stage.order + 1}. ${stage.title}`);
    lines.push(`   ${t.stage}   : ${stage.id}`);
    if (stage.prompt_intent) lines.push(`   ${t.why}     : ${stage.prompt_intent}`);
    if (Array.isArray(stage.options) && stage.options.length > 0) {
      const shown = stage.options
        .slice(0, 6)
        .map((o) => o.label ?? o.code ?? String(o))
        .join(" · ");
      const more =
        stage.options.length > 6 ? ` (+${stage.options.length - 6} more)` : "";
      lines.push(`   ${t.choices} : ${shown}${more}`);
    }
    lines.push("");
  }
  lines.push(t.boundary_heading);
  lines.push(`  ${t.boundary_1}`);
  lines.push(`  ${t.boundary_2}`);
  lines.push("");
  lines.push(t.next_heading);
  lines.push(`  ${t.next_welcome}`);
  lines.push(`  ${t.next_status}`);
  if (i18n.truth_label === "DECLARED_NEEDS_NATIVE_REVIEW") {
    lines.push("");
    lines.push(
      `[${i18n.truth_label}] Arabic onboard surface · awaiting native operator review`,
    );
  }
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
  const home = process.env.DEMA_HOME || join(homedir(), ".dema");
  const lang = await readOperatorLanguage(home);
  const preview = buildOnboardingLifecyclePreview({});
  console.log(
    argv.includes("--json")
      ? JSON.stringify(
          {
            ...preview,
            language_code: lang.language_code,
            stages: localizeOnboardingStages(
              preview.stages,
              lang.language_code === "ar" ? "ar" : "en",
            ),
          },
          null,
          2,
        )
      : formatGuidedPath(preview, lang.language_code),
  );
  process.exit(process.exitCode ?? 0);
}
