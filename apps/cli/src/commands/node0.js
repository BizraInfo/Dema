export async function cmd_node0(ctx) {
  const { argv } = ctx;
  const sub = argv[1];
  const action = argv[2];
  const wantJson = argv.includes("--json");
  const outIdx = argv.indexOf("--out");
  const outDir =
    outIdx !== -1 && argv[outIdx + 1] ? argv[outIdx + 1] : undefined;
  const operatorIdx = argv.indexOf("--operator");
  const operator =
    operatorIdx !== -1 && argv[operatorIdx + 1]
      ? argv[operatorIdx + 1]
      : "Mumu";

  if (sub === "map") {
    const { buildNode0RosettaConstitutionPreview } = await import(
      "../../../../packages/core/src/node0-rosetta-constitution-preview.js"
    );
    const map = buildNode0RosettaConstitutionPreview();
    if (wantJson) {
      console.log(JSON.stringify(map, null, 2));
      return;
    }
    console.log(
      `Node0 Rosetta Constitution (preview-only) — ${map.truth_label}`,
    );
    console.log(
      "  Telescript         Dema primitive                          status",
    );
    for (const row of map.rosetta) {
      console.log(
        `  ${row.telescript.padEnd(18)} ${row.dema_primitive.padEnd(39)} ${row.status}`,
      );
    }
    const s = map.status_summary;
    console.log(
      `  Capabilities: IMPLEMENTED ${s.IMPLEMENTED} · DECLARED ${s.DECLARED} · DESIGNED_NOT_LIVE ${s.DESIGNED_NOT_LIVE}`,
    );
    const rp = map.rest_protection;
    console.log(
      `  Rest-protection ${rp.metric}: ${rp.autonomous_count}/${rp.total_count} = ${rp.autonomy_coverage} (definition ${rp.definition_status}; live ${rp.live_measurement_status})`,
    );
    console.log(
      `  Cross-ref: ${map.cross_ref.external_pattern_registry.anchor_path}`,
    );
    return;
  }

  const actions = new Set(["status", "verify", "consent", "journey"]);
  if (sub !== "mumu" || !actions.has(action)) {
    console.error(
      "dema node0: Mumu closed-loop face (read-only; loop stays npm run node0). Subcommands:\n" +
        "  dema node0 map [--json]\n" +
        "  dema node0 mumu status [--json] [--out <dir>]\n" +
        "  dema node0 mumu verify [--json] [--out <dir>]\n" +
        "  dema node0 mumu consent [--json] [--out <dir>]\n" +
        "  dema node0 mumu journey [--json] [--out <dir>] [--operator <name>]",
    );
    process.exitCode = 1;
    return;
  }

  const {
    buildMumuStatus,
    buildMumuVerify,
    buildMumuConsent,
    buildMumuJourney,
  } = await import("../../../../scripts/node0-mumu-cli.mjs");

  const opts = outDir ? { outDir } : {};

  if (action === "status") {
    const report = buildMumuStatus(opts);
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

  if (action === "consent") {
    const report = buildMumuConsent(opts);
    if (wantJson) {
      console.log(JSON.stringify(report, null, 2));
    } else if (report.consent_pending) {
      console.log("Node0 Mumu consent — AWAITING");
      console.log(`  decision_id: ${report.decision_id}`);
      console.log(`  phrase:      ${report.expected_consent_phrase}`);
      console.log(`  next:        ${report.next_step}`);
    } else if (report.loop_complete) {
      console.log("Node0 Mumu consent — LOOP COMPLETE");
      console.log(`  next: ${report.next_step}`);
    } else {
      console.log("Node0 Mumu consent — NO PENDING REQUEST");
      console.log(`  next: ${report.next_step}`);
    }
    return;
  }

  if (action === "journey") {
    const report = buildMumuJourney({ ...opts, operator });
    if (wantJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      const { renderNode0MumuCockpit } =
        await import("../../../../packages/core/src/node0-mumu-cockpit.js");
      console.log(renderNode0MumuCockpit(report));
    }
    return;
  }

  const report = buildMumuVerify(opts);
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
