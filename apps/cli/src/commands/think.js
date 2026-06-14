import {
  buildThinkDryRun,
  formatThinkDryRun,
} from "../../../../packages/think/src/think-dry-run.js";
import {
  buildThinkLive,
  formatThinkLive,
} from "../../../../packages/think/src/think-live.js";
import {
  buildThinkCloseout,
  formatThinkCloseout,
} from "../../../../packages/think/src/think-closeout.js";
import {
  saveThinkReceipt,
  THINK_RECEIPT_SAVE_CONSENT,
} from "../../../../packages/think/src/think-receipt-save.js";
import {
  runThinkProbe,
  renderThinkProbeText,
} from "../../../../packages/think/src/think-probe.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_think(ctx) {
  const { argv } = ctx;
  if (argv.includes("--probe")) {
    const wantJsonTP = wantsJson(argv);
    try {
      const { fileURLToPath: tpURL } = await import("node:url");
      const { dirname: tpDirname, join: tpJoin } = await import("node:path");
      // commands/ is one level deeper than index.js — need 4 levels to repo root
      const tpRepoRoot = tpJoin(
        tpDirname(tpURL(import.meta.url)),
        "..",
        "..",
        "..",
        "..",
      );
      const tpReport = await runThinkProbe(tpRepoRoot);
      if (wantJsonTP) {
        console.log(JSON.stringify(tpReport, null, 2));
      } else {
        console.log(renderThinkProbeText(tpReport));
      }
      if (tpReport.verdict === "FAILED") process.exitCode = 1;
    } catch (err) {
      if (wantJsonTP) {
        console.log(
          JSON.stringify(
            {
              schema: "bizra.dema.think_probe.v0.1",
              error: err.message,
            },
            null,
            2,
          ),
        );
      } else {
        console.error(`Think probe error: ${err.message}`);
      }
      process.exitCode = 2;
    }
    process.exit(process.exitCode ?? 0);
  }

  const closeoutPath = argValue(argv, "--closeout");
  if (closeoutPath) {
    const wantJsonTC = wantsJson(argv);
    try {
      const {
        readFile: tcReadFile,
        readdir: tcReaddir,
        stat: tcStat,
      } = await import("node:fs/promises");
      const { join: tcJoin } = await import("node:path");
      const { homedir: tcHd } = await import("node:os");
      let raw;
      if (closeoutPath === "latest") {
        const tcHome = process.env.DEMA_HOME || tcJoin(tcHd(), ".dema");
        const tcDir = tcJoin(tcHome, "receipts");
        let tcFiles;
        try {
          tcFiles = (await tcReaddir(tcDir)).filter(
            (f) => f.startsWith("think-") && f.endsWith(".json"),
          );
        } catch {
          tcFiles = [];
        }
        if (tcFiles.length === 0) {
          const noMsg =
            "No think receipts found. Run a think with --save-receipt first.";
          if (wantJsonTC) {
            console.log(
              JSON.stringify(
                { schema: "bizra.dema.think_closeout.v0.1", error: noMsg },
                null,
                2,
              ),
            );
          } else {
            console.error(noMsg);
          }
          process.exitCode = 1;
          process.exit(process.exitCode ?? 0);
        }
        const withMtime = await Promise.all(
          tcFiles.map(async (f) => {
            const fp = tcJoin(tcDir, f);
            const s = await tcStat(fp);
            return { path: fp, mtime: s.mtimeMs };
          }),
        );
        withMtime.sort((a, b) => b.mtime - a.mtime);
        raw = await tcReadFile(withMtime[0].path, "utf8");
      } else {
        raw = await tcReadFile(closeoutPath, "utf8");
      }
      const envelope = JSON.parse(raw);
      const closeout = buildThinkCloseout(envelope);
      if (closeout.error) {
        if (wantJsonTC) {
          console.log(
            JSON.stringify(
              {
                schema: "bizra.dema.think_closeout.v0.1",
                error: closeout.error,
              },
              null,
              2,
            ),
          );
        } else {
          console.error(closeout.error);
        }
        process.exitCode = 1;
      } else if (wantJsonTC) {
        console.log(JSON.stringify(closeout, null, 2));
      } else {
        console.log(formatThinkCloseout(closeout));
      }
    } catch (err) {
      if (wantsJson(argv)) {
        console.log(
          JSON.stringify(
            {
              schema: "bizra.dema.think_closeout.v0.1",
              error: err.message,
            },
            null,
            2,
          ),
        );
      } else {
        console.error(`Think closeout error: ${err.message}`);
      }
      process.exitCode = 2;
    }
    process.exit(process.exitCode ?? 0);
  }

  const hasDryRun = argv.includes("--dry-run");
  const thinkConsent = argValue(argv, "--consent") ?? "";
  const modelConsent = argValue(argv, "--model-consent") ?? "";
  const thinkModel = argValue(argv, "--model") ?? "";
  const wantJsonTH = wantsJson(argv);

  if (hasDryRun && thinkConsent) {
    const msg = "Cannot use both --dry-run and --consent.";
    if (wantJsonTH) {
      console.log(
        JSON.stringify(
          { schema: "bizra.dema.think_dry_run.v0.1", error: msg },
          null,
          2,
        ),
      );
    } else {
      console.error(msg);
    }
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  if (!hasDryRun && !thinkConsent) {
    const msg =
      'Specify --dry-run or --consent "RUN LOCAL THINK".\n' +
      "Usage:\n" +
      '  dema think "<query>" --dry-run [--json]\n' +
      '  dema think "<query>" --consent "RUN LOCAL THINK" --model-consent "<phrase>" [--json]';
    if (wantJsonTH) {
      console.log(
        JSON.stringify(
          { schema: "bizra.dema.think_live.v0.1", error: msg },
          null,
          2,
        ),
      );
    } else {
      console.error(msg);
    }
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  const saveConsentVal = argValue(argv, "--save-consent") ?? "";
  const thinkQuery = argv
    .slice(1)
    .filter(
      (a) =>
        a !== "--dry-run" &&
        a !== "--json" &&
        a !== "--no-color" &&
        a !== "--consent" &&
        a !== thinkConsent &&
        a !== "--model-consent" &&
        a !== modelConsent &&
        a !== "--model" &&
        a !== thinkModel &&
        a !== "--save-receipt" &&
        a !== "--save-consent" &&
        a !== saveConsentVal,
    )
    .join(" ")
    .trim();

  if (!thinkQuery) {
    const msg = 'Missing query. Usage: dema think "<query>" --dry-run [--json]';
    if (wantJsonTH) {
      console.log(
        JSON.stringify(
          { schema: "bizra.dema.think_dry_run.v0.1", error: msg },
          null,
          2,
        ),
      );
    } else {
      console.error(msg);
    }
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  if (hasDryRun) {
    try {
      const thinkEnvelope = await buildThinkDryRun(thinkQuery);
      if (thinkEnvelope.error) {
        if (wantJsonTH) {
          console.log(
            JSON.stringify(
              {
                schema: "bizra.dema.think_dry_run.v0.1",
                error: thinkEnvelope.error,
              },
              null,
              2,
            ),
          );
        } else {
          console.error(thinkEnvelope.error);
        }
        process.exitCode = 1;
        process.exit(process.exitCode ?? 0);
      }
      if (wantJsonTH) {
        console.log(JSON.stringify(thinkEnvelope, null, 2));
      } else {
        console.log(formatThinkDryRun(thinkEnvelope));
      }
    } catch (err) {
      if (wantJsonTH) {
        console.log(
          JSON.stringify(
            { schema: "bizra.dema.think_dry_run.v0.1", error: err.message },
            null,
            2,
          ),
        );
      } else {
        console.error(`Think error: ${err.message}`);
      }
      process.exitCode = 2;
    }
    process.exit(process.exitCode ?? 0);
  }

  try {
    const liveEnvelope = await buildThinkLive(thinkQuery, {
      thinkConsent,
      modelConsent,
      model: thinkModel,
    });
    if (liveEnvelope.error) {
      if (wantJsonTH) {
        console.log(
          JSON.stringify(
            {
              schema: "bizra.dema.think_live.v0.1",
              error: liveEnvelope.error,
            },
            null,
            2,
          ),
        );
      } else {
        console.error(liveEnvelope.error);
      }
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    if (wantJsonTH) {
      console.log(JSON.stringify(liveEnvelope, null, 2));
    } else {
      console.log(formatThinkLive(liveEnvelope));
    }

    if (argv.includes("--save-receipt")) {
      const saveConsent = argValue(argv, "--save-consent") ?? "";
      const saveResult = await saveThinkReceipt(liveEnvelope, {
        demaHome: process.env.DEMA_HOME,
        consent: saveConsent,
        pretty: true,
      });
      if (!saveResult.saved) {
        if (saveResult.reason === "consent_missing") {
          console.error(
            `dema think: --save-receipt requires --save-consent "${THINK_RECEIPT_SAVE_CONSENT}"\n`,
          );
        } else if (saveResult.reason === "consent_mismatch") {
          console.error(
            `dema think: --save-receipt consent phrase mismatch; required: "${THINK_RECEIPT_SAVE_CONSENT}"\n`,
          );
        } else {
          console.error(
            `dema think: --save-receipt failed (${saveResult.reason}): ${saveResult.error_message ?? "unknown"}\n`,
          );
        }
        process.exitCode = 1;
      } else {
        console.error(`saved receipt to: ${saveResult.path}\n`);
      }
    }
  } catch (err) {
    if (wantJsonTH) {
      console.log(
        JSON.stringify(
          { schema: "bizra.dema.think_live.v0.1", error: err.message },
          null,
          2,
        ),
      );
    } else {
      console.error(`Think error: ${err.message}`);
    }
    process.exitCode = 2;
  }
  process.exit(process.exitCode ?? 0);
}
