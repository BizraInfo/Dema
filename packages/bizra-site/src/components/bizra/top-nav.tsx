'use client'

import { useEffect, useState } from 'react'
import { motion, useScroll, useSpring } from 'framer-motion'
import { SECTIONS } from '@/lib/bizra-data'
import { OnboardingTour } from './onboarding-tour'
import { cn } from '@/lib/utils'

export function TopNav() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 })
  const [active, setActive] = useState<string>('hero')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: [0, 0.25, 0.5, 1] },
    )
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="sticky top-0 z-50">
      <motion.div
        className="h-[2px] origin-left bg-gradient-to-r from-[#c9a84c] via-[#e8c878] to-[#5b9bd5]"
        style={{ scaleX }}
      />
      <div className="border-b border-[#1c2438] bg-[#0a0e1a]/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1080px] items-center gap-3 px-4 py-2.5 sm:px-6">
          <button
            type="button"
            onClick={() => go('hero')}
            className="flex shrink-0 items-baseline gap-2"
            aria-label="BIZRA — back to top"
          >
            <span className="font-display text-[15px] font-semibold tracking-[0.02em] text-[#f3f0e6]">
              BIZRA
            </span>
            <span className="font-mono text-[10px] text-[#c9a84c]">البذرة · sovereign node</span>
          </button>
          <span className="hidden h-4 w-px bg-[#232c44] sm:block" />
          <nav
            aria-label="Sections"
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go(s.id)}
                className={cn(
                  'shrink-0 rounded-md px-2.5 py-1 text-[11px] transition-colors',
                  active === s.id
                    ? 'bg-[#1a2238] text-[#e8c878]'
                    : 'text-[#7c8597] hover:text-[#cdd3df]',
                )}
              >
                {s.label}
              </button>
            ))}
          </nav>
          <OnboardingTour />
        </div>
      </div>
    </div>
  )
}
