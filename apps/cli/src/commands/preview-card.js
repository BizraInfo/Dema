export async function cmd_preview_card(ctx) {
  const { argv, subcommand } = ctx;
  const { join: pcJoin2 } = await import("node:path");
  const { homedir: pcHd2 } = await import("node:os");
  const { readGenesisPreviewCards } =
    await import("../../../../packages/core/src/operator-profile.js");
  const pcHome2 = process.env.DEMA_HOME || pcJoin2(pcHd2(), ".dema");

  if (!subcommand || subcommand === "show") {
    // dema preview-card show [<receipt_id_preview>] [--json]
    const hashArg = argv[2] && !argv[2].startsWith("--") ? argv[2] : null;
    const wantJson2 = argv.includes("--json");
    const cards = await readGenesisPreviewCards(pcHome2);

    if (hashArg) {
      const match = cards.find(
        (c) => c?.would_mint_if_consented?.receipt_id_preview === hashArg,
      );
      if (!match) {
        console.log(`preview-card: card not found for hash ${hashArg}`);
        process.exit(process.exitCode ?? 0);
      }
      console.log(
        wantJson2
          ? JSON.stringify(match, null, 2)
          : `receipt_id_preview: ${match.would_mint_if_consented.receipt_id_preview}`,
      );
      process.exit(process.exitCode ?? 0);
    }

    if (cards.length === 0) {
      console.log("no preview cards stored yet");
      process.exit(process.exitCode ?? 0);
    }

    if (wantJson2) {
      console.log(JSON.stringify(cards, null, 2));
      process.exit(process.exitCode ?? 0);
    }
    for (const c of cards) {
      console.log(
        `  ${c?.would_mint_if_consented?.receipt_id_preview ?? "unknown"}`,
      );
    }
    process.exit(process.exitCode ?? 0);
  }
  process.exit(process.exitCode ?? 0);
}
