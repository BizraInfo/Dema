// `dema ambient` command handler — extracted from index.js (④).
import {
  buildAmbientManifestPreview,
  formatAmbientManifestPreview,
  buildAmbientAuditPreview,
  formatAmbientAuditPreview,
  buildAmbientBoundary,
  formatAmbientBoundary,
} from "../../../../packages/core/src/ambient.js";

export async function cmd_ambient(ctx) {
  const { argv, subcommand } = ctx;
  if (subcommand === "--manifest") {
    const manifest = buildAmbientManifestPreview();
    console.log(
      argv.includes("--json")
        ? JSON.stringify(manifest, null, 2)
        : formatAmbientManifestPreview(manifest),
    );
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "audit") {
    const audit = buildAmbientAuditPreview();
    console.log(
      argv.includes("--json")
        ? JSON.stringify(audit, null, 2)
        : formatAmbientAuditPreview(audit),
    );
    process.exit(process.exitCode ?? 0);
  }
  console.log(formatAmbientBoundary(buildAmbientBoundary()));
  process.exit(process.exitCode ?? 0);
}
