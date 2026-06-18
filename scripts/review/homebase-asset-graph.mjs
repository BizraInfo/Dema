#!/usr/bin/env node
// HOMEBASE-ASSET-GRAPH-1A — read-only graph composition check.

import {
  buildHomebaseAssetGraph,
} from "../../packages/core/src/homebase-asset-graph.js";
import { DEMA_REALM_WORLD_MAP_SCHEMA } from "../../packages/core/src/dema-realm-world-map.js";

const JSON_MODE = process.argv.includes("--json");

const graph = buildHomebaseAssetGraph({
  renderedAtIso: new Date().toISOString(),
  realmWorldMap: {
    schema: DEMA_REALM_WORLD_MAP_SCHEMA,
    status: "INVENTORY_READY",
    artifact_path: "/tmp/.dema/realm/local-assets/inventory-v0.1.json",
    clusters: [
      {
        category: "document",
        count: 1,
        newest_mtime_iso: "2026-06-18T08:00:00.000Z",
        total_size_bytes: 10,
      },
    ],
    summary: { records_count: 1 },
    next_safe_action: "Review local clusters",
  },
});

const ok =
  graph.schema === "bizra.dema.homebase_asset_graph.v0.1" &&
  graph.summary.node_count > 0 &&
  graph.summary.edge_count > 0 &&
  graph.boundary.scanner_invoked === false;

if (JSON_MODE) {
  console.log(JSON.stringify({ ok, graph }, null, 2));
} else {
  console.log("DEMA · homebase asset graph (metadata-only)");
  console.log(`  nodes: ${graph.summary.node_count}`);
  console.log(`  edges: ${graph.summary.edge_count}`);
  console.log(`  result: ${ok ? "PASS" : "FAIL"}`);
}

process.exit(ok ? 0 : 1);
