import { NextRequest, NextResponse } from "next/server";
import os from "node:os";
import nodePath from "node:path";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import {
  buildNodeResourcesResponse,
  isLoopbackOrPrivateIp,
  TelemetryExecError,
  type ExecAdapter,
  type FsAdapter,
  type OsAdapter,
} from "@/lib/telemetry/node-resources-core";

// ---------------------------------------------------------------------------
// GET /api/node-resources
//
// Response schema: bizra.dema.node_resources.local.v0.1 (see
// src/lib/telemetry/node-resources-core.ts for the pure parsing/redaction
// logic — this file only wires real, bounded adapters). READ-ONLY: no
// mutation, no daemon control, no launch/install route. loopback-only.
//
// Every field can be UNKNOWN/UNAVAILABLE and is NEVER rendered as 0/false —
// status/readiness never derives from this route's output.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

const EXEC_TIMEOUT_MS = 4_000;
const MAX_OUTPUT_BYTES = 65_536; // 64KB fail-closed ceiling on stdout/stderr

// Fixed executables + fixed argv only — every call site below passes a
// literal command and a literal argv array. Never a composed shell string.
const realExec: ExecAdapter = {
  run(cmd, args) {
    let out: string;
    try {
      out = execFileSync(cmd, args, {
        encoding: "utf8",
        timeout: EXEC_TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_BYTES,
        windowsHide: true,
        shell: false,
      });
    } catch (err) {
      if (err instanceof TelemetryExecError) throw err;
      const e = err as NodeJS.ErrnoException & { signal?: string | null; stdout?: Buffer | string };
      if (e.code === "ENOENT") throw new TelemetryExecError("command_not_found");
      if (e.signal === "SIGTERM" || e.code === "ETIMEDOUT") throw new TelemetryExecError("command_timeout");
      const msg = String(e.message ?? "");
      if (e.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" || /maxBuffer/i.test(msg)) {
        throw new TelemetryExecError("output_exceeded_ceiling");
      }
      throw new TelemetryExecError("command_nonzero_exit");
    }
    // fail closed if the ceiling was technically satisfied by maxBuffer but
    // the decoded string still exceeds the byte ceiling (defense in depth).
    if (Buffer.byteLength(out, "utf8") > MAX_OUTPUT_BYTES) {
      throw new TelemetryExecError("output_exceeded_ceiling");
    }
    return out;
  },
};

const realOs: OsAdapter = {
  cpuCount: () => os.cpus().length,
  cpuModel: () => os.cpus()[0]?.model ?? "unknown",
  totalMemBytes: () => os.totalmem(),
  freeMemBytes: () => os.freemem(),
  loadavg: () => os.loadavg() as [number, number, number],
  uptimeSeconds: () => os.uptime(),
  platform: () => os.platform(),
  arch: () => os.arch(),
};

const realFs: FsAdapter = {
  existsSync,
  readdirSync: (p) => readdirSync(p),
};

// Receipts path is resolved at runtime, never a source literal (a hardcoded
// absolute path would leak a HOME dir + username into the tree). Configure via
// DEMA_RECEIPTS_PATH; otherwise resolve relative to the process cwd. If it does
// not exist, the receipts observation returns UNAVAILABLE — never fabricated.
const RECEIPTS_PATH =
  process.env.DEMA_RECEIPTS_PATH ?? nodePath.resolve(process.cwd(), "docs/receipts");

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return null; // no proxy header present — see GET() note on the real control
}

export async function GET(req: NextRequest) {
  // SECURITY NOTE (honest boundary): x-forwarded-for / x-real-ip are proxy
  // headers and are spoofable — this header check is best-effort defense in
  // depth, NOT a hard access gate. The PRIMARY controls are: (1) the dev/prod
  // server binds to loopback (do not expose this app on 0.0.0.0 without a real
  // auth layer in front), and (2) the payload is redacted observation-only —
  // no hostname/user/env/token/path leaks even if reached. A forged loopback
  // XFF passes this check by design; that is acceptable because the response
  // carries nothing sensitive.
  const ip = clientIp(req);
  if (ip && !isLoopbackOrPrivateIp(ip)) {
    return NextResponse.json(
      { schema: "bizra.dema.node_resources.local.v0.1", error: "loopback_only" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  const body = buildNodeResourcesResponse({
    os: realOs,
    exec: realExec,
    fs: realFs,
    receiptsPath: RECEIPTS_PATH,
  });

  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
