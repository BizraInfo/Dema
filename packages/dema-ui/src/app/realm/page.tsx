"use client";

// DEMA World Map — /realm
//
// Renders authoritative URP-0 backend state. Every value on this page comes from
// GET /api/realm on the local runtime. There is no timer-driven progress, no
// hard-coded PASS, and no state transition that happens in the browser: the only
// things this page can do are ASK the runtime for state and SUBMIT an exact
// consent phrase the operator typed.

import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_URP0_API ?? "http://127.0.0.1:4300";

type Json = Record<string, unknown>;

type Realm = {
  truth_label: string;
  ok: boolean;
  blocked_by: string[];
  urp: { urp_id: string; state: string; state_root: string | null; events_applied: number; journal_length: number };
  human: Json | null;
  node: Json | null;
  dema: Json;
  pat: Json;
  fate: Json;
  sat: { status: string; implementation: string; autonomous_ai_agent: boolean; lanes: { id: string; lane: string }[]; registered: Json | null };
  resource_offer: Json | null;
  missions: Record<string, Json>;
  receipts: Record<string, Json>;
  block0: Json | null;
  boundary: Record<string, boolean>;
  state_permissions: Record<string, string>;
  journal: { seq: number; kind: string; event_id: string }[];
};

async function call(path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json()) as Json };
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1 text-sm border-b border-white/5 last:border-0">
      <span className="w-56 shrink-0 text-white/45">{label}</span>
      <span className="font-mono break-all text-white/85">{value}</span>
    </div>
  );
}

function Panel({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <header className="mb-2 flex items-baseline gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-white/90">{title}</h2>
        {tag ? <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[11px] text-white/60">{tag}</span> : null}
      </header>
      {children}
    </section>
  );
}

function Verdict({ v }: { v: string }) {
  const tone = v === "PASS" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300";
  return <span className={`rounded px-2 py-0.5 font-mono text-[11px] ${tone}`}>{v}</span>;
}

export default function RealmPage() {
  const [realm, setRealm] = useState<Realm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [admitCard, setAdmitCard] = useState<Json | null>(null);
  const [admitPhrase, setAdmitPhrase] = useState("");
  const [root, setRoot] = useState("");
  const [card, setCard] = useState<Json | null>(null);
  const [phrase, setPhrase] = useState("");
  const [outcome, setOutcome] = useState<Json | null>(null);
  const [busy, setBusy] = useState(false);

  // Refresh is explicit and manual. Nothing on this page advances on a timer.
  const refresh = useCallback(async () => {
    try {
      const res = await call("/api/realm");
      setRealm(res.data as unknown as Realm);
      setError(null);
    } catch (e) {
      setError(`runtime unreachable at ${API} — start it with: npm run genesis:node0`);
      setRealm(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void call("/api/admission-card").then((r) => setAdmitCard(r.data)).catch(() => {});
  }, [refresh]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const admitted = Boolean(realm?.human);
  const mission = realm ? Object.values(realm.missions)[0] : undefined;
  const judgment = (outcome?.judgment ?? null) as Json | null;
  const verdicts = (judgment?.verifier_verdicts ?? []) as { id: string; lane: string; verdict: string; reasons: string[] }[];

  return (
    <main className="min-h-screen bg-[#08090c] px-6 py-8 text-white">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">BIZRA WORLD — LOCAL GENESIS</h1>
          <p className="font-mono text-xs text-white/50">
            truth label: {realm?.truth_label ?? "—"} · runtime: {API} · loopback only · no public gateway
          </p>
          <button onClick={() => void refresh()} className="mt-2 rounded border border-white/15 px-3 py-1 text-xs hover:bg-white/5">
            refresh authoritative state
          </button>
        </header>

        {error ? <p className="rounded border border-red-500/30 bg-red-500/10 p-3 font-mono text-xs text-red-300">{error}</p> : null}

        {realm ? (
          <>
            <Panel title="URP-0" tag={realm.urp.state}>
              <Row label="urp_id" value={realm.urp.urp_id} />
              <Row label="state_root" value={realm.urp.state_root ?? "—"} />
              <Row label="events_applied" value={String(realm.urp.events_applied)} />
              <Row label="journal_length" value={String(realm.urp.journal_length)} />
              <Row label="replay_ok" value={String(realm.ok)} />
            </Panel>

            {/* 1 — inspect Node0 */}
            <Panel title="HUMAN-0 / NODE0" tag={admitted ? "REGISTERED" : "NOT ADMITTED"}>
              {admitted ? (
                <>
                  <Row label="human_id" value={String(realm.human?.human_id)} />
                  <Row label="roles" value={(realm.human?.roles as string[])?.join(", ")} />
                  <Row label="founder_bypass" value={String(realm.human?.founder_bypass)} />
                  <Row label="node_id" value={String(realm.node?.node_id)} />
                  <Row label="owner" value={String(realm.node?.owner)} />
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-white/60">
                    Human-0 is admitted through the ordinary path with no privilege. Type the exact phrase to admit.
                  </p>
                  <pre className="overflow-x-auto rounded bg-black/40 p-2 font-mono text-[11px] text-white/70">
                    {String(admitCard?.required_phrase ?? "…")}
                  </pre>
                  <input
                    value={admitPhrase}
                    onChange={(e) => setAdmitPhrase(e.target.value)}
                    placeholder="exact admission phrase"
                    className="w-full rounded border border-white/15 bg-black/40 px-2 py-1 font-mono text-xs"
                  />
                  <button
                    disabled={busy}
                    onClick={() => act(async () => { await call("/api/admit", { phrase: admitPhrase }); })}
                    className="rounded bg-white/10 px-3 py-1 text-xs hover:bg-white/20 disabled:opacity-40"
                  >
                    admit HUMAN-0
                  </button>
                </div>
              )}
            </Panel>

            <Panel title="DEMA · PAT · FATE · SAT-5">
              <Row label="DEMA" value={`${realm.dema.role} · ${realm.dema.status}`} />
              <Row label="PAT" value={`${realm.pat.status} · autonomous_agent=${String(realm.pat.autonomous_agent)}`} />
              <Row label="FATE" value={`${realm.fate.status} · ${realm.fate.mode}`} />
              <Row label="SAT status" value={`${realm.sat.status} · ${realm.sat.implementation}`} />
              <Row label="autonomous_ai_agent" value={String(realm.sat.autonomous_ai_agent)} />
              {realm.sat.lanes.map((l) => (
                <Row key={l.id} label={l.id} value={l.lane} />
              ))}
            </Panel>

            {/* 2 — inspect the resource offer */}
            <Panel title="RESOURCE OFFER" tag={realm.resource_offer ? "BOUNDED" : "—"}>
              {realm.resource_offer ? (
                <>
                  <p className="mb-2 text-xs text-white/50">NODE0 POSSESSES</p>
                  <Row label="cpu_threads" value={String((realm.resource_offer.possessed as Json).cpu_threads)} />
                  <Row label="memory_bytes" value={String((realm.resource_offer.possessed as Json).memory_bytes)} />
                  <p className="mb-2 mt-3 text-xs text-white/50">NODE0 VOLUNTARILY OFFERS</p>
                  {Object.entries(realm.resource_offer.allowed as Json).map(([k, v]) => (
                    <Row key={k} label={k} value={String(v)} />
                  ))}
                  <Row label="network" value={String(realm.resource_offer.network)} />
                  <Row label="revocable" value={String(realm.resource_offer.revocable)} />
                  <Row label="per_mission_consent" value={String(realm.resource_offer.per_mission_consent)} />
                </>
              ) : (
                <p className="text-xs text-white/50">Registered when HUMAN-0 is admitted.</p>
              )}
            </Panel>

            {/* 3,4,5 — contract, exact phrase, consent */}
            <Panel title="MISSION — BIZRA-GENESIS-LOCAL-MISSION-0" tag={String(mission?.status ?? "NOT DECLARED")}>
              {admitted ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      value={root}
                      onChange={(e) => setRoot(e.target.value)}
                      placeholder="bounded directory to inventory (e.g. ./docs)"
                      className="flex-1 rounded border border-white/15 bg-black/40 px-2 py-1 font-mono text-xs"
                    />
                    <button
                      disabled={busy}
                      onClick={() => act(async () => {
                        const r = await call("/api/consent-card", { root });
                        setCard(r.data);
                        setOutcome(null);
                      })}
                      className="rounded bg-white/10 px-3 py-1 text-xs hover:bg-white/20 disabled:opacity-40"
                    >
                      derive consent card
                    </button>
                  </div>

                  {card?.ok === false ? (
                    <p className="font-mono text-xs text-red-300">{JSON.stringify(card.blocked_by)}</p>
                  ) : null}

                  {card?.ok ? (
                    <>
                      <p className="text-xs text-white/50">
                        Deriving this card wrote nothing and executed nothing. Metadata only: no file is opened, hashed or followed.
                      </p>
                      <Row label="canonical_root" value={String((card.contract as Json).canonical_root)} />
                      <Row label="contract_hash" value={String(card.contract_hash)} />
                      <Row label="permitted" value={((card.contract as Json).permitted_actions as string[]).join(", ")} />
                      <Row label="forbidden" value={((card.contract as Json).forbidden_actions as string[]).join(", ")} />
                      <p className="mt-2 text-xs text-white/50">exact consent phrase</p>
                      <pre className="overflow-x-auto rounded bg-black/40 p-2 font-mono text-[11px] text-white/70">
                        {String((card.card as Json).required_phrase)}
                      </pre>
                      <input
                        value={phrase}
                        onChange={(e) => setPhrase(e.target.value)}
                        placeholder="type the exact phrase — a near match is refused"
                        className="w-full rounded border border-white/15 bg-black/40 px-2 py-1 font-mono text-xs"
                      />
                      <button
                        disabled={busy}
                        onClick={() => act(async () => {
                          const r = await call("/api/authorize", { consent_context: card.consent_context, phrase });
                          setOutcome(r.data);
                        })}
                        className="rounded bg-emerald-500/20 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40"
                      >
                        authorize the bounded mission
                      </button>
                    </>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-white/50">Admit HUMAN-0 first.</p>
              )}
            </Panel>

            {/* 6 — real mission state */}
            {outcome ? (
              <Panel title="MISSION RESULT" tag={outcome.ok ? "EXECUTED" : "REFUSED"}>
                {outcome.ok ? (
                  <>
                    <Row label="files" value={String(((outcome.result as Json).counts as Json).files)} />
                    <Row label="directories" value={String(((outcome.result as Json).counts as Json).directories)} />
                    <Row label="symlinks" value={String(((outcome.result as Json).counts as Json).symlinks)} />
                    <Row label="skipped" value={String(((outcome.result as Json).counts as Json).skipped)} />
                    <Row label="total_file_bytes" value={String((outcome.result as Json).total_file_bytes)} />
                    <Row label="type_histogram" value={JSON.stringify((outcome.result as Json).type_histogram)} />
                    <Row label="source_unchanged" value={String(outcome.source_fingerprint_before === outcome.source_fingerprint_after)} />
                  </>
                ) : (
                  <p className="font-mono text-xs text-red-300">refused: {JSON.stringify(outcome.blocked_by)}</p>
                )}
              </Panel>
            ) : null}

            {/* 7 — all five SAT results */}
            {verdicts.length > 0 ? (
              <Panel title="SAT-5 JUDGMENT" tag={String(judgment?.set_verdict)}>
                <p className="mb-2 text-xs text-white/50">
                  {String(judgment?.implementation)} · autonomous_ai_agent={String(judgment?.autonomous_ai_agent)}
                </p>
                {verdicts.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 border-b border-white/5 py-1 text-sm last:border-0">
                    <span className="w-16 font-mono text-white/70">{v.id}</span>
                    <Verdict v={v.verdict} />
                    <span className="text-xs text-white/50">{v.lane}</span>
                    {v.reasons.length > 0 ? <span className="font-mono text-[11px] text-red-300">{v.reasons.join(", ")}</span> : null}
                  </div>
                ))}
                <Row label="judgment_hash" value={String(judgment?.judgment_hash)} />
              </Panel>
            ) : null}

            {/* 8,9 — receipt and resulting world-state root */}
            {outcome?.ok ? (
              <Panel title="RECEIPT / WORLD-STATE TRANSITION">
                <Row label="receipt_hash" value={String(outcome.receipt_hash)} />
                <Row label="result_hash" value={String(outcome.result_hash)} />
                <Row label="previous_state_root" value={String(outcome.previous_state_root)} />
                <Row label="resulting_state_root" value={String(outcome.resulting_state_root)} />
              </Panel>
            ) : null}

            {/* 10 — Block0 */}
            <Panel title="BLOCK0" tag={realm.block0 ? "LOCAL_CANDIDATE" : "NOT SEALED"}>
              {realm.block0 ? (
                <>
                  <Row label="block0_hash" value={String(realm.block0.block0_hash)} />
                  <Row label="truth_label" value={String(realm.block0.truth_label)} />
                  <Row label="token_created" value={String(realm.block0.token_created)} />
                  <Row label="internet_gateway" value={String(realm.block0.internet_gateway)} />
                </>
              ) : (
                <button
                  disabled={busy || !Object.values(realm.missions).some((m) => (m as Json).status === "RECEIPTED")}
                  onClick={() => act(async () => { await call("/api/block0/seal", {}); })}
                  className="rounded bg-white/10 px-3 py-1 text-xs hover:bg-white/20 disabled:opacity-40"
                >
                  seal BIZRA-BLOCK0-LOCAL-CANDIDATE
                </button>
              )}
            </Panel>

            <Panel title="BOUNDARY (all false, always)">
              <div className="grid grid-cols-2 gap-x-4">
                {Object.entries(realm.boundary).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-white/5 py-1 font-mono text-[11px]">
                    <span className="text-white/45">{k}</span>
                    <span className={v ? "text-red-300" : "text-white/70"}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="JOURNAL" tag={`${realm.journal.length} events`}>
              {realm.journal.map((e) => (
                <Row key={e.seq} label={`${e.seq} · ${e.kind}`} value={e.event_id} />
              ))}
            </Panel>
          </>
        ) : null}
      </div>
    </main>
  );
}
