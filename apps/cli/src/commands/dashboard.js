import { createNode0Adapter } from "../../../../packages/node-adapter/src/node0-adapter.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";
import { htmlSafeJson } from "../../../../packages/core/src/html-safe.js";
import { statusWithLocalIdentity } from "../lib/status-identity.js";
import { readPackageVersion } from "../lib/package-version.js";
import { openerArgv } from "../lib/browser-opener.js";

const adapter = createNode0Adapter();

export async function cmd_dashboard(ctx) {
  const { argv } = ctx;
  const { fileURLToPath } = await import("node:url");
  const { dirname, join, resolve } = await import("node:path");
  const { readFileSync, writeFileSync, mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");

  const here = dirname(fileURLToPath(import.meta.url));
  // commands/ is one level deeper — need 4 levels to reach repo root
  const htmlPath = resolve(
    join(
      here,
      "..",
      "..",
      "..",
      "..",
      "docs",
      "tui",
      "dema-homebase-dashboard-v0.1.html",
    ),
  );

  let dashboardHtml;
  try {
    dashboardHtml = readFileSync(htmlPath, "utf8");
  } catch {
    console.log("Dashboard not found: " + htmlPath);
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  if (wantsJson(argv)) {
    console.log(
      JSON.stringify(
        { schema: "bizra.dema.dashboard.v0.1", path: htmlPath },
        null,
        2,
      ),
    );
    process.exit(process.exitCode ?? 0);
  }

  const status = await statusWithLocalIdentity(adapter);
  const version = await readPackageVersion();
  const statusPayload = {
    node: status.node || "Node0",
    human: status.human || "unknown",
    ready: status.ready,
    consoleReady: status.consoleReady,
    activationGate: status.activationGate || "BLOCKED",
    daemonStatus: status.daemonStatus,
    missionExecuted: status.missionExecuted,
    runtimePulse: status.runtimePulse,
    modelConnected: status.modelConnected,
    nextAction: status.nextAdmissibleAction || "complete_setup",
    version,
    generated_at: new Date().toISOString(),
  };

  const useStatic = argv.includes("--static");
  let openPath = htmlPath;

  if (!useStatic) {
    const html = dashboardHtml;
    const injection = `<script>window.__DEMA_STATUS__=${htmlSafeJson(statusPayload)};</script>`;
    const filled = html.replace("</body>", injection + "\n</body>");
    const tmp = mkdtempSync(join(tmpdir(), "dema-dashboard-"));
    openPath = join(tmp, "dashboard.html");
    writeFileSync(openPath, filled, "utf8");
  }

  const { cmd, args } = openerArgv(process.platform, openPath);
  const { execFile } = await import("node:child_process");
  execFile(cmd, args, () => {});
  console.log(
    useStatic
      ? "Opening static dashboard: " + openPath
      : "Opening live dashboard: " + openPath,
  );
  process.exit(process.exitCode ?? 0);
}
