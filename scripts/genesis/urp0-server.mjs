// BIZRA-GENESIS-NODE0-URP-LOCAL-IGNITION-1A · GENESIS_RUNTIME_SPINE_1A.0
//
// I/O TIER — the URP-0 local control plane. Loopback only.
//
// Binds 127.0.0.1 explicitly. Never 0.0.0.0, never ::, no tunnel, no proxy, no
// DNS. The bind host is a constant in this file, not a configurable — there is
// no code path that exposes this server to a network interface.

import { createServer } from "node:http";

import { execFileSync } from "node:child_process";
import {
  admissionCard,
  admitHuman0,
  authorizeAndExecute,
  missionConsentCard,
  replayFromDisk,
  sealBlock0,
  worldState,
} from "./urp0-runtime.mjs";
import { resolveStateRootDir } from "./urp0-store.mjs";

export const BIND_HOST = "127.0.0.1";
export const DEFAULT_PORT = 4300;
const MAX_BODY_BYTES = 64 * 1024;

// The UI runs on its own loopback port; nothing else may talk to this server.
// Derived from the port the UI was actually started on — hardcoding 3000 here
// while the launcher accepted GENESIS_UI_PORT made the documented escape hatch
// produce a CORS-blocked page.
export function loopbackOrigins(port) {
  return Object.freeze([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
}

export const DEFAULT_UI_PORT = 3000;

function json(res, status, body, origin, allowedOrigins) {
  const text = JSON.stringify(body, null, 2);
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
  if (origin && allowedOrigins.includes(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-headers"] = "content-type";
    headers["access-control-allow-methods"] = "GET,POST,OPTIONS";
  }
  res.writeHead(status, headers);
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body_too_large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (raw === "") return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("body_not_json"));
      }
    });
    req.on("error", reject);
  });
}

// Fixed argv, no shell, no interpolation — the only subprocess in the spine, and
// it reads one commit id. SAT-4's "no unrestricted shell" holds structurally.
function gitCommit(cwd) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export function createUrp0Server({
  stateRootDir = resolveStateRootDir(),
  repoRoot = process.cwd(),
  now = () => new Date().toISOString(),
  uiPort = DEFAULT_UI_PORT,
  allowedOrigins = loopbackOrigins(uiPort),
} = {}) {
  return createServer(async (req, res) => {
    const origin = req.headers.origin;
    const url = new URL(req.url, `http://${BIND_HOST}`);
    const path = url.pathname;

    if (req.method === "OPTIONS") return json(res, 204, {}, origin, allowedOrigins);

    try {
      if (req.method === "GET" && path === "/readyz") {
        const disk = replayFromDisk(stateRootDir);
        return json(res, disk.ok ? 200 : 503, {
          ready: disk.ok,
          truth_label: "LOCAL_CANDIDATE",
          urp_state_root: disk.state_root,
          events_applied: disk.events_applied,
          blocked_by: disk.blocked_by,
          bind_host: BIND_HOST,
          public_gateway: false,
        }, origin, allowedOrigins);
      }

      if (req.method === "GET" && path === "/api/realm") {
        return json(res, 200, worldState(stateRootDir), origin, allowedOrigins);
      }

      if (req.method === "GET" && path === "/api/admission-card") {
        return json(res, 200, admissionCard(), origin, allowedOrigins);
      }

      if (req.method === "POST" && path === "/api/admit") {
        const body = await readBody(req);
        const out = admitHuman0(stateRootDir, { phrase: body.phrase, now_iso: now() });
        return json(res, out.ok ? 200 : 400, out, origin, allowedOrigins);
      }

      // Deriving a card writes nothing and executes nothing. It is a GET-shaped
      // act expressed as POST only because it carries the selected root.
      if (req.method === "POST" && path === "/api/consent-card") {
        const body = await readBody(req);
        const out = missionConsentCard(stateRootDir, { root: body.root, now_iso: now() });
        return json(res, out.ok ? 200 : 400, out, origin, allowedOrigins);
      }

      if (req.method === "POST" && path === "/api/authorize") {
        const body = await readBody(req);
        const out = authorizeAndExecute(stateRootDir, {
          consent_context: body.consent_context,
          phrase: body.phrase,
          now_iso: now(),
        });
        return json(res, out.ok ? 200 : 400, out, origin, allowedOrigins);
      }

      if (req.method === "POST" && path === "/api/block0/seal") {
        const body = await readBody(req);
        const out = sealBlock0(stateRootDir, {
          repository_base_commit: body.repository_base_commit ?? null,
          implementation_commit: gitCommit(repoRoot),
          constitution_source_hash: body.constitution_source_hash ?? null,
          topology_source_hash: body.topology_source_hash ?? null,
        });
        return json(res, out.ok ? 200 : 400, out, origin, allowedOrigins);
      }

      return json(res, 404, { ok: false, blocked_by: ["route_unknown"], path }, origin, allowedOrigins);
    } catch (error) {
      return json(res, 400, { ok: false, blocked_by: [error?.message ?? "request_failed"] }, origin, allowedOrigins);
    }
  });
}

export function startUrp0Server(options = {}) {
  const port = options.port ?? DEFAULT_PORT;
  const server = createUrp0Server(options);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    // Explicit loopback bind. The host argument is the constant above.
    server.listen(port, BIND_HOST, () => resolve({ server, url: `http://${BIND_HOST}:${server.address().port}` }));
  });
}
