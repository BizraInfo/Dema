// NODE0-MINIMUM-SEASON-SAVE-RESUME-1A — `dema season save|status|resume`.
//
// Thin wrapper. Every decision belongs to the kernel + store; this file only
// parses argv, picks the season, and renders. It never invents a default that
// could change what is persisted, and it never grants consent.

import {
  saveSeasonState,
  seasonStatus,
  resumeSeason,
  listSeasons,
} from "../../../../packages/receipts/src/season-state-store.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";
import { buildLocalModelInventoryScan } from "../../../../packages/core/src/local-model-inventory-scan.js";
import { buildLocalModelWorldObservation } from "../../../../packages/core/src/realm0-world-observer.js";
import { readFileSync } from "node:fs";

function argValue(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

/** Every occurrence of a repeatable flag, in argv order (order is preserved). */
function argValues(argv, name) {
  const out = [];
  for (let i = 0; i < argv.length; i++) if (argv[i] === name && argv[i + 1] !== undefined) out.push(argv[i + 1]);
  return out;
}

/** `--pending-consent none` means an empty list; otherwise "phrase::scope". */
function parsePendingConsent(values) {
  if (values.length === 0) return [];
  if (values.length === 1 && values[0] === "none") return [];
  return values.map((v) => {
    const idx = v.indexOf("::");
    return idx < 0
      ? { phrase: v, scope: "unspecified" }
      : { phrase: v.slice(0, idx), scope: v.slice(idx + 2) };
  });
}

/**
 * Resolve which season to act on. One season present = unambiguous. Several,
 * with no --season, is an ambiguity the operator must settle — not one the CLI
 * may guess, since guessing would resume the wrong mission.
 */
async function pickSeason(argv, demaHome) {
  const explicit = argValue(argv, "--season");
  if (explicit) return { ok: true, seasonId: explicit };
  const listed = await listSeasons({ demaHome });
  if (listed.season_ids.length === 1) return { ok: true, seasonId: listed.season_ids[0] };
  if (listed.season_ids.length === 0) return { ok: true, seasonId: null, none: true };
  return { ok: false, reason: "season_ambiguous", season_ids: listed.season_ids };
}

function buildStateFromArgv(argv) {
  const fromPath = argValue(argv, "--from");
  if (fromPath) return JSON.parse(readFileSync(fromPath, "utf8"));
  return {
    season_id: argValue(argv, "--season"),
    mission_id: argValue(argv, "--mission"),
    mission_contract_hash: argValue(argv, "--contract-hash") ?? null,
    mission_phase: argValue(argv, "--phase"),
    completed_steps: argValues(argv, "--step"),
    next_safe_action: argValue(argv, "--next"),
    must_not_repeat: argValues(argv, "--must-not-repeat"),
    pending_consent: parsePendingConsent(argValues(argv, "--pending-consent")),
    last_receipt_hash: argValue(argv, "--last-receipt") ?? null,
    repository_commit: argValue(argv, "--repo-commit"),
    repository_tree: argValue(argv, "--repo-tree"),
    saved_at: argValue(argv, "--saved-at") ?? new Date().toISOString().replace(/\.\d+Z$/, "Z"),
  };
}

export async function cmd_season(ctx) {
  const argv = ctx.argv.slice(1);
  const sub = argv[0];
  const json = wantsJson(argv);
  const demaHome = argValue(argv, "--dema-home");

  // The CLI boundary turns a refusal into exit 1 via the `refused` sentinel
  // (apps/cli/src/index.js) — a numeric return would be silently discarded.
  const emit = (result) => {
    if (json) console.log(JSON.stringify(result, null, 2));
    return result.ok ? result : { ...result, refused: true };
  };

  if (sub === "save") {
    let input;
    try {
      input = buildStateFromArgv(argv);
    } catch (err) {
      const r = { ok: false, outcome: "REFUSED", reason: `state_input_unreadable:${err?.code ?? "parse_error"}` };
      if (!json) console.error(`season save refused: ${r.reason}`);
      return emit(r);
    }
    // REALM0-ANCHOR-BINDING-0B. An anchored save binds the publication to a
    // world anchor INSIDE receipt_hash. The CLI only carries the operator's
    // observed payload through; it never invents one — absence stays legacy.
    const anchorObserved = argValue(argv, "--world-anchor-observed");
    // REALM0-WORLD-OBSERVER-1A. The operator observes the REAL local model
    // world rather than typing a hash: the shipped scanner produces the estate,
    // the observer normalizes it to identity, and 0B binds the digest-bearing
    // payload. A blind observation REFUSES the save — it never fabricates an
    // anchor. Mutually exclusive with a hand-supplied payload.
    const observeWorld = argv.includes("--observe-world-local-models");
    let worldAnchor = null;
    if (observeWorld && anchorObserved !== undefined) {
      const r = { ok: false, outcome: "REFUSED", reason: "world_anchor_source_ambiguous" };
      if (!json) console.error(`season save refused: ${r.reason}`);
      return emit(r);
    }
    if (observeWorld) {
      const scan = await buildLocalModelInventoryScan();
      const observation = buildLocalModelWorldObservation({ scan });
      if (observation.status !== "OBSERVED") {
        const r = {
          ok: false, outcome: "REFUSED",
          reason: `world_observation_unavailable:${observation.reason ?? "unknown"}`,
          blind_sources: observation.blind_sources,
        };
        if (!json) {
          console.error(`season save refused: ${r.reason}`);
          for (const b of observation.blind_sources ?? []) console.error(`    blind: ${b}`);
        }
        return emit(r);
      }
      worldAnchor = { observed: observation.observed };
    } else if (anchorObserved !== undefined) {
      try {
        worldAnchor = { observed: JSON.parse(anchorObserved) };
      } catch {
        const r = { ok: false, outcome: "REFUSED", reason: "world_anchor_observed_unparseable" };
        if (!json) console.error(`season save refused: ${r.reason}`);
        return emit(r);
      }
    }
    const result = await saveSeasonState({ demaHome, state: input, worldAnchor });
    if (!json) {
      if (result.ok) {
        console.log("Season state saved");
        console.log(`  season:   ${result.season_id}`);
        console.log(`  sequence: ${result.state_sequence}`);
        console.log(`  state:    ${result.state_hash}`);
        console.log(`  receipt:  ${result.receipt_hash}`);
        if (result.world_anchor_ref) console.log(`  anchor:   ${result.world_anchor_ref}`);
      } else {
        console.error(`season save refused: ${result.reason}`);
        for (const b of result.blocked_by ?? []) console.error(`    ${b}`);
      }
    }
    return emit(result);
  }

  if (sub === "status" || sub === "resume") {
    const picked = await pickSeason(argv, demaHome);
    if (!picked.ok) {
      if (!json) console.error(`season ${sub} refused: ${picked.reason} (${picked.season_ids.join(", ")})`);
      return emit({ ok: false, outcome: "REFUSED", reason: picked.reason, season_ids: picked.season_ids });
    }
    if (picked.none) {
      const r = { ok: true, outcome: "EMPTY", reason: null, season_id: null };
      if (!json) console.log("No season state found (EMPTY).");
      return emit(r);
    }

    if (sub === "status") {
      const result = await seasonStatus({ demaHome, seasonId: picked.seasonId });
      if (!json) {
        if (result.outcome === "EMPTY") console.log(`Season ${picked.seasonId}: EMPTY`);
        else if (result.ok) {
          console.log("Season status");
          console.log(`  season:    ${result.season_id}`);
          console.log(`  mission:   ${result.mission_id}`);
          console.log(`  phase:     ${result.mission_phase}`);
          console.log(`  sequence:  ${result.state_sequence}`);
          console.log(`  next:      ${result.next_safe_action}`);
          console.log(`  consent:   ${result.pending_consent_pending ? `${result.pending_consent_count} PENDING` : "none pending"}`);
          console.log(`  repo:      ${result.repository_commit} / ${result.repository_tree}`);
          console.log(`  state:     ${result.state_hash}`);
          console.log(`  anchor:    ${result.world_anchor}${result.world_anchor_ref ? ` ${result.world_anchor_ref}` : ""}`);
        } else console.error(`season status refused: ${result.reason}`);
      }
      return emit(result);
    }

    const result = await resumeSeason({
      demaHome, seasonId: picked.seasonId,
      repositoryCommit: argValue(argv, "--repo-commit"),
      repositoryTree: argValue(argv, "--repo-tree"),
    });
    if (!json) {
      if (result.outcome === "EMPTY") console.log(`Season ${picked.seasonId}: EMPTY`);
      else if (result.ok) {
        const c = result.continuation;
        console.log("Season resumed (reconstruction only — nothing executed)");
        console.log(`  anchor:    ${result.world_anchor} ${result.world_anchor_ref}`);
        console.log(`  mission:   ${c.mission_id}`);
        console.log(`  phase:     ${c.mission_phase}`);
        console.log(`  next:      ${c.next_safe_action}`);
        console.log(`  consent:   ${c.pending_consent.length} pending (granted: ${c.consent_granted})`);
        console.log("  completed:");
        for (const s of c.completed_steps) console.log(`    - ${s}`);
        console.log("  must not repeat:");
        for (const s of c.must_not_repeat) console.log(`    - ${s}`);
      } else console.error(`season resume refused: ${result.reason} (${result.outcome})`);
    }
    return emit(result);
  }

  const usage = {
    ok: false, outcome: "REFUSED", reason: "unknown_subcommand",
    subcommands: ["save", "status", "resume"],
  };
  if (json) console.log(JSON.stringify(usage, null, 2));
  else {
    console.error("Usage: dema season save|status|resume [--json]");
    console.error("  dema season save --season <id> --mission <id> --phase <PHASE> --next <ACTION> \\");
    console.error("       --repo-commit <sha40> --repo-tree <sha40> [--step <s>]... [--must-not-repeat <s>]... \\");
    console.error("       [--pending-consent none|<phrase>::<scope>]... [--from <state.json>] [--dema-home <path>] \\");
    console.error("       [--world-anchor-observed <json> | --observe-world-local-models]");
    console.error("  dema season status [--season <id>] [--dema-home <path>]");
    console.error("  dema season resume [--season <id>] [--repo-commit <sha40>] [--repo-tree <sha40>]");
  }
  return { ...usage, refused: true };
}
