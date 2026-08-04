import Link from "next/link";
import {
  WORLD_OPEN_GATES,
  WORLD_PLANES,
  WORLD_PROJECTION_SOURCE,
  WORLD_SURFACES,
  type WorldTruthLabel,
} from "@/lib/world-projection-model";

const LABEL_STYLE: Record<WorldTruthLabel, string> = {
  MEASURED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  SOURCE_BOUND: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  DESIGNED_NOT_LIVE: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  UNKNOWN: "border-slate-400/30 bg-slate-400/10 text-slate-300",
};

function TruthBadge({ label }: { label: WorldTruthLabel }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.14em] ${LABEL_STYLE[label]}`}>
      {label}
    </span>
  );
}

export default function WorldProjectionPage() {
  return (
    <main className="min-h-screen bg-[#050b14] text-[#e8edf4]">
      <header className="border-b border-[#c9a962]/20 bg-[#08111f]">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-10 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#c9a962]">
              Dema · unified experience architecture
            </div>
            <h1 className="mt-3 font-serif text-4xl tracking-tight text-[#f4ecd7] md:text-6xl">
              One mission. Three views. One authority spine.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#9fb3c8] md:text-base">
              The simulation workspace is preserved as a source-bound world projection inside Dema.
              It does not become a second runtime, a second memory, or a second source of truth.
            </p>
          </div>
          <div className="flex gap-3">
            <Link className="rounded-md bg-[#c9a962] px-4 py-2 text-sm font-semibold text-[#050b14]" href="/">
              Continue mission
            </Link>
            <Link className="rounded-md border border-[#2dd4bf]/35 px-4 py-2 text-sm text-[#9ce7dd]" href="/realm">
              Enter realm
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-[#c9a962]/15 bg-[#0a1628]">
        <div className="mx-auto grid max-w-6xl gap-4 px-6 py-5 text-xs md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <TruthBadge label="SOURCE_BOUND" />
            <span className="ml-3 text-[#9fb3c8]">
              Imported from simulation workspace {WORLD_PROJECTION_SOURCE.simulation_workspace_head.slice(0, 8)};
              authority delta {WORLD_PROJECTION_SOURCE.authority_delta}.
            </span>
          </div>
          <code className="overflow-hidden text-ellipsis text-[#64798f]">
            archive sha256:{WORLD_PROJECTION_SOURCE.simulation_archive_sha256.slice(0, 18)}…
          </code>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="mb-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#2dd4bf]">Product surfaces</p>
          <h2 className="mt-2 font-serif text-3xl text-[#f4ecd7]">The merge boundary</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {WORLD_SURFACES.map((surface) => (
            <article key={surface.route} className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
              <div className="flex items-center justify-between gap-3">
                <code className="text-sm text-[#c9a962]">{surface.route}</code>
                <TruthBadge label={surface.truth} />
              </div>
              <h3 className="mt-5 font-serif text-2xl text-[#f4ecd7]">{surface.name}</h3>
              <p className="mt-2 text-sm leading-6 text-[#b8cadb]">{surface.role}</p>
              <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-6 text-[#64798f]">
                {surface.authority}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#08111f]">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="mb-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#c9a962]">Architecture planes</p>
            <h2 className="mt-2 font-serif text-3xl text-[#f4ecd7]">The unified vertical spine</h2>
          </div>
          <div className="space-y-3">
            {WORLD_PLANES.map((plane, index) => (
              <article key={plane.id} className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.025] p-5 md:grid-cols-[48px_1.1fr_1fr_auto] md:items-center">
                <div className="font-mono text-xl text-[#c9a962]">{String(index + 1).padStart(2, "0")}</div>
                <div>
                  <h3 className="font-serif text-xl text-[#f4ecd7]">{plane.title}</h3>
                  <p className="mt-1 text-sm text-[#9fb3c8]">{plane.purpose}</p>
                </div>
                <div className="text-xs leading-6 text-[#7f93a8]">
                  <div>owner: {plane.owner}</div>
                  <div>law: {plane.invariant}</div>
                </div>
                <TruthBadge label={plane.state} />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-14 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-xl border border-[#2dd4bf]/20 bg-[#2dd4bf]/[0.04] p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#2dd4bf]">Canonical law</p>
          <blockquote className="mt-5 font-serif text-2xl leading-relaxed text-[#e8edf4] md:text-3xl">
            The model is a replaceable worker. The mission is durable state. Dema owns the experience;
            FATE owns effects; receipts preserve proof; the human remains sovereign.
          </blockquote>
        </article>
        <article className="rounded-xl border border-amber-300/20 bg-amber-300/[0.035] p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-serif text-2xl text-[#f4ecd7]">Open gates</h2>
            <TruthBadge label="DESIGNED_NOT_LIVE" />
          </div>
          <ul className="mt-5 space-y-3 text-sm leading-6 text-[#b8cadb]">
            {WORLD_OPEN_GATES.map((gate) => (
              <li key={gate} className="flex gap-3">
                <span className="text-amber-200">◆</span>
                <span>{gate}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-[#64798f]">
        Source-bound world projection · runtime authority none · no federation or economic claim
      </footer>
    </main>
  );
}
