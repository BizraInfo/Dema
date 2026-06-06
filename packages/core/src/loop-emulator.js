const SCHEMA = "bizra.dema.loop_design_emulation_preview.v0.1";
const DEFAULT_SEED = 42;

const PAT_CLASSES = [
  ["read_file", 0.2, 1, 0.005, [0.98, 0.01, 0.01], 0.1],
  ["write_journal", 0.15, 1, 0.005, [0.95, 0.04, 0.01], 0.1],
  ["query_memory", 0.15, 2, 0.01, [0.96, 0.02, 0.02], 0.4],
  ["propose_action", 0.12, 3, 0.02, [0.5, 0.4, 0.1], 0.3],
  ["ingest_corpus", 0.08, 4, 0.03, [0.3, 0.55, 0.15], 1.5],
  ["draft_message", 0.08, 3, 0.025, [0.2, 0.7, 0.1], 0.2],
  ["modify_canon", 0.05, 5, 0.04, [0.05, 0.85, 0.1], 0.5],
  ["external_call", 0.05, 4, 0.06, [0.1, 0.6, 0.3], 0.6],
  ["spawn_subagent", 0.05, 3, 0.03, [0.4, 0.5, 0.1], 0.4],
  ["commit_receipt", 0.04, 2, 0.01, [0.92, 0.06, 0.02], 0.8],
  ["ambiguous", 0.03, 5, 0.15, [0.1, 0.3, 0.6], 0.2],
];

const SAT_CLASSES = [
  ["urp_query_read", 0.35, 1, 0.002, [0.98, 0.01, 0.01]],
  ["capability_advertise", 0.1, 1, 0.005, [0.92, 0.06, 0.02]],
  ["wisdom_retrieve", 0.2, 2, 0.005, [0.95, 0.03, 0.02]],
  ["resource_offer_serve", 0.1, 2, 0.01, [0.85, 0.1, 0.05]],
  ["log_bus_emit", 0.1, 1, 0.003, [0.99, 0.005, 0.005]],
  ["poi_record", 0.05, 2, 0.01, [0.9, 0.08, 0.02]],
  ["wisdom_promote", 0.04, 4, 0.02, [0.05, 0.9, 0.05]],
  ["cross_node_handshake", 0.04, 4, 0.03, [0.1, 0.85, 0.05]],
  ["cross_node_write", 0.02, 5, 0.05, [0.0, 0.9, 0.1]],
];

const BOUNDARY = {
  scope: "design-emulation-preview",
  runtime_execution: false,
  pat_sat_runtime_spawned: false,
  mutation_performed: false,
  receipt_minted: false,
  capability_minted: false,
  network_connection_attempted: false,
  federation_initiated: false,
  node_handshake_performed: false,
  local_state_written: false,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedChoice(items, rng) {
  const total = items.reduce((sum, item) => sum + item[1], 0);
  let cursor = rng() * total;
  for (const item of items) {
    cursor -= item[1];
    if (cursor <= 0) return item;
  }
  return items.at(-1);
}

function randomInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function poisson(lambda, rng) {
  if (lambda <= 0) return 0;
  const threshold = Math.exp(-lambda);
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= rng();
  } while (product > threshold);
  return count - 1;
}

function emptyCounters() {
  return {
    missions: 0,
    completed: 0,
    blocked: 0,
    failed: 0,
    rejected: 0,
    pending_go: 0,
    wisdom_capsules: 0,
    vdpu: { V: 0, D: 0, P: 0, U: 0 },
    halts_by_stage: {},
  };
}

function addVdpu(target, source) {
  for (const key of ["V", "D", "P", "U"]) target[key] += source[key];
}

function addHalt(target, halt) {
  const stage = halt.split(":")[0];
  target[stage] = (target[stage] ?? 0) + 1;
}

function runMicroLoop({ organ, complexity, gateDist, haltP }, rng) {
  const vdpu = { V: 0, D: 0, P: 0, U: 0 };
  const halts = [];
  let gate_decision = null;
  let dod_result = null;
  let emulated_receipt_bytes = 0;

  vdpu.V += 3;
  if (rng() < 0.0001)
    return {
      vdpu,
      halts: ["mu1: canon hash mismatch"],
      gate_decision,
      dod_result,
    };

  vdpu.V += 1;
  vdpu.V += randomInt(rng, 2, 5);
  vdpu.D += randomInt(rng, 1, complexity);
  vdpu.P += randomInt(rng, 0, Math.max(1, complexity - 1));
  vdpu.U += randomInt(rng, 0, Math.max(1, complexity - 2));

  if (vdpu.U > vdpu.V + vdpu.D) {
    halts.push("mu4: unknowns block");
    return { vdpu, halts, gate_decision, dod_result: "BLOCKED" };
  }

  if (rng() < 0.002) {
    halts.push("mu5: empty knowledge body");
    return { vdpu, halts, gate_decision, dod_result: "BLOCKED" };
  }

  if (organ === "PAT") {
    const urpHit = rng() < 0.3;
    if (!urpHit && complexity >= 4 && rng() < 0.05) {
      halts.push("mu6: no know-how");
      return { vdpu, halts, gate_decision, dod_result: "BLOCKED" };
    }
  }

  if (rng() < 0.001) {
    halts.push("mu7: KPI/DoD vague");
    return { vdpu, halts, gate_decision, dod_result: "BLOCKED" };
  }

  const [permitP, pendingP] = gateDist;
  const gateRoll = rng();
  if (gateRoll < permitP) {
    gate_decision = "PERMIT";
  } else if (gateRoll < permitP + pendingP) {
    gate_decision = "PENDING_GO";
    halts.push("mu9: pending typed-GO");
    return { vdpu, halts, gate_decision, dod_result: "BLOCKED" };
  } else {
    gate_decision = "REJECT";
    halts.push("mu9: rejected");
    return {
      vdpu,
      halts,
      gate_decision,
      dod_result: "FAIL",
      emulated_receipt_bytes: 1024,
    };
  }

  if (rng() < haltP) {
    halts.push("mu10: scope violation");
    return { vdpu, halts, gate_decision, dod_result: "FAIL" };
  }

  dod_result = rng() < 0.95 - complexity * 0.05 ? "PASS" : "FAIL";
  emulated_receipt_bytes = 2048 + complexity * 512;
  return { vdpu, halts, gate_decision, dod_result, emulated_receipt_bytes };
}

function updateCounters(counter, outcome, rng) {
  counter.missions += 1;
  addVdpu(counter.vdpu, outcome.vdpu);
  for (const halt of outcome.halts) addHalt(counter.halts_by_stage, halt);

  if (outcome.gate_decision === "REJECT") counter.rejected += 1;
  else if (outcome.gate_decision === "PENDING_GO") {
    counter.pending_go += 1;
    counter.blocked += 1;
  } else if (outcome.dod_result === "PASS") {
    counter.completed += 1;
    if (rng && rng() < 0.1) counter.wisdom_capsules += 1;
  } else if (outcome.dod_result === "FAIL") counter.failed += 1;
  else counter.blocked += 1;
}

function simulateNode(nodeId, patMissionCount, rng) {
  const node = {
    node_id: nodeId,
    pat: emptyCounters(),
    sat: emptyCounters(),
    emulated_receipt_bytes: 0,
  };

  for (let i = 0; i < patMissionCount; i += 1) {
    const patClass = weightedChoice(PAT_CLASSES, rng);
    const [, , complexity, haltP, gateDist, satLambda] = patClass;
    const pat = runMicroLoop(
      { organ: "PAT", complexity, gateDist, haltP },
      rng,
    );
    updateCounters(node.pat, pat, rng);
    node.emulated_receipt_bytes += pat.emulated_receipt_bytes ?? 0;

    if (pat.dod_result === "PASS") {
      const satCount = poisson(satLambda, rng);
      for (let j = 0; j < satCount; j += 1) {
        const satClass = weightedChoice(SAT_CLASSES, rng);
        const [, , satComplexity, satHaltP, satGateDist] = satClass;
        const sat = runMicroLoop(
          {
            organ: "SAT",
            complexity: satComplexity,
            gateDist: satGateDist,
            haltP: satHaltP,
          },
          rng,
        );
        updateCounters(node.sat, sat);
        node.emulated_receipt_bytes += sat.emulated_receipt_bytes ?? 0;
      }
    }
  }

  return node;
}

function sumNodeCounters(nodes, organ) {
  const total = emptyCounters();
  for (const node of nodes) {
    const counter = node[organ];
    for (const key of [
      "missions",
      "completed",
      "blocked",
      "failed",
      "rejected",
      "pending_go",
      "wisdom_capsules",
    ]) {
      total[key] += counter[key];
    }
    addVdpu(total.vdpu, counter.vdpu);
    for (const [stage, count] of Object.entries(counter.halts_by_stage)) {
      total.halts_by_stage[stage] = (total.halts_by_stage[stage] ?? 0) + count;
    }
  }
  return total;
}

function percent(numerator, denominator) {
  return Math.round((numerator / Math.max(denominator, 1)) * 10000) / 100;
}

function scaleValue(value, scaleFactor) {
  return Math.round(value * scaleFactor);
}

function scaleCounters(counter, scaleFactor) {
  return {
    missions: scaleValue(counter.missions, scaleFactor),
    completed: scaleValue(counter.completed, scaleFactor),
    blocked: scaleValue(counter.blocked, scaleFactor),
    pending_go: scaleValue(counter.pending_go, scaleFactor),
    rejected: scaleValue(counter.rejected, scaleFactor),
    failed: scaleValue(counter.failed, scaleFactor),
    wisdom_capsules: scaleValue(counter.wisdom_capsules, scaleFactor),
  };
}

function vdpuPct(vdpu) {
  const total = Object.values(vdpu).reduce((sum, value) => sum + value, 0) || 1;
  return Object.fromEntries(
    Object.entries(vdpu).map(([key, value]) => [key, percent(value, total)]),
  );
}

function humanizeBytes(bytes) {
  for (const [unit, divisor] of [
    ["PB", 1e15],
    ["TB", 1e12],
    ["GB", 1e9],
    ["MB", 1e6],
    ["KB", 1e3],
  ]) {
    if (bytes >= divisor) return `${(bytes / divisor).toFixed(2)} ${unit}`;
  }
  return `${bytes} B`;
}

function humanizeSeconds(seconds) {
  if (seconds >= 86400 * 365)
    return `${(seconds / 86400 / 365).toFixed(1)} years`;
  if (seconds >= 86400) return `${(seconds / 86400).toFixed(1)} days`;
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)} hours`;
  if (seconds >= 60) return `${(seconds / 60).toFixed(1)} minutes`;
  return `${seconds} seconds`;
}

function aggregateScale({ label, nodeCount, patPerNode, sampleNodes, seed }) {
  const rng = makeRng(seed + nodeCount);
  const nodes = Array.from({ length: sampleNodes }, (_, index) =>
    simulateNode(index, patPerNode, rng),
  );
  const scaleFactor = nodeCount / sampleNodes;
  const pat = sumNodeCounters(nodes, "pat");
  const sat = sumNodeCounters(nodes, "sat");
  const receiptBytes = nodes.reduce(
    (sum, node) => sum + node.emulated_receipt_bytes,
    0,
  );
  const pendingTotal = pat.pending_go + sat.pending_go;

  return {
    scale: label,
    truth_basis: scaleFactor === 1 ? "DESIGN_SAMPLE" : "DERIVED_EXTRAPOLATION",
    sample: {
      nodes_simulated: sampleNodes,
      nodes_represented: nodeCount,
      pat_per_node: patPerNode,
      scale_factor: scaleFactor,
    },
    hardware: {
      nodes_represented: nodeCount,
      pat_agents_modeled: nodeCount * 7,
      sat_agents_modeled: nodeCount * 5,
      total_agents_modeled: nodeCount * 12,
      aggregate_ram_gb_estimate: nodeCount * 32,
      aggregate_disk_gb_estimate: nodeCount * 500,
      aggregate_cores_estimate: nodeCount * 8,
      evidence_kind: "design_assumption",
    },
    performance: {
      pat_wall_per_mission_sec_assumption: 75,
      sat_wall_per_mission_sec_assumption: 12,
      pat_throughput_per_hour_estimate: nodeCount * Math.floor(3600 / 75),
      sat_throughput_per_hour_estimate: nodeCount * Math.floor(3600 / 12),
      bottleneck_estimate:
        pendingTotal * scaleFactor > 1_000_000
          ? "human_attention_typed_go_queue"
          : "local_llm_inference",
      evidence_kind: "design_estimate",
    },
    data: {
      emulated_receipt_bytes: scaleValue(receiptBytes, scaleFactor),
      emulated_receipt_size_human: humanizeBytes(
        scaleValue(receiptBytes, scaleFactor),
      ),
      emulated_receipt_records: scaleValue(
        pat.missions + sat.missions,
        scaleFactor,
      ),
      wisdom_capsules_estimate: scaleValue(pat.wisdom_capsules, scaleFactor),
      pending_go_queue_estimate: scaleValue(pendingTotal, scaleFactor),
      pat_vdpu_pct: vdpuPct(pat.vdpu),
      sat_vdpu_pct: vdpuPct(sat.vdpu),
      data_residency_assumption: "local_per_node",
      cross_node_data_flow_assumption: "metadata_only_no_raw_personal_data",
    },
    impact: {
      completed_missions_estimate: scaleValue(
        pat.completed + sat.completed,
        scaleFactor,
      ),
      pat_completion_pct: percent(pat.completed, pat.missions),
      sat_completion_pct: percent(sat.completed, sat.missions),
      pat_rejection_pct: percent(pat.rejected, pat.missions),
      sat_rejection_pct: percent(sat.rejected, sat.missions),
      wisdom_compounding_pct: percent(pat.wisdom_capsules, pat.completed),
      human_attention_if_30_sec_each: humanizeSeconds(
        scaleValue(pendingTotal, scaleFactor) * 30,
      ),
      estimated_value_usd_if_005_per_completion:
        Math.round((pat.completed + sat.completed) * scaleFactor * 5) / 100,
      certifies_economic_value: false,
    },
    raw_counts: {
      pat: scaleCounters(pat, scaleFactor),
      sat: scaleCounters(sat, scaleFactor),
    },
  };
}

export function emulateLoopDesign({ seed = DEFAULT_SEED } = {}) {
  const normalizedSeed = Number.isInteger(seed) ? seed : DEFAULT_SEED;
  const scales = {
    node0_solo: aggregateScale({
      label: "node0_solo",
      nodeCount: 1,
      patPerNode: 1000,
      sampleNodes: 1,
      seed: normalizedSeed,
    }),
    pilot_100: aggregateScale({
      label: "pilot_100",
      nodeCount: 100,
      patPerNode: 200,
      sampleNodes: 100,
      seed: normalizedSeed,
    }),
    global_1m: aggregateScale({
      label: "global_1m",
      nodeCount: 1_000_000,
      patPerNode: 100,
      sampleNodes: 1000,
      seed: normalizedSeed,
    }),
  };

  return {
    schema: SCHEMA,
    mode: "PREVIEW_ONLY",
    truth_label: "DESIGN_EMULATION_NOT_RUNTIME_RECEIPT",
    source_version: "dema_loop_lifecycle_emulator_v0.2_port",
    seed: normalizedSeed,
    covers: "PAT_7_PER_NODE_PLUS_SAT_5_PER_NODE_DESIGN_MODEL",
    lenses: ["hardware", "performance", "data", "impact"],
    scales,
    proof_of_truth_convergence: {
      formal:
        "Taxonomies, gates, and counters are deterministic for a fixed seed.",
      cryptographic:
        "No cryptographic receipt is minted or claimed by this preview.",
      empirical:
        "Use tests and CLI smoke only to verify deterministic preview behavior.",
      economic:
        "Value fields are assumptions, not measured PoI or financial claims.",
    },
    self_critique: [
      "This is a design emulation, not a runtime receipt, not a Node0 activation, and not evidence that PAT or SAT agents executed.",
      "Performance and impact values are derived from fixed assumptions; they should guide bottleneck reasoning, not certify capacity.",
      "The model can surface typed-GO queue pressure and receipt-volume risk, but it cannot prove security, federation readiness, or economic value.",
    ],
    boundary: clone(BOUNDARY),
  };
}

function formatScale(label, scale) {
  return [
    `--- ${label} ---`,
    `  agents modeled:      ${scale.hardware.total_agents_modeled.toLocaleString()}`,
    `  PAT throughput/hr:   ${scale.performance.pat_throughput_per_hour_estimate.toLocaleString()}`,
    `  SAT throughput/hr:   ${scale.performance.sat_throughput_per_hour_estimate.toLocaleString()}`,
    `  emulated records:    ${scale.data.emulated_receipt_records.toLocaleString()}`,
    `  pending typed-GO:    ${scale.data.pending_go_queue_estimate.toLocaleString()}`,
    `  completed estimate:  ${scale.impact.completed_missions_estimate.toLocaleString()}`,
    `  bottleneck:          ${scale.performance.bottleneck_estimate}`,
  ];
}

export function formatLoopDesignEmulation(report) {
  const lines = [
    "DEMA Loop Design Emulation",
    "",
    `Mode: ${report.mode}`,
    `Truth label: ${report.truth_label}`,
    `Seed: ${report.seed}`,
    "Boundary: preview-only; no runtime execution; no PAT/SAT agents spawned; no receipt minted; no local state written.",
    "",
  ];

  for (const [label, scale] of Object.entries(report.scales)) {
    lines.push(...formatScale(label, scale), "");
  }

  lines.push("Self-critique:");
  for (const item of report.self_critique) lines.push(`  - ${item}`);
  return lines.join("\n").trimEnd();
}
