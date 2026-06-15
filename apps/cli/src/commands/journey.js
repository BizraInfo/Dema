// `dema journey` command handler.
//
// Extracted from apps/cli/src/index.js (dispatcher decomposition ④). Deps are
// package imports re-bound here (import depth +../ vs index.js); no closure on
// index.js internals.
import {
  buildSovereignJourneyPreview,
  formatSovereignJourneyPreview,
} from "../../../../packages/mission/src/journey.js";

export async function cmd_journey(ctx) {
  const { argv } = ctx;
  const json = argv.includes("--json");
  const intent = argv
    .slice(1)
    .filter((arg) => arg !== "--json")
    .join(" ")
    .trim();
  const journey = buildSovereignJourneyPreview({ intent });
  console.log(
    json
      ? JSON.stringify(journey, null, 2)
      : formatSovereignJourneyPreview(journey),
  );
  process.exit(process.exitCode ?? 0);
}
