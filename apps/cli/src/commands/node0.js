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

  if (sub === "activation" && action === "observe") {
    const { gatherNode0ActivationObservations } = await import("./observe-gatherer.js");
    const { buildNode0ActivationObserve } = await import(
      "../../../../packages/core/src/node0-activation-observe.js"
    );
    const observations = await gatherNode0ActivationObservations({});
    const report = buildNode0ActivationObserve(observations);
    if (wantJson) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    const s = report.sovereign_runtime_status;
    const lm = report.local_model_status.lm_studio;
    const ol = report.local_model_status.ollama;
    console.log(`Node0 activation observe (read-only) — ${report.truth_label}`);
    console.log(`  sovereign: live=${s.live} ready=${s.ready} (${s.base_url})`);
    console.log(
      `  models:    lm_studio ${lm.reachable ? lm.model_ids.length : "—"} · ollama ${ol.reachable ? ol.model_ids.length : "—"}`,
    );
    console.log(`  identity:  ${report.identity_status}`);
    console.log(`  roots:     ${report.canonical_roots.filter((r) => r.exists).length}/${report.canonical_roots.length} present`);
    console.log(`  gaps:      ${report.activation_gap_map.length}`);
    for (const g of report.activation_gap_map) {
      console.log(`    - ${g.gap}: ${g.suggestion}`);
    }
    console.log(`  next:      ${report.next_safe_action}`);
    return;
  }

  if (sub === "ladder") {
    const { gatherNode0LadderEvidence } = await import("./node0-ladder-gatherer.js");
    const { buildNode0ActivationLadder } = await import(
      "../../../../packages/core/src/node0-activation-ladder.js"
    );
    const evidence = gatherNode0LadderEvidence({});
    const report = buildNode0ActivationLadder({ evidence });
    if (wantJson) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    const s = report.summary;
    console.log(`Node0 activation ladder (read-only) — ${report.truth_label}`);
    for (const r of report.rungs) {
      console.log(`  ${r.status.padEnd(20)} ${r.id.padEnd(16)} ${r.command ?? "(operator-only)"}`);
    }
    console.log(
      `  summary: ${s.shipped} shipped · ${s.partial} partial · ${s.missing} missing · ${s.gated} gated`,
    );
    console.log(`  next gated rung: ${report.next_gated_rung ?? "—"} (operator-only · §1)`);
    console.log("  SHIPPED = surface present on disk, NOT proof of runtime correctness; nothing executed.");
    return;
  }

  if (sub === "chain") {
    const painIdx = argv.indexOf("--pain");
    const goalIdx = argv.indexOf("--goal");
    const pain = painIdx !== -1 ? argv[painIdx + 1] : undefined;
    const goal = goalIdx !== -1 ? argv[goalIdx + 1] : undefined;
    const baseIdx = argv.indexOf("--baseline");
    const basePath = baseIdx !== -1 ? argv[baseIdx + 1] : undefined;
    const includeSelfLoop = argv.includes("--self-loop");

    const { gatherNode0LadderEvidence } = await import("./node0-ladder-gatherer.js");
    const { buildNode0ActivationLadder } = await import(
      "../../../../packages/core/src/node0-activation-ladder.js"
    );
    const { buildModelRoutingPreview } = await import(
      "../../../../packages/core/src/model-routing-preview.js"
    );
    const { buildClosedDualLoopDryRun } = await import(
      "../../../../packages/core/src/closed-dual-loop-dry-run.js"
    );
    const { buildPatSatBlackboardDryRun } = await import(
      "../../../../packages/core/src/pat-sat-blackboard-dry-run.js"
    );
    const { buildNode0ActivationChainPreview } = await import(
      "../../../../packages/core/src/node0-activation-chain-preview.js"
    );
    const { buildPeakSelfLoopPreview } = includeSelfLoop
      ? await import("../../../../packages/core/src/peak-self-loop-preview.js")
      : { buildPeakSelfLoopPreview: null };

    const ladder = buildNode0ActivationLadder({
      evidence: gatherNode0LadderEvidence({}),
    });

    let routing_preview = null;
    if (basePath) {
      const { isAbsolute, resolve } = await import("node:path");
      const { readFile } = await import("node:fs/promises");
      if (!isAbsolute(basePath)) {
        throw new Error("`dema node0 chain --baseline` requires an absolute path.");
      }
      let baseline;
      try {
        baseline = JSON.parse(await readFile(resolve(basePath), "utf8"));
      } catch (readErr) {
        throw new Error(
          `Failed to read baseline: ${readErr && readErr.message ? readErr.message : readErr}`,
        );
      }
      routing_preview = buildModelRoutingPreview({
        baseline,
        generated_at_iso: new Date().toISOString(),
      });
    }

    const mission_plan = buildClosedDualLoopDryRun({
      pain: pain ?? null,
      goal: goal ?? null,
      routing_preview,
    });
    const blackboard = buildPatSatBlackboardDryRun({
      pain: pain ?? null,
      goal: goal ?? null,
    });
    const self_loop = includeSelfLoop
      ? buildPeakSelfLoopPreview({
          consent_phrase: "GO: act on peak-self-loop suggestion",
        })
      : null;
    const chain = buildNode0ActivationChainPreview({
      ladder,
      routing_preview,
      mission_plan,
      blackboard,
      self_loop,
    });

    if (wantJson) {
      console.log(JSON.stringify(chain, null, 2));
      return;
    }

    console.log(`Node0 activation chain (preview-only) — ${chain.truth_label}`);
    console.log(`  chain_status: ${chain.chain_status}`);
    console.log(
      `  ladder: ${chain.ladder_summary?.shipped ?? 0} shipped · next gated: ${chain.next_gated_rung ?? "—"}`,
    );
    if (chain.talk_env_hint?.env) {
      console.log("  talk env hint (PREVIEW — separate exact consent to invoke):");
      console.log(`    export DEMA_TALK_PROVIDER=${chain.talk_env_hint.env.DEMA_TALK_PROVIDER}`);
      console.log(`    export DEMA_TALK_MODEL=${chain.talk_env_hint.env.DEMA_TALK_MODEL}`);
    }
    console.log(`  mission_plan: ${mission_plan.dry_run_status}`);
    console.log(`  blackboard: ${blackboard.final_state}`);
    if (chain.autopoietic_posture) {
      const p = chain.autopoietic_posture;
      console.log(
        `  autopoietic posture (PREVIEW_ONLY): SNR=${p.snr_score ?? "—"} · RSI=${p.rsi_merged_verdict ?? "—"} · HHMM=${p.hhmm_peak_phase ?? "—"}`,
      );
      console.log(`    not_autonomous_runtime: ${p.not_autonomous_runtime}`);
    }
    console.log(`  chain_hash: ${chain.chain_hash?.slice(0, 16) ?? "—"}…`);
    console.log("  Nothing executed; activate rung remains operator-only.");
    return;
  }

  const actions = new Set(["status", "verify", "consent", "journey"]);
  if (sub !== "mumu" || !actions.has(action)) {
    console.error(
      "dema node0: Mumu closed-loop face (read-only; loop stays npm run node0). Subcommands:\n" +
        "  dema node0 map [--json]\n" +
        "  dema node0 activation observe [--json]\n" +
        "  dema node0 ladder [--json]\n" +
        "  dema node0 chain [--pain ...] [--goal ...] [--baseline <abs.json>] [--self-loop] [--json]\n" +
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
