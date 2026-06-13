// `dema skill-growth-governor` command handler — extracted from index.js (④).
import { buildSkillGrowthGovernorPreview } from "../../../../packages/core/src/skill-growth-governor.js";
import {
  formatSkillGrowthGovernorPreview,
  resolveFormatterOptsFromEnv,
} from "../../../../packages/core/src/tui-formatter.js";

export async function cmd_skill_growth_governor(ctx) {
  const { argv } = ctx;
  const preview = buildSkillGrowthGovernorPreview();
  if (argv.includes("--json")) {
    console.log(JSON.stringify(preview, null, 2));
    process.exit(process.exitCode ?? 0);
  }
  if (process.stdout.isTTY) {
    console.log(
      formatSkillGrowthGovernorPreview(preview, resolveFormatterOptsFromEnv()),
    );
  } else {
    console.log(JSON.stringify(preview, null, 2));
  }
  process.exit(process.exitCode ?? 0);
}
