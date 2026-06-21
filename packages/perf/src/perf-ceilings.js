// PERF-BENCH-CI-HEADROOM-1A · environment-aware A+ performance ceilings (ms).
//
// dema_boot_latency_ms is environment-aware: CLI cold-start on shared CI runners
// runs markedly slower than local, and `npm run perf --a-plus` runs LAST in the
// CI check job (under load). Local stays strict (150ms) to catch real boot
// regressions; CI gets honest headroom (250ms) so the gate measures regressions,
// not runner jitter — a genuine 2x+ boot blowup still trips even in CI. Mirrors
// resolvePerfBudgets in scripts/review/performance-budget-gate.mjs (PR #188).
export function resolveAPlusCeilings(env = process.env) {
  const inCI = env.CI === "true" || env.GITHUB_ACTIONS === "true";
  return Object.freeze({
    verification_latency_ms: 1, // sub-ms for canonical sha256
    dema_boot_latency_ms: inCI ? 250 : 150, // strict local / CI jitter headroom
  });
}
