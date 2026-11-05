// Node0 Gateway Server — retired, read-only test fixture.
// Production execution and receipt issuance belong to the governed runtime.
// POST /mission/run is always 410, even for fixtures: no path classification
// or symlink-swap window may revive the retired writer.

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
const DEFAULT_PORT = 7421;
const DEFAULT_HOST = "127.0.0.1";
const DOMAIN = "bizra-cognition-gateway-v1";
const GATEWAY_VERSION = "0.1.0";

function defaultStateDir() {
  return join(process.env.DEMA_HOME || join(homedir(), ".dema"), "node0");
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
        req.resume();
        return respond(410, {
          error: "gateway_retired",
          message: "JS gateway retired: mission execution via governed runtime only.",
          retired: true,
          expected: "governed_runtime",
        });
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
  console.error(JSON.stringify({
    error: "gateway_retired",
    message: "JS gateway retired. Import the read-only fixture in isolated tests only.",
    retired: true,
  }));
  process.exitCode = 1;
}
