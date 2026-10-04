// C4D-TAIL-15 child: resume one real post-ledger closure transaction.
//
// Exit contract (consumed by the parent test):
//   0  exactly this process completed the owned tail
//   3  ownership arbitration fenced this process before any tail mutation
//   91 harness/configuration/unexpected failure
//
// No signal or arbitrary nonzero exit is ever translated into a fence.

import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { dirname } from "node:path";

import {
  buildClaimBoundConsentRegistry,
  buildRenameEffectAdapter,
  runTransactionalMechanicalClosure,
} from "../../packages/mission/src/corridor-closure-gatherer.js";
import { evaluateVerificationAdmission } from "../../packages/core/src/verification-admission.js";
import {
  runOwnedCorridorEvidenceTail,
  runOwnedCorridorWeld,
} from "../../apps/cli/src/commands/mission.js";

const [, , configPath, tag, readyPath, goPath, fencedPath] = process.argv;

function emit(report) {
  // Synchronous fd writes survive an immediate declared exit. Piped stdout plus
  // console.log/process.exit can discard the classification under load.
  writeFileSync(1, `${JSON.stringify(report)}\n`);
}

async function waitForPath(path, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (!existsSync(path)) {
    if (Date.now() > deadline) throw new Error(`tail_harness_timeout:${label}`);
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function writeDurableAtomic(path, content, tag) {
  const temporary = `${path}.${tag}.${process.pid}.tmp`;
  const fd = openSync(temporary, "wx", 0o600);
  try {
    writeSync(fd, content);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temporary, path);
  const dirFd = openSync(dirname(path), "r");
  try {
    fsyncSync(dirFd);
  } finally {
    closeSync(dirFd);
  }
}

function publishDurableFence(path, report) {
  // The winner must not proceed merely because open(2) made a pathname visible.
  // Publish the complete declaration atomically, fsync its directory, and only
  // then publish a second ready marker. Observing `.ready` therefore proves the
  // declaration itself completed its durability boundary.
  writeDurableAtomic(path, `${JSON.stringify(report)}\n`, tag);
  writeDurableAtomic(`${path}.ready`, "1\n", tag);
}

function verifyAdmission(missionId) {
  return ({ card }) => {
    const admission = evaluateVerificationAdmission({
      proposed_act: `corridor-closure:${missionId}`,
      verifier: "hash_equality",
      proposer: "corridor-closure-effect-adapter",
      certifier: "omega0-mechanical-closure-route",
      bindings: { expected_post_sha256: card.after_hash },
    });
    return {
      admitted: admission.self_verifiable === true,
      reason: admission.refusal_reason ?? null,
    };
  };
}

async function main() {
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  writeFileSync(readyPath, tag);
  await waitForPath(goPath, "go");

  const effect = buildRenameEffectAdapter(config.effectConfig);
  const mechanical = await runTransactionalMechanicalClosure({
    ...config.mechanicalArgs,
    effect,
  });
  if (!mechanical.ok) {
    const reason = mechanical.reason ?? "unknown_refusal";
    if (reason === "ownership_held" || reason === "stale_owner_fenced") {
      const report = { class: "FENCED", tag, reason };
      publishDurableFence(fencedPath, report);
      emit(report);
      process.exit(3);
    }
    throw new Error(`mechanical_resume_unexpected:${reason}`);
  }

  // Keep the winner alive until the rival has durably declared its ownership
  // refusal. Without this barrier, a fast winner could exit and the rival would
  // lawfully take over a dead predecessor, measuring succession rather than
  // simultaneous contention.
  await waitForPath(`${fencedPath}.ready`, "durably_fenced_loser");
  const fencedReport = JSON.parse(readFileSync(fencedPath, "utf8"));
  if (
    fencedReport?.class !== "FENCED" ||
    typeof fencedReport.tag !== "string" ||
    !["ownership_held", "stale_owner_fenced"].includes(fencedReport.reason)
  ) {
    throw new Error("durable_fence_declaration_invalid");
  }

  const {
    mechanicalArgs: { demaHome, claim, prepared, mission, lease, consent, anchorDir },
    corridor,
    atIso,
    now,
  } = config;

  const closure = await runOwnedCorridorWeld({
    mechanical,
    effect,
    nowIso: atIso,
    closureArgs: {
      contract: { mission_id: corridor.missionId },
      contract_hash: corridor.contractHash,
      journal: corridor.journal,
      mission,
      lease,
      consent,
      anchorDir,
      now,
      omega0Card: mechanical.omega0_card,
      transactionBinding: {
        transaction_id: claim.transaction_id,
        consent_claim_hash: claim.claim_hash,
        prepared_intent_hash: prepared.prepared_intent_hash,
      },
      verifyAdmission: verifyAdmission(corridor.missionId),
      consentRegistry: buildClaimBoundConsentRegistry({ demaHome, claim }),
    },
  });
  if (closure.state !== "COMPLETE" || !closure.ledger_head || !closure.ledger_length) {
    throw new Error(`corridor_tail_refused:${closure.terminal_outcome}`);
  }

  const tail = await runOwnedCorridorEvidenceTail({
    mechanical,
    home: demaHome,
    transactionId: claim.transaction_id,
    consentClaimHash: claim.claim_hash,
    preparedIntentHash: prepared.prepared_intent_hash,
    nowIso: atIso,
    closureResult: closure,
    contractHash: corridor.contractHash,
    journal: corridor.journal,
    buildTerminalEvent: (anchor) => ({
        state: "COMPLETE",
        at_iso: atIso,
        terminal_outcome: "COMPLETED_VERIFIED",
        requires_human: false,
        note: `C4D-TAIL-15 fixture · seal ${closure.omega0_card.seal_head} · ledger ${closure.ledger_head}`,
        next_command: `dema mission corridor status ${corridor.missionId}`,
        closure_transaction_id: claim.transaction_id,
        consent_claim_hash: claim.claim_hash,
        prepared_intent_hash: prepared.prepared_intent_hash,
        seal_head: closure.omega0_card.seal_head,
        ledger_head: closure.ledger_head,
        anchor_hash: anchor.anchor_hash,
    }),
  });
  if (!tail.ok) throw new Error(`owned_tail_refused:${tail.stage}:${tail.reason}`);

  emit({
    class: "WINNER",
    tag,
    receiptId: closure.ledger_head,
    anchorHash: tail.anchorRecord.anchor_hash,
    terminalHash: tail.terminalEvent.event.event_hash,
    phase: tail.resolvedPhase.state.phase,
  });
}

try {
  await main();
} catch (error) {
  writeFileSync(2, `C4D-TAIL-15 unexpected failure: ${error?.stack ?? error}\n`);
  process.exitCode = 91;
}
