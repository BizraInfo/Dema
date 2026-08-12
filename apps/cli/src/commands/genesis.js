// `dema genesis` command handler — extracted from index.js (④).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFile as execFileCb } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";
import {
  buildGenesisCompositionBlueprintPreview,
  formatGenesisCompositionBlueprintPreview,
} from "../../../../packages/core/src/genesis-composition-blueprint-preview.js";
import { assessBlock0LiveReadiness } from "../../../../packages/genesis/src/block0-live-readiness.js";
import { assessNode0GenesisKeyCeremonyPreflight } from "../../../../packages/genesis/src/node0-genesis-key-ceremony-preflight.js";
import {
  buildBlock0SealCeremonyDryRun,
  formatBlock0SealCeremonyDryRun,
} from "../../../../packages/genesis/src/block0-seal-ceremony-dry-run.js";
import { buildLocalAssetInventory } from "../../../../packages/core/src/local-asset-awareness.js";
import { buildHomebaseAssetAwareness } from "../../../../packages/core/src/homebase-asset-awareness.js";
import {
  buildNode0HistoricalContributionVerification,
  formatNode0HistoricalContributionVerification,
} from "../../../../packages/core/src/node0-historical-contribution-verification.js";
import {
  gatherCanonWitnessMarkers,
  gatherGitTimeSpanEvidence,
} from "./node0-historical-gatherer.js";
import { gatherNode0HardwareObservations } from "./hardware-profile-gatherer.js";
import {
  establishNodeGenesisRoot,
  ESTABLISH_ROOT_TRUST_CONSENT_PHRASE,
  GENESIS_ROOT_REQUIRES_FRESH_NODE,
} from "../../../../packages/genesis/src/node0-genesis-root-ceremony.js";
import { resolveWitnessPath } from "../../../../packages/genesis/src/node0-genesis-witness.js";
import {
  buildAuthorshipMigrationPreview,
  buildAuthorshipMigrationConsentEnvelope,
  executeGenesisAuthorshipMigration,
  repositoryIdentityFromBinding,
} from "../../../../packages/genesis/src/genesis-authorship-migration-binding.js";
import {
  readExecutingRepositoryBinding,
  REPO_ROOT as BINDING_REPO_ROOT,
} from "../../../../packages/mission/src/executing-repository-binding.js";
import { KEY_MIGRATE_CONSENT_PHRASE } from "../../../../packages/receipts/src/authorship-key-store.js";
import { captureDirectoryIdentity } from "../../../../packages/mission/src/corridor-closure-gatherer.js";

const execFileAsyncGit = promisify(execFileCb);
const realGitRunner = async (args, { cwd } = {}) => {
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (name.startsWith("GIT_")) delete env[name];
  }
  const { stdout } = await execFileAsyncGit("git", args, {
    cwd: cwd ?? BINDING_REPO_ROOT,
    env,
  });
  return stdout;
};

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function resolveDemaHome() {
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

// Read a JSON artifact named by a CLI flag, in the estate's established
// {parsed}|{error} shape (mirrors steward.js). A missing flag or unreadable
// file is an error the caller turns into a refusal — never a throw.
function readCliJson(path) {
  if (!path) return { error: "path_flag_missing" };
  try {
    return { parsed: JSON.parse(readFileSync(path, "utf8")) };
  } catch {
    return { error: "file_unreadable_or_not_json" };
  }
}

// Write a canonical authority artifact exactly once. The estate's exclusive-
// create idiom (`wx` — root marker, nonce claim): an existing target refuses,
// so a stale ceremony artifact can never be silently replaced. This is an
// operator_requested_artifact_write at a caller-named path — not an
// authority-state write by design; the path placement itself is
// unconstrained here (no containment rule is enforced on --out).
function writeArtifactExclusive(path, artifact) {
  try {
    writeFileSync(path, JSON.stringify(artifact, null, 2) + "\n", { flag: "wx" });
    return { written: true };
  } catch (err) {
    return {
      written: false,
      reason: err?.code === "EEXIST" ? "artifact_exists" : "artifact_write_failed",
    };
  }
}

// Mirror scripts/node0-genesis-key-ceremony-preflight.mjs — fail closed: missing
// or unreadable provenance → BLOCKED rather than silently proceed.
function loadProvenanceNextGate() {
  const path = join(
    process.cwd(),
    "docs/08-quality/CROSS_REPO_GENESIS_PROVENANCE_2026_06_05.json",
  );
  if (!existsSync(path)) return "BLOCKED_BY_UNRESOLVED_PROVENANCE";
  try {
    const doc = JSON.parse(readFileSync(path, "utf8"));
    return doc.next_gate?.gate ?? "BLOCKED_BY_UNRESOLVED_PROVENANCE";
  } catch {
    return "BLOCKED_BY_UNRESOLVED_PROVENANCE";
  }
}

export async function cmd_genesis(ctx) {
  const { argv } = ctx;
  const genesisSub = argv[1] ?? "";
  const genesisAction = argv[2] ?? "";
  const wantJsonG = wantsJson(argv);
  if (genesisSub === "composition" && genesisAction === "blueprint") {
    const preview = buildGenesisCompositionBlueprintPreview();
    console.log(
      wantJsonG
        ? JSON.stringify(preview, null, 2)
        : formatGenesisCompositionBlueprintPreview(preview),
    );
    process.exit(process.exitCode ?? 0);
  }
  if (genesisSub === "seal" && genesisAction === "preview") {
    // Read-only: assemble the dry-run signing-ceremony preview. No private key is
    // read, no signature is produced, no Block0 is sealed.
    const demaHome = resolveDemaHome();
    const readiness = await assessBlock0LiveReadiness({ demaHome });
    const preflight = await assessNode0GenesisKeyCeremonyPreflight({
      demaHome,
      provenanceNextGate: loadProvenanceNextGate(),
    });
    const preview = buildBlock0SealCeremonyDryRun({ readiness, preflight });
    console.log(
      wantJsonG
        ? JSON.stringify(preview, null, 2)
        : formatBlock0SealCeremonyDryRun(preview),
    );
    process.exit(process.exitCode ?? 0);
  }
  // NODE0-GENESIS-ROOT-BOOTSTRAP-CEREMONY-1A. The one production path by which
  // a human gives this Node an origin. Deliberately a THIN adapter: it parses
  // flags, delegates the entire decision to the ceremony kernel, and prints.
  // No provisioning logic lives here, and no second way to write a root exists.
  // GENESIS-AUTHORSHIP-MIGRATION-PRODUCTION-WIRING-1A. The ONE production path
  // to migrate a legacy authorship key into the governed generation store.
  // `preview` is read-only and emits the exact sealed preview the sovereign
  // authorizes; `execute` runs the governed executor, which binds the preview,
  // the sovereign consent envelope, and the executing repository/subject before
  // any write. The generic phrase-only writer is unreachable from here.
  if (genesisSub === "migrate-key") {
    const demaHome = resolveDemaHome();
    const executingBinding = await readExecutingRepositoryBinding({
      runGit: realGitRunner,
    });
    const executingRepository = repositoryIdentityFromBinding(executingBinding);
    // The target estate is OBSERVED at this boundary — realpath/dev/ino of
    // the resolved governed home — never accepted from a caller flag.
    // DIRECTORY_IDENTITY != NODE_IDENTITY: node_id stays sovereign-declared.
    const observeTargetEstate = () => captureDirectoryIdentity(demaHome);
    if (genesisAction === "preview") {
      let targetEstate;
      try {
        targetEstate = observeTargetEstate();
      } catch {
        console.error("Refused: target_estate_unverifiable — the governed home's directory identity could not be independently observed");
        process.exit(1);
      }
      const pv = await buildAuthorshipMigrationPreview({
        demaHome,
        nodeId: argValue(argv, "--node-id") ?? "",
        nonce: argValue(argv, "--nonce") ?? "",
        expiresAt: argValue(argv, "--expires-at") ?? "",
        repository: executingRepository ?? "",
        now: new Date().toISOString(),
        targetEstate,
      });
      const previewOutPath = argValue(argv, "--out");
      if (pv.ok && previewOutPath) {
        // stdout stays the presentation wrapper; the artifact is the inner
        // sealed preview — exactly the schema `execute` consumes.
        // PRESENTATION != AUTHORITY_ARTIFACT.
        const w = writeArtifactExclusive(previewOutPath, pv.preview);
        if (!w.written) {
          console.error(`Refused: ${w.reason}: ${previewOutPath}`);
          console.error("The canonical preview artifact is create-once; name a fresh path.");
          process.exit(1);
        }
      }
      console.log(JSON.stringify(pv, null, 2));
      process.exit(pv.ok ? 0 : 1);
    }
    if (genesisAction === "consent") {
      // The sovereign's authorization artifact, built by the ONE kernel
      // builder and bound to the exact sealed preview by hash + nonce. The
      // CLI knows the required phrase but never supplies or defaults it —
      // PHRASE_KNOWN_BY_SYSTEM != PHRASE_PRESENTED_BY_SOVEREIGN.
      const previewFile = readCliJson(argValue(argv, "--preview"));
      const consentOutPath = argValue(argv, "--out");
      if (previewFile.error || !consentOutPath) {
        console.error(
          "Refused: consent requires --preview <preview.json> and --out <envelope.json>",
        );
        process.exit(1);
      }
      const phrase = argValue(argv, "--consent");
      if (typeof phrase === "string" && phrase.length > 0 && phrase !== KEY_MIGRATE_CONSENT_PHRASE) {
        // Same law, same vocabulary as the executor: a wrong phrase is not
        // consent. The required phrase is deliberately not echoed here.
        console.error("Refused: consent_required — the supplied phrase is not the exact sovereign phrase");
        process.exit(1);
      }
      const consentEnv = buildAuthorshipMigrationConsentEnvelope({
        preview: previewFile.parsed,
        consent: phrase,
        now: new Date().toISOString(),
      });
      if (!consentEnv.ok) {
        console.error(`Refused: ${consentEnv.reason}`);
        process.exit(1);
      }
      const w = writeArtifactExclusive(consentOutPath, consentEnv.envelope);
      if (!w.written) {
        console.error(`Refused: ${w.reason}: ${consentOutPath}`);
        process.exit(1);
      }
      console.log(JSON.stringify({
        ok: true,
        out_path: consentOutPath,
        preview_hash: consentEnv.envelope.preview_hash,
        nonce: consentEnv.envelope.nonce,
        expires_at: consentEnv.envelope.expires_at,
      }, null, 2));
      process.exit(0);
    }
    if (genesisAction === "execute") {
      const preview = readCliJson(argValue(argv, "--preview"));
      const consentEnvelope = readCliJson(argValue(argv, "--consent-envelope"));
      if (preview.error || consentEnvelope.error) {
        console.error("Refused: --preview and --consent-envelope must each name a readable JSON file");
        console.error("The sovereign authorizes an exact sealed preview; the phrase alone cannot.");
        process.exit(1);
      }
      const result = await executeGenesisAuthorshipMigration({
        preview: preview.parsed,
        consentEnvelope: consentEnvelope.parsed,
        demaHome,
        now: new Date().toISOString(),
        executingRepository,
        // The estate is re-observed INSIDE the executor's gate via this
        // injected observer — the preview names the estate, execution proves
        // it. The old self-feed (subjectNodeId from the preview itself) is
        // closed: x == x certified nothing.
        observeTargetEstate,
      });
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.migrated ? 0 : 1);
    }
    console.error("Usage: dema genesis migrate-key preview --node-id <id> --nonce <n> --expires-at <iso> [--out <preview.json>] | consent --preview <preview.json> --consent \"<PHRASE>\" --out <envelope.json> | execute --preview <preview.json> --consent-envelope <envelope.json>");
    process.exit(1);
  }

  if (genesisSub === "root" && genesisAction === "establish") {
    const result = await establishNodeGenesisRoot({
      demaHome: resolveDemaHome(),
      nodeId: argValue(argv, "--node-id") ?? "",
      consent: argValue(argv, "--consent") ?? "",
      ceremonyId: argValue(argv, "--ceremony-id") ?? "",
      // A real human act happens at a real time. The clock is read HERE, at the
      // authority boundary, never inside the kernel.
      now: new Date().toISOString(),
      // The erasure law: the surviving out-of-home pin may veto a "fresh"
      // origin. Env is read HERE, at the boundary — the kernel stays pure.
      witnessPath: resolveWitnessPath(process.env),
    });
    if (wantJsonG) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.established) {
      console.log("Node Genesis Root Established");
      console.log("=".repeat(40));
      console.log(`  Node id:      ${result.node_id}`);
      console.log(`  Root key fp:  ${result.root_public_key_fingerprint}`);
      console.log(`  Ceremony id:  ${result.ceremony_id}`);
      console.log(`  Established:  ${result.established_at}`);
      console.log("");
      console.log("  This is where this Node's history begins. It is written once");
      console.log("  and cannot be changed by any runtime path.");
    } else if (result.reason === "consent_required") {
      console.error(
        `Consent required. Use: --consent "${ESTABLISH_ROOT_TRUST_CONSENT_PHRASE}"`,
      );
    } else if (result.reason === GENESIS_ROOT_REQUIRES_FRESH_NODE) {
      console.error(
        "Refused: a genesis root may only be established on a fresh Node, " +
          "before any canonical history or key rotation exists.",
      );
      for (const reason of result.blocked_by ?? []) console.error(`  - ${reason}`);
      console.error(
        "Recovering an already-historic rootless Node is a separate, unshipped act.",
      );
    } else if (result.reason === "node_id_required") {
      console.error("Node id required. Use: --node-id <id>");
    } else if (result.reason === "ceremony_id_required") {
      console.error("Ceremony id required. Use: --ceremony-id <id>");
    } else {
      console.error(`Genesis root not established: ${result.reason}`);
    }
    if (!result.established) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  if (genesisSub === "verify-node0") {
    const root = argValue(argv, "--root") || process.cwd();
    const lookbackYears = Number(argValue(argv, "--years") ?? "3");
    const inventory = await buildLocalAssetInventory({ root });
    const awareness = buildHomebaseAssetAwareness({ inventory });
    const git_evidence = await gatherGitTimeSpanEvidence({
      root,
      lookback_years: Number.isFinite(lookbackYears) ? lookbackYears : 3,
    });
    const canon_witnesses = gatherCanonWitnessMarkers({ root });
    const hardware_observation = await gatherNode0HardwareObservations();
    const report = buildNode0HistoricalContributionVerification({
      awareness,
      git_evidence,
      canon_witnesses,
      hardware_observation,
      lookback_years: Number.isFinite(lookbackYears) ? lookbackYears : 3,
    });
    console.log(
      wantJsonG
        ? JSON.stringify(report, null, 2)
        : formatNode0HistoricalContributionVerification(report),
    );
    process.exitCode = report.valid ? 0 : 1;
    process.exit(process.exitCode ?? 0);
  }
  console.error(
    "Usage: dema genesis composition blueprint [--json]\n" +
      "       dema genesis seal preview [--json]\n" +
      "       dema genesis root establish --node-id <id> --ceremony-id <id> --consent <phrase> [--json]\n" +
      "       dema genesis verify-node0 --root <path> [--years 3] [--json]",
  );
  process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}
