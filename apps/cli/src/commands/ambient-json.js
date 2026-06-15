import { buildAmbientBoundary } from "../../../../packages/core/src/ambient.js";

export async function cmd_ambient_json(ctx) {
  console.log(JSON.stringify(buildAmbientBoundary(), null, 2));
  process.exit(process.exitCode ?? 0);
}
