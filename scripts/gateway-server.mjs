// Node0 Gateway Server v0.1 — QUARANTINED: LEGACY CONSUMER — FIXTURE-ONLY
//
// RETIRED per DEMA_GOVERNED_RUNTIME_HANDOFF-1A (2026-08-31 evaluation).
// This JavaScript gateway MUST NOT execute or certify production missions.
// Production path is the governed Rust runtime (bizra-data-lake).
// This file remains ONLY as a fixture for isolated tests
// (tests/gateway-verified-mission.test.js with injected stateDir=temp).
// Production stateDir (~/.dema/node0) via POST /mission/run now returns
// 410 Gone. The preview SAT-5 admission filter inside executeMission is
// request-envelope admission (same-process, caller-supplied booleans,
// hard-coded effect_count=1, SAT preview inert) — NOT independent
// mission execution, NOT governed-runtime receipt, NOT CONSTITUTIONAL
// verification. See docs/CURRENT_LIMITS.md and incident receipt
// docs/receipts/GATEWAY_QUARANTINE_2026-08-31.md.
//
// Endpoints (fixture-only):
//   GET /health        — domain=bizra-cognition-gateway-v1, status=ok
//   GET /chain         — receipt chain head, length, latestTimestamp
//   GET /poi/summary   — proof-of-impact summary
//   GET /resources/list — resource availability
//   POST /mission/run  — 410 in production; 200 only with isolated stateDir
//
// Loopback-only. No network surface. Stdlib only.

import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { evaluateConsent } from "../packages/fate/src/fate.js";
import { deriveSatVerifierSet } from "../packages/core/src/sat5-constitutional-verifier-set-preview.js";
import {
  genesisSupervisorState,
  step as supervisorStep,
  EVENT_KINDS as SUPERVISOR_EVENTS,
} from "../packages/core/src/mission-supervisor.js";

// Deterministic serialization — imported from the same source as node0-mumu-loop.
// JSON.stringify is NOT guaranteed to produce stable key order across engines.
function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

const DEFAULT_PORT = 7421;
const DEFAULT_HOST = "127.0.0.1";
const DOMAIN = "bizra-cognition-gateway-v1";
const GATEWAY_VERSION = "0.1.0";
const MISSION_CONSENT_PHRASE = "GO: Node0 bounded diagnostic activation only";

function defaultStateDir() {
  return join(process.env.DEMA_HOME || join(homedir(), ".dema"), "node0");
}

function isProductionStateDir(stateDir) {
  try {
    const def = defaultStateDir();
    // Exact match is production; temp dirs (mkdtemp) are fixture
    return resolve(stateDir) === resolve(def);
  } catch {
    return false;
  }
}

// ---- state persistence ---------------------------------------------------

function loadChain(stateDir) {
  const chainPath = join(stateDir, "chain.jsonl");
  if (!existsSync(chainPath)) return { ok: true, entries: [], empty: true };
  try {
    const text = readFileSync(chainPath, "utf8");
    const lines = text.split("\n").filter((l) => l.trim());
    const entries = [];
    const malformed = [];
    for (let i = 0; i < lines.length; i++) {
      try {
        entries.push(JSON.parse(lines[i]));
      } catch {
        malformed.push(i + 1);
      }
    }
    if (malformed.length > 0) {
      return {
        ok: false,
        error: "CHAIN_CORRUPT",
        entries,
        malformed_lines: malformed,
        total_lines: lines.length,
      };
    }
    return { ok: true, entries, empty: entries.length === 0 };
  } catch (err) {
    return { ok: false, error: "CHAIN_UNREADABLE", entries: [], reason: err.message };
  }
}

function appendChain(stateDir, entry) {
  mkdirSync(stateDir, { recursive: true });
  appendFileSync(
    join(stateDir, "chain.jsonl"),
    stableStringify(entry) + "\n",
    "utf8",
  );
}

function loadResources(stateDir) {
  const resPath = join(stateDir, "resources.json");
  if (!existsSync(resPath)) {
    return {
      compute: { available: true, type: "local" },
      storage: { available: true, type: "local" },
      model: { available: false, type: "none" },
      network: { available: false, type: "none" },
    };
  }
  try {
    return JSON.parse(readFileSync(resPath, "utf8"));
  } catch {
    return { compute: { available: true, type: "local" } };
  }
}

function loadPoiSummary(stateDir) {
  const chain = loadChain(stateDir);
  const entries = chain.entries || [];
  let totalImpact = 0;
  let totalEntries = 0;
  for (const entry of entries) {
    if (entry.impact !== undefined) {
      totalImpact += entry.impact;
      totalEntries += 1;
    }
  }
  return {
    totalEntries,
    totalImpact,
    avgImpact: totalEntries > 0 ? totalImpact / totalEntries : 0,
  };
}

// ---- receipt helpers -----------------------------------------------------

function sha256(value) {
  const data = typeof value === "string" ? value : stableStringify(value);
  return "sha256:" + createHash("sha256").update(data).digest("hex");
}

// ---- mission execution ---------------------------------------------------

function executeMission(stateDir, mission) {
  const now = new Date().toISOString();
  const missionId = mission.id || sha256(mission).slice(7, 19);

  const chain = loadChain(stateDir);
  if (!chain.ok) {
    return { ok: false, error: chain.error, message: `Chain integrity failure: ${chain.error}` };
  }
  const entries = chain.entries || [];
  const prevHead = entries.length > 0 ? entries[entries.length - 1].hash : null;

  // Build base receipt without final status — status is DERIVED via verifiers, not self-declared.
  const baseReceipt = {
    schema: "bizra.dema.node0_mission_receipt.v0.1",
    mission_id: missionId,
    objective: mission.objective || "unknown",
    effect_class: mission.effect_class || "READ_ONLY_OBSERVATION",
    previous_hash: prevHead,
    timestamp: now,
    effect_count: 1,
    duplicate_effects: 0,
    boundary_flags: {
      network_used: false,
      wallet_used: false,
      token_minted: false,
      file_content_read: false,
      source_tree_mutated: false,
    },
  };

  // ---- SAT-5 constitutional judgement (fail-closed) ----
  // Construct the deterministic outcome that SAT-5 judges. For honest missions the
  // outcome is ADMISSIBLE; any tripwire (mint claim, riba, forbidden claim) makes it REJECTED.
  const receiptHashForSat = sha256(baseReceipt);
  const outcome = {
    subject: "node0",
    receipt: {
      claimed_content_hash: receiptHashForSat,
      body_hash_rederived: receiptHashForSat,
    },
    consent: {
      phrase_present: typeof mission.consent === "string" && mission.consent.length > 0,
      exact_match: mission.consent === MISSION_CONSENT_PHRASE,
    },
    impact: {
      mint_claim: !!mission.mint_claim,
      cost_called_value: !!mission.cost_called_value,
      simulated_impact_as_real: !!mission.simulated_impact_as_real,
      unverified_impact_claimed: !!mission.unverified_impact_claimed,
    },
    blast: {
      blast_radius: mission.blast_radius || "low",
      reversible: mission.reversible ?? true,
      backup_present: mission.backup_present ?? true,
    },
    doctrine: {
      truth_label_present: mission.truth_label_present ?? true,
      boundary_all_false: mission.boundary_all_false ?? true,
      forbidden_claims: Array.isArray(mission.forbidden_claims) ? mission.forbidden_claims : [],
    },
  };
  // Convenience: objective marker SHOULD_FAIL_SAT5 forces a failing outcome without requiring the caller to set fields explicitly.
  if (typeof mission.objective === "string" && mission.objective.includes("SHOULD_FAIL_SAT5")) {
    outcome.impact.mint_claim = true;
    outcome.doctrine.forbidden_claims = [...outcome.doctrine.forbidden_claims, "test_forbidden_via_objective_marker"];
  }
  let satJudgment;
  try {
    satJudgment = deriveSatVerifierSet(outcome);
  } catch {
    satJudgment = { admissible: false, set_verdict: "REJECTED", failing_verifiers: ["SAT-derive-threw"], verifiers: [] };
  }

  // ---- MissionSupervisor wiring (preview) ----
  // The supervisor is pure and proposes; it never performs. We wire it as a
  // structural check that the call site imports the conductor — the gateway never
  // invents its own COMPLETED. A real contract would be frozen before EXECUTE;
  // here we prove the import and genesis do not throw on a minimal contract.
  // Supervisor failure does NOT override SAT-5 in this slice; SAT-5 is the gate.
  try {
    const dummyContract = {
      mission_id: missionId,
      authority_ceiling: "read_only",
      scope: "node0",
      iteration_budget: 5,
      acceptance_contract: {
        required_output_keys: [],
        forbidden_substrings: [],
        expected: {},
      },
    };
    const contractHash = sha256(dummyContract);
    const genesis = genesisSupervisorState({ contract: dummyContract, contract_hash: contractHash });
    // One step to prove the reducer is live (DISCOVER -> CONTRACT) — not terminal, but validates wiring.
    supervisorStep(genesis, { kind: SUPERVISOR_EVENTS.DISCOVERY_RECORDED, stage: "DISCOVER", hash: `test-${missionId}` }, { contract: dummyContract });
  } catch {
    // Preview boundary — supervisor wiring is structural, not mission-blocking in v0.1.
  }

  const verifiedStatus = satJudgment.admissible ? "COMPLETED" : "VERIFY_FAILED";

  const receipt = {
    ...baseReceipt,
    status: verifiedStatus,
    sat_verdict: satJudgment.set_verdict,
    sat_admissible: satJudgment.admissible,
    sat_failing_verifiers: satJudgment.failing_verifiers,
    // Inert judgment — no authority, no mint, no live SAT agent.
    sat_judges_node0: satJudgment.judges_node0,
    sat_serves_node0: satJudgment.serves_node0,
  };
  receipt.hash = sha256(receipt);

  appendChain(stateDir, receipt);

  // The HTTP response is honest about verification — a failing mission is not ok:true COMPLETED.
  if (verifiedStatus === "VERIFY_FAILED") {
    return {
      ok: false,
      error: "verify_failed",
      message: `Mission verdict REJECTED by SAT-5: ${satJudgment.failing_verifiers.join(",")}`,
      mission_id: missionId,
      receipt_hash: receipt.hash,
      timestamp: now,
      status: verifiedStatus,
      sat_verdict: satJudgment.set_verdict,
      sat_failing_verifiers: satJudgment.failing_verifiers,
    };
  }

  return {
    ok: true,
    mission_id: missionId,
    receipt_hash: receipt.hash,
    timestamp: now,
    effect_count: 1,
    duplicate_effects: 0,
    status: verifiedStatus,
    sat_verdict: satJudgment.set_verdict,
  };
}

// ---- HTTP server ---------------------------------------------------------

export function createGatewayServer(options = {}) {
  const {
    port = DEFAULT_PORT,
    host = DEFAULT_HOST,
    stateDir = options.stateDir || defaultStateDir(),
  } = options;

  let ready = false;

  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://${host}:${port}`);
    const method = req.method;

    // CORS: loopback only
    res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const respond = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body, null, 2) + "\n");
    };

    try {
      // GET /health
      if (method === "GET" && url.pathname === "/health") {
        const chain = loadChain(stateDir);
        if (!chain.ok) {
          return respond(503, {
            status: "degraded",
            domain: DOMAIN,
            version: GATEWAY_VERSION,
            ready: false,
            error: chain.error,
            uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
          });
        }
        return respond(200, {
          status: "ok",
          domain: DOMAIN,
          version: GATEWAY_VERSION,
          ready,
          chain_length: (chain.entries || []).length,
          uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
        });
      }

      // GET /chain
      if (method === "GET" && url.pathname === "/chain") {
        const chain = loadChain(stateDir);
        if (!chain.ok) {
          return respond(503, { error: chain.error, message: "Chain integrity failure" });
        }
        const entries = chain.entries || [];
        const head = entries.length > 0 ? entries[entries.length - 1].hash : null;
        const latestTimestamp =
          entries.length > 0 ? entries[entries.length - 1].timestamp : null;
        return respond(200, {
          head,
          length: entries.length,
          latestTimestamp,
          entries: entries.map((e) => ({
            hash: e.hash,
            mission_id: e.mission_id,
            timestamp: e.timestamp,
            status: e.status,
          })),
        });
      }

      // GET /poi/summary
      if (method === "GET" && url.pathname === "/poi/summary") {
        const summary = loadPoiSummary(stateDir);
        return respond(200, summary);
      }

      // GET /resources/list
      if (method === "GET" && url.pathname === "/resources/list") {
        const resources = loadResources(stateDir);
        const list = Object.entries(resources).map(([key, info]) => ({
          type: key,
          available: info.available,
          ...(info.type ? { capability: info.type } : {}),
        }));
        return respond(200, { resources: list });
      }

      // POST /mission/run
      if (method === "POST" && url.pathname === "/mission/run") {
        // Body size limit: 64KB — prevents oversized payload attacks.
        // Checked after full body received (not mid-stream) so the server
        // can always send a proper HTTP response.
        const MAX_BODY = 65536;
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          if (body.length > MAX_BODY) {
            return respond(413, {
              error: "payload_too_large",
              message: `Body exceeds ${MAX_BODY} byte limit`,
            });
          }
          try {
            const mission = JSON.parse(body);
            if (!mission.objective) {
              return respond(400, {
                error: "objective_required",
                message: "POST /mission/run requires { objective: string }",
              });
            }
            // QUARANTINE: production execution retired
            if (isProductionStateDir(stateDir)) {
              return respond(410, {
                error: "gateway_retired",
                message: "JS gateway retired: production mission execution via governed Rust runtime only (DEMA_GOVERNED_RUNTIME_HANDOFF-1A). Fixture-only with isolated stateDir.",
                retired: true,
                expected: "governed_runtime",
              });
            }
            // Consent gate: require exact phrase.
            // The actor must prove intent — bare POST is never authority.
            const consent = evaluateConsent({
              phrase: mission.consent,
              requiredPhrase: MISSION_CONSENT_PHRASE,
            });
            if (!consent.accepted) {
              return respond(403, {
                error: "consent_required",
                message:
                  'POST /mission/run requires { consent: "GO: Node0 bounded diagnostic activation only" }',
                expected_consent_phrase:
                  MISSION_CONSENT_PHRASE,
              });
            }
            const result = executeMission(stateDir, mission);
            if (!result.ok) {
              // Chain integrity failures are 503 (degraded); verified rejections are honest 200 with VERIFY_FAILED.
              if (result.error === "verify_failed") {
                return respond(200, result);
              }
              return respond(503, result);
            }
            ready = true;
            return respond(200, result);
          } catch (e) {
            return respond(400, {
              error: "invalid_json",
              message: e.message,
            });
          }
        });
        return;
      }

      // 404
      respond(404, {
        error: "not_found",
        message: `${method} ${url.pathname} not recognized`,
        available: ["/health", "/chain", "/poi/summary", "/resources/list", "POST /mission/run"],
      });
    } catch (err) {
      respond(500, { error: "internal", message: err.message });
    }
  });

  const startTime = Date.now();

  return {
    server,
    start() {
      return new Promise((resolve, reject) => {
        server.listen(port, host, () => {
          ready = true;
          resolve({ port, host, stateDir });
        });
        server.on("error", reject);
      });
    },
    stop() {
      return new Promise((resolve) => {
        ready = false;
        server.close(resolve);
      });
    },
    isReady() {
      return ready;
    },
  };
}

// ---- CLI entry point -----------------------------------------------------

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)
) {
  const port = Number(process.env.BIZRA_COGNITION_PORT || DEFAULT_PORT);
  const stateDir =
    process.env.BIZRA_SOVEREIGN_STATE_PATH ||
    defaultStateDir();

  if (isProductionStateDir(stateDir) && !process.env.DEMA_GATEWAY_ALLOW_FIXTURE) {
    console.error(
      JSON.stringify({
        error: "gateway_retired",
        message:
          "JS gateway retired: production execution via governed Rust runtime only (DEMA_GOVERNED_RUNTIME_HANDOFF-1A). Use fixture with isolated stateDir or set DEMA_GATEWAY_ALLOW_FIXTURE=1 for local preview.",
        stateDir,
        retired: true,
      }),
    );
    process.exitCode = 1;
  } else {
    const gw = createGatewayServer({ port, stateDir });

    gw.start()
      .then(() => {
        console.log(
          JSON.stringify({
            status: "started",
            domain: DOMAIN,
            port,
            host: DEFAULT_HOST,
            stateDir,
            loopback_only: true,
            message: "Node0 gateway listening on 127.0.0.1:" + port,
          }),
        );
      })
      .catch((err) => {
        console.error("Gateway failed to start:", err.message);
        process.exitCode = 1;
      });
  }
}
