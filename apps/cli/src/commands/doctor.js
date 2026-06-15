import { createNode0Adapter } from "../../../../packages/node-adapter/src/node0-adapter.js";
import {
  evaluatePredicates,
  formatDoctorDashboard,
} from "../../../../packages/core/src/doctor-dashboard.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";
import { statusWithLocalIdentity } from "../lib/status-identity.js";

const adapter = createNode0Adapter();

export async function cmd_doctor(ctx) {
  const { argv } = ctx;
  const status = await statusWithLocalIdentity(adapter);
  const predicates = evaluatePredicates(status);
  const anyFail = predicates.some((p) => p.status === "fail");

  if (wantsJson(argv)) {
    const verdict = anyFail ? "blocked" : "ready and consent-gated";
    console.log(
      JSON.stringify(
        {
          schema: "bizra.dema.doctor_dashboard.v0.1",
          verdict,
          predicates,
          status,
        },
        null,
        2,
      ),
    );
    process.exitCode = anyFail ? 1 : 0;
    process.exit(process.exitCode ?? 0);
  }

  const noColor =
    Boolean(process.env.NO_COLOR) ||
    process.env.TERM === "dumb" ||
    argv.includes("--no-color");
  console.log(formatDoctorDashboard(predicates, { color: !noColor }));
  process.exitCode = anyFail ? 1 : 0;
  process.exit(process.exitCode ?? 0);
}
