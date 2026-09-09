"use client";

import { useEffect, useState } from "react";
import { GameShell } from "@/components/game/GameShell";
import { SovereignBoot } from "@/components/game/SovereignBoot";

/**
 * The spatial / cinematic surface, preserved verbatim from the previous root route.
 * It was not discarded — it moved below the mission front door. A stranger meets
 * the mission first; this is a deeper layer they reach after value, not before it.
 */
export default function Realm() {
  const [genesis, setGenesis] = useState<{
    truth_label: string;
    dema: { status: string; mission_id?: string; receipt_hash?: string };
    pat: { status: string; count: number };
    sat: { status: string; inventory: Array<{ role_id: string; verdict: string }> };
    world_cell: { effect_count: number; duplicate_effects: number; recovery_status: string };
  } | null>(null);
  const [handover, setHandover] = useState<{
    display: { title: string; mission_text: string; snapshot_scope: string; human_usefulness_review: string };
    mission: { mission_id: string; attempt_id: string; state: string; effect_records: number; duplicate_effects: number };
    artifact: { relative_path: string; bytes: number; sha256: string; content: string };
    evidence: {
      final_evidence_sha256: string;
      capsule_sha256: string;
      receipt_id: string;
      ledger_sha256: string;
      ledger_lines: number;
      source_commit?: string;
      source_tree?: string;
      observer?: string;
      observer_limits?: string;
    };
    authority: { root_mode?: string; authority_delta: number; historical_a005_incident?: string };
    recovery: { status_command: string; policy: string; result?: string; observer_result?: string; reopened_without_reexecution?: boolean; archived_replay_attempt?: string };
    sat: { status: string; verdicts: string[]; owner: string; principal: string; logical_home: string; serves_node0: boolean; judges_node0: boolean };
    boundary: { local_only: boolean; public_gateway: boolean; federation: boolean; node1: boolean; economy: boolean; model_calls: number; consequential_effects: number };
    proof_ceiling: string;
    node0_closed: boolean;
  } | null>(null);
  const [handoverBlocked, setHandoverBlocked] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/genesis-realm-status", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then(setGenesis)
      .catch(() => setGenesis(null));
    fetch("/api/genesis-founder-handover", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.blocked_by?.[0] ?? "handover_unavailable");
        return body;
      })
      .then(setHandover)
      .catch((error) => setHandoverBlocked(String(error?.message ?? "handover_unavailable")));
  }, []);
  return (
    <>
      {genesis && <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-4xl rounded-lg border border-teal/50 bg-background/95 px-4 py-3 font-mono text-xs text-foreground shadow-lg backdrop-blur">
        <div className="text-teal">GENESIS WORLD-CELL · {genesis.truth_label}</div>
        <div className="mt-1 grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
          <span>DEMA {genesis.dema.status}</span>
          <span>PAT {genesis.pat.count}/7 · {genesis.pat.status}</span>
          <span>SAT {genesis.sat.inventory.length}/5 · {genesis.sat.status}</span>
          <span>effect {genesis.world_cell.effect_count} · duplicates {genesis.world_cell.duplicate_effects}</span>
        </div>
        <div className="mt-1 text-muted-foreground">mission {genesis.dema.mission_id} · receipt {genesis.dema.receipt_hash}</div>
      </div>}
      <section className="fixed inset-x-4 top-28 z-40 mx-auto max-h-[calc(100vh-8rem)] max-w-4xl overflow-y-auto rounded-lg border border-gold/50 bg-background/95 px-4 py-3 font-mono text-xs text-foreground shadow-lg backdrop-blur" aria-label="Founder mission handover">
        {handover ? (
          <>
            <div className="text-gold">FOUNDER HANDOVER · {handover.proof_ceiling}</div>
            <div className="mt-1 grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
              <span>MISSION {handover.mission.state}</span>
              <span>EFFECTS {handover.mission.effect_records} · DUPLICATES {handover.mission.duplicate_effects}</span>
              <span>SAT {handover.sat.verdicts.length}/5 · {handover.sat.status}</span>
              <span>AUTHORITY DELTA {handover.authority.authority_delta}</span>
            </div>
            <div className="mt-1 text-muted-foreground">
              {handover.mission.mission_id} · receipt {handover.evidence.receipt_id}
            </div>
            <div className="mt-2 rounded border border-border/60 bg-card/30 p-2 text-muted-foreground">
              <div>Saved artifact: {handover.artifact.relative_path} · {handover.artifact.bytes} bytes · {handover.artifact.sha256}</div>
              <div>Recovery: {handover.recovery.result} · observer: {handover.recovery.observer_result} · reopened without re-execution: {String(handover.recovery.reopened_without_reexecution)}</div>
              <div>Human usefulness review: {handover.display.human_usefulness_review} · Node0 closed: {String(handover.node0_closed)}</div>
            </div>
            <details className="mt-2 rounded border border-border/60 bg-card/30 p-2">
              <summary className="cursor-pointer text-gold">Open actual saved Founder Brief</summary>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/90">{handover.artifact.content}</pre>
            </details>
            <details className="mt-2 rounded border border-border/60 bg-card/30 p-2">
              <summary className="cursor-pointer text-gold">Evidence and safe re-entry</summary>
              <div className="mt-2 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                <div>Capsule: {handover.evidence.capsule_sha256}</div>
                <div>Ledger: {handover.evidence.ledger_lines} lines · {handover.evidence.ledger_sha256}</div>
                <div>Source: {handover.evidence.source_commit} · tree {handover.evidence.source_tree}</div>
                <div>Observer: {handover.evidence.observer} ({handover.evidence.observer_limits})</div>
                <div className="pt-1 text-foreground">Read-only status command:</div>
                <code className="block break-all rounded bg-black/30 p-2">{handover.recovery.status_command}</code>
                <div>{handover.recovery.policy}</div>
              </div>
            </details>
          </>
        ) : (
          <div className="text-consent">FOUNDER HANDOVER · BLOCKED · {handoverBlocked ?? "loading"}</div>
        )}
      </section>
      <GameShell />
      <SovereignBoot />
    </>
  );
}
