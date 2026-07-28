'use client'

import dynamic from 'next/dynamic'
import { TopNav } from '@/components/bizra/top-nav'
import { HeroIqra } from '@/components/bizra/hero-iqra'
import { DividerLabel } from '@/components/bizra/primitives'
import { HabitatSignatureBar, IqraMark, TruthLabel } from '@/components/bizra/habitat-brand'

/* Code-splitting: the hero + nav load eagerly (above the fold). Every
 * below-the-fold section lazy-loads via next/dynamic so the initial
 * bundle — and thus LCP/FCP/TTFB — stays small. This is the dashboard
 * practicing "measured cost is not value" on its own payload. */
const MovementLoop = dynamic(() => import('@/components/bizra/movements').then((m) => m.MovementLoop))
const MovementDual = dynamic(() => import('@/components/bizra/dual-agent').then((m) => m.MovementDual))
const MovementForest = dynamic(() => import('@/components/bizra/movements').then((m) => m.MovementForest))
const MovementBlockTree = dynamic(() => import('@/components/bizra/blocktree').then((m) => m.MovementBlockTree))
const MovementMeasured = dynamic(() => import('@/components/bizra/movements').then((m) => m.MovementMeasured))

const FoundingThesis = dynamic(() => import('@/components/bizra/wisdom-thesis').then((m) => m.FoundingThesis))
const WisdomGiants = dynamic(() => import('@/components/bizra/wisdom-giants').then((m) => m.WisdomGiants))
const WisdomLifecycle = dynamic(() => import('@/components/bizra/wisdom-lifecycle').then((m) => m.WisdomLifecycle))
const GamingWisdom = dynamic(() => import('@/components/bizra/wisdom-gaming').then((m) => m.GamingWisdom))
const SwissWatchDoctrine = dynamic(() => import('@/components/bizra/wisdom-thesis').then((m) => m.SwissWatchDoctrine))

const IntentGate = dynamic(() => import('@/components/bizra/sections-a').then((m) => m.IntentGate))
const CognitiveLenses = dynamic(() => import('@/components/bizra/sections-a').then((m) => m.CognitiveLenses))
const EvidenceTable = dynamic(() => import('@/components/bizra/sections-b').then((m) => m.EvidenceTable))
const CognitiveArchitecture = dynamic(() => import('@/components/bizra/cognitive-arch').then((m) => m.CognitiveArchitecture))
const RarePathProber = dynamic(() => import('@/components/bizra/sections-a').then((m) => m.RarePathProber))
const SymbolicHarness = dynamic(() => import('@/components/bizra/symbolic').then((m) => m.SymbolicHarness))
const AbstractionElevator = dynamic(() => import('@/components/bizra/sections-b').then((m) => m.AbstractionElevator))
const TensionStudio = dynamic(() => import('@/components/bizra/sections-a').then((m) => m.TensionStudio))
const RedTeamMirror = dynamic(() => import('@/components/bizra/sections-b').then((m) => m.RedTeamMirror))
const SpearPoint = dynamic(() => import('@/components/bizra/spear').then((m) => m.SpearPoint))
const Node0Runtime = dynamic(() => import('@/components/bizra/node0-runtime').then((m) => m.Node0Runtime))

const HonestBoundary = dynamic(() => import('@/components/bizra/wisdom-thesis').then((m) => m.HonestBoundary))
const SealedDoors = dynamic(() => import('@/components/bizra/sealed-doors').then((m) => m.SealedDoors))
const GenesisClosureSprint = dynamic(() => import('@/components/bizra/node0-sprint').then((m) => m.GenesisClosureSprint))
const InvestorDemo = dynamic(() => import('@/components/bizra/investor-demo').then((m) => m.InvestorDemo))
const UnifiedInstaller = dynamic(() => import('@/components/bizra/installer').then((m) => m.UnifiedInstaller))
const PerformanceTelemetry = dynamic(() => import('@/components/bizra/telemetry').then((m) => m.PerformanceTelemetry))
const FinalSeal = dynamic(() => import('@/components/bizra/seal').then((m) => m.FinalSeal))

export default function Home() {
  return (
    <div className="bizra flex min-h-screen flex-col bg-[#0a0e1a] text-[#e8e6df]">
      <TopNav />
      <HabitatSignatureBar />

      <main className="flex-1">
        <HeroIqra />

        <div className="mx-auto w-full max-w-[1080px] px-4 sm:px-6">
          <DividerLabel>The Living System</DividerLabel>
        </div>

        <MovementLoop />
        <MovementDual />
        <MovementForest />
        <MovementBlockTree />
        <MovementMeasured />

        <div className="mx-auto w-full max-w-[1080px] px-4 sm:px-6">
          <DividerLabel>Standing on the Shoulders of Giants</DividerLabel>
        </div>

        <FoundingThesis />
        <WisdomGiants />
        <WisdomLifecycle />
        <GamingWisdom />
        <SwissWatchDoctrine />

        <div className="mx-auto w-full max-w-[1080px] px-4 sm:px-6">
          <DividerLabel>Omni-Synthesis Audit</DividerLabel>
        </div>

        <IntentGate />
        <CognitiveLenses />
        <EvidenceTable />
        <CognitiveArchitecture />
        <RarePathProber />
        <SymbolicHarness />
        <AbstractionElevator />
        <TensionStudio />
        <RedTeamMirror />
        <SpearPoint />
        <Node0Runtime />
        <HonestBoundary />

        <SealedDoors />
        <GenesisClosureSprint />

        <div className="mx-auto w-full max-w-[1080px] px-4 sm:px-6">
          <DividerLabel>Flagship Experiences · The Dashboard Measures Itself</DividerLabel>
        </div>

        <InvestorDemo />
        <UnifiedInstaller />
        <PerformanceTelemetry />
        <FinalSeal />
      </main>

      <footer className="mt-auto border-t border-[#1c2438] bg-[#080b14]">
        <div className="mx-auto w-full max-w-[1080px] px-4 py-10 text-center sm:px-6">
          <div className="mb-6 flex flex-col items-center gap-3">
            <IqraMark size="md" />
            <TruthLabel state="DECLARED" />
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#707b8f]">
              The signature of the habitat · knowledge before assertion
            </p>
          </div>
          <p className="mx-auto max-w-2xl text-[12px] leading-[1.7] text-[#7c8597]">
            BIZRA stands on the shoulders of the giants, but it does not stop where they stopped. Movement
            A and the gold dot are Node0 — seeded reality today. The forest, the federation, and the
            cross-node economics are the designed shape, drawn as the target, never disguised as the
            present.
          </p>
          <div className="mt-5 text-[14px] leading-[1.8] text-[#cdd3df]">
            Every human is a node. Every node is a seed. Every seed has infinite potential.
            <br />
            <span dir="rtl" lang="ar" className="text-[#c9a84c]">
              كل إنسان عقدة. وكل عقدة بذرة. وكل بذرة لها إمكانية لا نهائية.
            </span>
          </div>
          <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.3em] text-[#7a8499]">
            BIZRA vΩ.2.0 · APEX KERNEL · OMNI-SYNTHESIS · SEALED
          </p>
        </div>
      </footer>
    </div>
  )
}
