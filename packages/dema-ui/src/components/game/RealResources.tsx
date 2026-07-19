"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { fetchNodeResources } from "@/lib/browser/node-resources";
import { Panel, StatBar, TruthLabelBadge } from "./primitives";
import { RefreshCw } from "lucide-react";

// Mirrors bizra.dema.node_resources.local.v0.1 — see
// src/lib/telemetry/node-resources-core.ts for the source of truth shape.
type ObsStatus = "MEASURED" | "UNAVAILABLE" | "UNKNOWN";
interface Observation<T> {
  status: ObsStatus;
  value: T | null;
  unit: string;
  source: string;
  measured_at: string;
  stale_after_ms: number;
  reason?: string;
}

interface NodeResources {
  schema: string;
  measured_at: string;
  system: {
    cpu: Observation<{ cores: number; model: string }>;
    memory: Observation<{ totalGB: number; freeGB: number; usedGB: number; usedPct: number }>;
    load: Observation<{ "1m": number; "5m": number; "15m": number }>;
    host: Observation<{ platform: string; arch: string; uptimeHours: number }>;
  };
  storage: Observation<{ label: string; totalGB: number; usedGB: number; availGB: number; usedPct: number }[]>;
  gpu: Observation<{ name: string; memTotalMB: number; memUsedMB: number; utilPct: number }>;
  models: Observation<{ name: string; size: string }[]>;
  node0_boundary: {
    daemon_started: Observation<boolean>;
    federation_enabled: Observation<boolean>;
    minting_enabled: Observation<boolean>;
    public_network_enabled: Observation<boolean>;
  };
  receipts: Observation<number>;
}

function UnavailableChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-muted-foreground/30 bg-muted-foreground/5 px-2 py-1 font-mono text-[11px] text-muted-foreground">
      <span className="size-1.5 rounded-full bg-fail/70" />
      {label}
    </span>
  );
}

function BoundaryChip({ label, obs }: { label: string; obs: Observation<boolean> }) {
  if (obs.status !== "MEASURED" || obs.value === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-muted-foreground/30 bg-muted-foreground/5 px-2 py-1 font-mono text-[11px] text-muted-foreground">
        <span className="size-1.5 rounded-full bg-unknown" />
        {label} · UNKNOWN
      </span>
    );
  }
  const active = obs.value;
  const c = active ? "border-fail/40 bg-fail/10 text-fail" : "border-verified/40 bg-verified/10 text-verified";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px]", c)}>
      <span className={cn("size-1.5 rounded-full", active ? "bg-fail" : "bg-verified")} />
      {label} · {active ? "ON" : "off"}
    </span>
  );
}

export function RealResources() {
  const [data, setData] = useState<NodeResources | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchNodeResources(fetch, signal));
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "fetch failed");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void load(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [load]);

  return (
    <Panel
      title="Real Host Telemetry"
      glyph="⧗"
      accent="proof"
      right={
        <div className="flex items-center gap-2">
          {data && <TruthLabelBadge label="LOCAL_ONLY" size="xs" />}
          <button
            onClick={() => void load()}
            disabled={loading}
            className="grid size-6 place-items-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-card/60 disabled:opacity-50"
            aria-label="Refresh telemetry"
          >
            <RefreshCw size={12} className={cn(loading && "animate-spin")} />
          </button>
        </div>
      }
      bodyClassName="p-3 space-y-3"
    >
      {data && (
        <p className="font-mono text-[10px] text-muted-foreground">
          measured_at {data.measured_at}
        </p>
      )}
      {error && <p className="font-mono text-[11px] text-fail">telemetry fetch failed: {error}</p>}
      {!data && !error && <p className="font-mono text-[11px] text-muted-foreground">loading…</p>}

      {data && (
        <>
          {/* System */}
          <div className="rounded-lg border border-border/60 bg-card/30 p-2.5">
            <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">System</h4>
            {data.system.cpu.status === "MEASURED" && data.system.cpu.value && (
              <p className="mt-1 font-mono text-xs text-foreground">
                {data.system.cpu.value.cores} cores · {data.system.cpu.value.model}
              </p>
            )}
            {data.system.memory.status === "MEASURED" && data.system.memory.value && (
              <>
                <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                  <span>RAM {data.system.memory.value.usedGB}GB / {data.system.memory.value.totalGB}GB</span>
                  <span>{data.system.memory.value.usedPct}%</span>
                </div>
                <StatBar value={data.system.memory.value.usedPct} color="proof" className="mt-1" />
              </>
            )}
            {data.system.load.status === "MEASURED" && data.system.load.value && data.system.host.status === "MEASURED" && data.system.host.value && (
              <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                load {data.system.load.value["1m"].toFixed(2)} / {data.system.load.value["5m"].toFixed(2)} / {data.system.load.value["15m"].toFixed(2)}
                {" · "}
                {data.system.host.value.platform}/{data.system.host.value.arch} · up {data.system.host.value.uptimeHours}h
              </p>
            )}
          </div>

          {/* Storage */}
          <div className="rounded-lg border border-border/60 bg-card/30 p-2.5">
            <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Storage</h4>
            {data.storage.status === "MEASURED" && data.storage.value ? (
              <div className="mt-1.5 space-y-2">
                {data.storage.value.map((m) => (
                  <div key={m.label}>
                    <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                      <span>{m.label}</span>
                      <span>{m.usedGB}GB / {m.totalGB}GB · {m.usedPct}%</span>
                    </div>
                    <StatBar value={m.usedPct} color="knowledge" className="mt-1" />
                  </div>
                ))}
              </div>
            ) : (
              <UnavailableChip label={`Storage · ${data.storage.reason ?? "unavailable"}`} />
            )}
          </div>

          {/* GPU */}
          <div className="rounded-lg border border-border/60 bg-card/30 p-2.5">
            <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">GPU</h4>
            <div className="mt-1.5">
              {data.gpu.status === "MEASURED" && data.gpu.value ? (
                <>
                  <p className="font-mono text-xs text-foreground">{data.gpu.value.name}</p>
                  <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                    <span>VRAM {data.gpu.value.memUsedMB}MB / {data.gpu.value.memTotalMB}MB</span>
                    <span>{data.gpu.value.utilPct}% util</span>
                  </div>
                  <StatBar value={(data.gpu.value.memUsedMB / data.gpu.value.memTotalMB) * 100} color="verified" className="mt-1" />
                </>
              ) : (
                <UnavailableChip label={`GPU · ${data.gpu.reason ?? "unavailable"}`} />
              )}
            </div>
          </div>

          {/* Models */}
          <div className="rounded-lg border border-border/60 bg-card/30 p-2.5">
            <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Models</h4>
            <div className="mt-1.5">
              {data.models.status === "MEASURED" && data.models.value ? (
                data.models.value.length > 0 ? (
                  <ul className="space-y-1 font-mono text-[11px] text-foreground">
                    {data.models.value.map((m) => (
                      <li key={m.name} className="flex justify-between">
                        <span>{m.name}</span>
                        <span className="text-muted-foreground">{m.size}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <UnavailableChip label="Models · none installed" />
                )
              ) : (
                <UnavailableChip label={`Models · ${data.models.reason ?? "unavailable"}`} />
              )}
            </div>
          </div>

          {/* Node0 boundary — every flag is an independent observation */}
          <div className="rounded-lg border border-border/60 bg-card/30 p-2.5">
            <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Node0 Boundary</h4>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <BoundaryChip label="daemon" obs={data.node0_boundary.daemon_started} />
              <BoundaryChip label="federation" obs={data.node0_boundary.federation_enabled} />
              <BoundaryChip label="minting" obs={data.node0_boundary.minting_enabled} />
              <BoundaryChip label="public network" obs={data.node0_boundary.public_network_enabled} />
            </div>
          </div>

          {/* Receipts */}
          <div className="rounded-lg border border-border/60 bg-card/30 p-2.5">
            <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Receipts</h4>
            {data.receipts.status === "MEASURED" && data.receipts.value !== null ? (
              <p className="mt-1 font-mono text-lg font-bold text-proof">{data.receipts.value}</p>
            ) : (
              <UnavailableChip label={`Receipts · ${data.receipts.reason ?? "unavailable"}`} />
            )}
          </div>
        </>
      )}
    </Panel>
  );
}
