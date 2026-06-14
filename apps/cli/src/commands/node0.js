export async function cmd_node0(ctx) {
  const { argv } = ctx;
  const sub = argv[1];
  const action = argv[2];
  const wantJson = argv.includes("--json");
  const outIdx = argv.indexOf("--out");
  const outDir =
    outIdx !== -1 && argv[outIdx + 1] ? argv[outIdx + 1] : undefined;

  if (sub !== "mumu" || (action !== "status" && action !== "verify")) {
    console.error(
      "dema node0: read-only Mumu closed-loop face. Subcommands:\n" +
        "  dema node0 mumu status [--json]\n" +
        "  dema node0 mumu verify [--json]",
    );
    process.exitCode = 1;
    return;
  }

  const { buildMumuStatus, buildMumuVerify } =
    // commands/ is one level deeper — need 4 levels to reach repo root
    await import("../../../../scripts/node0-mumu-cli.mjs");

  if (action === "status") {
    const report = buildMumuStatus(outDir ? { outDir } : {});
    if (wantJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(
        `Node0 Mumu closed loop — ${report.network_mode.network_mode}`,
      );
      console.log(
        `  chain: ${report.chain_present ? `present (${report.receipt_count} receipts)` : "absent"}`,
      );
      console.log(`  out:   ${report.out_dir}`);
      console.log(
        `  token_minted: ${report.network_mode.token_minted} · federation: ${report.network_mode.external_federation_active}`,
      );
      console.log(`  next:  ${report.next_step}`);
    }
    return;
  }

  const report = buildMumuVerify(outDir ? { outDir } : {});
  if (wantJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Node0 Mumu chain verify → ${report.verdict}`);
    if (report.chain_present) {
      for (const [k, v] of Object.entries(report.replay.checks)) {
        console.log(`  ${v ? "ok  " : "FAIL"} ${k}`);
      }
      if (report.replay.tamper_detected.length) {
        console.log(`  tamper: ${report.replay.tamper_detected.join(", ")}`);
      }
    } else {
      console.log(`  ${report.note}`);
    }
  }
  if (report.verdict !== "VERIFIED") process.exitCode = 1;
}
