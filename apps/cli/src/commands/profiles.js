import {
  buildProfileFoundationPreview,
  buildProfileFoundationSummary,
} from "../../../../packages/core/src/profiles.js";
import {
  wantsJson,
  humanHintLine,
} from "../../../../packages/core/src/output-mode.js";

export async function cmd_profiles(ctx) {
  const { argv } = ctx;
  const wantsSummary = argv.includes("--summary");
  const profilePreview = wantsSummary
    ? buildProfileFoundationSummary()
    : buildProfileFoundationPreview();
  if (wantsJson(argv)) {
    console.log(JSON.stringify(profilePreview, null, 2));
    process.exit(process.exitCode ?? 0);
  }
  if (wantsSummary) {
    const actors = profilePreview.actors;
    console.log(
      [
        "Dema profiles (summary)",
        `  User: ${actors.user}`,
        `  PAT:  ${actors.pat}`,
        `  SAT:  ${actors.sat}`,
        `  Mission: ${actors.mission}`,
        `  Context capsule: ${profilePreview.context_capsule_schema}`,
        humanHintLine("profiles"),
      ].join("\n"),
    );
  } else {
    const p = profilePreview;
    console.log(
      [
        "Dema profiles",
        `  User: ${p.user.schema} · operator: ${p.user.identity.name}`,
        `  PAT:  ${p.pat.schema} · owner: ${p.pat.owner}`,
        `  SAT:  ${p.sat.schema} · owner: ${p.sat.owner}`,
        `  Mission: ${p.mission.schema} · status: ${p.mission.status}`,
        `  Context capsule: ${p.context_capsule.schema}`,
        humanHintLine("profiles"),
      ].join("\n"),
    );
  }
  process.exit(process.exitCode ?? 0);
}
