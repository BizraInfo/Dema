// AUTO-DERIVED (AUDIT P1b · workflow w082loh8k): path-keyed I/O-tier allowlist for
// non-core Dema packages. Each LEGIT_IO entry is bounded, local (DEMA_HOME/~/.dema)
// or localhost-gated I/O verified by adversarial classification + operator disk-review.
// The 2 runtime-tier exec entries are INTENTIONAL and flagged (see reasons).
export const NONCORE_IO_TIER_ALLOWLIST = Object.freeze({
  "packages/covenant/src/covenant-gate.js":
    "readFileSync (L17/L217) reads one fixed fixture resolved relative to __dirname (../../../fixtures/covenant/example-impact-proposal.json); bounded read-only repo read, JSON.parsed, no recursion/network.",
  "packages/flywheel/src/flywheel-ledger.js":
    "mkdir/readFile/writeFile/rename/unlink scoped to DEMA_HOME||~/.dema; appends econ/flywheel-impact-ledger.ndjson via atomic tmp+rename; network_used:false; no net/http/fetch/child_process.",
  "packages/flywheel/src/flywheel-attestation-ledger.js":
    "mkdir/readFile/writeFile/rename/unlink scoped to DEMA_HOME||~/.dema; appends attestations/convergence-attestation-ledger.ndjson via atomic tmp+rename; network_used:false.",
  "packages/flywheel/src/flywheel-one-task.js":
    "mkdir/writeFile/rename/unlink scoped to DEMA_HOME||~/.dema receipts dir; writes flywheel-<id>.json via wx atomic tmp+rename; localhost-only, no net/child_process.",
  "packages/flywheel/src/flywheel-xp-state.js":
    "mkdir/readFile/writeFile/rename/unlink scoped to DEMA_HOME||~/.dema; appends agents/flywheel-xp-state.ndjson via atomic tmp+rename; network_used:false.",
  "packages/installer/src/dema-recovery.js":
    "Bounded read-only walk of DEMA_HOME (readdirSync/openSync/readFileSync/fstatSync) to sha256 each file; capped MAX_FILES=20000, MAX_DEPTH=24, skips symlinks; read_only:true, network_used:false.",
  "packages/installer/src/setup.js":
    "Creates/reads/removes the local Dema home (~/.dema or DEMA_HOME): mkdir receipts/memory/logs/skills, exclusive-create JSON (wx), sha256File reads, consent-gated rm restricted to validated owned paths (validateRemoveRoot blocks fs-root/homedir/cwd/symlink). No network/child_process.",
  "packages/memory/src/memory-store.js":
    "readdir/readFile from node:fs/promises over DEMA_HOME||~/.dema; reads profile.json and memory/<name>.json one level deep, no recursion; entry names traversal-guarded by /^[A-Za-z0-9_-]+$/; no network/child_process.",
  "packages/mission/src/health-snapshot.js":
    "writes/reads under DEMA_HOME||~/.dema/receipts only; atomic mkdir+writeFile{wx}+rename via realpath; reads one receipt to verify; network_used:false, no recursion.",
  "packages/mission/src/mission-closeout.js":
    "readdir/readFile/stat on DEMA_HOME||~/.dema/receipts to resolve/render one mission receipt; bounded single-level listing, no recursion/network.",
  "packages/mission/src/mission-probe.js":
    "fs ops are bounded local (mkdtemp tmpdir isolated home, readdir receipts, readFile fixed SOURCE_FILES, rm temp home). The http/https/net/child_process/fetch( tokens are FORBIDDEN_IMPORTS pattern literals the probe greps for — substring scan, not actual imports/calls. No network/spawn.",
  "packages/models/src/model-inventory.js":
    "readdir/stat scan of local downloads root depth/count-capped (maxDepth=4, maxFiles=500) with paths redacted; fetch() gated by isLocalUrl->isLocalAddress (only 127.0.0.1/::1/localhost), probeOllama/probeLmStudio refuse non-local; no remote egress.",
  "packages/models/src/model-safety.js":
    "execFileAsync(\"ss\",[\"-tln\"],{timeout:1500}) — fixed argv, no shell, no user interpolation, opt-out DEMA_MODELS_SKIP_TCP=1; only reads local TCP listener table for localhost-binding detection; failures caught; no remote command, no egress.",
  "packages/node-adapter/src/gateway-http-adapter.js":
    "fetch() is GET-only, hard-gated to localhost via isLocalGatewayUrl (refuses non-http/non-localhost), 5s AbortController, 4 fixed read-only endpoints (/health,/chain,/poi/summary,/resources/list); no remote egress.",
  "packages/receipts/src/authorship-sign-command.js":
    "readFile(artifactPath) of operator-supplied artifact + atomic writeFile to $DEMA_HOME/receipts via wx+rename; no network.",
  "packages/receipts/src/route-receipt-save.js":
    "write-only route-<sha256>.json to $DEMA_HOME/receipts with realpath containment; no network.",
  "packages/receipts/src/witness-receipt.js":
    "mkdir + atomic write of witness receipt to $DEMA_HOME/receipts (realDir via realpath); no network.",
  "packages/receipts/src/consent-verify-command.js":
    "readFile(proofPath)+readFile(pubkeyPath) of operator-supplied local files to verify consent proof; read-only, no network.",
  "packages/receipts/src/authorship-latest.js":
    "readdir+stat of $DEMA_HOME/receipts to find latest authorship receipt; bounded single-dir read, no network.",
  "packages/receipts/src/verdict-attest-command.js":
    "readFile(inputPath)+writeFile(outPath) of operator-supplied local paths for verdict bundle; no network.",
  "packages/receipts/src/verdict-verify-command.js":
    "readFile(bundlePath)+readFile(pubkeyPath) of operator-supplied local files; read-only verify, no network.",
  "packages/receipts/src/authorship-verify.js":
    "readFile(receiptPath) of a local receipt JSON to verify signature; read-only, no network.",
  "packages/receipts/src/verdict-attest.js":
    "mkdir + writeFile verdict-<bodyHash>.json to $DEMA_HOME/receipts (resolveHome); no network.",
  "packages/receipts/src/authorship-closeout.js":
    "readFile(latest.path) of a local receipt under $DEMA_HOME/receipts; read-only, no network.",
  "packages/receipts/src/authorship-key-store.js":
    "key files under $DEMA_HOME/keys; mkdir+realpath+open with 0o700 and lstat checks; local key store, no network.",
  "packages/receipts/src/consent-nonce-registry.js":
    "single used-nonces.json under $DEMA_HOME/consent for within-host replay protection; local file, no network.",
  "packages/receipts/src/canonical-ledger.js":
    "read/append canonical-ledger.ndjson under $DEMA_HOME/receipts via atomic rename; local chain file, no network.",
  "packages/receipts/src/codebase-map-save.js":
    "write-only of a pre-built map envelope to $DEMA_HOME/receipts, consent-gated, 256MiB cap, assertContained realpath guard; no scan/recursion/network.",
  "packages/receipts/src/founder-work-index-save.js":
    "write-only founder-work-index-<sha256>.json to $DEMA_HOME/receipts with realpath containment, no_mint envelope gate, 16MiB cap, atomic tmp+rename; no network.",
  "packages/receipts/src/node0-quality-evidence-card-save.js":
    "write-only node0-quality-evidence-card-<sha256>.json to $DEMA_HOME/receipts with realpath containment, no_mint card gate, 512KiB cap, atomic tmp+rename; no network.",
  "packages/receipts/src/receipt-store.js":
    "readdir/readFile/stat of $DEMA_HOME/receipts to list/summarize receipts, paginated; bounded read, no network.",
  "packages/receipts/src/witness-verify.js":
    "readdir+stat+readFile of $DEMA_HOME/receipts witness files to verify; bounded single-dir read, no network.",
  "packages/receipts/src/consent-prove-command.js":
    "writeFile(outPath) of consent_proof to operator-supplied local path; key read via $DEMA_HOME kernel, no network.",
  "packages/receipts/src/proof-passport.js":
    "readdir of $DEMA_HOME/receipts to assemble passport from receipt filenames; bounded single-dir read, no network.",
  "packages/receipts/src/proof-passport-verify.js":
    "readFile(passportPath) of a local passport JSON to verify; read-only, no network.",
  "packages/receipts/src/assumption-guarded-claim.js":
    "mkdir(0o700)+write guarded-claim-<id>.json to $DEMA_HOME/receipts only on satisfied guard; local, no network.",
  "packages/receipts/src/pipeline-result-save.js":
    "write-only pipeline-<sha256>.json to $DEMA_HOME/receipts with realpath containment; no network.",
  "packages/receipts/src/invocation-result-save.js":
    "write-only invocation-<sha256>.json to $DEMA_HOME/receipts, consent-gated, absFinal containment; no network.",
  "packages/receipts/src/verification-result-save.js":
    "write-only verification-<sha256>.json to $DEMA_HOME/receipts with realpath containment; no network.",
  "packages/tasks/src/downloads-audit-preview.js":
    "Single-level (non-recursive) readdir(root)+stat over DEMA_DOWNLOADS_ROOT/~/Downloads, then one writeFile to DEMA_HOME/~/.dema/receipts via mkdir+writeFile; no network/child_process; bounded local read + scoped receipt write.",
  "packages/think/src/think-dry-run.js":
    "spawnSync runs local python3 wrapper under ~/.dema/bin/agent-db-query (30s timeout); fetch hits only http://localhost:11434/api/tags (3s AbortController); readdirSync/statSync scan local Ollama manifests + bounded gguf dirs. All local+bounded, no remote egress.",
  "packages/think/src/think-live.js":
    "spawnSync runs local python3 memory wrapper under ~/.dema/bin (30s timeout); LLM call delegated to invokeLocalLLM in core/llm-adapter, this file has no fetch/http; boundary external_call_scope localhost_only. Local+bounded.",
  "packages/think/src/think-probe.js":
    "\"fetch(\" is a string literal in the FORBIDDEN_IMPORTS allowlist used by the static scanner, not a call; fs/promises reads a fixed 3-file RECEIPT_SOURCE_FILES list, uses mkdtemp/mkdir/rm on a tmpdir sandbox + readdir of receipts. Bounded, temp-scoped, read-only report.",
  "packages/think/src/think-receipt-save.js":
    "writeFile/rename/mkdir only into <DEMA_HOME>/receipts/ guarded by realpath assertContained; consent-gated, content-addressed filename, atomic tmp+rename. DEMA_HOME-scoped, no network.",
  "packages/urp/src/choose-list.js":
    "readdir+readFile of $DEMA_HOME/urp/choices/choose-<sha256>.json scoped to DEMA_HOME||~/.dema; no write, no network.",
  "packages/urp/src/choose-verify.js":
    "single readFile of a caller-supplied choose-receipt path for read-only hash/forbidden-field verification; network_used:false, no mutation.",
  "packages/urp/src/choose-writer.js":
    "bounded write of content-addressed choose receipt under $DEMA_HOME/urp/choices via mkdir/writeFile(wx,0600)/rename/readFile/stat; DEMA_HOME-scoped, no network.",
  "packages/urp/src/local-index-list.js":
    "readdir+readFile of $DEMA_HOME/urp/indexes/urp-index-<sha256>.json scoped to DEMA_HOME||~/.dema; read-only, no write/network.",
  "packages/urp/src/local-index-verify.js":
    "single readFile of a caller-supplied local-index path for read-only schema/hash verification; network_used:false, file_write_performed:false.",
  "packages/urp/src/local-index-writer.js":
    "bounded write of content-addressed local index under $DEMA_HOME/urp/indexes via mkdir/writeFile(wx,0600)/rename/readFile/stat; DEMA_HOME-scoped, no network.",
  // --- RUNTIME-TIER intentional child-process execution; NOT pure kernels, flagged in audit P1b ---
  "packages/mission/src/artifact-011-ceremony-preflight.js":
    "RUNTIME-TIER ceremony preflight: child_process exec is dependency-injected (execFileFn, default null, NODE_ENV=test) to run Dema CLI preflight. Intentional + DI-gated, not a pure kernel; flagged for review.",
  "packages/node-adapter/src/node0-adapter.js":
    "RUNTIME-TIER adapter to the separate Node0 runtime: execFile of the operator-set DEMA_NODE0_STATUS_COMMAND (shell:false, 30s timeout). Intentional runtime bridge, not a pure kernel; flagged for review, not accidental impurity.",
});
