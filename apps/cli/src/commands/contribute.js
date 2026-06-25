import { buildLocalAssetInventory } from "../../../../packages/core/src/local-asset-awareness.js";
import { buildHomebaseAssetAwareness } from "../../../../packages/core/src/homebase-asset-awareness.js";
import { buildHomebaseShareability } from "../../../../packages/core/src/homebase-shareability.js";
import {
  buildNode0HistoricalContributionVerification,
} from "../../../../packages/core/src/node0-historical-contribution-verification.js";
import {
  buildUrpContributionBenefitPreview,
  renderUrpContributionBenefitPreview,
} from "../../../../packages/core/src/urp-contribution-benefit-preview.js";
import {
  buildPoiReceiptEligibilityPlan,
  renderPoiReceiptEligibilityPlan,
} from "../../../../packages/core/src/poi-receipt-eligibility-plan.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";
import {
  gatherCanonWitnessMarkers,
  gatherGitTimeSpanEvidence,
} from "./node0-historical-gatherer.js";
import { gatherNode0HardwareObservations } from "./hardware-profile-gatherer.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function buildContributionStack(root, years) {
  const inventory = await buildLocalAssetInventory({ root });
  const awareness = buildHomebaseAssetAwareness({ inventory });
  const shareability = buildHomebaseShareability({ awareness });
  const git_evidence = await gatherGitTimeSpanEvidence({
    root,
    lookback_years: years,
  });
  const canon_witnesses = gatherCanonWitnessMarkers({ root });
  const hardware_observation = await gatherNode0HardwareObservations();
  const historical = buildNode0HistoricalContributionVerification({
    awareness,
    git_evidence,
    canon_witnesses,
    hardware_observation,
    lookback_years: years,
  });
  const benefit_preview = buildUrpContributionBenefitPreview({
    awareness,
    shareability,
    historical,
    lookback_years: years,
  });
  return { awareness, shareability, historical, benefit_preview };
}

export async function cmd_contribute(ctx) {
  const { argv } = ctx;
  const sub = argv[1] ?? "";
  const wantJson = wantsJson(argv);
  const root = argValue(argv, "--root") || process.cwd();
  const lookbackYears = Number(argValue(argv, "--years") ?? "3");
  const years = Number.isFinite(lookbackYears) ? lookbackYears : 3;

  if (sub === "preview") {
    const { benefit_preview } = await buildContributionStack(root, years);
    console.log(
      wantJson
        ? JSON.stringify(benefit_preview, null, 2)
        : renderUrpContributionBenefitPreview(benefit_preview),
    );
    process.exitCode = benefit_preview.valid ? 0 : 1;
    process.exit(process.exitCode ?? 0);
  }

  if (sub === "receipt-plan") {
    const { shareability, historical, benefit_preview } =
      await buildContributionStack(root, years);
    const report = buildPoiReceiptEligibilityPlan({
      benefit_preview,
      shareability,
      historical,
      lookback_years: years,
    });
    console.log(
      wantJson
        ? JSON.stringify(report, null, 2)
        : renderPoiReceiptEligibilityPlan(report),
    );
    process.exitCode = report.valid ? 0 : 1;
    process.exit(process.exitCode ?? 0);
  }

  console.error(
    "Usage: dema contribute preview [--json] [--root <path>] [--years 3]\n" +
      "       dema contribute receipt-plan [--json] [--root <path>] [--years 3]",
  );
  process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}
