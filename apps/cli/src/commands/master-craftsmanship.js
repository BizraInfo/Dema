import {
  auditArtifact,
  formatAuditReport,
} from "../../../../packages/core/src/master-craftsmanship-audit.js";
import { fileURLToPath as mcFURL } from "node:url";
import { dirname as mcDirname, join as mcJoin } from "node:path";

// commands/ is one level deeper — need 4 levels to reach repo root
const projectRoot = mcJoin(
  mcDirname(mcFURL(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
);

export async function cmd_master_craftsmanship(ctx) {
  const { argv } = ctx;
  // External audit surface — audits arbitrary artifacts against the 10
  // MASTER_CRAFTSMANSHIP_INVARIANTS. Default subject is the ADR-011
  // phase-4 compliance suite.
  // Usage:
  //   dema master-craftsmanship audit [--json] [<path>]
  const mcSubcommand = argv[1];
  if (mcSubcommand !== "audit") {
    console.log(
      "Usage: dema master-craftsmanship audit [--json] [<path>]\n" +
        "  Default path: tests/node-onboarding-adr011-compliance.test.js",
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  const mcJsonFlag = argv.includes("--json");
  const mcPathArg = argv.slice(2).find((a) => !a.startsWith("--"));
  const result = await auditArtifact({
    artifactPath: mcPathArg,
    projectRoot,
  });
  if (mcJsonFlag) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatAuditReport(result));
  }
  if (!result.overall_compliant) process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}
