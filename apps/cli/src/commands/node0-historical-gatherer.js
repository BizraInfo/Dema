// NODE0-HISTORICAL-CONTRIBUTION-VERIFICATION-1A — read-only evidence gatherer.
// Git time-span metadata and canon witness path markers only. No content reads.

import { execFile as nodeExecFile } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(nodeExecFile);

export const CANON_WITNESS_CANDIDATES = Object.freeze([
  Object.freeze({
    id: "root_source_of_truth",
    relative_path: "docs/BIZRA_ROOT_SOURCE_OF_TRUTH_v0_1.md",
    witness_role: "public_canon",
  }),
  Object.freeze({
    id: "third_fact_pdf",
    relative_path: "BIZRA_Third_Fact_v0_1_FINAL.pdf",
    witness_role: "public_economy_canon",
  }),
  Object.freeze({
    id: "the_message_pdf",
    relative_path: "themassage.pdf",
    witness_role: "arabic_root_al_risala",
  }),
  Object.freeze({
    id: "the_seed_pdf",
    relative_path: "bizra.pdf",
    witness_role: "arabic_root_al_bidra",
  }),
  Object.freeze({
    id: "priority_manifest",
    relative_path: "proof-of-priority/manifest.json",
    witness_role: "bitcoin_priority_anchor",
  }),
  Object.freeze({
    id: "node0_founder_proof",
    relative_path: "docs/NODE0_FOUNDER_PROOF_AND_HUMAN_CHOICE_v0_1.md",
    witness_role: "founder_proof_doc",
  }),
]);

function isoYearsAgo(years, referenceDate) {
  const d = new Date(referenceDate);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString();
}

async function runGit(cwd, args, execFileImpl = execFile) {
  try {
    const { stdout } = await execFileImpl("git", args, {
      cwd,
      timeout: 30_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function gatherGitTimeSpanEvidence({
  root,
  lookback_years = 3,
  reference_iso,
  execFileImpl,
} = {}) {
  const referenceDate =
    typeof reference_iso === "string" && reference_iso.length > 0
      ? reference_iso
      : new Date().toISOString();
  const window_start_iso = isoYearsAgo(lookback_years, referenceDate);
  const window_end_iso = referenceDate;
  const gitDir = join(root, ".git");
  const is_git_repository = existsSync(gitDir);

  if (!is_git_repository) {
    return Object.freeze({
      is_git_repository: false,
      lookback_years,
      window_start_iso,
      window_end_iso,
      commits_in_window: 0,
      first_commit_iso: null,
      last_commit_iso: null,
    });
  }

  const inside = await runGit(
    root,
    ["rev-parse", "--is-inside-work-tree"],
    execFileImpl,
  );
  if (inside !== "true") {
    return Object.freeze({
      is_git_repository: false,
      lookback_years,
      window_start_iso,
      window_end_iso,
      commits_in_window: 0,
      first_commit_iso: null,
      last_commit_iso: null,
    });
  }

  const since = window_start_iso.slice(0, 10);
  const logOut = await runGit(
    root,
    ["log", `--since=${since}`, "--format=%aI", "--reverse"],
    execFileImpl,
  );
  const lines = logOut ? logOut.split("\n").filter(Boolean) : [];
  const commits_in_window = lines.length;
  const first_commit_iso = lines[0] ?? null;
  const last_commit_iso = lines.length > 0 ? lines[lines.length - 1] : null;

  return Object.freeze({
    is_git_repository: true,
    lookback_years,
    window_start_iso,
    window_end_iso,
    commits_in_window,
    first_commit_iso,
    last_commit_iso,
  });
}

export function gatherCanonWitnessMarkers({ root } = {}) {
  return Object.freeze(
    CANON_WITNESS_CANDIDATES.map((candidate) => {
      const absolute = join(root, candidate.relative_path);
      const present = existsSync(absolute);
      let size_bytes = null;
      let mtime_iso = null;
      if (present) {
        try {
          const st = statSync(absolute);
          size_bytes = st.size;
          mtime_iso = st.mtime.toISOString();
        } catch {
          // metadata unavailable — still path-present
        }
      }
      return Object.freeze({
        id: candidate.id,
        witness_role: candidate.witness_role,
        relative_path: candidate.relative_path,
        present,
        size_bytes,
        mtime_iso,
        content_read: false,
      });
    }),
  );
}
