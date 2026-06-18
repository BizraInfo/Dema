// HOMEBASE-ASSET-GRAPH-1A · metadata-only graph from existing surfaces.
//
// Composes homebase affordances with the read-only Realm World Map inventory
// clusters. No scanner invocation, no file-content reads, no network.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";
import { DEMA_REALM_WORLD_MAP_SCHEMA } from "./dema-realm-world-map.js";
import { gatherDemaRealmWorldMap } from "./dema-realm-world-map.js";

export const HOMEBASE_ASSET_GRAPH_SCHEMA =
  "bizra.dema.homebase_asset_graph.v0.1";

export const HOMEBASE_ASSET_GRAPH_TRUTH_LABEL = "HOMEBASE_ASSET_GRAPH_PREVIEW";

const HOMEBASE_AFFORDANCES = Object.freeze([
  Object.freeze({ key: "m", label: "Mission", boundary_level: "L2_propose" }),
  Object.freeze({ key: "j", label: "Journal", boundary_level: "L1_remember" }),
  Object.freeze({ key: "r", label: "Receipts", boundary_level: "L0_observe" }),
  Object.freeze({ key: "b", label: "Browse", boundary_level: "L0_observe" }),
  Object.freeze({ key: "?", label: "Help", boundary_level: "L0_observe" }),
  Object.freeze({ key: "q", label: "Quit", boundary_level: "L0_observe" }),
]);

const CATEGORY_AFFORDANCE_HINTS = Object.freeze({
  receipt_or_proof: Object.freeze({ key: "r", label: "Receipts" }),
  code_project: Object.freeze({ key: "m", label: "Mission" }),
  document: Object.freeze({ key: "j", label: "Journal" }),
  model_artifact: Object.freeze({ key: "b", label: "Browse" }),
  media: Object.freeze({ key: "b", label: "Browse" }),
  dataset: Object.freeze({ key: "b", label: "Browse" }),
  archive: Object.freeze({ key: "b", label: "Browse" }),
  unknown: Object.freeze({ key: "b", label: "Browse" }),
});

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function freezeDeep(value) {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  for (const v of Object.values(value)) freezeDeep(v);
  return value;
}

function readOnlyBoundary() {
  return Object.freeze({
    ...buildPreviewBoundary(),
    scanner_invoked: false,
    inventory_write_performed: false,
  });
}

function nodeId(kind, key) {
  return `${kind}:${key}`;
}

function edgeId(from, to, relation) {
  return `sha256:${sha256(`${from}|${to}|${relation}`)}`;
}

function affordanceHintForCategory(category) {
  return CATEGORY_AFFORDANCE_HINTS[category] ?? CATEGORY_AFFORDANCE_HINTS.unknown;
}

/**
 * Pure builder: compose graph nodes/edges from an existing world-map state.
 *
 * @param {object} opts
 * @param {string} opts.renderedAtIso
 * @param {object} opts.realmWorldMap
 * @param {object|null} [opts.homebaseGather]
 */
export function buildHomebaseAssetGraph({
  renderedAtIso,
  realmWorldMap,
  homebaseGather = null,
}) {
  const nodes = [];
  const edges = [];

  const homebaseNode = Object.freeze({
    node_id: nodeId("homebase", "root"),
    kind: "homebase_root",
    label: "Homebase",
    metadata: Object.freeze({
      receipts_count: homebaseGather?.receipts?.count ?? null,
      memory_entries: homebaseGather?.memory_size?.entries ?? null,
      profile_present: homebaseGather?.profile?.source_present ?? null,
    }),
  });
  nodes.push(homebaseNode);

  for (const affordance of HOMEBASE_AFFORDANCES) {
    nodes.push(
      Object.freeze({
        node_id: nodeId("affordance", affordance.key),
        kind: "homebase_affordance",
        label: affordance.label,
        metadata: Object.freeze({
          boundary_level: affordance.boundary_level,
        }),
      }),
    );
    edges.push(
      Object.freeze({
        edge_id: edgeId(homebaseNode.node_id, nodeId("affordance", affordance.key), "offers"),
        from: homebaseNode.node_id,
        to: nodeId("affordance", affordance.key),
        relation: "offers",
      }),
    );
  }

  const worldMapNode = Object.freeze({
    node_id: nodeId("realm", "world_map"),
    kind: "realm_world_map",
    label: "Realm World Map",
    metadata: Object.freeze({
      status: realmWorldMap?.status ?? null,
      root_display: realmWorldMap?.root_display ?? null,
      generated_at_iso: realmWorldMap?.generated_at_iso ?? null,
      denied_count: realmWorldMap?.denied_count ?? null,
      truncated: realmWorldMap?.truncated ?? null,
    }),
  });
  nodes.push(worldMapNode);
  edges.push(
    Object.freeze({
      edge_id: edgeId(homebaseNode.node_id, worldMapNode.node_id, "surfaces"),
      from: homebaseNode.node_id,
      to: worldMapNode.node_id,
      relation: "surfaces",
    }),
  );

  if (realmWorldMap?.artifact_path) {
    const artifactNode = Object.freeze({
      node_id: nodeId("inventory", "artifact"),
      kind: "inventory_artifact",
      label: "Local asset inventory",
      metadata: Object.freeze({
        artifact_path_hash: `sha256:${sha256(realmWorldMap.artifact_path)}`,
        records_count: realmWorldMap?.summary?.records_count ?? null,
      }),
    });
    nodes.push(artifactNode);
    edges.push(
      Object.freeze({
        edge_id: edgeId(worldMapNode.node_id, artifactNode.node_id, "summarizes"),
        from: worldMapNode.node_id,
        to: artifactNode.node_id,
        relation: "summarizes",
      }),
    );
  }

  const clusters = Array.isArray(realmWorldMap?.clusters)
    ? realmWorldMap.clusters
    : [];
  for (const cluster of clusters) {
    const category = cluster.category || "unknown";
    const categoryNode = Object.freeze({
      node_id: nodeId("asset_category", category),
      kind: "asset_category",
      label: category,
      metadata: Object.freeze({
        count: cluster.count ?? 0,
        newest_mtime_iso: cluster.newest_mtime_iso ?? null,
        total_size_bytes: cluster.total_size_bytes ?? 0,
      }),
    });
    nodes.push(categoryNode);
    edges.push(
      Object.freeze({
        edge_id: edgeId(worldMapNode.node_id, categoryNode.node_id, "clusters"),
        from: worldMapNode.node_id,
        to: categoryNode.node_id,
        relation: "clusters",
      }),
    );

    const hint = affordanceHintForCategory(category);
    edges.push(
      Object.freeze({
        edge_id: edgeId(
          categoryNode.node_id,
          nodeId("affordance", hint.key),
          "suggested_for",
        ),
        from: categoryNode.node_id,
        to: nodeId("affordance", hint.key),
        relation: "suggested_for",
        metadata: Object.freeze({
          affordance_label: hint.label,
          heuristic: "metadata_only_v0.1",
        }),
      }),
    );
  }

  return freezeDeep({
    schema: HOMEBASE_ASSET_GRAPH_SCHEMA,
    truth_label: HOMEBASE_ASSET_GRAPH_TRUTH_LABEL,
    mode: "metadata_only",
    rendered_at_iso: renderedAtIso,
    sources: Object.freeze({
      realm_world_map_schema: DEMA_REALM_WORLD_MAP_SCHEMA,
      realm_world_map_status: realmWorldMap?.status ?? null,
      homebase_gather_present: Boolean(homebaseGather),
    }),
    summary: Object.freeze({
      node_count: nodes.length,
      edge_count: edges.length,
      category_count: clusters.length,
      affordance_count: HOMEBASE_AFFORDANCES.length,
    }),
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    next_safe_action:
      realmWorldMap?.next_safe_action ??
      "Run dema assets scan --root ~/Downloads, then dema realm asset-graph",
    boundary: readOnlyBoundary(),
  });
}

export async function gatherHomebaseAssetGraph(options = {}) {
  const now = options.now || new Date();
  const realmWorldMap = await gatherDemaRealmWorldMap(options);
  return buildHomebaseAssetGraph({
    renderedAtIso: now.toISOString(),
    realmWorldMap,
    homebaseGather: options.homebaseGather ?? null,
  });
}

export function renderHomebaseAssetGraph(graph, { useColor = false } = {}) {
  void useColor;
  const lines = [
    "DEMA HOMEBASE · ASSET GRAPH",
    `truth: ${graph.truth_label} · mode: ${graph.mode}`,
    `nodes: ${graph.summary.node_count} · edges: ${graph.summary.edge_count} · categories: ${graph.summary.category_count}`,
    `world_map_status: ${graph.sources.realm_world_map_status ?? "—"}`,
    "",
    "Categories → affordance hints:",
  ];
  const categoryEdges = graph.edges.filter((e) => e.relation === "suggested_for");
  if (categoryEdges.length === 0) {
    lines.push("  —");
  } else {
    for (const edge of categoryEdges) {
      const fromNode = graph.nodes.find((n) => n.node_id === edge.from);
      lines.push(
        `  ${fromNode?.label ?? edge.from} → ${edge.metadata?.affordance_label ?? edge.to}`,
      );
    }
  }
  lines.push("");
  lines.push(`Next: ${graph.next_safe_action}`);
  lines.push(
    "Boundary: metadata-only · read-only · no scan · no content · no network",
  );
  return lines.join("\n");
}
