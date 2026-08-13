// DEMA-FRESH-PROCESS-INDEPENDENCE-1A — the binary question, asked in a fresh process.
//
//   Does Dema remain Dema when the development harness is gone?
//
// Emits an AUTHORITATIVE REPORT built only from Dema-native state under DEMA_HOME:
// season head, governed authorship identity, the consent-nonce ledger, and a live
// constitutional refusal. Nothing env-derived enters the report — no HOME, no cwd,
// no provider paths — so the report hash is comparable across environments by
// construction rather than by luck.
//
// READ-ONLY. This prover loads and refuses; it never writes to DEMA_HOME.
//
// Usage: node scripts/dema-native-independence.mjs [seasonId] [probeNonce]
//   DEMA_HOME must be set explicitly. HOME may be anywhere — that is the point.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

import { loadSeasonHead } from "../packages/receipts/src/season-state-store.js";
import { loadActiveKeyPair } from "../packages/receipts/src/authorship-key-store.js";
import { inspectConsentNonce } from "../packages/receipts/src/consent-nonce-claim.js";
import { walkGenesisMissionSpine } from "../packages/mission/src/genesis-mission-spine.js";
import { readExecutingRepositoryBinding } from "../packages/mission/src/executing-repository-binding.js";

// Season and probe nonce are CLI arguments, not environment variables. Every new
// DEMA_* variable is surface the env-hygiene registry must carry forever, and
// these two configure a diagnostic — they are not habitat configuration.
const demaHome = process.env.DEMA_HOME;
const seasonId = process.argv[2] ?? "NODE0-FIRST-LIGHT-PREFLIGHT-HARDENING-1A";
const probeNonce = process.argv[3] ?? "gm001-run1-c2c1c492f5fef888";

const facts = {};

// ── 1 · the habitat root resolves, and it is not a provider directory ────────
facts.dema_home_resolves = typeof demaHome === "string" && demaHome.length > 0;
facts.dema_home_exists = facts.dema_home_resolves && existsSync(demaHome);
facts.dema_home_is_not_provider_dir =
  facts.dema_home_resolves && !/\.(claude|codex)(\/|$)/.test(demaHome);

// ── 2 · the season head reconstructs from Dema-owned state ──────────────────
let head = null;
try {
  head = await loadSeasonHead({ demaHome, seasonId });
} catch {
  head = null;
}
// `ok: true` from loadSeasonHead means the LOAD succeeded, not that a head
// exists — an absent season returns ok with outcome "EMPTY". Conflating the two
// let this prover exit 0 against a completely empty estate, which is absence
// reading as presence. A head exists only when it is not EMPTY and carries a hash.
facts.season_head_loads =
  head?.ok === true && head?.outcome !== "EMPTY" && typeof head?.head?.head_hash === "string";
facts.season_state_sequence = head?.head?.state_sequence ?? null;
facts.season_head_hash = head?.head?.head_hash ?? null;

// ── 3 · governed authorship identity loads (fingerprint only; no key bytes) ──
let keys = null;
try {
  keys = await loadActiveKeyPair(demaHome);
} catch {
  keys = null;
}
facts.governed_identity_loads = keys?.ok === true;
facts.identity_fingerprint = keys?.fingerprint ?? keys?.active?.fingerprint ?? null;

// ── 4 · the consent ledger still answers about a retired authority ──────────
let nonce = null;
try {
  nonce = await inspectConsentNonce({ nonce: probeNonce, demaHome });
} catch {
  nonce = null;
}
facts.consent_ledger_answers = nonce !== null;
facts.probe_nonce_used = nonce?.used ?? null;

// ── 5 · constitutional refusal still refuses, with no human phrase present ──
// A spine walk with no presented consent must halt at CONSENT_GATE granting
// nothing. This is Dema's law running with no provider in the process at all.
let spine = null;
try {
  spine = walkGenesisMissionSpine({
    intention: "Create the canonical manifest receipt",
    effect: { sandbox_root: "/tmp/independence-probe", atoms: [{ from: "a.md", to: "b.md" }] },
    seasonLoad: head,
    executingRepository: await readExecutingRepositoryBinding({
      runGit: async (a) => (a.includes("HEAD^{tree}") ? `${"2".repeat(40)}\n` : `${"1".repeat(40)}\n`),
    }),
    actionId: "RUN_GENESIS_MISSION_SPINE",
    corridorContext: {
      kind: "START",
      mission_id: "genesis-mission-001",
      contract_hash: `sha256:${"c".repeat(64)}`,
      permitted_actions: ["analyze", "edit", "test"],
      mission_root: "/tmp/independence-probe",
      nonce: "independence-probe-0001",
      expires_at: "2099-01-01T00:00:00Z",
    },
    now: "2026-08-13T00:00:00Z",
    usedNonces: [],
  });
} catch {
  spine = null;
}
// A refusal is a refusal. This probe supplies a repository binding that does NOT
// match what the season authorized, so Dema refuses at the gate with
// `repository_commit_mismatch` rather than merely asking for consent — a stronger
// law than the one first coded for here. What matters is that an unauthorized
// walk is refused and grants nothing, with no provider in the process.
facts.constitutional_refusal_holds =
  spine?.ok === false && spine?.stage === "CONSENT_GATE" && spine?.grants_execution === false;
facts.refusal_verdict = spine?.verdict ?? null;
facts.refusal_reason = spine?.reason ?? null;
facts.refusal_grants_nothing =
  spine?.authority_delta === 0 && spine?.effect_executed === false && spine?.nonce_claimed === false;

// ── the authoritative report ────────────────────────────────────────────────
const authoritative = {
  schema: "bizra.dema.fresh_process_independence_report.v0.1",
  season_id: seasonId,
  facts,
};
const report_hash =
  "sha256:" + createHash("sha256").update(JSON.stringify(authoritative)).digest("hex");

// Observations ABOUT the environment are reported but deliberately excluded from
// the hashed body — if they were inside it, the two runs could never match and the
// comparison would prove nothing.
const environment_observed_not_authoritative = {
  home: process.env.HOME ?? null,
  provider_dir_visible: existsSync(`${process.env.HOME ?? "/nonexistent"}/.claude`),
  claude_env_vars: Object.keys(process.env).filter((k) => /^(CLAUDE|ANTHROPIC)/i.test(k)).sort(),
};

console.log(
  JSON.stringify({ ...authoritative, report_hash, environment_observed_not_authoritative }, null, 2),
);
// Every one of these must hold. Governed identity is included specifically
// because it is the fact that discriminated the real estate from an empty
// directory — without it this prover passes on nothing at all.
process.exit(
  facts.dema_home_exists &&
    facts.dema_home_is_not_provider_dir &&
    facts.season_head_loads &&
    facts.governed_identity_loads &&
    facts.consent_ledger_answers &&
    facts.constitutional_refusal_holds &&
    facts.refusal_grants_nothing
    ? 0
    : 1,
);
