import { buildConsentCardPreview } from "../../../../packages/core/src/consent-card-preview.js";

export async function cmd_consent_card(ctx) {
  console.log(JSON.stringify(buildConsentCardPreview(), null, 2));
  process.exit(process.exitCode ?? 0);
}
