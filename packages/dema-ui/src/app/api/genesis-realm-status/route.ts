import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_GENESIS_REALM_URL = "http://127.0.0.1:4300/api/realm";
const TIMEOUT_MS = 1_500;

function blocked(blocked_by: string[], source_url: string) {
  return NextResponse.json({
    schema: "bizra.dema.genesis_realm_status.v0.1",
    truth_label: "GENESIS_REALM_UNAVAILABLE",
    source_url,
    blocked_by,
  }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

function summarize(state: any, source_url: string) {
  const inventory = state?.sat?.inventory;
  const boundary = state?.boundary;
  if (state?.schema !== "bizra.genesis.world_state.v0.1" || state?.ok !== true) {
    return ["genesis_world_state_not_ready"];
  }
  if (state?.truth_label !== "LOCAL_CANDIDATE") return ["genesis_truth_label_unexpected"];
  if (state?.dema?.status !== "HEALTHY_LOCAL") return ["dema_health_not_proven"];
  if (state?.pat?.status !== "PAT7_OPERATIONAL_NODE0_LOCAL" || state.pat.count !== 7) {
    return ["pat7_not_verified"];
  }
  if (state?.sat?.status !== "SAT5_OPERATIONAL_URP_GENESIS" || state.sat.owner !== "BIZRA_SYSTEM") {
    return ["sat5_system_plane_not_verified"];
  }
  if (!Array.isArray(inventory) || inventory.length !== 5 || inventory.some((entry: any) =>
    entry?.status !== "MISSION_VERIFIED" || entry?.verdict !== "PASS" ||
    entry?.evidence_ref?.source_event !== "SAT_JUDGMENT_RECORDED" ||
    typeof entry?.evidence_ref?.judgment_sha256 !== "string")) {
    return ["sat_verdict_evidence_refs_incomplete"];
  }
  if (!state?.world_cell || state.world_cell.effect_count !== 1 || state.world_cell.duplicate_effects !== 0) {
    return ["world_cell_effect_postcondition_missing"];
  }
  if (!boundary || Object.values(boundary).some((value) => value !== false)) {
    return ["genesis_boundary_not_closed"];
  }
  return null;
}

export async function GET() {
  const source_url = DEFAULT_GENESIS_REALM_URL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(source_url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return blocked([`genesis_http_${response.status}`], source_url);
    let state;
    try {
      state = await response.json();
    } catch {
      return blocked(["genesis_response_not_json"], source_url);
    }
    const blocked_by = summarize(state, source_url);
    if (blocked_by) return blocked(blocked_by, source_url);
    return NextResponse.json({
      schema: "bizra.dema.genesis_realm_status.v0.1",
      truth_label: "MEASURED_LOCAL",
      source: "loopback_genesis_urp0",
      source_url,
      observed_at_iso: new Date().toISOString(),
      dema: state.dema,
      pat: state.pat,
      sat: {
        status: state.sat.status,
        owner: state.sat.owner,
        principal: state.sat.principal,
        logical_home: state.sat.logical_home,
        inventory: state.sat.inventory,
      },
      fate: state.fate,
      urp: state.urp,
      world_cell: state.world_cell,
      boundary: state.boundary,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return blocked([error?.name === "AbortError" ? "genesis_request_timeout" : "genesis_request_failed"], source_url);
  } finally {
    clearTimeout(timer);
  }
}
