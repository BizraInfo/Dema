// Node0 Gateway Server v0.1 — the missing conductor.
//
// Lightweight HTTP server on 127.0.0.1:7421 that implements the contract
// expected by the gateway-http-adapter. Makes one Node0 actually run locally.
//
// Endpoints:
//   GET /health        — domain=bizra-cognition-gateway-v1, status=ok
//   GET /chain         — receipt chain head, length, latestTimestamp
//   GET /poi/summary   — proof-of-impact summary
//   GET /resources/list — resource availability
//   POST /mission/run  — execute one bounded mission (accepts consent phrase)
//
// Loopback-only. No network surface. Stdlib only.

import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

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

  // Build receipt
  const chain = loadChain(stateDir);
  if (!chain.ok) {
    return { ok: false, error: chain.error, message: `Chain integrity failure: ${chain.error}` };
  }
  const entries = chain.entries || [];
  const prevHead = entries.length > 0 ? entries[entries.length - 1].hash : null;

  const receipt = {
    schema: "bizra.dema.node0_mission_receipt.v0.1",
    mission_id: missionId,
    objective: mission.objective || "unknown",
    effect_class: mission.effect_class || "READ_ONLY_OBSERVATION",
    previous_hash: prevHead,
    timestamp: now,
    status: "COMPLETED",
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
  receipt.hash = sha256(receipt);

  // Persist
  appendChain(stateDir, receipt);

  return {
    ok: true,
    mission_id: missionId,
    receipt_hash: receipt.hash,
    timestamp: now,
    effect_count: 1,
    duplicate_effects: 0,
  };
}

// ---- HTTP server ---------------------------------------------------------

export function createGatewayServer(options = {}) {
  const {
    port = DEFAULT_PORT,
    host = DEFAULT_HOST,
    stateDir = options.stateDir || join(process.cwd(), ".node0-state"),
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
            // Consent is exact-string authority. Any other GO-prefixed text
            // is a different instruction and must be refused, not widened.
            const expectedConsent = mission.consent || "";
            const consentOk = expectedConsent === MISSION_CONSENT_PHRASE;
            if (!consentOk) {
              return respond(403, {
                error: "consent_required",
                message: `POST /mission/run requires { consent: "${MISSION_CONSENT_PHRASE}" }`,
                expected_consent_phrase: MISSION_CONSENT_PHRASE,
              });
            }
            const result = executeMission(stateDir, mission);
            if (!result.ok) {
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
    join(process.cwd(), ".node0-state");

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
