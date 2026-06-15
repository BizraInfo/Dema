import { buildEvidenceChainEventPreviewFromInputs } from "../../../../packages/core/src/evidence-chain-event-preview.js";

export async function cmd_evidence_event(ctx) {
  console.log(
    JSON.stringify(buildEvidenceChainEventPreviewFromInputs(), null, 2),
  );
  process.exit(process.exitCode ?? 0);
}
