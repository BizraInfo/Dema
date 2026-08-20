#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { cmd_language } from "./commands/language.js";
import { cmd_journey } from "./commands/journey.js";
import { cmd_node_registry } from "./commands/node-registry.js";
import { cmd_project_status } from "./commands/project-status.js";
import { cmd_skill_growth_governor } from "./commands/skill-growth-governor.js";
import { cmd_genesis } from "./commands/genesis.js";
import { cmd_harness } from "./commands/harness.js";
import { cmd_bootstrap } from "./commands/bootstrap.js";
import { cmd_seed } from "./commands/seed.js";
import { cmd_state } from "./commands/state.js";
import { cmd_start } from "./commands/start.js";
import { cmd_scan } from "./commands/scan.js";
import { cmd_corpus } from "./commands/corpus.js";
import { cmd_mirror } from "./commands/mirror.js";
import { cmd_talk } from "./commands/talk.js";
import { cmd_setup } from "./commands/setup.js";
import { cmd_onboarding_lifecycle } from "./commands/onboarding-lifecycle.js";
import { cmd_explain } from "./commands/explain.js";
import { cmd_urp } from "./commands/urp.js";
import { cmd_steward } from "./commands/steward.js";
import { cmd_model_broker } from "./commands/model-broker.js";
import { cmd_think } from "./commands/think.js";
import { cmd_authorship } from "./commands/authorship.js";
import { cmd_proof } from "./commands/proof.js";
import { cmd_delivery } from "./commands/delivery.js";
import { cmd_foundation } from "./commands/foundation.js";
import { cmd_realm } from "./commands/realm.js";
import { cmd_mission } from "./commands/mission.js";
import { cmd_season } from "./commands/season.js";
import { cmd_recovery } from "./commands/recovery.js";
import { cmd_founder } from "./commands/founder.js";
import { cmd_voice } from "./commands/voice.js";
import { cmd_memory } from "./commands/memory.js";
import { cmd_codebase } from "./commands/codebase.js";
import { cmd_orchestrator } from "./commands/orchestrator.js";
import { cmd_first_run } from "./commands/first-run.js";
import { cmd_onboard } from "./commands/onboard.js";
import { cmd_preview_card } from "./commands/preview-card.js";
import { cmd_setup_check } from "./commands/setup-check.js";
import { cmd_uninstall } from "./commands/uninstall.js";
import { cmd_witness } from "./commands/witness.js";
import { cmd_attest } from "./commands/attest.js";
import { cmd_verify_grounded } from "./commands/verify-grounded.js";
import { cmd_assets } from "./commands/assets.js";
import { cmd_library } from "./commands/library.js";
import { cmd_stand } from "./commands/stand.js";
import { cmd_poi } from "./commands/poi.js";
import { cmd_away } from "./commands/away.js";
import { cmd_contribute } from "./commands/contribute.js";
import { cmd_demo } from "./commands/demo.js";
import { cmd_status, cmd_status_json } from "./commands/status.js";
import { cmd_profiles } from "./commands/profiles.js";
import { cmd_consent_card } from "./commands/consent-card.js";
import { cmd_mission_loop } from "./commands/mission-loop.js";
import { cmd_evidence_event } from "./commands/evidence-event.js";
import { cmd_craftsmanship_witness } from "./commands/craftsmanship-witness.js";
import { cmd_peak_self_loop } from "./commands/peak-self-loop.js";
import { cmd_master_craftsmanship } from "./commands/master-craftsmanship.js";
import { cmd_llm_router } from "./commands/llm-router.js";
import { cmd_process_mining } from "./commands/process-mining.js";
import { cmd_key_maker_check } from "./commands/key-maker-check.js";
import { cmd_llm_invoke } from "./commands/llm-invoke.js";
import { cmd_ask } from "./commands/ask.js";
import { cmd_today } from "./commands/today.js";
import { cmd_doctor } from "./commands/doctor.js";
import { cmd_dashboard } from "./commands/dashboard.js";
import { cmd_ambient } from "./commands/ambient.js";
import { cmd_ambient_json } from "./commands/ambient-json.js";
import { cmd_diagnostics } from "./commands/diagnostics.js";
import { cmd_consent } from "./commands/consent.js";
import { cmd_receipts } from "./commands/receipts.js";
import { cmd_models } from "./commands/models.js";
import { cmd_web } from "./commands/web.js";
import { cmd_monitors } from "./commands/monitors.js";
import { cmd_report } from "./commands/report.js";
import { cmd_network } from "./commands/network.js";
import { cmd_amana } from "./commands/amana.js";
import { cmd_diffusion } from "./commands/diffusion.js";
import { cmd_mcp } from "./commands/mcp.js";
import { cmd_datalake } from "./commands/datalake.js";
import { cmd_roadmap } from "./commands/roadmap.js";
import { cmd_eval } from "./commands/eval.js";
import { cmd_evidence } from "./commands/evidence.js";
import { cmd_ihsan } from "./commands/ihsan.js";
import { cmd_behavior } from "./commands/behavior.js";
import { cmd_design } from "./commands/design.js";
import { cmd_economy } from "./commands/economy.js";
import { cmd_agent_loop } from "./commands/agent-loop.js";
import { cmd_task } from "./commands/task.js";
import { cmd_sovereign } from "./commands/sovereign.js";
import { cmd_node0 } from "./commands/node0.js";
import { cmd_node0_index } from "./commands/node0-index.js";
import { cmd_canon } from "./commands/canon.js";
import { cmd_hardware } from "./commands/hardware.js";
import { cmd_adk } from "./commands/adk.js";
import { cmd_homebase, runHomebaseInvocation } from "./commands/homebase.js";
import { createNode0Adapter } from "../../../packages/node-adapter/src/node0-adapter.js";
import { readOperatorPreferredName } from "../../../packages/core/src/operator-profile.js";
import {
  screenProposal,
  signReceipt,
} from "../../../packages/covenant/src/covenant-gate.js";
// model-broker imports moved to commands/model-broker.js
// codebase imports moved to commands/codebase.js
// orchestrator imports moved to commands/orchestrator.js
// URP imports moved to commands/urp.js
import {
  formatBanner,
  gatherBannerInputs,
  probeGateway,
} from "../../../packages/core/src/banner.js";
import {
  buildOnboardingGuide,
  formatOnboardingGuide,
} from "../../../packages/core/src/onboarding.js";
import { runShell } from "../../../packages/core/src/shell.js";
import {
  buildCouncilSeatPatDispatchPreview,
  formatCouncilSeatPatDispatchResponse,
} from "../../../packages/adk/src/council-seat-pat-dispatch.js";
import { suggestCommands } from "../../../packages/core/src/command-suggester.js";
// buildExplainPreview/formatExplainPreview/getPerspective moved to commands/explain.js
import {
  shouldShowIntro,
  renderIntroLine,
  recordIntroSeen,
} from "../../../packages/core/src/intro-line.js";
import {
  renderHelpRoot,
  renderHelpTopic,
  renderHelpCommand,
  renderHelpFlat,
  renderHelpUnknown,
} from "../../../packages/core/src/help-topics.js";
// think imports moved to commands/think.js

const adapter = createNode0Adapter();

async function statusWithLocalIdentity() {
  const status = await adapter.status();
  if (status?.human) return status;
  const human = await readOperatorPreferredName();
  return human ? { ...status, human } : status;
}

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

const HELP = `Dema CLI

Usage:
  dema              Active kernel — banner + setup-or-status + next safe task
  dema chat         Interactive shell (same surface as the bare CLI)

Orientation:
  dema welcome      Show the first-run orientation
  dema onboard [--json]
                    Guided zero-technical onboarding path; preview-only
  dema explain [<concept>]
                    Plain-language definition of a BIZRA/Dema concept (28 known)
  dema setup        Create local Dema folders/profile skeleton
  dema setup-check  Verify install integrity (paths + sha256 hashes)
  dema uninstall [--dry-run]
                    Remove local Dema data; requires --consent with exact phrase
  dema stand [--json] [--drain less|same|more] [--blockers <abs.json>] [--receipt --consent "<phrase>"]
                    DEMA-STAND-1A Morning Standing card: git + gate-log
                    metadata composed into FDE lens buckets, exactly ONE next
                    action, declared drain, stale-proof + orbit warnings.
                    Read-only compose; receipt writes only under
                    DEMA_HOME/stand/receipts with the exact consent phrase.
                    No network, no model call, no mint, no live autonomy.
  dema stand chain [--json]
                    DEMA-STEWARD-CHAIN-1A steward-chain verifier: re-verifies
                    every standing receipt on disk, checks consecutive UTC
                    days, and reports day-N-of-7 / broken / complete honestly.
                    Days cannot be fabricated; read-only.
  dema poi compression record [--json] [--receipt --consent "<phrase>"]
                    POI-TIME-COMPRESSION-1A candidate receipt: operator-declared
                    baseline estimate vs actual proof-loop duration under
                    required quality gates. A failed gate refuses the receipt;
                    baseline stays a declared assumption; observation-time is a
                    separate clock. Candidate only — no verified impact, no mint.
                    Receipt writes only under DEMA_HOME/poi/compression/receipts
                    with the exact consent phrase.
  dema poi compression show [--json]
                    List recorded time-compression candidate receipts (read-only)
  dema poi compression verify [--json]
                    Re-verify every recorded candidate receipt; fails closed
  dema away draft [--intent-file <intent.json>] [--now <iso>] [--contract-id-prefix <prefix>] [--json]
                    AWAY-CONTRACT-CLI-DRAFT-1A: compile an explicit JSON intent
                    into a draft Away Contract body (ADR-043 ladder). Draft
                    only — validates shape via the pure compiler; no receipt,
                    no DEMA_HOME write, no model call, no network, no Away
                    Mode start. Act-time is the declared --now value.
  dema away verify [--contract-file <contract.json>] [--validation-file <validation.json>] [--now <iso>] [--json]
                    AWAY-CONTRACT-CLI-VERIFY-1A: body-bound check that the
                    contract still matches its validation_result (whole
                    normalized body + hash, launder catches). Read-only;
                    verify never infers a validation_result, writes nothing,
                    starts nothing. Act-time is the declared --now value.
  dema away receipt [--contract-file <contract.json>] [--validation-file <validation.json>] [--now <iso>] [--consent "<phrase>"] [--dema-home <path>] [--json]
                    AWAY-CONTRACT-CLI-RECEIPT-1A: record a verified Away
                    Contract as a receipt. Verify-before-write; exact phrase
                    "GO: write away-contract receipt <id> <hash12>" required;
                    single atomic write under the DISCLOSED resolved home
                    (--dema-home > DEMA_HOME > ~/.dema; printed as
                    resolved_dema_home on every path, no overwrite).
                    Recording is not starting — no Away Mode.
  dema away preview [--contract-file <contract.json>] [--validation-file <validation.json>] [--receipt-file <receipt.json>] [--now <iso>] [--json]
                    ABSENCE-STEWARD readiness report: derives
                    NOT_CONFIGURED / CONTRACT_VERIFIED / PREVIEW_READY /
                    EXPIRED / REFUSED from the trio. Report only — exits
                    after reporting; PREVIEW_READY grants nothing; the
                    start surface does not exist and stays refused.
  dema away review [--contract-file <contract.json>] [--validation-file <validation.json>] [--receipt-file <receipt.json>] [--left <iso>] [--returned <iso>] [--json]
                    ABSENCE-STEWARD return review: post-absence report over
                    a declared window. Opens "Nothing is hidden."; every
                    claim is receipt-backed or NO_RECEIPT; verdicts limited
                    to NO_ABSENCE_RECORDED / REVIEW_BLOCKED /
                    READY_BUT_NOT_STARTED / EXPIRED_BEFORE_START. Report
                    only — nothing executed, nothing starts.
  dema away queue draft [--item-file <queue-item.json>] [--now <iso>] [--json]
                    ABSENCE-STEWARD queue proposal draft: validates ONE
                    proposal item shape (statuses capped at the design
                    five; consent-ish fields and never-executable classes
                    reject). Validation only — no queue stored, no
                    approval, no execution, no receipt, nothing starts.
  dema witness [--dry-run] [--json]
                    Node0 self-witness receipt; requires --consent to save
  dema witness verify [--file <path>] [--json]
                    Verify a witness receipt (latest or by path)
  dema mission run health [--dry-run] [--json]
                    Node0 health snapshot mission; requires --consent to save
  dema season save --season <id> --mission <id> --phase <PHASE> --next <ACTION> --repo-commit <sha40> --repo-tree <sha40> [--step <s>]... [--must-not-repeat <s>]... [--pending-consent none|<phrase>::<scope>]... [--from <state.json>] [--dema-home <path>] [--json]
                    Durably persist ONE bounded season checkpoint under DEMA_HOME:
                    content-addressed state + save receipt + atomically replaced HEAD.
  dema season status [--season <id>] [--dema-home <path>] [--json]
                    Verify and report the authoritative checkpoint (read-only; typed EMPTY when none)
  dema season resume [--season <id>] [--repo-commit <sha40>] [--repo-tree <sha40>] [--dema-home <path>] [--json]
                    Reconstruct the continuation from stored bytes alone — no chat history,
                    no execution, pending consent preserved as pending
  dema mission verify <path> [--json]
                    Verify a mission receipt
  dema mission pulse <file> --claim ... --task ... --boundary ... [--json]
                    PREVIEW_ONLY local mission pulse over one named file (read-only);
                    --receipt --consent writes a preview receipt; no model/daemon/network
  dema mission review <receipt-path> [--json]
                    PREVIEW_ONLY return-review of a mission-pulse receipt (read-only):
                    proven / not-proven / one next safe action; no model/daemon/network
  dema mission shelf [--json]
                    PREVIEW_ONLY local URP shelf: index all mission-pulse receipts under
                    $DEMA_HOME into a queryable catalog (read-only); nothing published/federated
  dema mission compact [--json]
                    PREVIEW_ONLY receipt-shelf compaction (read-only): compact PROOF not prose into a
                    hash-bound state — keep/drop/no-longer-claim/one-next-action; nothing live
  dema mission corridor start [--id <id>] [--objective "<text>"] [--base-sha <sha40>] [--time-budget-hours <h>] [--repair-budget <n>] [--permitted <csv>] [--stop-conditions <csv>] [--now <iso>] [--dema-home <path>] --nonce <n> --expires <iso> [--created-at <iso>] [--consent "<phrase>" --consent-context <hash>] [--json]
                    PREVIEW_ONLY persistent mission control plane: seal a corridor contract and open a
                    hash-chained journal under $DEMA_HOME/missions/<id>. Root-bound two-step consent:
                    first run (with --nonce/--expires) prints the consent card + created_at_iso;
                    re-run with --created-at, --consent "GO: start mission corridor <id>" and
                    --consent-context <hash> — a phrase alone is never authority; control plane
                    only — no worker, no daemon, nothing runs
  dema mission corridor status <id> [--now <iso>] [--dema-home <path>] [--json]
                    Derive corridor state, lease, repair budget and resume point purely from
                    contract+journal on disk (read-only); tampered journals fail closed
  dema mission corridor resume <id> [--now <iso>] [--dema-home <path>] [--json]
                    Reconstruct the exact resume point (branch / head SHA / failing gate / next
                    command) from disk alone after any session loss (read-only)
  dema mission corridor stop <id> [--note "<why>"] [--now <iso>] [--dema-home <path>] --nonce <n> --expires <iso> [--consent "<phrase>" --consent-context <hash>] [--json]
                    Append the terminal STOPPED event (kill switch). Root-bound two-step consent
                    (consent card, then --consent "GO: stop mission corridor <id>" +
                    --consent-context <hash>); journal stays append-only
  dema founder impact scope <manifest> [--json]
                    LOCAL_ONLY dry-run: gather the declared bounded source set (read-only) and
                    preview the candidate founder-impact receipt; writes nothing; no model/network/mint
  dema founder impact run <manifest> --consent "GO: dema founder impact loop 0a" [--json]
                    LOCAL_ONLY: build + verify a candidate founder-impact receipt and, only under the
                    exact consent phrase, atomically write it under $DEMA_HOME/founder-impact; mint_allowed false
  dema founder impact verify <receipt> [--json]
                    LOCAL_ONLY read-only re-derivation of a founder-impact receipt; no model/network/mint
  dema authorship key init [--json]
                    Generate and persist Ed25519 keypair (requires --consent)
  dema authorship key migrate [--json]
                    One-time explicit migration of a legacy flat keypair into the
                    immutable generation store + atomic active pointer (requires --consent)
  dema authorship key rotate [--json] [--envelope <path>] [--dema-home <path>]
                    Retire the active generation + install a replacement under the
                    active-pointer model (requires --consent + ceremony envelope)
                    Mint the envelope first with:
                      node scripts/node0-rotation-consent-envelope.mjs
                    It is single-use, bound to one DEMA_HOME, and expires.
  dema authorship sign <artifact-path> [--json]
                    Sign a local artifact (requires --consent)
  dema authorship latest [--json]
                    Show the most recent authorship receipt (read-only)
  dema authorship closeout [--json]
                    Closeout summary: discover + verify latest receipt
  dema authorship verify <receipt.json> | --latest [--json]
                    Verify an Ed25519-signed authorship receipt (by path or latest)
  dema authorship demo [--json]
                    Generate ephemeral keypair, sign, verify (no disk write)

Foundation:
  dema foundation create [--consent <phrase>] [--json] [--dry-run]
                    Consent-gated create of the local node foundation under DEMA_HOME · exact-phrase write · SKIP for ephemeral · changes no existing command
Proof:
  dema proof passport [--json]
                    Generate portable proof passport from local receipts
  dema proof passport verify <passport.json> [--deep] [--receipts-dir <dir>] [--json]
                    Verify a proof passport. Default: envelope only (hash + structure
                    + boundary). With --deep: also re-verifies each referenced
                    authorship receipt file against passport metadata.

Economy:
  dema economy poi-mint-preview --impact-receipt <path> [--json]
                    Simulate BZR-C/BZR-I mint eligibility from a verified PoI
                    receipt-shaped JSON file. ECONOMY_SIMULATION_ONLY: no
                    wallet, no sale, no live token mint.

Genesis:
  dema genesis composition blueprint [--json]
                    Preview the NODE0-OSTREE-1A delivery blueprint around the
                    signed Node0 composition manifest: management Body of
                    Knowledge, DevOps operating model, CI/CD gate ladder,
                    performance model, and QA thresholds. Read-only. No
                    libostree, no daemon, no federation, no deploy surface,
                    no receipt mint, no CI workflow mutation.
  dema genesis seal preview [--json]
                    Dry-run preview of the Block0 signing ceremony from
                    read-only readiness + provenance preflight. Plans the 12
                    prerequisite slots (11 operator-signed, poi_rule verifiable)
                    without reading the private key, producing a signature, or
                    sealing Block0. Preview only.
  dema genesis verify-node0 [--years 3] [--json] [--root <path>]
                    Pre-token Node0 historical contribution verification:
                    metadata-only asset awareness + git time-span + canon witness
                    markers + benefit/risk/eligibility previews. No content read,
                    no token mint, no URP submission.

Delivery:
  dema delivery policy [--json]
                    Machine-readable delivery/DevOps/QA gate manifest (policy_only).
  dema delivery status [--json]
                    Annotate the policy with which gate commands are wired in package.json.

URP:
  dema urp index --passport <passport.json> [--receipts-dir <dir>] [--json]
                    Build + persist a local content-addressed URP index from a
                    verified proof passport. LOCAL_INDEX_ONLY · MARKED_LOCAL_ONLY.
                    No share, no mint, no PoI, no federation, no network.
  dema urp list [--json]
                    Enumerate locally-persisted URP indexes under
                    $DEMA_HOME/urp/indexes/, verifying filename↔hash parity
                    per entry. Read-only. Exit 1 only on detected corruption.
  dema urp verify <index.json> [--json]
                    Verify a single local index file by path: schema +
                    body-hash recompute + filename↔hash parity + forbidden-
                    field check. Read-only. Exit 0 on VERIFIED, 1 on FAILED.
  dema urp choose verify <choose-receipt.json> [--json]
                    UX-4.1C-ter verify a single persisted choose receipt by
                    path: schema + chosen:true + decision + consent_verified +
                    forbidden-field scan + body-hash recompute + filename↔hash
                    parity. Exit 0 on VERIFIED, 1 on FAILED.
  dema urp choose list [--json]
                    UX-4.1C+ list persisted choose receipts under
                    $DEMA_HOME/urp/choices/. Filename↔hash + body-hash
                    integrity per entry. Exit 1 only on detected corruption.
  dema urp choose <index.json> --decision MARK_SHAREABLE|MARK_LOCAL_ONLY
                              --consent "<exact phrase>" [--json]
  dema urp launch-5sat --consent "LAUNCH NODE0 URP WITH 5 SAT ONLY AND LOCK AGAINST PAT/DEMA/MOMO" [--json]
                    URP-5SAT-1A (Node0 only): Launch BIZRA URP with *only* the Node0 5 SAT
                    (Guardian/Reasoner/Builder/Critic/Archivist from council). Declares
                    URP declared active state with locked:true and manipulators_blocked.
                    The 5 SAT cannot be changed without consent by PAT or Dema or Momo.
                    Writes content-addressed launch receipt. Exact consent required.
                    [PROTOTYPE] — declaration/lock only. No runtime URP. Local face.
                    LOCAL ONLY — no federation, no mint.
  dema urp node1-5sat-preview --consent "DECLARE NODE1 5 SAT VIA UNIVERSAL POOL" [--json]
                    Node1 5 SAT preview declaration (connects to BIZRA universal
                    resource pool). Declares new 5 SAT for Node1. [PREVIEW] only.
                    Exact consent required. Writes preview receipt.
                    LOCAL ONLY — no federation, no mint.
                    UX-4.1C operator choose CLI. Reads a verified URP local
                    index, builds a kernel envelope, persists it to
                    $DEMA_HOME/urp/choices/choose-<sha256>.json (mode 0o600,
                    content-addressed, append-only). Decision MARK_SHAREABLE
                    requires consent "MARK URP ENTRY SHAREABLE";
                    MARK_LOCAL_ONLY requires "MARK URP ENTRY LOCAL-ONLY".
                    LOCAL ONLY — no network, no federation, no mint.

Node0 Mumu closed loop (N0-MUMU-CLI-1/2, read-only face):
  dema node0 mumu status [--json] [--out <dir>]
                    Report the Mumu closed-loop state: whether a receipt chain
                    exists under artifacts/node0/mumu, its receipt count, and the
                    GENESIS single-node network-mode invariants. Read-only; never
                    runs the loop (that stays npm run node0). No mutation, no
                    network, no mint.
  dema node0 mumu verify [--json] [--out <dir>]
                    Replay-verify the existing Mumu receipt chain (recompute
                    hashes, check the prev-link chain, inventory integrity,
                    required artifacts, boundary flags). Verdict VERIFIED /
                    TAMPERED / ABSENT. Read-only. Exit 1 on TAMPERED or ABSENT.
  dema node0 mumu consent [--json] [--out <dir>]
                    Read the pending consent-request artifact (if any) and show
                    the exact phrase for the governed loop re-run. Read-only.
  dema node0 mumu journey [--json] [--out <dir>] [--operator <name>]
                    Closed-loop operator journey for Mumu: stage INACTIVE /
                    AWAITING_CONSENT / ACTIVE / TAMPERED with next command.
                    Governed runtime stays npm run node0; Dema is the face.

BIZRA ADK (BIZRA-ADK-AGENT-CONTRACT-1A, define/validate/preview only):
  dema adk agent validate <contract.json> [--json]
                    Refuse agent contracts missing scope, consent/proof/receipt
                    policies, what_this_does_not_prove, or stop_by_default.
                    No execution, network, keys, signing, or federation.
  dema adk agent template <pat-engineer|sat-verifier|...> [--json]
                    Emit a PAT or SAT agent contract template (local-only).
  dema adk agent receipt-preview <contract.json> [--json]
                    Preview receipt shape for a validated agent contract.
  dema adk harness run [<contract.json>] [--json]
                    Run adversarial negative tests (built-in suite) or deep
                    harness on one contract. Read-only; no agent execution.

Local asset awareness:
  dema node0-index --root <path> [--hash-content --consent "<phrase>"] [--json]
                    DEMA-NODE0-SPACE-INDEX-1A metadata-only Node0 onboarding
                    census. Prints the exact hash-consent phrase for optional
                    content hashing. Checkpoints write only under
                    DEMA_HOME/node0-index/checkpoints. No dedup apply, move,
                    delete, network, model, mint, wallet, SAT, or federation.
  dema assets scan [--json] [--root <path>]
                    DEMA-HOMEBASE-ASSET-AWARENESS-1A metadata-only homebase
                    asset awareness. Scans declared root (default ~/Downloads or
                    DEMA_LOCAL_ASSET_ROOT) for metadata only — clusters, hidden-
                    gem candidates, monetization candidates, risk flags. Also writes
                    inventory artifact under DEMA_HOME/realm/local-assets/
                    inventory-v0.1.json (mode 0600). No content reads, no symlink
                    following, no network, no upload, no mutation inside scanned root.
  dema assets shareability [--json] [--root <path>]
                    DEMA-HOMEBASE-SHAREABILITY-1A metadata-only shareability
                    analysis. Classifies clusters into shareable, content-consent,
                    blocked, and URP-later-preview buckets. No content reads, no
                    network, no upload, no URP submission, no token action.
  dema contribute preview [--json] [--root <path>] [--years 3]
                    URP-CONTRIBUTION-BENEFIT-PREVIEW-1A pre-token benefit
                    preview. Composes asset awareness, historical verification,
                    and shareability into eligibility bands and benefit classes.
                    No token mint, no wallet, no URP submission, no upload, no
                    valuation guarantee.
  dema contribute receipt-plan [--json] [--root <path>] [--years 3]
                    POI-RECEIPT-ELIGIBILITY-1A pre-token proof-plan preview.
                    Composes benefit preview into receipt/evidence/witness/SAT
                    requirements. No PoI mint, no URP submission, no upload, no
                    wallet, no SAT settlement.
  dema contribute receipt-draft [--json] [--root <path>] [--years 3]
                    POI-RECEIPT-DRAFT-1A unsigned receipt draft preview.
                    Structures receipt-plan into local evidence slots. No sign,
                    no seal, no PoI mint, no URP submission, no wallet.
  dema contribute receipt-seal-preview [--json] [--root <path>] [--years 3]
                    POI-RECEIPT-SEAL-PREVIEW-1A seal readiness preview.
                    Lists blockers, gates, and consent phrase for unsigned
                    draft. No seal, no sign, no PoI mint, no URP submission.

Demo:
  dema demo node0-value-loop [--json]
                    NODE0-KILLER-DEMO-VALUE-LOOP-CLI-1A preview envelope:
                    scan modes → unstructured awareness → multi-device → Node
                    Space ontology. Metadata-first; plan-only organization and
                    receipts. No content read, OCR, network, upload, wallet,
                    token mint, URP, or Node0 activation.
  dema demo node0-value-loop convergence [--json]
                    NODE0-KILLER-DEMO-VALUE-LOOP-PROOF-CONVERGENCE-1A +
                    NODE0-PROOF-SNAPSHOT-ATTACHMENT-1A compose preview:
                    killer-demo CLI + four-rail Proof-of-Truth Convergence +
                    gathered proof:truth snapshot + SNR/RSI framing + proactive
                    ultra-micro self-loop declarations. Honest READY_LOCAL or
                    BLOCKED verdict; advisory CI rails UNKNOWN unless
                    verified CI evidence attestation. Preview-only; not autonomous runtime,
                    agent RL, or live HHMM engine.

Dema Realm (UX-1A, UX-1B):
  dema realm [--json] [--no-color] [--debug]
                    Wake Node0. 7-step boot sequence + BIZRA NODE0 · DEMA HOME
                    frame + 5 menu placeholders. Truth-labeled (DECLARED for
                    surfaces with no runtime yet). Read-only. No mutation, no
                    network. Menu dispatch is preview-only in v0 (UX-2A wires it).
  dema realm board [--json] [--no-color]
                    The 6-stage BIZRA lifecycle quest board: SEED · PREFLIGHT ·
                    FORGE · VERIFY · CLOSEOUT · ARCHIVE. Reads operator-curated
                    DEMA_HOME/realm/quest-board.json if present, else uses
                    built-in default reflecting the actual session ledger. Per-
                    quest status (DONE/ACTIVE/NEXT/READY/BLOCKED) honestly
                    labeled. Read-only.
  dema realm status [--json] [--no-color]
                    UX-2A Live Status (heartbeat). Aggregates identity status,
                    authorship-receipts count, URP-indexes count, checkpoint
                    present/label, timeline events count + latest event.
                    Read-only · pure aggregation · 10-flag false boundary.
  dema realm world-map [--json] [--no-color]
                    B1A Local Asset Awareness world map. Reads only
                    DEMA_HOME/realm/local-assets/inventory-v0.1.json and
                    renders category clusters, denied/truncated counters, and
                    next safe action. Read-only · no scan · no mutation.
  dema realm asset-graph [--json] [--no-color]
                    HOMEBASE-ASSET-GRAPH-1A metadata graph. Composes homebase
                    affordances with the read-only world-map inventory clusters
                    (category → affordance hints). No scan · no content · no
                    network · no mutation.
  dema datalake dual-loop-preview [--json] [--no-color]
                    DATALAKE-DUAL-LOOP-PREVIEW-1A reference preview. Composes
                    the Dema face proof spine with Data Lake body expectation
                    stages (ADR-030 alignment spine). Reference-only · no sync
                    · no mutation · no network · no cross-repo write.
  dema realm council [--json] [--no-color]
                    UX-1D Council Chamber: 5 declared council profiles —
                    Guardian (boundary/consent/risk), Reasoner (SAPE/graph
                    thinking), Builder (implementation/tests), Critic (self-
                    review/red-team), Archivist (receipts/memory/truth).
                    Profiles are DECLARED, NOT runtime-backed. Read-only.
  dema realm checkpoint [--json] [--no-color]
                    Checkpoint Journal v0 — where you stopped, what resumes.
                    Reads DEMA_HOME/realm/last-checkpoint.json + optional
                    DEMA_HOME/realm/timeline.json. Honest CHECKPOINT_ABSENT
                    state when no file. Read-only.
  dema realm checkpoint save --label "<text>"
                              [--stage <SEED|PREFLIGHT|FORGE|VERIFY|CLOSEOUT|ARCHIVE>]
                              [--next-gear <text>] [--resume "<cmd>"]
                              [--timeline-label <text>] [--json]
                    UX-2B persistence writer. Overwrites
                    DEMA_HOME/realm/last-checkpoint.json (atomic, mode 0o600)
                    AND appends one event to DEMA_HOME/realm/timeline.json
                    (append-only). Operator memory aid; no consent required.
                    Boundary honestly declares file_write_performed:true and
                    mutation_performed:true.

Dema Recovery Mission (DEMA-RECOVERY-MISSION-GATHERER-1B):
  dema recovery preview <--root abs --mission "objective" --consent "phrase">
                    [--exclude <abs>]... [--max-files <n>] [--json]
                    Read-only Recovery Mission candidate PREVIEW: walks --root
                    for file METADATA ONLY (no content read), then
                    reconstructs up to 7 ranked candidates + chronology +
                    not_accessed_report via the gatherer kernel over the
                    reused DEMA-RECOVERY-MISSION-ENGINE-1A helper. No
                    mutation, no auto-selection — human revival is a separate
                    governed step, not in this slice.

Covenant Gate (v0.1 PROTOTYPE — per Omnidirectional Audit):
  dema covenant screen <proposal.json> [--json]
                    Run the deterministic screening engine on a project proposal.
                    Emits GraduationDecision with screening results, structured
                    Thought Packets, and explicit proof_gap. [PROTOTYPE] only.
                    LOCAL ONLY. No runtime, no claims, no network.
  dema covenant consent <decision.json> --typed-go "GO: SIGN COVENANT RECEIPT <decision_id>" [--json]
                    Emit a signed consent receipt. Requires exact decision-bound
                    micro-consent string. Produces demo receipt with payload + signature.
                    [PROTOTYPE] (HMAC demo only; replace with Ed25519 before use).
                    Does not execute any external action.

Readiness:
  dema status       Show human-readable Node0 status
  dema status:json  Show machine-readable status
  dema today        Record a local continuity tick + memory summary
  dema doctor       Validate readiness and consent gate
  dema homebase     Technical homebase preview (operator surface) [--json]
  dema dashboard    Open homebase dashboard in browser [--json for path only]

Preview planning:
  dema ambient      Show Ambient Sovereign Execution boundary (preview-only)
  dema ambient:json Show the ambient boundary as schema-tagged JSON
  dema diagnostics plan [--json]
                    Preview self-diagnostics harness; does not run checks
  dema consent plan [--json] "<intent>"
                    Preview a micro-consent scope; does not approve or execute
  dema mission draft [--json] "<intent>"
                    Preview Intent -> MissionDraft -> ConsentPlan
  dema mission propose [--consent "GO: Node0 bounded diagnostic activation only"]
                    Preview ARTIFACT-011 readiness; does not execute runtime
  dema model-broker route --task <kind> [--required-role <role>]
                          [--no-local-only] [--allow-unknown] [--max-size <class>]
                          [--registry-stdin | --use-local-registry | --registry-file <abs-path>]
                          [--save-receipt --consent "GO: save local model route receipt"]
                          [--invoke --prompt "<text>"
                                    --invoke-consent "GO: invoke local LLM at <selected_model_id>"
                                    [--timeout-ms <n>]
                                    [--save-invocation-result
                                     --save-invocation-consent "GO: save local model invocation result"]]
                          [--pretty]
                    Route a task through the local model broker preview;
                    emits a bizra.dema.local_model_route_receipt.v0.1 JSON to stdout.
                    Default registry is DEFAULT_SAMPLE_REGISTRY (placeholders only -> routes nothing).
                    --save-receipt (with exact --consent) persists the route receipt to
                    $DEMA_HOME/receipts/route-<sha256>.json (atomic; NOT canonical mint).
                    --invoke runs the routed local-LLM invocation through the existing adapter
                    (localhost-only, model-whitelist, prompt-length-bounded, exact-consent).
                    --invoke REQUIRES --save-receipt (route durability before invocation).
                    --invoke REQUIRES --prompt and --invoke-consent. In invoke mode, stdout
                    emits a bizra.dema.local_model_routed_invocation_result.v0.1 envelope
                    instead of the bare route receipt.
                    --save-invocation-result (with exact --save-invocation-consent) persists
                    the envelope to $DEMA_HOME/receipts/invocation-<sha256>.json (atomic;
                    preview-grade; NOT canonical chain-bound mint). Saves both success and
                    failure envelopes for audit. Requires --invoke (nothing to save without
                    an invocation envelope).
                    Does NOT call remote endpoints. NO PAT/SAT swarm. NO URP. NO token/economy.
  dema model-broker verify-invocation
                          [--invocation-result-file <abs-path> | --latest]
                          [--save-verification-result
                           --save-verification-consent "GO: save local model invocation verification"]
                          [--pretty]
                    Deterministic invariant checker for a saved routed invocation envelope.
                    Reads a saved invocation-<sha256>.json file (--invocation-result-file abs path,
                    or --latest reads newest from $DEMA_HOME/receipts/) and emits a
                    bizra.dema.local_model_routed_invocation_verification.v0.1 JSON envelope
                    with verdict (compliant/non_compliant), 17 invariant probes, evidence quality,
                    self-critique, warnings, and a canonical next_step recommendation.
                    --save-verification-result (with exact --save-verification-consent) persists
                    the verification envelope to $DEMA_HOME/receipts/verification-<sha256>.json
                    (atomic; saves both compliant and non_compliant for audit). Saved file
                    matches stdout byte-for-byte.
                    NOT canonical SAT-1..5 verification. NOT chain-bound mint. No model invocation.
                    No network. No mutation.

Local evidence:
  dema receipts     List local receipts
  dema receipts ID  Show by ID, artifact ID, exact path, or unique filename
  dema memory       List local memory entries (profile + ~/.dema/memory/*)
  dema memory show NAME
                    Show one memory entry by name (e.g. profile, bizra-context)
  dema web witness <url> --consent "<phrase>" [--json]
                    One consented, credential-free GET -> content-addressed
                    witness (body sha256, title, bounded excerpt/links,
                    executed boundary declared). No scripts run, nothing
                    written, raw body not retained. Refuses without the
                    exact phrase; nothing is fetched.
  dema web diff <a.json> <b.json>
                    Pure drift verdict between two saved witnesses of a
                    page (same body? status changed? bytes delta). No network.
  dema models       Show local model inventory (read-only; no inference)
  dema models scan [--summary]
                    C1.5 · schema-tagged local model inventory scan (Ollama API · LM Studio API · GGUF files · HF cache · /data/bizra)
                    Read-only · no model load · no prompt execution · no public network · canonical 16-key boundary
  dema models discover [--json]
                    MODEL-EVAL-BASELINE-1A · read-only local model-pool discovery (Ollama · LM Studio · llama.cpp); no inference, local providers only
  dema models readiness [--json]
                    LOCAL-LLM-FLEET-READINESS-1A · read-only fleet readiness (provider reachability · installed/loaded models · preferred routes · consent phrases); no model invocation
  dema monitors run [--json] [--ci-unavailable]
                    MONITOR-GATHERER-1A + RECEIPT-MONITOR-PREVIEW-1A · operator-invoked proof-health scan (stale proof · registry/docs drift · missing gates · evidence gaps); read-only, fail-closed on criticals, no daemon, no autofix
  dema report safety [--json]
                    Preview the safety report; does not certify, execute, or mint
  dema report quality-evidence-card --commit <sha> --tests-total N --tests-pass N --tests-fail N [--check-pass] [--llm-guidance-pass] [--diff-check-clean] [--coverage-lines P] [--coverage-branches P] [--coverage-functions P] [--json]
                    Internal quality evidence card (NOT production certification). Seals under $DEMA_HOME. no_mint: true.
  dema network blueprint [--json]
                       Preview Node1/Node2 and phase-gated readiness; no federation
  dema network fixture preview [--json]
                       Preview offline 5-slot fixture; no sockets or mint
  dema network refusal preview [--json]
                       Preview partition/rejoin refusal matrix; no sockets or mint
  dema amana contracts preview [--json]
                        Preview Amana contract primitives; imports no external code
  dema diffusion refine <--drafts lines | --drafts-file path> [--evidence a,b] [--json]
  dema diffusion verify <abs-report.json> [--json]
                        diffusion-preview-kernel: deterministic denoising-convergence; not neural ML
  dema mcp blueprint [--json]
                       Preview MCP integration contract; does not call MCP tools
  dema roadmap preview [--json]
                      Preview optimization roadmap; does not execute or enforce gates
  dema roadmap dev [--json]
                      Live dev anchor (branch · HEAD · dirty · main vs origin · recent on main · feat/* branches · anchor-doc presence); read-only
  dema eval layer2 prompts [--json]
                      Emit Layer 2 rubric pack (truthfulness · actionability · boundary_compliance); data-only, no LLM invocation
  dema eval layer2 verify <abs-path> [--json]
                      Validate an operator-pasted Layer 2 judge verdict file; structural + semantic checks; read-only; exit 1 on validation failure
  dema eval baseline [--suite bizra-local-small] [--max-models <n>] [--json]
                      MODEL-EVAL-BASELINE-1A · warm-up then run the frozen local suite against the model pool; content-addressed; LOCAL ONLY; not a leaderboard
  dema eval compare <--baseline a.json --candidate b.json> [--json]
                      Deterministic before/after delta of two baseline reports; refuses a tampered input
  dema eval route <--baseline a.json> [--json]
                      MODEL-ROUTING-PREVIEW-1A · deterministic role→model PREVIEW from a verified baseline; refuses a tampered input; PREVIEW ONLY · routes no live traffic · no MoE/council/federation/runtime
  dema hardware profile [--json]
                      NODE0-HARDWARE-PROFILE-1A · read-only architecture profile (capacity bands + preview policies); PREVIEW ONLY · enforces nothing
  dema voice turn <file> [--json]
                      SOVEREIGN-VOICE-TURN-PREVIEW-1A · read transcript text, run Pulse E2E, plan bounded speech; PREVIEW ONLY · no mic/STT/TTS/audio/model/network/action/mint
  dema evidence receipt preview [--json]
                      Preview receipt-shaped evidence; does not mint, sign, or write
  dema ihsan floor preview [--score N] [--json]
                      Preview externally supplied Ihsan floor check; does not certify
  dema behavior modulation preview [--consent TEXT] [--score N] [--json] "<intent>"
                      Preview visible guidance modulation; does not apply behavior changes
  dema design emulate-loop [--json]
                      Preview PAT/SAT loop design assumptions; does not run agents
  dema agent-loop dual-preview [--json]
                      Preview/eval-only PAT-7 and SAT-5 dual-loop coordinator; no agent runtime, model, reward, token, PoI, or federation
  dema agent-loop blackboard [--pain ...] [--goal ...] [--json]
                      Preview-only PAT/SAT shared-state blackboard dry-run; deterministic seed function, no agent runtime, model, or reward

Spine preview surfaces (canonical 16-key boundary · NODE0_LOCAL_SEED):
  dema state               Node0 state preview; mission_centered + runtime/federation/mint=false
  dema profiles [--summary]
                           Profile foundation (User/PAT/SAT/Mission/ContextCapsule)
  dema consent-card        Consent card preview; allowed/blocked effects + decision options
  dema mission-loop [--summary]
                           Full lifecycle preview; preview_lifecycle_status pinned HOLD
  dema evidence-event      EvidenceChain event preview; chain_advance=false; hash-only refs
  dema node-registry [--pretty]
                           Node ordinal registry preview (v0.1e+f); accepted + ghost slots; no federation, no node_connection. --pretty = ANSI TUI render
  dema onboarding-lifecycle [--json]
                           Onboarding lifecycle preview (v0.1) · 7-stage flow (language→tech-level→node-role→purpose→resources→consent-constitution→first-mission) · ANSI TUI on TTY · JSON in --json or non-TTY
  dema skill-growth-governor [--json]
                           Skill Growth Governor preview (v0.1) · 5 promotion gates + 8 refusals · 4-line law: no learning without evaluation, no evaluation without evidence, no skill promotion without receipt, no overwrite without human consent
  dema project-status [--json]
                           Project Status preview (v0.1 · PMBOK 7th-edition-aligned) · stakeholders + value stream + risk register + quality posture + 12 principles · companion to docs/pm/PROJECT_CHARTER_AND_STATUS.md
  dema llm-router          Local LLM router preview; routing_allowed=false; abstain by default
  dema harness [--summary] [--json]
                           Unified harness integration; aggregates self-proactive, self-critique, micro-compliance, micro-consent, Law-of-Assumption gate + hook inventory
  dema bootstrap [--summary] [--json]
                           Bootstrap Mode preview (v0.1) · model-less ephemeral first-entry · composes model-less broker + 7-stage onboarding lifecycle + canonical all-false boundary · no write, no model invocation, no network
  dema seed [--live] [--summary] [--json]
                           Seed-loop preview (v0.1) · the gate over Seed→Assumption→Meaning→Consent→Receipt→Growth · composes assumption-state + proof-convergence into ADVANCE/HOLD/REFUSED · default = illustrative example · --live grades the real claim register · pure, no write
  dema proof convergence [--summary] [--json]
                           Proof-of-Truth Convergence preview (v0.1) · grades example claims across Formal/Cryptographic/Empirical/Economic rails · no-overclaim (level derived from evidence) · illustrative, not a live verdict
  dema process-mining [--summary]
                           Operator-pattern mirror; surfaces ring_advancement_status; blocks operator_judgment
  dema key-maker-check [--door "<text>"] [--summary]
                           Self-audits reasoning shape against the 5 Key Maker invariants; fails closed when violated
  dema llm-invoke [--model NAME --prompt TEXT] [--invoke --consent "GO: invoke local LLM at NAME"] [--summary]
                           C1 · local LLM adapter · preview-only by default; --invoke + exact consent calls Ollama at localhost
  dema master-craftsmanship audit [--json] [<path>]
                           External audit of any artifact against the 10 master-craftsmanship invariants. Default subject: tests/node-onboarding-adr011-compliance.test.js. Verdict: COMPLIANT (10/10) | PARTIAL (N/10) | NON-COMPLIANT. Exits 1 on non-compliant or missing path.
  dema orchestrator verify [--invocation-file <abs-path> | --latest] [--pretty]
                           [--save-pipeline-result --save-pipeline-consent "GO: save local orchestrator pipeline result"]
                           v0.1 SAT-1..5 pipeline exposure. Reads a saved invocation envelope and pipes it through the existing runVerificationPipeline() (multi-agent-orchestrator.js). Emits bizra.dema.orchestrator_verification_pipeline.v0.1 to stdout with per-SAT verdicts + aggregate verdict. Optional --save-pipeline-result persists to $DEMA_HOME/receipts/pipeline-<sha256>.json (atomic; preview-grade; saves both passed and non-passed pipelines). NOT chain-bound mint. NOT PAT execution. NO model invocation. NO network. NO URP. NO token/economy.
  dema codebase map <abs-path>
                           [--summary] [--json] [--max-files N] [--max-depth N] [--max-file-size N]
                           [--include-tests] [--hotspots] [--exclude PAT] [--no-default-exclude]
                           [--save-map --save-map-consent "GO: save local codebase architecture map"]
                           Read-only architecture map for any target repo (v0.1). Iterative bounded walker · stdlib only · deterministic. Default JSON (bizra.dema.codebase_architecture_map.v0.1) to stdout. --summary emits compact human summary. --hotspots enables content-reading hotspot probes. .env*, *secret*, *credential*, *.pem/.key/.crt/.p12, id_rsa* recorded as metadata only. Symlinks recorded but never followed. --save-map (with exact --save-map-consent) persists the envelope to $DEMA_HOME/receipts/codebase-map-<sha256>.json (atomic; 256 MiB serialized cap; preview persistence; NOT canonical chain-bound mint). --save-map cannot combine with --summary unless --json is also passed. NOT a model. NO network. NO mutation. NO chain-bound mint. NO PAT/SAT swarm. NO URP. NO token/economy.

Reversible file steward (DEMA-REVERSIBLE-FILE-STEWARD-1C · sandbox-scoped, consent-bound):
  dema steward plan --job <job.json> [--consent "GO: dema reversible file steward preview"]
                           1A planner preview: bounded, sanitizer-gated, content-addressed multi-RENAME job plan; eligible only with the exact preview phrase; no mutation
  dema steward verify --job <job.json> --consent "GO: execute reversible file steward job with backup and undo receipts"
                           1B round-trip proof on a real sandbox: execute-all → undo-all restores genesis (user-file state-hash equality); backups + receipts via the shipped reversible-rename gate
  dema steward run --job <job.json> --consent "<execute phrase>"
                           Sequenced reversible execution; stops fail-closed at the first non-sealed atom; emits receipts JSON (save it to undo later)
  dema steward undo --receipts <receipts.json>
                           Reverse-order undo; every restoration proven against its independent on-disk backup

Tasks and views:
  dema task         List registered tasks
  dema task NAME    Run a registered task (read-only in v{{DEMA_VERSION}})
  dema sovereign    Render local Sovereign Mission Interface (view-only)
  dema monetize     Show proof-safe first offer boundary
  dema help         Show this list

Dema v{{DEMA_VERSION}} — Active Command Kernel. Local-first. Consent-bound. Receipt-aware.`;

// Top-level tokens the switch handles. Used by the command suggester only.
const REGISTERED_COMMANDS_LIST = [
  {
    command: "season",
    description:
      "durable local season state: save / status / resume a bounded continuation checkpoint",
  },
  { command: "status", description: "show Node0 readiness" },
  { command: "status:json", description: "machine-readable status" },
  { command: "state", description: "Node0 state preview" },
  {
    command: "start",
    description: "birth loop: detect node state + greet (local · preview-only)",
  },
  {
    command: "scan",
    description: "consent-gated homebase metadata scan (exact phrase required)",
  },
  {
    command: "corpus",
    description:
      "governed founder corpus index + spend proof + receipt review (subcommands: index, spend, review)",
  },
  {
    command: "founder",
    description:
      "LOCAL_ONLY candidate founder-impact loop over a declared source manifest (subcommands: impact scope | run | verify)",
  },
  {
    command: "mirror",
    description: "honest homebase mirror: what you have + what Dema can do today (read-only)",
  },
  {
    command: "talk",
    description: "preview a local-model talk request: model route + exact consent phrase (no call)",
  },
  {
    command: "ask",
    description:
      "sanitizer-gated corpus ask (H3/H4): ALLOWED-only index + truth-graph receipt under DEMA_HOME/ask",
  },
  {
    command: "canon",
    description: "local canon retrieval surfaces (subcommand: first-lesson)",
  },
  { command: "node0", description: "Node0 Mumu closed-loop read-only face" },
  {
    command: "steward",
    description:
      "reversible file steward over proven kernels (subcommands: plan, verify, run, undo) — bounded multi-RENAME jobs with backups + proven undo",
  },
  { command: "profiles", description: "profile foundation preview" },
  { command: "consent-card", description: "consent card preview" },
  { command: "mission-loop", description: "full mission lifecycle preview" },
  { command: "evidence-event", description: "evidence chain event preview" },
  { command: "node-registry", description: "node ordinal registry preview" },
  {
    command: "onboarding-lifecycle",
    description: "onboarding lifecycle preview",
  },
  {
    command: "skill-growth-governor",
    description: "skill growth governor preview",
  },
  { command: "project-status", description: "project status preview" },
  {
    command: "craftsmanship-witness",
    description: "master-craftsmanship creation preview",
  },
  {
    command: "peak-self-loop",
    description:
      "peak ultra-micro self-loop preview-kernel (SNR · convergence · HHMM-preview · proactive self)",
  },
  {
    command: "agent-loop",
    description:
      "PAT/SAT dual-loop preview coordinator (preview/eval only)",
  },
  {
    command: "master-craftsmanship",
    description:
      "audit an artifact against the 10 master-craftsmanship invariants",
  },
  {
    command: "codebase",
    description:
      "read-only architecture map of any target repo (subcommand: map <abs-path>)",
  },
  {
    command: "orchestrator",
    description:
      "run the SAT-1..5 verification pipeline on a saved invocation envelope (subcommand: verify)",
  },
  { command: "llm-router", description: "local LLM router preview" },
  { command: "harness", description: "unified harness integration" },
  {
    command: "bootstrap",
    description: "model-less ephemeral onboarding preview",
  },
  {
    command: "seed",
    description: "seed-loop gate preview (ADVANCE/HOLD/REFUSED)",
  },
  { command: "process-mining", description: "operator-pattern mirror" },
  {
    command: "key-maker-check",
    description: "self-audit reasoning against Key Maker invariants",
  },
  {
    command: "llm-invoke",
    description: "local LLM adapter (preview or live call)",
  },
  { command: "today", description: "record a local continuity tick" },
  { command: "doctor", description: "validate readiness and consent gate" },
  {
    command: "covenant",
    description:
      "Covenant Gate v0.1 screening + micro-consent (PROTOTYPE per audit)",
  },
  {
    command: "assets",
    description:
      "metadata-only homebase asset awareness scan and shareability analysis",
  },
  {
    command: "contribute",
    description:
      "pre-token URP contribution preview, receipt plan, draft, and seal readiness (metadata-first, no submission)",
  },
  { command: "dashboard", description: "open homebase dashboard in browser" },
  {
    command: "homebase",
    description: "technical homebase preview (operator/debug surface)",
  },
  {
    command: "ambient",
    description: "show Ambient Sovereign Execution boundary",
  },
  { command: "ambient:json", description: "ambient boundary as JSON" },
  { command: "diagnostics", description: "preview self-diagnostics harness" },
  { command: "consent", description: "preview a micro-consent scope" },
  { command: "mission", description: "preview mission draft or propose" },
  {
    command: "recovery",
    description: "read-only Recovery Mission candidate preview (subcommand: preview)",
  },
  { command: "voice", description: "preview voice-turn receipt (text transcript only)" },
  { command: "receipts", description: "list or show local receipts" },
  {
    command: "authorship",
    description: "verify or demo Ed25519 authorship receipts",
  },
  { command: "proof", description: "generate portable proof passport" },
  {
    command: "delivery",
    description: "delivery/DevOps/QA control plane (policy, status)",
  },
  { command: "foundation", description: "consent-gated local node foundation" },
  {
    command: "genesis",
    description:
      "preview Genesis/OSTree composition blueprint + Block0 seal ceremony dry-run + Node0 historical contribution verification (subcommands: composition blueprint, seal preview, verify-node0)",
  },
  {
    command: "memory",
    description:
      "list/show local memory entries · query BIZRA Omega AgentDB (MC-A)",
  },
  { command: "models", description: "show local model inventory" },
  { command: "web", description: "consented one-page web witness (hash-pinned GET) + witness diff" },
  { command: "report", description: "preview safety report" },
  {
    command: "network",
    description: "preview network blueprint or refusal matrix",
  },
  { command: "amana", description: "preview Amana contract primitives" },
  { command: "diffusion", description: "diffusion-preview-kernel: deterministic denoising-convergence (refine|verify); not neural ML" },
  { command: "mcp", description: "preview MCP integration contract" },
  { command: "roadmap", description: "preview optimization roadmap" },
  {
    command: "eval",
    description:
      "Layer 2 LLM-as-judge surfaces (subcommands: layer2 prompts | layer2 verify <abs-path>)",
  },
  { command: "evidence", description: "preview evidence receipt" },
  { command: "ihsan", description: "preview Ihsan floor check" },
  { command: "behavior", description: "preview behavioral modulation" },
  { command: "design", description: "preview PAT/SAT loop design assumptions" },
  { command: "task", description: "list or run registered tasks" },
  { command: "monetize", description: "show proof-safe first offer boundary" },
  { command: "sovereign", description: "render Sovereign Mission Interface" },
  { command: "language", description: "set or show preferred language" },
  { command: "welcome", description: "show first-run orientation" },
  { command: "onboard", description: "guided onboarding path" },
  {
    command: "explain",
    description: "plain-language definition of a BIZRA/Dema concept (28 known)",
  },
  {
    command: "setup",
    description: "create local Dema folders/profile skeleton",
  },
  {
    command: "setup-check",
    description: "verify local Dema install integrity (hashes + paths)",
  },
  {
    command: "uninstall",
    description: "remove local Dema data (consent-gated)",
  },
  {
    command: "witness",
    description: "Node0 self-witness receipt (consent-gated)",
  },
  {
    command: "poi",
    description:
      "PoI time-compression candidate receipts (subcommands: compression record|show|verify)",
  },
  { command: "help", description: "show full command list" },
];

async function readPackageVersion() {
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const { dirname: vDir, join: vJoin } = await import("node:path");
  const here = vDir(fileURLToPath(import.meta.url));
  const pkgPath = vJoin(here, "..", "..", "..", "package.json");
  try {
    const raw = await readFile(pkgPath, "utf8");
    return JSON.parse(raw).version ?? "0.0.0-unknown";
  } catch {
    return "0.0.0-unknown";
  }
}

async function renderFullHelp() {
  const version = await readPackageVersion();
  return renderHelpFlat(HELP.replaceAll("{{DEMA_VERSION}}", version));
}

// --- Command handlers (Track 2 dispatcher refactor) -------------------------
// Each handler receives ctx = { argv, command, subcommand } and reproduces the
// exact behavior of its historical switch case. COMMAND_TABLE (below) maps each
// `dema <command>` token to its handler; dispatch() routes through the table
// after the version / bare-invocation intercepts, falling back to the default
// suggester for unknown commands.

async function cmdActive() {
  return runActiveKernel({ interactive: process.stdin.isTTY });
}

async function cmdChat() {
  return runActiveKernel({ interactive: true, force: true });
}

async function cmdWelcome() {
  console.log(formatOnboardingGuide(buildOnboardingGuide()));
}

async function cmdMonetize() {
  console.log(
    [
      "Dema monetize: safe offer guardian.",
      "Allowed now: Sovereign Local AI Node Setup + Safety Audit.",
      "Blocked: token claims, passive income claims, AGI claims, public federation claims.",
    ].join("\n"),
  );
}

// -h / --help emit the full flat list (opt-in backward-compat path).
async function cmdHelpFlat() {
  console.log(await renderFullHelp());
}

// cmd_first_run extracted to ./commands/first-run.js

// cmd_onboard extracted to ./commands/onboard.js

// cmd_preview_card extracted to ./commands/preview-card.js

// cmd_language extracted to ./commands/language.js (dispatcher decomposition ④).

// cmd_explain extracted to ./commands/explain.js (⑦).

// cmd_setup extracted to ./commands/setup.js (④).

// cmd_setup_check extracted to ./commands/setup-check.js

// cmd_uninstall extracted to ./commands/uninstall.js

// cmd_witness extracted to ./commands/witness.js

// cmd_authorship extracted to ./commands/authorship.js

// cmd_proof extracted to ./commands/proof.js

// cmd_genesis extracted to ./commands/genesis.js (④).

// cmd_attest extracted to ./commands/attest.js

// cmd_verify_grounded extracted to ./commands/verify-grounded.js

// cmd_urp extracted to ./commands/urp.js

// cmd_assets extracted to ./commands/assets.js

// cmd_realm extracted to ./commands/realm.js

// cmd_status extracted to ./commands/status.js

// cmd_status_json extracted to ./commands/status-json.js

// cmd_state extracted to ./commands/state.js (④).

// cmd_profiles extracted to ./commands/profiles.js

// cmd_consent_card extracted to ./commands/onsent-card.js

// cmd_mission_loop extracted to ./commands/ission-loop.js

// cmd_evidence_event extracted to ./commands/evidence-event.js

// cmd_node_registry extracted to ./commands/node-registry.js (④).

// cmd_onboarding_lifecycle extracted to ./commands/onboarding-lifecycle.js (④).

// cmd_skill_growth_governor extracted to ./commands/skill-growth-governor.js (④).

// cmd_project_status extracted to ./commands/project-status.js (④).

// cmd_craftsmanship_witness extracted to ./commands/raftsmanship-witness.js

// cmd_master_craftsmanship extracted to ./commands/aster-craftsmanship.js

// cmd_codebase extracted to ./commands/codebase.js

// cmd_orchestrator extracted to ./commands/orchestrator.js

// cmd_llm_router extracted to ./commands/llm-router.js

// cmd_model_broker extracted to ./commands/model-broker.js

// cmd_harness extracted to ./commands/harness.js (④).

// cmd_process_mining extracted to ./commands/process-mining.js

// cmd_key_maker_check extracted to ./commands/key-maker-check.js

// cmd_llm_invoke extracted to ./commands/llm-invoke.js

// cmd_today extracted to ./commands/today.js

// cmd_doctor extracted to ./commands/octor.js

// cmd_dashboard extracted to ./commands/ashboard.js

// cmd_ambient extracted to ./commands/ambient.js (④).

// cmd_ambient_json extracted to ./commands/ambient-json.js

// cmd_journey extracted to ./commands/journey.js (dispatcher decomposition ④).

// cmd_diagnostics extracted to ./commands/iagnostics.js

// cmd_consent extracted to ./commands/onsent.js

// cmd_mission extracted to ./commands/mission.js

// cmd_receipts extracted to ./commands/receipts.js

// cmd_memory extracted to ./commands/memory.js

// cmd_think extracted to ./commands/think.js

// cmd_models extracted to ./commands/odels.js

// cmd_report extracted to ./commands/report.js

// cmd_network extracted to ./commands/network.js

// cmd_amana extracted to ./commands/amana.js

// cmd_mcp extracted to ./commands/p.js

// cmd_roadmap extracted to ./commands/roadmap.js

// cmd_eval extracted to ./commands/eval.js

// cmd_evidence extracted to ./commands/evidence.js

// cmd_ihsan extracted to ./commands/ihsan.js

// cmd_behavior extracted to ./commands/behavior.js

// cmd_design extracted to ./commands/esign.js

// cmd_task extracted to ./commands/task.js

// cmd_sovereign extracted to ./commands/sovereign.js

async function cmd_help(ctx) {
  const { argv } = ctx;
  const helpArg = argv[1];
  if (!helpArg) {
    console.log(renderHelpRoot());
    process.exit(process.exitCode ?? 0);
  }
  if (helpArg === "--all") {
    console.log(await renderFullHelp());
    process.exit(process.exitCode ?? 0);
  }
  // Try topic first, then command detail, then unknown.
  const topicOutput = renderHelpTopic(helpArg);
  if (topicOutput !== null) {
    console.log(topicOutput);
    process.exit(process.exitCode ?? 0);
  }
  const commandOutput = renderHelpCommand(helpArg);
  if (commandOutput !== null) {
    console.log(commandOutput);
    process.exit(process.exitCode ?? 0);
  }
  console.log(renderHelpUnknown(helpArg));
  process.exit(process.exitCode ?? 0);
}

// Classify a covenant CLI failure into a precise, machine-readable reason.
// Returns null for true PROGRAMMING errors (ReferenceError/TypeError — the class of
// the prior `require()`-in-ESM bug) so the caller RETHROWS them: a code defect must
// never masquerade as a covenant input/decision outcome. Input-read and JSON errors,
// and legitimate covenant rejections (plain Error from signReceipt), get a reason.
function classifyCovenantError(e) {
  if (e instanceof ReferenceError || e instanceof TypeError) return null;
  if (e && (e.code === "ENOENT" || e.code === "EISDIR" || e.code === "EACCES")) {
    return { code: e.code, message: `cannot read file (${e.code})` };
  }
  if (e instanceof SyntaxError) {
    return { code: "invalid_json", message: `invalid JSON: ${e.message}` };
  }
  return { code: "rejected", message: e?.message ?? String(e) };
}

function reportCovenantError(surface, reason, wantJson) {
  if (wantJson) {
    console.error(
      JSON.stringify({
        error: `covenant_${surface}_failed`,
        reason: reason.code,
        message: reason.message,
      }),
    );
  } else {
    console.error(`covenant ${surface} error [${reason.code}]: ${reason.message}`);
  }
}

// Covenant Gate v0.1 (PROTOTYPE) — terminal surface for the audit-derived screening gate.
// [PROTOTYPE] only. Requires exact "GO" micro-consent. Demo receipt. Local face only.
async function cmdCovenant(ctx) {
  const { argv } = ctx;
  const sub = argv[1];
  const wantJson = argv.includes("--json");

  if (sub === "screen") {
    const file = argv[2];
    if (!file) {
      console.error("usage: dema covenant screen <proposal.json> [--json]");
      process.exit(1);
    }
    try {
      const proposal = JSON.parse(readFileSync(file, "utf8"));
      const decision = screenProposal(proposal);
      if (wantJson) {
        console.log(JSON.stringify(decision, null, 2));
      } else {
        console.log(JSON.stringify(decision, null, 2));
      }
    } catch (e) {
      const reason = classifyCovenantError(e);
      if (!reason) throw e;
      reportCovenantError("screen", reason, wantJson);
      process.exit(1);
    }
    process.exit(process.exitCode ?? 0);
  }

  if (sub === "consent") {
    const file = argv[2];
    const typedGoIdx = argv.indexOf("--typed-go");
    const typedGo = typedGoIdx >= 0 ? argv[typedGoIdx + 1] : "";
    if (!file || !typedGo) {
      console.error(
        'usage: dema covenant consent <decision.json> --typed-go "GO: SIGN COVENANT RECEIPT <decision_id>" [--json]',
      );
      process.exit(1);
    }
    try {
      const decision = JSON.parse(readFileSync(file, "utf8"));
      const receipt = signReceipt(decision, typedGo, process.env.DEMA_COVENANT_KEY);
      if (wantJson) {
        console.log(JSON.stringify(receipt, null, 2));
      } else {
        console.log(JSON.stringify(receipt, null, 2));
      }
    } catch (e) {
      const reason = classifyCovenantError(e);
      if (!reason) throw e;
      reportCovenantError("consent", reason, wantJson);
      process.exit(1);
    }
    process.exit(process.exitCode ?? 0);
  }

  console.error("unknown covenant subcommand (screen | consent)");
  process.exit(1);
}

// N0-MUMU-CLI-1: read-only face over the sealed Node0 Mumu closed loop.
// Reads/reports receipts; never runs the governed runtime (`npm run node0`).
// cmd_node0 extracted to ./commands/node0.js

const COMMAND_TABLE = {
  active: cmdActive,
  "": cmdActive,
  chat: cmdChat,
  welcome: cmdWelcome,
  monetize: cmdMonetize,
  "-h": cmdHelpFlat,
  "--help": cmdHelpFlat,
  "first-run": cmd_first_run,
  onboard: cmd_onboard,
  "preview-card": cmd_preview_card,
  language: cmd_language,
  explain: cmd_explain,
  setup: cmd_setup,
  "setup-check": cmd_setup_check,
  uninstall: cmd_uninstall,
  stand: cmd_stand,
  monitors: cmd_monitors,
  poi: cmd_poi,
  away: cmd_away,
  witness: cmd_witness,
  authorship: cmd_authorship,
  proof: cmd_proof,
  delivery: cmd_delivery,
  foundation: cmd_foundation,
  genesis: cmd_genesis,
  attest: cmd_attest,
  "verify-grounded": cmd_verify_grounded,
  urp: cmd_urp,
  datalake: cmd_datalake,
  realm: cmd_realm,
  homebase: (ctx) => cmd_homebase(ctx, { dispatchFn: dispatch }),
  node0: cmd_node0,
  adk: cmd_adk,
  status: cmd_status,
  "status:json": cmd_status_json,
  state: cmd_state,
  "node0-index": cmd_node0_index,
  start: cmd_start,
  scan: cmd_scan,
  corpus: cmd_corpus,
  mirror: cmd_mirror,
  talk: cmd_talk,
  canon: cmd_canon,
  profiles: cmd_profiles,
  "consent-card": cmd_consent_card,
  "mission-loop": cmd_mission_loop,
  "evidence-event": cmd_evidence_event,
  "node-registry": cmd_node_registry,
  "onboarding-lifecycle": cmd_onboarding_lifecycle,
  "skill-growth-governor": cmd_skill_growth_governor,
  "project-status": cmd_project_status,
  "craftsmanship-witness": cmd_craftsmanship_witness,
  "peak-self-loop": cmd_peak_self_loop,
  "master-craftsmanship": cmd_master_craftsmanship,
  codebase: cmd_codebase,
  orchestrator: cmd_orchestrator,
  covenant: cmdCovenant,
  assets: cmd_assets,
  library: cmd_library,
  contribute: cmd_contribute,
  demo: cmd_demo,
  "llm-router": cmd_llm_router,
  "model-broker": cmd_model_broker,
  harness: cmd_harness,
  bootstrap: cmd_bootstrap,
  seed: cmd_seed,
  "process-mining": cmd_process_mining,
  "key-maker-check": cmd_key_maker_check,
  "llm-invoke": cmd_llm_invoke,
  ask: cmd_ask,
  today: cmd_today,
  doctor: cmd_doctor,
  dashboard: cmd_dashboard,
  ambient: cmd_ambient,
  "ambient:json": cmd_ambient_json,
  journey: cmd_journey,
  diagnostics: cmd_diagnostics,
  consent: cmd_consent,
  mission: cmd_mission,
  season: cmd_season,
  recovery: cmd_recovery,
  founder: cmd_founder,
  voice: cmd_voice,
  receipts: cmd_receipts,
  memory: cmd_memory,
  think: cmd_think,
  models: cmd_models,
  web: cmd_web,
  report: cmd_report,
  network: cmd_network,
  amana: cmd_amana,
  diffusion: cmd_diffusion,
  mcp: cmd_mcp,
  roadmap: cmd_roadmap,
  eval: cmd_eval,
  hardware: cmd_hardware,
  evidence: cmd_evidence,
  ihsan: cmd_ihsan,
  behavior: cmd_behavior,
  design: cmd_design,
  economy: cmd_economy,
  "agent-loop": cmd_agent_loop,
  task: cmd_task,
  sovereign: cmd_sovereign,
  steward: cmd_steward,
  help: cmd_help,
};

async function dispatch(argv) {
  const command = argv[0] ?? "active";
  const subcommand = argv[1];

  // --version / -v intercept (top-level flag OR explicit command).
  // Returns the package.json version so a release manifest is verifiable
  // from CLI without parsing it externally. JSON output via --json.
  if (
    command === "--version" ||
    command === "-v" ||
    command === "version" ||
    argv.includes("--version")
  ) {
    const version = await readPackageVersion();
    if (argv.includes("--json")) {
      console.log(
        JSON.stringify(
          { schema: "bizra.dema.cli_version.v0.1", name: "dema", version },
          null,
          2,
        ),
      );
    } else {
      console.log(`dema ${version}`);
    }
    process.exit(process.exitCode ?? 0);
  }

  // First-look companion home (DEMA-QUALITY-DELIVERY-SPINE-1A).
  // Bare `dema` routes to human-first companion output.
  // Technical homebase preview: `dema homebase` (JSON/TUI · phase-5 legacy surface).
  const isBareInvocation =
    (command === "active" || command === "" || command === "--json") &&
    !argv.includes("--chat") &&
    !argv.includes("--interactive");
  if (isBareInvocation) {
    const wantJson =
      argv.includes("--json") ||
      !process.stdout.isTTY ||
      Boolean(process.env.DEMA_NO_TUI) ||
      process.env.NODE_ENV === "test";
    const { join: pathJoin } = await import("node:path");
    const { homedir } = await import("node:os");
    const demaHome = process.env.DEMA_HOME || pathJoin(homedir(), ".dema");
    const showIntro = await shouldShowIntro({ home: demaHome });
    if (showIntro) {
      const introStream = wantJson ? process.stderr : process.stdout;
      introStream.write(renderIntroLine() + "\n\n");
      await recordIntroSeen({ home: demaHome });
    }
    const { gatherFirstLookContext, buildFirstLookHome, renderFirstLookHome } =
      await import("../../../packages/core/src/dema-first-look-home.js");
    const { resolveFormatterOptsFromEnv } =
      await import("../../../packages/core/src/tui-formatter.js");
    const ctx = await gatherFirstLookContext({ demaHome });
    const envelope = buildFirstLookHome(ctx);
    if (wantJson) {
      process.stdout.write(JSON.stringify(envelope, null, 2) + "\n");
      process.exit(process.exitCode ?? 0);
    }
    const opts = resolveFormatterOptsFromEnv(process.env);
    process.stdout.write(
      renderFirstLookHome(envelope, { noColor: opts.noColor }) + "\n",
    );
    process.exit(process.exitCode ?? 0);
  }

  // Route through the command table (Track 2 dispatcher refactor). Each command
  // token maps to a named handler in COMMAND_TABLE; the switch was replaced by
  // this O(1) lookup. Unknown commands fall through to the suggester below.
  const ctx = { argv, command, subcommand };
  const handler = Object.hasOwn(COMMAND_TABLE, command)
    ? COMMAND_TABLE[command]
    : null;
  if (typeof handler === "function") return await handler(ctx);

  // Default: unknown command — suggest the closest registered command.
  const result = suggestCommands(command, REGISTERED_COMMANDS_LIST);
  const lines = [
    `I don't have a \`${result.missingToken || command}\` command.`,
    "",
  ];
  if (result.matched === "natural-language" || result.matched === "close") {
    lines.push("Did you mean:");
    for (const s of result.suggestions) {
      lines.push(`  - dema ${s.command.padEnd(32)} — ${s.description}`);
    }
  } else {
    lines.push(
      "I couldn't find a close match. Type `dema help` for the full list.",
    );
  }
  lines.push("", "Type `dema help` to see everything I can do.");
  console.log(lines.join("\n"));
}

async function runActiveKernel({ interactive = false, force = false } = {}) {
  const inputs = await gatherBannerInputs();
  const banner = formatBanner(inputs);

  if (interactive) {
    await runShell({
      greeting: banner,
      dispatchCommand: dispatch,
      statusProvider: () => statusWithLocalIdentity(),
      councilPatDispatchFormatter: (chatResult) => {
        const preview = buildCouncilSeatPatDispatchPreview({
          seat: chatResult.council_seat,
          consent_phrase: chatResult.consent_phrase ?? "",
        });
        return formatCouncilSeatPatDispatchResponse(preview);
      },
    });
    process.exit(process.exitCode ?? 0);
  }

  console.log(banner);
  if (force) {
    // chat was requested but we aren't in a TTY. Be explicit.
    console.log("");
    console.log("(stdin is not a TTY — interactive shell skipped.)");
  }
}

// Allow tests to import dispatch + runActiveKernel without firing main().
const isDirectInvocation =
  process.argv[1] &&
  (process.argv[1].endsWith("/index.js") || process.argv[1].endsWith("/dema"));

if (isDirectInvocation) {
  dispatch(process.argv.slice(2))
    .then((result) => {
      // Refusal sentinel from the task gate translates to exit 1 only at
      // the top-level CLI boundary. Inside `dema chat` (where dispatch is
      // invoked from runShell) the refusal stays a per-turn outcome and
      // does not taint the parent process exit code.
      if (result?.refused) process.exit(1);
    })
    .catch((error) => {
      console.error("Dema error:", error?.message ?? error);
      process.exit(1);
    });
}

export { dispatch, runActiveKernel };
export { classifyCovenantError };
export { probeGateway };
export { REGISTERED_COMMANDS_LIST };
export { COMMAND_TABLE };
