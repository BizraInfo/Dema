import {
  buildOnboardingGuide,
  formatOnboardingGuide,
} from "../../../../packages/core/src/onboarding.js";

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
  const guide = buildOnboardingGuide();
  console.log(
    argv.includes("--json")
      ? JSON.stringify(guide, null, 2)
      : formatOnboardingGuide(guide),
  );
  process.exit(process.exitCode ?? 0);
}
