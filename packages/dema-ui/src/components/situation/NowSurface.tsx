"use client";

import { useEffect, useState } from "react";
import { createUnknownSituationState } from "@/lib/situation/situation-state";
import { projectNow, type NowField, type NowProjection } from "@/lib/situation/now-projection";

type FetchState = "READING" | "OBSERVED" | "UNKNOWN";

function unknownProjection(): NowProjection {
  return projectNow(createUnknownSituationState(new Date().toISOString(), "now_surface_unavailable"));
}

function Field({ item }: { item: NowField }) {
  return (
    <div data-truth={item.truth} data-source={item.source} style={{ display: "grid", gridTemplateColumns: "minmax(10rem, 14rem) 1fr auto", gap: "0.75rem", alignItems: "baseline", padding: "0.35rem 0", borderBottom: "1px solid rgba(201,169,98,0.12)" }}>
      <dt style={{ color: "#C9A962", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>{item.label}</dt>
      <dd style={{ margin: 0, color: "#E8EDF4", overflowWrap: "anywhere" }}>{item.value}</dd>
      <dd style={{ margin: 0, color: item.truth === "UNKNOWN" || item.truth === "STALE" ? "#D99191" : "#9FB3C8", fontSize: 11, letterSpacing: "0.08em" }}>{item.truth}</dd>
    </div>
  );
}

export function NowSurface() {
  const [projection, setProjection] = useState<NowProjection>(() => unknownProjection());
  const [fetchState, setFetchState] = useState<FetchState>("READING");
  const [commitment, setCommitment] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/founder-situation", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`source_${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (!active) return;
        setProjection(payload.now ?? projectNow(createUnknownSituationState(new Date().toISOString(), "now_surface_unavailable")));
        setCommitment(typeof payload.commitment === "string" ? payload.commitment : null);
        setFetchState("OBSERVED");
      })
      .catch(() => {
        if (!active) return;
        setProjection(unknownProjection());
        setFetchState("UNKNOWN");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section aria-label="DEMA NOW" data-fetch-state={fetchState} style={{ position: "relative", zIndex: 20, margin: "1rem auto", width: "min(1100px, calc(100% - 2rem))", padding: "1rem 1.15rem", border: "1px solid rgba(201,169,98,0.32)", borderRadius: 12, background: "rgba(5,11,20,0.94)", color: "#E8EDF4", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", boxShadow: "0 12px 36px rgba(0,0,0,0.22)" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline", marginBottom: "0.65rem" }}>
        <div>
          <div style={{ color: "#C9A962", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase" }}>DEMA · NOW</div>
          <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.15rem", fontWeight: 500 }}>Current situation orientation</h1>
        </div>
        <span data-truth={projection.freshness.status} style={{ color: projection.freshness.status === "CURRENT" ? "#9FB3C8" : "#D99191", fontSize: 11, letterSpacing: "0.08em" }}>
          {projection.freshness.status} · {projection.freshness.observedAt}
        </span>
      </header>
      <div data-situation-commitment={commitment ?? "UNKNOWN"} style={{ color: "#9FB3C8", fontSize: 11, letterSpacing: "0.08em", marginBottom: "0.5rem" }}>STATE COMMITMENT · {commitment ?? "UNKNOWN"}</div>
      <dl style={{ margin: 0 }}>
        <Field item={projection.identity} />
        <Field item={projection.mission} />
        <Field item={projection.frontier} />
        <Field item={projection.attention} />
        <Field item={projection.authority} />
        <Field item={projection.resources} />
        <Field item={projection.proof} />
        <Field item={projection.next} />
      </dl>
      <details style={{ marginTop: "0.75rem", color: "#9FB3C8", fontSize: 12 }}>
        <summary style={{ cursor: "pointer", color: "#C9A962" }}>Evidence limits</summary>
        <p style={{ margin: "0.6rem 0 0" }}>Not established: {projection.notEstablished.join(", ") || "UNKNOWN"}</p>
        <p style={{ margin: "0.35rem 0 0" }}>Open gaps: {projection.unresolvedGaps.join(", ") || "none observed"}</p>
        {projection.contradictions.length > 0 && <p style={{ margin: "0.35rem 0 0", color: "#D99191" }}>Contradictions: {projection.contradictions.join(", ")}</p>}
      </details>
    </section>
  );
}
