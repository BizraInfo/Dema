export async function cmd_sovereign(ctx) {
  const { argv } = ctx;
  // Sovereign Mission Interface — 7-panel cockpit renderer
  // Delegates to the Python scaffold at ~/.dema/kernel/sovereign_tui/sovereign.py
  // Schema: bizra.dema.sovereign_tui_render.v0.1
  const { existsSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const home = process.env.HOME || process.env.USERPROFILE;
  const demaHome = process.env.DEMA_HOME || (home ? join(home, ".dema") : null);
  if (!demaHome) {
    console.error(
      "dema sovereign: unable to resolve DEMA_HOME (set DEMA_HOME or HOME).",
    );
    process.exit(1);
  }
  const scaffold = join(demaHome, "kernel", "sovereign_tui", "sovereign.py");
  if (!existsSync(scaffold)) {
    console.error(`dema sovereign: scaffold not found: ${scaffold}`);
    process.exit(1);
  }
  const result = spawnSync("python3", [scaffold, ...argv.slice(1)], {
    stdio: "inherit",
  });
  if (result.error) {
    console.error(
      `dema sovereign: failed to spawn python3: ${result.error.message}`,
    );
    process.exit(1);
  }
  // status null without error is unusual; fail-safe to non-zero
  process.exit(result.status ?? 1);
}
