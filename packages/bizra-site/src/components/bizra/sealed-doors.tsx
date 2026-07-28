'use client'

import openProblems from '@/lib/open-problems.json'
import { IqraMark, SealedDoor, TruthLabel, type TruthState } from './habitat-brand'

type OpenProblem = {
  surface: string
  status: string
  kind: string
  meaning: string
  evidence: string
}

function normalizeState(problem: OpenProblem): TruthState {
  if (problem.status === 'BLOCKED') return 'BLOCKED'
  if (problem.status === 'PREVIEW_ONLY') return 'PREVIEW'
  if (problem.status.includes('DESIGNED')) return 'DESIGNED'
  return 'DECLARED'
}

function unsealCondition(problem: OpenProblem): string {
  if (problem.status === 'BLOCKED') {
    return 'Remove the named blocker, rerun the bound verification gates, and promote only from an exact passing receipt.'
  }
  if (problem.status === 'PREVIEW_ONLY') {
    return 'Replace preview-only rendering with a governed runtime path, measured effects, rollback evidence, and human-approved activation.'
  }
  if (problem.status.includes('DESIGNED')) {
    return 'Implement the design as a bounded vertical slice, prove it in an isolated environment, then bind the observed result to a signed receipt.'
  }
  return 'Supply a falsifiable contract, executable evidence, and an explicit sovereign promotion decision.'
}

export function SealedDoors() {
  const problems = openProblems.problems as OpenProblem[]

  return (
    <section id="sealed-doors" className="relative border-y border-[#1c2438] bg-[#090d17] py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <IqraMark size="lg" quiet className="absolute -right-8 top-8 rotate-[-4deg] opacity-40" />
      </div>

      <div className="relative mx-auto w-full max-w-[1080px] px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.25fr] lg:items-end">
          <div>
            <div className="flex items-center gap-3">
              <IqraMark size="md" />
              <TruthLabel state="MEASURED" />
            </div>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.24em] text-[#c89b3c]">
              Habitat fixture · generated from CURRENT_LIMITS
            </p>
            <h2 className="mt-3 max-w-[16ch] text-[clamp(2.2rem,6vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-[#ebe6db]">
              Sealed doors, not hidden promises.
            </h2>
          </div>

          <div className="max-w-[58ch] lg:justify-self-end">
            <p className="text-[15px] leading-[1.8] text-[#9aa4b5]">
              Every unfinished capability remains visible. Each door names its present truth state, the evidence already attached to it, and the exact class of proof required before it may open.
            </p>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[#68758a]">
              Click a door to inspect its seal · no status is upgraded by presentation
            </p>
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {problems.map((problem) => (
            <SealedDoor
              key={`${problem.status}:${problem.surface}`}
              title={problem.surface.replace(/^\*\*[^*]+\*\*\s*/, '')}
              state={normalizeState(problem)}
              meaning={problem.meaning}
              evidence={problem.evidence}
              unseal={unsealCondition(problem)}
            />
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#1c2438] pt-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#667287]">
            {openProblems.total_open} visible doors · {openProblems.generated_from_ledger_rows} ledger rows examined
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#c89b3c]">
            What is not live remains sealed
          </p>
        </div>
      </div>
    </section>
  )
}
