// ============================================================================
// bizra.dema.node_resources.local.v0.1 — PURE telemetry parsing + redaction.
//
// Zero fs/os/child_process access in this module — every adapter is injected
// so tests can mock without a GPU or ollama on the test machine. The route
// handler (src/app/api/node-resources/route.ts) wires the real adapters.
//
// Contract:
//   - Every observation is {status, value, unit, source, measured_at,
//     stale_after_ms, reason?}. status is MEASURED | UNAVAILABLE | UNKNOWN.
//   - UNKNOWN / UNAVAILABLE are NEVER rendered as 0 or false — value is null.
//   - No status/readiness may derive from this module's output.
//   - Reason is always a STABLE CODE, never a raw stack trace or raw path.
//   - Storage mount paths are mapped to stable display labels, never raw
//     arbitrary paths. Nothing here returns hostname, usernames, HOME/home
//     paths, process args, env vars, tokens, network interfaces, or serials.
// ============================================================================

export const NODE_RESOURCES_SCHEMA = "bizra.dema.node_resources.local.v0.1" as const;

export type ObsStatus = "MEASURED" | "UNAVAILABLE" | "UNKNOWN";

export type ReasonCode =
  | "command_not_found"
  | "command_timeout"
  | "command_nonzero_exit"
  | "output_exceeded_ceiling"
  | "path_not_found"
  | "parse_error"
  | "source_unreadable";

export interface Observation<T = unknown> {
  status: ObsStatus;
  value: T | null;
  unit: string;
  source: string;
  measured_at: string; // ISO 8601
  stale_after_ms: number;
  reason?: ReasonCode;
}

// ---------------------------------------------------------------------------
// Injected adapters — the route handler supplies real implementations with
// fixed executables + fixed argv (execFile/spawn, never a composed shell
// string), a mandatory timeout, and a mandatory stdout/stderr byte ceiling.
// Adapters MUST throw a TelemetryExecError (not a raw Error) on failure so
// this module never has to parse or forward a raw message/stack.
// ---------------------------------------------------------------------------
export class TelemetryExecError extends Error {
  code: ReasonCode;
  constructor(code: ReasonCode, message?: string) {
    super(message ?? code);
    this.name = "TelemetryExecError";
    this.code = code;
  }
}

export interface ExecAdapter {
  run(cmd: string, args: string[]): string; // returns stdout; throws TelemetryExecError
}

export interface OsAdapter {
  cpuCount(): number;
  cpuModel(): string;
  totalMemBytes(): number;
  freeMemBytes(): number;
  loadavg(): [number, number, number];
  uptimeSeconds(): number;
  platform(): string;
  arch(): string;
}

export interface FsAdapter {
  existsSync(p: string): boolean;
  readdirSync(p: string): string[];
}

const DEFAULT_STALE_MS = 5_000;

function nowIso(): string {
  return new Date().toISOString();
}

function measured<T>(value: T, unit: string, source: string, staleAfterMs = DEFAULT_STALE_MS): Observation<T> {
  return { status: "MEASURED", value, unit, source, measured_at: nowIso(), stale_after_ms: staleAfterMs };
}

function unavailable<T>(reason: ReasonCode, source: string, staleAfterMs = DEFAULT_STALE_MS): Observation<T> {
  return { status: "UNAVAILABLE", value: null, unit: "", source, measured_at: nowIso(), stale_after_ms: staleAfterMs, reason };
}

function unknown<T>(reason: ReasonCode, source: string, staleAfterMs = DEFAULT_STALE_MS): Observation<T> {
  return { status: "UNKNOWN", value: null, unit: "", source, measured_at: nowIso(), stale_after_ms: staleAfterMs, reason };
}

function reasonOf(err: unknown): ReasonCode {
  return err instanceof TelemetryExecError ? err.code : "source_unreadable";
}

// ---------------------------------------------------------------------------
// SYSTEM (cpu / memory / load / host) — os.* adapter, always available.
// hostname is intentionally NEVER read or returned.
// ---------------------------------------------------------------------------
export interface CpuInfo { cores: number; model: string }
export interface MemoryInfo { totalGB: number; freeGB: number; usedGB: number; usedPct: number }
export interface LoadInfo { "1m": number; "5m": number; "15m": number }
export interface HostInfo { platform: string; arch: string; uptimeHours: number }

export function observeSystem(os: OsAdapter, staleAfterMs = DEFAULT_STALE_MS) {
  const totalGB = +(os.totalMemBytes() / 1e9).toFixed(1);
  const freeGB = +(os.freeMemBytes() / 1e9).toFixed(1);
  const usedGB = +(totalGB - freeGB).toFixed(1);
  const usedPct = totalGB > 0 ? +((usedGB / totalGB) * 100).toFixed(1) : 0;
  const [l1, l5, l15] = os.loadavg();
  return {
    cpu: measured<CpuInfo>({ cores: os.cpuCount(), model: os.cpuModel().trim() }, "count+string", "os.cpus()", staleAfterMs),
    memory: measured<MemoryInfo>({ totalGB, freeGB, usedGB, usedPct }, "GB", "os.totalmem()/os.freemem()", staleAfterMs),
    load: measured<LoadInfo>({ "1m": l1, "5m": l5, "15m": l15 }, "load-avg", "os.loadavg()", staleAfterMs),
    host: measured<HostInfo>(
      { platform: os.platform(), arch: os.arch(), uptimeHours: +(os.uptimeSeconds() / 3600).toFixed(1) },
      "mixed",
      "os.platform()/os.arch()/os.uptime()",
      staleAfterMs
    ),
  };
}

// ---------------------------------------------------------------------------
// STORAGE — df, mapped to STABLE DISPLAY LABELS, never raw mount paths.
// ---------------------------------------------------------------------------
export interface StorageMount { label: string; totalGB: number; usedGB: number; availGB: number; usedPct: number }

const STABLE_MOUNT_LABELS: Record<string, string> = {
  "/data/bizra": "Corpus estate",
  "/": "Node root",
};

function mountLabel(target: string, index: number): string {
  return STABLE_MOUNT_LABELS[target] ?? `Mount ${index + 1}`;
}

export function observeStorage(
  exec: ExecAdapter,
  targets: string[] = ["/data/bizra", "/"],
  staleAfterMs = DEFAULT_STALE_MS
): Observation<StorageMount[]> {
  try {
    const out = exec.run("df", ["-B1", "--output=source,size,used,avail,pcent,target", ...targets]);
    const lines = out.trim().split("\n").slice(1); // drop header
    const mounts: StorageMount[] = lines.map((line, i) => {
      const parts = line.trim().split(/\s+/);
      const [, size, used, avail, pcent, target] = parts;
      const totalGB = +(Number(size) / 1e9).toFixed(1);
      const usedGB = +(Number(used) / 1e9).toFixed(1);
      const availGB = +(Number(avail) / 1e9).toFixed(1);
      return {
        label: mountLabel(target, i),
        totalGB,
        usedGB,
        availGB,
        usedPct: +String(pcent).replace("%", ""),
      };
    });
    return measured(mounts, "GB", "df -B1", staleAfterMs);
  } catch (err) {
    return unavailable(reasonOf(err), "df -B1", staleAfterMs);
  }
}

// ---------------------------------------------------------------------------
// GPU — nvidia-smi. UNAVAILABLE (never 0) when the driver isn't responding.
// ---------------------------------------------------------------------------
export interface GpuInfo { name: string; memTotalMB: number; memUsedMB: number; utilPct: number }

export function observeGpu(exec: ExecAdapter, staleAfterMs = DEFAULT_STALE_MS): Observation<GpuInfo> {
  try {
    const out = exec.run("nvidia-smi", [
      "--query-gpu=name,memory.total,memory.used,utilization.gpu",
      "--format=csv,noheader,nounits",
    ]);
    const [name, memTotalMB, memUsedMB, utilPct] = out.trim().split(",").map((s) => s.trim());
    if (!name || Number.isNaN(Number(memTotalMB))) {
      return unavailable("parse_error", "nvidia-smi", staleAfterMs);
    }
    return measured<GpuInfo>(
      { name, memTotalMB: Number(memTotalMB), memUsedMB: Number(memUsedMB), utilPct: Number(utilPct) },
      "mixed",
      "nvidia-smi",
      staleAfterMs
    );
  } catch (err) {
    return unavailable(reasonOf(err), "nvidia-smi", staleAfterMs);
  }
}

// ---------------------------------------------------------------------------
// MODELS — ollama list.
// ---------------------------------------------------------------------------
export interface ModelInfo { name: string; size: string }

export function observeModels(exec: ExecAdapter, staleAfterMs = DEFAULT_STALE_MS): Observation<ModelInfo[]> {
  try {
    const out = exec.run("ollama", ["list"]);
    const lines = out.trim().split("\n").slice(1); // drop header
    const models: ModelInfo[] = lines
      .filter((l) => l.trim().length > 0)
      .map((line) => {
        const parts = line.trim().split(/\s{2,}/);
        return { name: parts[0], size: parts[2] ?? "unknown" };
      });
    return measured(models, "list", "ollama list", staleAfterMs);
  } catch (err) {
    return unavailable(reasonOf(err), "ollama list", staleAfterMs);
  }
}

// ---------------------------------------------------------------------------
// NODE0 BOUNDARY — each field is its own observation. UNKNOWN when the
// authoritative source can't be read. NEVER inferred from a missing process
// (a failed/absent `dema state` call is UNKNOWN, not false).
// ---------------------------------------------------------------------------
export interface Node0Boundary {
  daemon_started: Observation<boolean>;
  federation_enabled: Observation<boolean>;
  minting_enabled: Observation<boolean>;
  public_network_enabled: Observation<boolean>;
}

export function observeNode0Boundary(exec: ExecAdapter, staleAfterMs = DEFAULT_STALE_MS): Node0Boundary {
  const source = "dema state --json";
  try {
    const out = exec.run("dema", ["state", "--json"]);
    const parsed = JSON.parse(out);
    const r = parsed?.runtime;
    if (!r || typeof r !== "object") {
      const u = unknown<boolean>("parse_error", source, staleAfterMs);
      return { daemon_started: u, federation_enabled: u, minting_enabled: u, public_network_enabled: u };
    }
    return {
      daemon_started: measured(!!r.autonomous_daemon, "bool", source, staleAfterMs),
      federation_enabled: measured(!!r.federation, "bool", source, staleAfterMs),
      minting_enabled: measured(!!r.minting, "bool", source, staleAfterMs),
      public_network_enabled: measured(!!r.public_network, "bool", source, staleAfterMs),
    };
  } catch (err) {
    // authoritative source unreadable → UNKNOWN, never inferred false.
    const u = unknown<boolean>(reasonOf(err), source, staleAfterMs);
    return { daemon_started: u, federation_enabled: u, minting_enabled: u, public_network_enabled: u };
  }
}

// ---------------------------------------------------------------------------
// RECEIPTS COUNT — path is opaque to the caller; source is a stable label,
// never the raw absolute path (which may contain a username / HOME).
// ---------------------------------------------------------------------------
export function observeReceiptsCount(
  fs: FsAdapter,
  receiptsPath: string,
  sourceLabel = "repo docs/receipts",
  staleAfterMs = DEFAULT_STALE_MS
): Observation<number> {
  try {
    if (!fs.existsSync(receiptsPath)) return unavailable("path_not_found", sourceLabel, staleAfterMs);
    return measured(fs.readdirSync(receiptsPath).length, "count", sourceLabel, staleAfterMs);
  } catch (err) {
    return unavailable(reasonOf(err), sourceLabel, staleAfterMs);
  }
}

// ---------------------------------------------------------------------------
// FULL RESPONSE — assembled from the observations above.
// ---------------------------------------------------------------------------
export interface NodeResourcesResponse {
  schema: typeof NODE_RESOURCES_SCHEMA;
  measured_at: string;
  system: ReturnType<typeof observeSystem>;
  storage: Observation<StorageMount[]>;
  gpu: Observation<GpuInfo>;
  models: Observation<ModelInfo[]>;
  node0_boundary: Node0Boundary;
  receipts: Observation<number>;
}

export interface NodeResourcesAdapters {
  os: OsAdapter;
  exec: ExecAdapter;
  fs: FsAdapter;
  receiptsPath: string;
}

// ---------------------------------------------------------------------------
// LOOPBACK / LOCAL-ORIGIN GUARD — this route must never answer a request that
// did not originate from this machine.
// ---------------------------------------------------------------------------
export function isLoopbackOrPrivateIp(ip: string): boolean {
  const v = ip.trim();
  if (v === "127.0.0.1" || v === "::1" || v === "localhost") return true;
  if (/^10\./.test(v)) return true;
  if (/^192\.168\./.test(v)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(v)) return true;
  return false;
}

export function buildNodeResourcesResponse(adapters: NodeResourcesAdapters): NodeResourcesResponse {
  return {
    schema: NODE_RESOURCES_SCHEMA,
    measured_at: nowIso(),
    system: observeSystem(adapters.os),
    storage: observeStorage(adapters.exec),
    gpu: observeGpu(adapters.exec),
    models: observeModels(adapters.exec),
    node0_boundary: observeNode0Boundary(adapters.exec),
    receipts: observeReceiptsCount(adapters.fs, adapters.receiptsPath),
  };
}
