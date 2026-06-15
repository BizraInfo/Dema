// `dema language` command handler.
//
// Extracted verbatim from apps/cli/src/index.js (dispatcher decomposition,
// step ④). Self-contained: ctx-driven, all dependencies loaded via dynamic
// import, no closure on index.js internals. The only edit vs the original is
// the relative import depth (one level deeper than index.js → one extra `../`).
export async function cmd_language(ctx) {
  const { argv, subcommand } = ctx;
  const { join: pathJoin } = await import("node:path");
  const { homedir: hd } = await import("node:os");
  const { readOperatorLanguage } =
    await import("../../../../packages/core/src/operator-profile.js");
  const { resolveOperatorLanguage, LANGUAGE_OPTIONS } =
    await import("../../../../packages/core/src/homebase-language-picker.js");
  const langHome = process.env.DEMA_HOME || pathJoin(hd(), ".dema");

  // dema language show [--json]
  if (subcommand === "show") {
    const result = await readOperatorLanguage(langHome);
    if (argv.includes("--json")) {
      console.log(
        JSON.stringify(
          {
            schema: "bizra.dema.language_state.v0.1",
            language_code: result.language_code,
            secondary_language_code: result.secondary_language_code,
            source: result.source,
          },
          null,
          2,
        ),
      );
      process.exit(process.exitCode ?? 0);
    }
    if (result.source === "absent" || result.language_code === null) {
      console.log(
        "Language: not set yet. Run `dema language` to set your preferred language.",
      );
    } else {
      const opt = LANGUAGE_OPTIONS.find((o) => o.code === result.language_code);
      const label = opt ? opt.label : result.language_code;
      console.log(`Language: ${label} (${result.language_code})`);
      if (result.secondary_language_code) {
        const opt2 = LANGUAGE_OPTIONS.find(
          (o) => o.code === result.secondary_language_code,
        );
        const label2 = opt2 ? opt2.label : result.secondary_language_code;
        console.log(`Secondary: ${label2} (${result.secondary_language_code})`);
      }
    }
    process.exit(process.exitCode ?? 0);
  }

  // dema language [--reset] — interactive picker
  const resetLanguage = argv.includes("--reset") || subcommand === "--reset";
  const picked = await resolveOperatorLanguage({
    home: langHome,
    stdin: process.stdin,
    stdout: process.stdout,
    resetLanguage,
    skipPrompt: false,
  });
  if (argv.includes("--json")) {
    console.log(JSON.stringify(picked, null, 2));
  }
  process.exit(process.exitCode ?? 0);
}
