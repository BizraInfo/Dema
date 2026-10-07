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
    // SOVEREIGN-CMD-SCAFFOLD-GAP (TASK-037): refuse with the prerequisite and
    // a working next step, not a bare path. `dema setup` never creates this
    // scaffold — it ships with the governed runtime, outside this repo — so a
    // fresh operator following the documented first run would otherwise hit a
    // dead end on a command the primary help surface advertises.
    if (argv.includes("--json")) {
      console.log(
        JSON.stringify(
          {
            schema: "bizra.dema.sovereign_tui_render.v0.1",
            truth_label: "NODE0_LOCAL_SEED",
            mode: "preview_only",
            available: false,
            reason: "sovereign_tui_scaffold_absent",
            expected_path: scaffold,
            prerequisite:
              "Python scaffold sovereign_tui/sovereign.py, shipped with the governed runtime — not part of this repo and not created by `dema setup`.",
            next: [
              "dema node0 activation observe",
              "dema status",
            ],
            boundary: {
              runtime_execution_performed: false,
              filesystem_write_performed: false,
              network_used: false,
              model_invocation_performed: false,
            },
          },
          null,
          2,
        ),
      );
      process.exit(1);
    }
    console.error("dema sovereign: unavailable — scaffold not installed.");
    console.error("");
    console.error(`  expected : ${scaffold}`);
    console.error(
      "  what     : the Sovereign Mission Interface is a Python scaffold",
    );
    console.error(
      "             (sovereign_tui/sovereign.py) that ships with the governed",
    );
    console.error(
      "             runtime. It is not part of this repo and `dema setup` does",
    );
    console.error("             not create it.");
    console.error("");
    console.error("  next     : dema node0 activation observe   — read what is live");
    console.error("             dema status                     — read node state");
    console.error("");
    console.error(
      "  Nothing was started, written, or connected. Dema observes the",
    );
    console.error("  sovereign runtime; it does not install or start it.");
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
