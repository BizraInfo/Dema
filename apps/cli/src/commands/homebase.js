import { runLiveHomebase } from "../../../../packages/core/src/live-homebase.js";
import {
  readBannerKey,
  runBannerKeyLoop,
} from "../../../../packages/core/src/banner-keys.js";
import {
  shouldShowIntro,
  renderIntroLine,
  recordIntroSeen,
} from "../../../../packages/core/src/intro-line.js";

export function homebaseWantsJson(argv) {
  return (
    argv.includes("--json") ||
    !process.stdout.isTTY ||
    Boolean(process.env.DEMA_NO_TUI) ||
    process.env.NODE_ENV === "test"
  );
}

export async function runHomebaseInvocation({
  argv = process.argv.slice(2),
  dispatchFn = null,
} = {}) {
  const wantJson = homebaseWantsJson(argv);
  const { join: pathJoin } = await import("node:path");
  const { homedir } = await import("node:os");
  const demaHome = process.env.DEMA_HOME || pathJoin(homedir(), ".dema");
  const showIntro = await shouldShowIntro({ home: demaHome });
  if (showIntro) {
    const introStream = wantJson ? process.stderr : process.stdout;
    introStream.write(renderIntroLine() + "\n\n");
    await recordIntroSeen({ home: demaHome });
  }
  const [{ gather }, { buildHomebasePreview }] = await Promise.all([
    import("../../../../packages/core/src/homebase-gather.js"),
    import("../../../../packages/core/src/homebase-preview.js"),
  ]);
  const gathered = await gather();
  const preview = buildHomebasePreview({ gather: gathered });
  if (wantJson) {
    process.stdout.write(JSON.stringify(preview, null, 2) + "\n");
    return;
  }
  const [{ formatHomebasePreview }, { resolveFormatterOptsFromEnv }] =
    await Promise.all([
      import("../../../../packages/core/src/tui-formatter.js"),
      import("../../../../packages/core/src/tui-formatter.js"),
    ]);
  const opts = resolveFormatterOptsFromEnv(process.env);
  process.stdout.write(formatHomebasePreview(preview, opts) + "\n");

  const bannerInteractive =
    process.stdin.isTTY &&
    process.stdout.isTTY &&
    process.env.DEMA_BANNER_INTERACTIVE !== "0";

  if (bannerInteractive && typeof dispatchFn === "function") {
    const liveMode = process.env.DEMA_HOMEBASE_LIVE !== "0";
    if (liveMode) {
      await runLiveHomebase({
        gatherFn: gather,
        buildPreviewFn: buildHomebasePreview,
        dispatchFn,
        stdin: process.stdin,
        stdout: process.stdout,
        opts,
      });
    } else {
      await runBannerKeyLoop({
        readKey: readBannerKey,
        dispatchFn,
        readKeyOpts: { stdin: process.stdin, stdout: process.stdout },
      });
    }
  }
}

export async function cmd_homebase(ctx, { dispatchFn } = {}) {
  await runHomebaseInvocation({ argv: ctx.argv, dispatchFn });
  process.exit(process.exitCode ?? 0);
}
