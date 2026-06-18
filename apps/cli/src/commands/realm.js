import {
  gatherDemaRealmState,
  renderDemaRealmHome,
  realmMenuItemByKey,
} from "../../../../packages/core/src/dema-realm-home.js";
import {
  gatherDemaRealmBoard,
  renderDemaRealmBoard,
} from "../../../../packages/core/src/dema-realm-board.js";
import {
  gatherDemaRealmCheckpoint,
  renderDemaRealmCheckpoint,
} from "../../../../packages/core/src/dema-realm-checkpoint.js";
import { saveDemaRealmCheckpoint } from "../../../../packages/core/src/dema-realm-checkpoint-writer.js";
import {
  gatherDemaRealmCouncil,
  renderDemaRealmCouncil,
} from "../../../../packages/core/src/dema-realm-council.js";
import {
  buildCouncilSeatPatRoutingPreview,
  formatCouncilSeatPatRoutingResponse,
} from "../../../../packages/core/src/council-seat-pat-routing.js";
import {
  buildCouncilSeatPatDispatchPreview,
  formatCouncilSeatPatDispatchResponse,
} from "../../../../packages/adk/src/council-seat-pat-dispatch.js";
import {
  gatherDemaRealmStatus,
  renderDemaRealmStatus,
} from "../../../../packages/core/src/dema-realm-status.js";
import {
  gatherDemaRealmWorldMap,
  renderDemaRealmWorldMap,
} from "../../../../packages/core/src/dema-realm-world-map.js";
import {
  gatherHomebaseAssetGraph,
  renderHomebaseAssetGraph,
} from "../../../../packages/core/src/homebase-asset-graph.js";
import {
  gatherDemaRealmWallet,
  renderDemaRealmWallet,
} from "../../../../packages/core/src/dema-realm-wallet.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";
import { shouldUseColor } from "../../../../packages/core/src/status.js";
import { cmd_peak_self_loop } from "./peak-self-loop.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_realm(ctx) {
  const { argv } = ctx;
  const realmSub = argv[1] ?? "";
  const wantJsonR = wantsJson(argv);
  const noColor = argv.includes("--no-color") || !shouldUseColor();

  if (realmSub === "go") {
    const pick = argv[2];
    const item = realmMenuItemByKey(pick);
    if (!item) {
      console.error(
        `Unknown menu key: ${pick ?? "(missing)"}. Use dema realm go <n> where n is 1–5.`,
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 1);
    }
    if (item.realm_sub) {
      return cmd_realm({
        ...ctx,
        argv: ["realm", item.realm_sub, ...argv.slice(3)],
      });
    }
    console.error(`Menu item ${item.key} has no dispatch target.`);
    process.exitCode = 1;
    process.exit(process.exitCode ?? 1);
  }

  if (realmSub === "board") {
    const board = await gatherDemaRealmBoard();
    if (wantJsonR) {
      console.log(JSON.stringify(board, null, 2));
      process.exit(process.exitCode ?? 0);
    }
    console.log(renderDemaRealmBoard(board, { useColor: !noColor }));
    process.exit(process.exitCode ?? 0);
  }

  if (realmSub === "status") {
    const status = await gatherDemaRealmStatus();
    if (wantJsonR) {
      console.log(JSON.stringify(status, null, 2));
      process.exit(process.exitCode ?? 0);
    }
    console.log(renderDemaRealmStatus(status, { useColor: !noColor }));
    process.exit(process.exitCode ?? 0);
  }

  if (realmSub === "world-map") {
    const worldMap = await gatherDemaRealmWorldMap();
    if (wantJsonR) {
      console.log(JSON.stringify(worldMap, null, 2));
      process.exit(process.exitCode ?? 0);
    }
    console.log(renderDemaRealmWorldMap(worldMap, { useColor: !noColor }));
    process.exit(process.exitCode ?? 0);
  }

  if (realmSub === "asset-graph") {
    const graph = await gatherHomebaseAssetGraph();
    if (wantJsonR) {
      console.log(JSON.stringify(graph, null, 2));
      process.exit(process.exitCode ?? 0);
    }
    console.log(renderHomebaseAssetGraph(graph, { useColor: !noColor }));
    process.exit(process.exitCode ?? 0);
  }

  if (realmSub === "council-route") {
    const seat = argValue(argv, "--seat");
    const preview = buildCouncilSeatPatRoutingPreview({ seat });
    if (wantJsonR) {
      console.log(JSON.stringify(preview, null, 2));
      process.exit(process.exitCode ?? 0);
    }
    console.log(formatCouncilSeatPatRoutingResponse(preview));
    process.exit(process.exitCode ?? 0);
  }

  if (realmSub === "council-dispatch") {
    const seat = argValue(argv, "--seat");
    const consent = argValue(argv, "--consent") ?? "";
    const preview = buildCouncilSeatPatDispatchPreview({
      seat,
      consent_phrase: consent,
    });
    if (wantJsonR) {
      console.log(JSON.stringify(preview, null, 2));
      process.exit(process.exitCode ?? 0);
    }
    console.log(formatCouncilSeatPatDispatchResponse(preview));
    process.exit(process.exitCode ?? 0);
  }

  if (realmSub === "council") {
    const council = gatherDemaRealmCouncil();
    if (wantJsonR) {
      console.log(JSON.stringify(council, null, 2));
      process.exit(process.exitCode ?? 0);
    }
    console.log(renderDemaRealmCouncil(council, { useColor: !noColor }));
    process.exit(process.exitCode ?? 0);
  }

  if (realmSub === "wallet") {
    const wallet = await gatherDemaRealmWallet();
    if (wantJsonR) {
      console.log(JSON.stringify(wallet, null, 2));
      process.exit(process.exitCode ?? 0);
    }
    console.log(renderDemaRealmWallet(wallet, { useColor: !noColor }));
    process.exit(process.exitCode ?? 0);
  }

  if (realmSub === "proof-studio") {
    return cmd_peak_self_loop({
      ...ctx,
      argv: ["peak-self-loop", ...argv.slice(2)],
    });
  }

  if (realmSub === "checkpoint") {
    const checkpointSub = argv[2] ?? "";

    if (checkpointSub === "save") {
      const label = argValue(argv, "--label");
      const stage = argValue(argv, "--stage");
      const nextGear = argValue(argv, "--next-gear");
      const resumeCommand = argValue(argv, "--resume");
      const timelineLabel = argValue(argv, "--timeline-label");
      const result = await saveDemaRealmCheckpoint({
        label,
        stage,
        nextGear,
        resumeCommand,
        timelineLabel,
      });
      if (wantJsonR) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result.saved) {
        console.log(
          [
            `Checkpoint saved.`,
            `  Label:    ${result.checkpoint.label}`,
            `  Stage:    ${result.checkpoint.stage ?? "—"}`,
            `  Resume:   ${result.checkpoint.resume_command}`,
            `  Next:     ${result.checkpoint.next_gear ?? "—"}`,
            `  Sealed:   ${result.checkpoint.sealed_at_iso}`,
            `  Path:     ${result.checkpoint_path}`,
            `  Mode:     ${result.mode_octal ?? "—"}`,
            `  Timeline: ${result.timeline_total_events} events (latest: ${result.timeline_event_appended.at} · ${result.timeline_event_appended.label})`,
            `  Truth:    ${result.truth_label}`,
          ].join("\n"),
        );
      } else {
        console.error(
          `Checkpoint NOT saved · error: ${result.error}` +
            (result.max_length
              ? ` (max ${result.max_length}, received ${result.received_length})`
              : ""),
        );
        process.exitCode = 1;
      }
      process.exit(process.exitCode ?? 0);
    }

    const cp = await gatherDemaRealmCheckpoint();
    if (wantJsonR) {
      console.log(JSON.stringify(cp, null, 2));
      process.exit(process.exitCode ?? 0);
    }
    console.log(renderDemaRealmCheckpoint(cp, { useColor: !noColor }));
    process.exit(process.exitCode ?? 0);
  }

  const state = await gatherDemaRealmState();
  const debugMode = argv.includes("--debug");
  if (wantJsonR) {
    const { buildMumuJourney } =
      await import("../../../../scripts/node0-mumu-cli.mjs");
    const mumu = buildMumuJourney({ operator: state.operator });
    const payload = { ...state, node0_mumu: mumu };
    if (debugMode) {
      const status = await gatherDemaRealmStatus();
      payload.debug_status = status;
    }
    console.log(JSON.stringify(payload, null, 2));
    process.exit(process.exitCode ?? 0);
  }
  console.log(renderDemaRealmHome(state, { useColor: !noColor }));
  if (debugMode) {
    const status = await gatherDemaRealmStatus();
    console.log("");
    console.log(renderDemaRealmStatus(status, { useColor: !noColor }));
  } else {
    const { buildMumuJourney } =
      await import("../../../../scripts/node0-mumu-cli.mjs");
    const { renderNode0MumuCockpit } =
      await import("../../../../packages/core/src/node0-mumu-cockpit.js");
    const mumu = buildMumuJourney({ operator: state.operator });
    console.log("");
    console.log(renderNode0MumuCockpit(mumu, { useColor: !noColor }));
  }
  process.exit(process.exitCode ?? 0);
}
