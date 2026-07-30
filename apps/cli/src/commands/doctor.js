import { createNode0Adapter } from "../../../../packages/node-adapter/src/node0-adapter.js";
import {
  evaluatePredicates,
  formatDoctorDashboard,
  doctorVerdict,
  doctorState,
} from "../../../../packages/core/src/doctor-dashboard.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";
import { statusWithLocalIdentity } from "../lib/status-identity.js";
import { readOperatorLanguage } from "../../../../packages/core/src/operator-profile.js";
import { join } from "node:path";
import { homedir } from "node:os";

const adapter = createNode0Adapter();

export async function cmd_doctor(ctx) {
  const { argv } = ctx;
  const status = await statusWithLocalIdentity(adapter);
  const home = process.env.DEMA_HOME || join(homedir(), ".dema");
  const lang = await readOperatorLanguage(home);
  const predicates = evaluatePredicates(status, {
    language_code: lang.language_code,
  });
  const state = doctorState(predicates);

  // Default `dema doctor` answers "is this node operational?" — so an unbridged
  // node exits non-zero even though nothing is broken. `--preview` asks the
  // narrower question "is the preview environment intact?" and exits 0 for it.
  // Collapsing these let a script read exit 0 off a node with no runtime at all.
  const previewMode = argv.includes("--preview");
  const exitCode = (previewMode ? state.preview_environment_valid : state.operational)
    ? 0
    : 1;

  if (wantsJson(argv)) {
    const verdict = doctorVerdict(predicates);
    console.log(
      JSON.stringify(
        {
          schema: "bizra.dema.doctor_dashboard.v0.1",
          verdict,
          ...state,
          exit_code: exitCode,
          language_code: lang.language_code,
          predicates,
          status,
        },
        null,
        2,
      ),
    );
    process.exitCode = exitCode;
    process.exit(process.exitCode ?? 0);
  }

  const noColor =
    Boolean(process.env.NO_COLOR) ||
    process.env.TERM === "dumb" ||
    argv.includes("--no-color");
  console.log(
    formatDoctorDashboard(predicates, {
      color: !noColor,
      language_code: lang.language_code,
    }),
  );
  process.exitCode = exitCode;
  process.exit(process.exitCode ?? 0);
}
