'use client'

import { useState } from 'react'

export type TruthState = 'MEASURED' | 'DESIGNED' | 'DECLARED' | 'SEALED' | 'BLOCKED' | 'PREVIEW'

const STATE_STYLES: Record<TruthState, string> = {
  MEASURED: 'border-[#4e7c59]/55 bg-[#4e7c59]/10 text-[#9fc0a6]',
  DESIGNED: 'border-[#5b9bd5]/50 bg-[#5b9bd5]/10 text-[#9bc3ea]',
  DECLARED: 'border-[#c9a84c]/50 bg-[#c9a84c]/10 text-[#e1c984]',
  SEALED: 'border-[#c89b3c]/65 bg-[#c89b3c]/12 text-[#f0d38b]',
  BLOCKED: 'border-[#a75656]/55 bg-[#a75656]/10 text-[#d69a9a]',
  PREVIEW: 'border-[#8c78b8]/50 bg-[#8c78b8]/10 text-[#bfaee4]',
}

export function TruthLabel({ state, className = '' }: { state: TruthState; className?: string }) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-1 font-mono text-[9px] font-semibold tracking-[0.18em] ${STATE_STYLES[state]} ${className}`}
    >
      {state}
    </span>
  )
}

export function IqraMark({
  size = 'md',
  quiet = false,
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg'
  quiet?: boolean
  className?: string
}) {
  const sizes = {
    sm: 'text-[1.15rem]',
    md: 'text-[1.75rem]',
    lg: 'text-[clamp(3.5rem,12vw,8rem)]',
  }

  return (
    <span
      dir="rtl"
      lang="ar"
      aria-label="اقرأ — Read"
      className={`${sizes[size]} font-[KufiLocal,'Noto_Kufi_Arabic',serif] font-bold leading-none ${
        quiet ? 'text-[#c89b3c]/35' : 'text-[#d9bb6a]'
      } ${className}`}
    >
      اقرأ
    </span>
  )
}

export function HabitatSignatureBar() {
  return (
    <div className="border-y border-[#1c2438] bg-[#090d17]/95">
      <div className="mx-auto flex w-full max-w-[1080px] items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <IqraMark size="sm" />
          <span className="hidden h-4 w-px bg-[#2a3448] sm:block" />
          <p className="truncate font-mono text-[9px] uppercase tracking-[0.18em] text-[#7f8999] sm:text-[10px]">
            Build the habitat, not the actor
          </p>
        </div>
        <div className="hidden items-center gap-1.5 md:flex" aria-label="BIZRA truth states">
          <TruthLabel state="MEASURED" />
          <TruthLabel state="DESIGNED" />
          <TruthLabel state="DECLARED" />
          <TruthLabel state="SEALED" />
        </div>
      </div>
    </div>
  )
}

export function SealedDoor({
  title,
  state,
  meaning,
  evidence,
  unseal,
}: {
  title: string
  state: TruthState
  meaning: string
  evidence: string
  unseal: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <article className="relative overflow-hidden border border-[#242d40] bg-[#0d1320]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="group w-full text-left"
      >
        <div className="relative min-h-[220px] p-5 sm:p-6">
          <div className="absolute inset-y-0 left-1/2 w-px bg-gradient-to-b from-transparent via-[#c89b3c]/22 to-transparent" />
          <div className="absolute inset-3 border border-[#c89b3c]/10 transition-colors group-hover:border-[#c89b3c]/30" />
          <div className="relative z-10 flex h-full min-h-[178px] flex-col justify-between">
            <div className="flex items-start justify-between gap-4">
              <TruthLabel state={state} />
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#596579]">
                {open ? 'Close record' : 'Inspect seal'}
              </span>
            </div>
            <div>
              <div className="mb-4 h-7 w-7 rounded-full border border-[#c89b3c]/40 bg-[#c89b3c]/5 shadow-[0_0_20px_rgba(200,155,60,0.08)]" />
              <h3 className="max-w-[30ch] text-[16px] font-medium leading-[1.45] text-[#e5e1d7]">{title}</h3>
              <p className="mt-3 text-[12px] leading-[1.65] text-[#7f8999]">{meaning}</p>
            </div>
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-[#242d40] bg-[#090e18] p-5 sm:p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#c89b3c]">What unseals this door</p>
              <p className="mt-2 text-[13px] leading-[1.7] text-[#c8ced8]">{unseal}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#748096]">Evidence bound to the seal</p>
              <p className="mt-2 break-words font-mono text-[10px] leading-[1.65] text-[#69758a]">{evidence}</p>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
