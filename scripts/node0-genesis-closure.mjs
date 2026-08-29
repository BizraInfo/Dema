#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { canonicalizeJsonV1 } from "../packages/canon/src/canonical-json-v1.js";
import {
  MISSION_CONTRACT_GO_PHRASE,
  buildMissionState,
  checkpointMissionState,
  createMissionContract,
} from "../packages/core/src/mission-contract-state.js";
import { conductOneShotWorkerTurn } from "../packages/core/src/mission-runtime-0b.js";
import {
  EVENT_KINDS,
  genesisSupervisorState,
  step,
} from "../packages/core/src/mission-supervisor.js";
import { evaluateAgainstContract } from "../packages/core/src/node0-model-swap-invariance.js";
import { llmAdapterConsentPhraseFor } from "../packages/core/src/llm-adapter.js";
import { postGenesisExecution } from "../packages/core/src/node0-genesis-client.js";
import { buildModelBrokerPreview } from "../packages/models/src/model-broker-preview.js";

const execFile = promisify(execFileCallback);
const FATE_PHRASE = "FATE: NODE0-GENESIS-CLOSURE-LEASE-1A bounded sandbox result";
const SUBJECT = Object.freeze({ kind: "HUMAN_NODE", id: "bizra:human-node:v1:0" });
const AUTHORITY_CEILING = Object.freeze({
  localNode0Only: true,
  node1: false,
  node2: false,
  federation: false,
  publicNetworkRuntime: false,
  token: false,
  mint: false,
  economy: false,
  capabilityDefinitionDelta: 0,
  effectiveAuthorityDelta: 0,
});

const MISSION = Object.freeze({
  checkout_identity: Object.freeze({
    id: "node0-genesis-checkout-identity-1a",
    acceptance(observation) {
      return {
        required_output_keys: ["commit", "tree", "worktree_state", "explanation"],
        expected: {
          commit: observation.commit,
          tree: observation.tree,
          worktree_state: observation.worktree_state,
        },
      };
    },
    evidence(observation) {
      return [{
        instruction: "Report the exact checkout facts below and explain briefly why the identity is bounded.",
        required_output: { ...observation, explanation: "one non-empty sentence, maximum 400 characters" },
      }];
    },
  }),
  source_owners: Object.freeze({
    id: "node0-genesis-source-owners-1a",
    acceptance() {
      return { required_output_keys: ["owners"] };
    },
    evidence() {
      return [{
        instruction: "Select exactly three existing source owners most relevant to this Genesis loop. Return owners only; each row has path and reason.",
        required_output: {
          owners: [
            { path: "candidate path 1", reason: "brief reason" },
            { path: "candidate path 2", reason: "brief reason" },
            { path: "candidate path 3", reason: "brief reason" },
          ],
        },
        candidates: [
          "packages/core/src/mission-runtime-0b.js",
          "packages/core/src/node0-genesis-client.js",
          "packages/core/src/mission-supervisor.js",
          "packages/core/src/mission-worker-adapter.js",
          "packages/core/src/routed-llm-invocation.js",
          "packages/models/src/model-broker-preview.js",
        ],
      }];
    },
  }),
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function git(repo, ...args) {
  return (await execFile("git", ["-C", repo, "--no-pager", ...args], { encoding: "utf8" })).stdout.trim();
}

export async function observeDema(repo) {
  const path = resolve(repo);
  const [commit, tree, status] = await Promise.all([
    git(path, "rev-parse", "HEAD"),
    git(path, "rev-parse", "HEAD^{tree}"),
    git(path, "status", "--porcelain=v1", "--untracked-files=all"),
  ]);
  return Object.freeze({ commit, tree, worktree_state: status === "" ? "CLEAN" : "DIRTY" });
}

function makePlan({ missionKind, observation, modelId }) {
  const spec = MISSION[missionKind];
  if (!spec) throw new Error(`unsupported mission: ${missionKind}`);
  const acceptance = spec.acceptance(observation);
  const created = createMissionContract({
    consent: MISSION_CONTRACT_GO_PHRASE,
    fields: {
      mission_id: spec.id,
      purpose: `Run one bounded ${missionKind} Genesis mission`,
      scope: "configured local Node0 Genesis sandbox only",
      acceptance_contract: acceptance,
      acceptance_criteria: ["PAT proposal passes deterministic SAT and governed runtime observation"],
      prohibited_outcomes: ["source mutation", "public network", "federation", "economic effect"],
      authority_ceiling: "local_node0_only_zero_delta",
      iteration_budget: 1,
      completion_conditions: ["runtime returns a durable measured receipt"],
      escalation_rule: "fail closed and report",
      created_at_iso: "2026-08-29T00:00:00.000Z",
    },
  });
  let state = genesisSupervisorState(created);
  state = step(state, {
    kind: EVENT_KINDS.DISCOVERY_RECORDED,
    stage: "DISCOVER",
    hash: `sha256:${sha256(`${spec.id}:discover`)}`,
  }, { contract: created.contract }).state;
  const advanced = step(state, {
    kind: EVENT_KINDS.CONTRACT_FROZEN,
    stage: "CONTRACT",
    hash: `sha256:${sha256(`${created.contract_hash}:frozen`)}`,
  }, { contract: created.contract });
  state = advanced.state;
  const checkpoint = checkpointMissionState(buildMissionState({
    accepted_evidence: spec.evidence(observation),
    contract_hash: created.contract_hash,
    current_stage: state.stage,
    failed_attempts: [],
    iteration_used: state.iteration_used,
    open_blockers: [],
    receipt_head: state.receipt_head,
    state_seq: state.state_seq,
    worker_history: [],
  }));
  const broker = buildModelBrokerPreview({ registry: [{
    id: modelId,
    provider: "ollama",
    model_name: modelId,
    role: "pat_worker",
    size_class: "7B",
    locality: "local",
    allowed_tasks: ["planning"],
    max_concurrency: 1,
    context_limit: 8192,
    status: "active",
  }] });
  return { spec, acceptance, contract: created.contract, state, checkpoint, eligibleActions: advanced.eligible_actions, broker };
}

async function persistCheckpoint(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${canonicalizeJsonV1(value)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
}

export async function runGenesisMission({
  missionKind,
  observation,
  demaRepo,
  leaseSha256,
  modelId,
  modelFetch,
  gatewayFetch,
  gatewayBaseUrl = "http://127.0.0.1:7421",
  checkpointPath = null,
} = {}) {
  const measured = observation ?? await observeDema(demaRepo);
  const plan = makePlan({ missionKind, observation: measured, modelId });
  const pat = await conductOneShotWorkerTurn({
    state: plan.state,
    contract: plan.contract,
    checkpoint: plan.checkpoint,
    eligibleActions: plan.eligibleActions,
    broker: plan.broker,
    taskKind: "planning",
    requiredRole: "pat_worker",
    expectedModelId: modelId,
    invokeConsent: llmAdapterConsentPhraseFor(modelId),
    timeoutMs: 120_000,
    fetchImpl: modelFetch,
  });
  if (pat.status !== "PROPOSAL_ACCEPTED") {
    return Object.freeze({ ok: false, pat, sat: null, runtime: null, authority_delta: 0 });
  }
  const sat = evaluateAgainstContract(pat.event.output, plan.acceptance);
  if (sat.verdict !== "ACCEPT") {
    return Object.freeze({ ok: false, pat, sat, runtime: null, authority_delta: 0 });
  }
  const request = {
    schema: "bizra.node0.genesis_execution.v0.1",
    missionId: plan.spec.id,
    missionKind,
    leaseSha256,
    fatePhrase: FATE_PHRASE,
    subjectKind: SUBJECT.kind,
    subjectId: SUBJECT.id,
    patModelId: modelId,
    patEvidenceSha256: sha256(canonicalizeJsonV1(pat.invocation)),
    result: pat.event.output,
    authorityCeiling: AUTHORITY_CEILING,
  };
  const runtime = await postGenesisExecution({ baseUrl: gatewayBaseUrl, request, fetchImpl: gatewayFetch });
  const result = Object.freeze({ ok: runtime.ok, pat, sat, runtime, authority_delta: 0 });
  if (runtime.ok && checkpointPath) {
    await persistCheckpoint(checkpointPath, { schema: "bizra.dema.genesis_client_checkpoint.v0.1", request, result });
  }
  return result;
}

export async function recoverGenesisMission({ checkpointPath, gatewayFetch, gatewayBaseUrl = "http://127.0.0.1:7421" } = {}) {
  const checkpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
  const runtime = await postGenesisExecution({ baseUrl: gatewayBaseUrl, request: checkpoint.request, fetchImpl: gatewayFetch });
  return Object.freeze({ ok: runtime.ok, recovered_from_checkpoint: true, runtime, authority_delta: 0 });
}

function option(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
}

async function main() {
  const missionKind = option("--mission");
  const demaRepo = resolve(process.env.BIZRA_GENESIS_DEMA_REPO ?? process.cwd());
  const demaHome = resolve(process.env.DEMA_HOME ?? join(process.env.HOME ?? "/tmp", ".dema"));
  const spec = MISSION[missionKind];
  if (!spec) throw new Error("--mission must be checkout_identity or source_owners");
  const checkpointPath = join(demaHome, "genesis", "client", `${spec.id}.json`);
  const result = process.argv.includes("--recover")
    ? await recoverGenesisMission({ checkpointPath })
    : await runGenesisMission({
      missionKind,
      demaRepo,
      leaseSha256: process.env.BIZRA_GENESIS_LEASE_SHA256,
      modelId: process.env.BIZRA_GENESIS_MODEL_ID,
      checkpointPath,
    });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
