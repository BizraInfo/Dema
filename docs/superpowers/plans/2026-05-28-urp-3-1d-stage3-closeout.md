# URP-3.1D Stage 3 Local Index Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze the Stage 3 Local Index boundary into a replayable, drift-guarded closeout (Shape B+) before Stage 4 Choose opens any share/PoI/mint/federation surface.

**Architecture:** One stdlib-only Node script runs the real cryptographic chain (`key init → sign → proof passport → urp index → urp list → urp verify`) inside a throwaway `DEMA_HOME`, emits a schema-tagged envelope on stdout, and exits 0 only when every step passes. The script is registered as one tuple in `scripts/check.mjs`'s `commands` array; `execFileSync` throws on non-zero exit, failing `npm run check`. A new closeout doc and two docs-index updates complete the slice.

**Tech Stack:** Node.js stdlib only (`node:child_process` spawn with argv array, `node:fs/promises`, `node:os.tmpdir`). No new package, no new test file, no new schema module.

**Spec:** `docs/superpowers/specs/2026-05-28-urp-3-1d-stage3-closeout-design.md`

**Approved shape:** B+ (docs + replayable demo script + `check.mjs` harness probe)

---

## Task 1: Write the closeout demo script

**Files:**

- Create: `scripts/urp-stage3-closeout.mjs`

- [ ] **Step 1.1: Create the script file with the full real-chain runner**

Write `scripts/urp-stage3-closeout.mjs`:

```js
#!/usr/bin/env node
// URP-3.1D Stage 3 Local Index Closeout — drift-guard probe.
//
// Runs the real cryptographic chain end-to-end inside a throwaway
// DEMA_HOME and emits a schema-tagged envelope on stdout. Exits 0
// only when every step passes; emits failure envelope on stderr and
// exits 1 otherwise. NO mock passport. NO persistent receipt.
// NO network, federation, PoI, mint, or share.

import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const CLI_PATH = join(REPO_ROOT, "apps", "cli", "src", "index.js");
const NODE_BIN = process.execPath;

const SCHEMA = "bizra.dema.urp_stage3_closeout_demo.v0.1";
const PASS_LABEL = "URP_STAGE_3_LOCAL_INDEX_DEMO_VERIFIED";
const FAIL_LABEL = "URP_STAGE_3_LOCAL_INDEX_DEMO_FAILED";

const STEP_TIMEOUT_MS = Number.parseInt(
  process.env.URP_STAGE3_CLOSEOUT_TIMEOUT_MS ?? "30000",
  10,
);

function runCli(argv, demaHome) {
  return new Promise((resolveOne) => {
    const child = spawn(NODE_BIN, [CLI_PATH, ...argv], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        DEMA_HOME: demaHome,
        DEMA_NO_TUI: "1",
        NODE_ENV: "test",
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), STEP_TIMEOUT_MS);
    child.stdout.on("data", (b) => (stdout += b.toString("utf8")));
    child.stderr.on("data", (b) => (stderr += b.toString("utf8")));
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolveOne({ exitCode: code, signal, stdout, stderr });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolveOne({
        exitCode: null,
        signal: null,
        stdout: "",
        stderr: `spawn_error: ${err.message}`,
      });
    });
  });
}

function parseJsonOrNull(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function runStep(name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    return { name, ok: true, duration_ms: Date.now() - t0, ...detail };
  } catch (err) {
    return {
      name,
      ok: false,
      duration_ms: Date.now() - t0,
      error: String(err?.message ?? err),
    };
  }
}

async function main() {
  const demaHome = await mkdtemp(join(tmpdir(), "dema-urp-stage3-closeout-"));
  const steps = [];
  let failedStep = null;

  try {
    // Step 1: key init
    const s1 = await runStep("key_init", async () => {
      const r = await runCli(
        [
          "authorship",
          "key",
          "init",
          "--consent",
          "GENERATE AUTHORSHIP KEY",
          "--json",
        ],
        demaHome,
      );
      if (r.exitCode !== 0) throw new Error(`exit=${r.exitCode}`);
      const env = parseJsonOrNull(r.stdout);
      if (!env || env.initialized !== true) {
        throw new Error("envelope_missing_initialized_true");
      }
      return { fingerprint: env.public_key_fingerprint };
    });
    steps.push(s1);
    if (!s1.ok) {
      failedStep = "key_init";
      throw new Error(s1.error);
    }

    // Step 2: sign
    const artifactPath = join(demaHome, "closeout-artifact.txt");
    await writeFile(
      artifactPath,
      `URP-3.1D closeout sentinel · ${new Date().toISOString()}`,
    );
    const s2 = await runStep("sign", async () => {
      const r = await runCli(
        [
          "authorship",
          "sign",
          artifactPath,
          "--consent",
          "SIGN AUTHORSHIP RECEIPT",
          "--json",
        ],
        demaHome,
      );
      if (r.exitCode !== 0) throw new Error(`exit=${r.exitCode}`);
      const env = parseJsonOrNull(r.stdout);
      if (!env || env.signed !== true) {
        throw new Error("envelope_missing_signed_true");
      }
      return {
        receipt_filename: env.receipt_path
          ? env.receipt_path.split("/").pop()
          : null,
      };
    });
    steps.push(s2);
    if (!s2.ok) {
      failedStep = "sign";
      throw new Error(s2.error);
    }

    // Step 3: proof passport
    const passportPath = join(demaHome, "passport.json");
    const s3 = await runStep("passport", async () => {
      const r = await runCli(["proof", "passport", "--json"], demaHome);
      if (r.exitCode !== 0) throw new Error(`exit=${r.exitCode}`);
      const env = parseJsonOrNull(r.stdout);
      if (!env || env.aggregate?.verdict !== "VERIFIED") {
        throw new Error(`bad_verdict=${env?.aggregate?.verdict}`);
      }
      await writeFile(passportPath, JSON.stringify(env, null, 2));
      return {
        verdict: env.aggregate.verdict,
        receipts_count: env.aggregate.total_receipts,
      };
    });
    steps.push(s3);
    if (!s3.ok) {
      failedStep = "passport";
      throw new Error(s3.error);
    }

    // Step 4: urp index
    let indexPath = null;
    const s4 = await runStep("index", async () => {
      const r = await runCli(
        ["urp", "index", "--passport", passportPath, "--json"],
        demaHome,
      );
      if (r.exitCode !== 0) throw new Error(`exit=${r.exitCode}`);
      const env = parseJsonOrNull(r.stdout);
      if (!env || env.written !== true) {
        throw new Error("envelope_missing_written_true");
      }
      indexPath = env.write_result?.index_path;
      return { index_hash: env.write_result?.index_hash };
    });
    steps.push(s4);
    if (!s4.ok) {
      failedStep = "index";
      throw new Error(s4.error);
    }

    // Step 5: urp list
    const s5 = await runStep("list", async () => {
      const r = await runCli(["urp", "list", "--json"], demaHome);
      if (r.exitCode !== 0) throw new Error(`exit=${r.exitCode}`);
      const env = parseJsonOrNull(r.stdout);
      if (!env || env.count < 1 || env.corruption_detected !== false) {
        throw new Error(
          `bad_list count=${env?.count} corruption=${env?.corruption_detected}`,
        );
      }
      for (const e of env.entries) {
        if (!e.filename_hash_matches || !e.body_hash_intact) {
          throw new Error(`entry_corrupt ${e.filename}`);
        }
      }
      return { count: env.count, corruption_detected: false };
    });
    steps.push(s5);
    if (!s5.ok) {
      failedStep = "list";
      throw new Error(s5.error);
    }

    // Step 6: urp verify (every index file)
    const s6 = await runStep("verify", async () => {
      const indexDir = join(demaHome, "urp", "indexes");
      const files = (await readdir(indexDir)).filter((f) =>
        /^urp-index-[a-f0-9]{64}\.json$/.test(f),
      );
      if (files.length === 0) throw new Error("no_index_files");
      for (const f of files) {
        const r = await runCli(
          ["urp", "verify", join(indexDir, f), "--json"],
          demaHome,
        );
        if (r.exitCode !== 0) throw new Error(`verify_exit=${r.exitCode}`);
        const env = parseJsonOrNull(r.stdout);
        if (!env || env.verdict !== "VERIFIED") {
          throw new Error(`verify_verdict=${env?.verdict}`);
        }
      }
      return { verdict: "VERIFIED", verified_count: files.length };
    });
    steps.push(s6);
    if (!s6.ok) {
      failedStep = "verify";
      throw new Error(s6.error);
    }

    const totalMs = steps.reduce((sum, s) => sum + s.duration_ms, 0);
    const envelope = {
      schema: SCHEMA,
      demo_passed: true,
      truth_label: PASS_LABEL,
      steps,
      total_duration_ms: totalMs,
      dema_home_used: demaHome,
      dema_home_cleaned: true,
      boundary: {
        local_only: true,
        network_used: false,
        share_decision_made: false,
        poi_score_calculated: false,
        token_minted: false,
        federation_used: false,
        persistent_closeout_receipt_written: false,
      },
    };
    process.stdout.write(JSON.stringify(envelope, null, 2) + "\n");
    process.exitCode = 0;
  } catch (err) {
    const envelope = {
      schema: SCHEMA,
      demo_passed: false,
      truth_label: FAIL_LABEL,
      failed_step: failedStep,
      error: String(err?.message ?? err),
      steps,
      dema_home_used: demaHome,
      dema_home_cleaned: true,
      boundary: {
        local_only: true,
        network_used: false,
        share_decision_made: false,
        poi_score_calculated: false,
        token_minted: false,
        federation_used: false,
        persistent_closeout_receipt_written: false,
      },
    };
    process.stderr.write(JSON.stringify(envelope, null, 2) + "\n");
    process.exitCode = 1;
  } finally {
    await rm(demaHome, { recursive: true, force: true });
  }
}

main().catch((err) => {
  process.stderr.write(`urp-stage3-closeout crashed: ${err.stack || err}\n`);
  process.exit(2);
});
```

- [ ] **Step 1.2: Make executable bit consistent with other scripts**

Run: `chmod +x scripts/urp-stage3-closeout.mjs`

Expected: no output, returns 0.

---

## Task 2: Standalone-test the script

**Files:**

- No file changes.

- [ ] **Step 2.1: Run the script and capture stdout**

Run: `node scripts/urp-stage3-closeout.mjs > /tmp/closeout.json 2> /tmp/closeout.err; echo "exit=$?"`

Expected: `exit=0`. `/tmp/closeout.err` empty.

- [ ] **Step 2.2: Verify the envelope shape**

Run: `jq -r '.demo_passed, .truth_label, (.steps | length), .boundary.persistent_closeout_receipt_written' /tmp/closeout.json`

Expected output exactly:

```
true
URP_STAGE_3_LOCAL_INDEX_DEMO_VERIFIED
6
false
```

- [ ] **Step 2.3: Verify all 6 steps OK**

Run: `jq -r '.steps[] | "\(.name)\t\(.ok)"' /tmp/closeout.json`

Expected:

```
key_init	true
sign	true
passport	true
index	true
list	true
verify	true
```

- [ ] **Step 2.4: Verify no leak of forbidden fields in stdout**

Run: `grep -cE '"private_key":|"raw_artifact":|"mint_candidate":|"token_eligible":|"federation_target":|BEGIN PRIVATE KEY' /tmp/closeout.json`

Expected: `0`

- [ ] **Step 2.5: Verify tmpdir cleanup**

Run: `dh=$(jq -r .dema_home_used /tmp/closeout.json); test ! -d "$dh" && echo CLEANED || echo LEAKED`

Expected: `CLEANED`

- [ ] **Step 2.6: Clean local artifacts**

Run: `rm -f /tmp/closeout.json /tmp/closeout.err`

---

## Task 3: Write the closeout doc

**Files:**

- Create: `docs/security/URP_LOCAL_INDEX_CLOSEOUT.md`

- [ ] **Step 3.1: Write the 8-section closeout doc**

Write `docs/security/URP_LOCAL_INDEX_CLOSEOUT.md`:

````markdown
# URP Local Index Closeout (Stage 3)

**Status:** remote-CI verified and drift-guarded
**Pair-doc:** [URP Local Index Preflight](./URP_LOCAL_INDEX_PREFLIGHT.md)
**Sparse point:** After URP-3.1C-ter verify-by-path at HEAD `b1a932f`

## 1. What this is

The closeout half of the URP-3.0 preflight. The preflight opened the
Stage 3 Local Index commitment; this doc closes it by stating what
was delivered, what was deliberately left out, and how regression is
detected going forward.

Stage 3 is one stage of the BIZRA Seed-to-Pool lifecycle. It produces
a local-only, content-addressed resource-wallet index from a verified
Proof Passport. It does **not** open any share, PoI, mint, or
federation surface — those belong to Stage 4 and beyond.

## 2. Stage 3 boundary triplet

Every persisted URP index file declares three fields that together
form the Stage 3 boundary contract:

| Field          | Value (constant)                | Contract                                                                                                                                               |
| -------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mode`         | `LOCAL_INDEX_ONLY`              | The index exists on this disk only. No federation transport, no public publication, no network egress.                                                 |
| `share_status` | `MARKED_LOCAL_ONLY`             | The operator has made no share decision. A Stage 4 Choose step would be required to change this.                                                       |
| `truth_label`  | `LOCAL_VERIFIED_RESOURCE_INDEX` | Every entry in the index references an authorship receipt whose Ed25519 signature was deep-verified against the proof passport at index-creation time. |

The writer (`packages/urp/src/local-index-writer.js`) refuses to
persist any object whose `mode` / `share_status` / `truth_label`
differ from these constants, or whose body contains any of the
forbidden fields (`private_key`, `raw_artifact`, `mint_candidate`,
`token_eligible`, `reward`, `economic_value`, `federation_target`,
etc.). The verifier (`packages/urp/src/local-index-verify.js`)
re-checks the triplet on every read.

## 3. 3-command operator replay

A working Stage 3 chain is exactly three commands against a prepared
`DEMA_HOME` (an authorship key has been initialized and at least one
artifact signed):

```bash
# 1. Write — build + persist a new local index from a verified passport.
dema urp index --passport ./passport.json --json
# → schema: bizra.dema.urp_local_index_cli_result.v0.1
#   exit 0 · file at $DEMA_HOME/urp/indexes/urp-index-<sha256>.json

# 2. List — enumerate all local indexes with filename↔hash parity.
dema urp list --json
# → schema: bizra.dema.urp_local_index_list.v0.1
#   exit 0 · corruption_detected:false · count >= 1

# 3. Verify — re-check one index by path (schema + body hash + filename hash).
dema urp verify "$(dema urp list --json | jq -r '.entries[0].filename | "$DEMA_HOME/urp/indexes/" + .')" --json
# → schema: bizra.dema.urp_local_index_verification.v0.1
#   exit 0 · verdict:VERIFIED · truth_label:LOCAL_VERIFIED_RESOURCE_INDEX_FILE_VERIFIED
```

A failed step at any stage exits 1 with a structured error envelope
(never a partial write, never a silent skip).

## 4. What Stage 3 proves

- **Write/list/verify symmetric.** Three CLI surfaces; one cryptographic substrate.
- **Content-addressed persistence.** Every index file's filename is the SHA-256 of its stable body. Renaming or tampering is detected on read.
- **Deep-verified provenance.** Every entry traces back to an authorship receipt with a verified Ed25519 signature over the artifact's SHA-256.
- **Tamper-detected.** The verifier runs a 12-layer fail-fast check (`missing_path → cannot_read_file → invalid_json → wrong_schema → wrong_mode → wrong_truth_label → wrong_share_status → forbidden_field_present → missing_or_invalid_index_hash → body_hash_mismatch → filename_hash_mismatch`).
- **Boundary-attested.** Every emitted envelope carries an explicit `boundary` block declaring `file_write_performed` / `network_used` / `federation_used` / `token_minted` / `poi_score_calculated` flags.
- **Operator-isolated.** Every test, smoke, and demo run uses a throwaway `DEMA_HOME` under `mkdtemp`; the operator's real `~/.dema/` is never touched by the harness.

## 5. What Stage 3 does NOT prove

- ❌ No share decision (Stage 4 Choose territory)
- ❌ No PoI (Proof of Impact) scoring
- ❌ No token, reward, or economic value claim
- ❌ No mint — content-addressed persistence is not chain-bound minting
- ❌ No federation, MCP message, or peer broadcast
- ❌ No network egress of any kind
- ❌ No operator-visible public/private classification
- ❌ No legal-identity binding (the Ed25519 key is local cryptographic identity only)

These are Stage 4+ concerns and must NOT be inferred from a green
Stage 3 closeout.

## 6. Drift guard

The closeout is replayable. `scripts/urp-stage3-closeout.mjs`
constructs a fresh `DEMA_HOME` under `mkdtemp`, runs `authorship key
init → authorship sign → proof passport → urp index → urp list → urp
verify` against it, asserts every step succeeded, then cleans up. The
script is registered as one probe in `scripts/check.mjs`'s `commands`
array, so `npm run check` exercises it on every full check.

If any sub-CLI regresses (consent phrase change, schema bump,
boundary-field drift, etc.), the closeout script fails its assertion
and `execFileSync` throws — `npm run check` goes RED. The boundary
stops being a doc claim and becomes a continuous invariant.

Operators can replay the closeout manually at any time:

```bash
node scripts/urp-stage3-closeout.mjs
# Success → JSON envelope on stdout, exit 0, truth_label:
#   URP_STAGE_3_LOCAL_INDEX_DEMO_VERIFIED
# Failure → JSON envelope on stderr, exit 1, truth_label:
#   URP_STAGE_3_LOCAL_INDEX_DEMO_FAILED
```

## 7. Status

**Stage 3 closeout is remote-CI verified and drift-guarded.**

This wording is deliberate. Stage 3 is **not** described as
"permanently sealed" — future code can drift, which is exactly why
the drift-guard probe exists. The closeout is a living gate, not a
museum plaque.

## 8. What unlocks next

Stage 4 Choose preflight is unblocked once URP-3.1D is remote-CI
verified. Stage 4 itself remains `DESIGNED_NOT_LIVE`. The Stage 4
preflight must enumerate:

- The exact consent surface required for any share decision
- The schema for a `share_status` transition (the field becomes
  variable instead of constant)
- The classifier that distinguishes shareable metadata from forbidden
  fields (a stricter contract than today's writer-side rejection)
- The audit/replay shape for share decisions themselves

None of these exist yet. Stage 5 Mint remains `DESIGNED_NOT_LIVE`
until Stage 4 is itself drift-guarded.
````

---

## Task 4: Wire the harness probe

**Files:**

- Modify: `scripts/check.mjs` (insert one tuple in the `commands` array, near line 118 after `harness-gate.mjs`)

- [ ] **Step 4.1: Read the current tail of the commands array**

Run: `sed -n '115,120p' scripts/check.mjs`

Expected output:

```
  ["node", ["scripts/urp-shared-discovery.mjs"]],
  ["node", ["scripts/proof-room-bundle.mjs", "--json"]],
  ["node", ["scripts/node0-self-check.mjs", "--verify"]],
  ["node", ["scripts/review/harness-gate.mjs"]],
];
```

- [ ] **Step 4.2: Insert the closeout probe after the harness-gate line**

Apply this exact edit:

Old:

```
  ["node", ["scripts/review/harness-gate.mjs"]],
];
```

New:

```
  ["node", ["scripts/review/harness-gate.mjs"]],
  ["node", ["scripts/urp-stage3-closeout.mjs"]],
];
```

- [ ] **Step 4.3: Verify the insertion**

Run: `grep -nE "urp-stage3-closeout" scripts/check.mjs`

Expected: one match around line 119.

---

## Task 5: Update docs/TESTING.md

**Files:**

- Modify: `docs/TESTING.md` (insert one row after the URP-3.1C-ter verify-test row)

- [ ] **Step 5.1: Locate insertion point**

Run: `grep -n "urp-local-index-verify.test.js" docs/TESTING.md`

Expected: line 48 (immediately after the URP-3.1C-ter test row).

- [ ] **Step 5.2: Insert the closeout-script row**

Append a new row immediately AFTER the existing `urp-local-index-verify.test.js` row.

Use this exact row (single line, pipe-delimited, mirror prior URP padding):

```
| `scripts/urp-stage3-closeout.mjs`                       | URP-3.1D Stage 3 Local Index Closeout drift-guard probe (`scripts/urp-stage3-closeout.mjs` · registered in `scripts/check.mjs`): runs the real cryptographic chain (`authorship key init` with `GENERATE AUTHORSHIP KEY` consent → `authorship sign` with `SIGN AUTHORSHIP RECEIPT` consent → `proof passport --json` → `urp index --passport <p> --json` → `urp list --json` → `urp verify <index> --json`) inside a throwaway `mkdtemp` `DEMA_HOME`; emits `bizra.dema.urp_stage3_closeout_demo.v0.1` envelope on stdout with `demo_passed:true` + `truth_label:URP_STAGE_3_LOCAL_INDEX_DEMO_VERIFIED` on success (exit 0); failure envelope to stderr with `truth_label:URP_STAGE_3_LOCAL_INDEX_DEMO_FAILED` (exit 1). Each subprocess wall-time bounded by `URP_STAGE3_CLOSEOUT_TIMEOUT_MS` (default 30000). Tmpdir cleaned in finally block. No persistent closeout receipt. No share/PoI/mint/federation/network/economic fields. Probe wired into `npm run check` so any sub-CLI regression fails the canonical check loudly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
```

- [ ] **Step 5.3: Verify the insertion**

Run: `grep -nE "urp-stage3-closeout.mjs" docs/TESTING.md`

Expected: one match. Surrounding rows (URP-3.1C-ter verify above, H19.3.1 deep-verify-cli below) should be intact.

---

## Task 6: Update docs/ARCHITECTURE.md

**Files:**

- Modify: `docs/ARCHITECTURE.md` (insert one row after the `dema urp verify` row, before `dema witness verify`)

- [ ] **Step 6.1: Locate insertion point**

Run: `grep -n "dema urp verify\|dema witness verify" docs/ARCHITECTURE.md`

Expected: two matches; insert AFTER the `dema urp verify` row.

- [ ] **Step 6.2: Insert the closeout-script row**

Apply this exact edit:

Old (line for `dema witness verify`):

```
| `dema witness verify` (with `--file <path>`, `--json`, `--latest` default)
```

New (insert a new row BEFORE it):

```
| `scripts/urp-stage3-closeout.mjs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `scripts/urp-stage3-closeout.mjs` · `scripts/check.mjs`                                                                                                                                                                                            | URP-3.1D Stage 3 Local Index Closeout drift-guard probe. One-shot Node script (stdlib only). Runs the real cryptographic chain end-to-end (`authorship key init` with `GENERATE AUTHORSHIP KEY` consent → `authorship sign` with `SIGN AUTHORSHIP RECEIPT` consent → `proof passport --json` → `urp index --passport <p> --json` → `urp list --json` → `urp verify <index> --json`) inside a throwaway `mkdtemp` `DEMA_HOME`; cleans the tmpdir in a `finally` block; emits one schema-tagged JSON envelope (`bizra.dema.urp_stage3_closeout_demo.v0.1`) on stdout with `demo_passed:true` + `truth_label:URP_STAGE_3_LOCAL_INDEX_DEMO_VERIFIED` on success (exit 0); failure envelope to stderr with `truth_label:URP_STAGE_3_LOCAL_INDEX_DEMO_FAILED` (exit 1). Per-subprocess wall-time bound: `URP_STAGE3_CLOSEOUT_TIMEOUT_MS` (default 30000). Registered as one tuple in `scripts/check.mjs`'s `commands` array so `npm run check` exercises it on every full check (`execFileSync` throws on non-zero exit). Not a `dema` subcommand. Not in the `driver.mjs` smoke matrix. No persistent closeout receipt. No share/PoI/mint/federation/network/economic fields. Boundary block: `local_only:true`, `network_used:false`, `share_decision_made:false`, `poi_score_calculated:false`, `token_minted:false`, `federation_used:false`, `persistent_closeout_receipt_written:false`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `dema witness verify` (with `--file <path>`, `--json`, `--latest` default)
```

- [ ] **Step 6.3: Verify the insertion**

Run: `grep -nE "urp-stage3-closeout.mjs" docs/ARCHITECTURE.md`

Expected: one match. The witness-verify row should still appear immediately below.

---

## Task 7: Run all verification gates

**Files:**

- No file changes. Pure verification.

- [ ] **Step 7.1: Smoke matrix**

Run: `node .claude/skills/run-dema/driver.mjs --smoke 2>&1 | tail -5`

Expected: `33/33 PASS · 0 FAIL` (smoke matrix unchanged — closeout is NOT a smoke row).

- [ ] **Step 7.2: Integration check**

Run: `node scripts/review/integration-check.mjs 2>&1 | jq -r '.ok'`

Expected: `true`. If `false`, inspect `.checks[]` for the failed audit. Most likely cause: docs/TESTING.md or docs/ARCHITECTURE.md row missing/mis-pathed — fix the row, do NOT remove the probe.

- [ ] **Step 7.3: Actuator check**

Run: `node scripts/review/actuator-check.mjs 2>&1 | jq -r '.ok, .findings'`

Expected: `true` and `[]`. If `exec(` is flagged inside the script, refactor to `String.match()` or remove the literal substring (same trap as URP-3.1C+).

- [ ] **Step 7.4: Full test suite**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`

Expected: `# tests 3223`, `# pass 3223`, `# fail 0` (no test count change — closeout adds no `tests/*.test.js`).

- [ ] **Step 7.5: Canonical check**

Run: `npm run check 2>&1 | grep -E "\"verdict\": \"CLEAN\"" | tail -1`

Expected: `  "verdict": "CLEAN",` (the harness verdict line). The new probe runs as part of this; failure surfaces here.

- [ ] **Step 7.6: llm:guidance**

Run: `npm run llm:guidance 2>&1 | grep -E "^Result:"`

Expected: `Result: PASS`

- [ ] **Step 7.7: Whitespace**

Run: `git diff --check && echo CLEAN`

Expected: `CLEAN`

- [ ] **Step 7.8: Confirm working tree shape**

Run: `git status -s`

Expected (exactly 5 lines):

```
 M docs/ARCHITECTURE.md
 M docs/TESTING.md
 M scripts/check.mjs
?? docs/security/URP_LOCAL_INDEX_CLOSEOUT.md
?? scripts/urp-stage3-closeout.mjs
```

Note: `docs/superpowers/specs/...-design.md` and `docs/superpowers/plans/...-closeout.md` (this file) may also appear as `??`; commit them in the same commit per repo convention (prior brainstormed slices have shipped spec/plan files alongside the implementation).

---

## Task 8: Commit, push, monitor CI

**Files:**

- No source file changes — git operations only.

- [ ] **Step 8.1: Stage all 5 implementation files + the spec + plan**

Run:

```bash
git add scripts/urp-stage3-closeout.mjs \
        scripts/check.mjs \
        docs/security/URP_LOCAL_INDEX_CLOSEOUT.md \
        docs/TESTING.md \
        docs/ARCHITECTURE.md \
        docs/superpowers/specs/2026-05-28-urp-3-1d-stage3-closeout-design.md \
        docs/superpowers/plans/2026-05-28-urp-3-1d-stage3-closeout.md
```

- [ ] **Step 8.2: Verify staged contents**

Run: `git diff --cached --stat`

Expected: 7 files changed, no surprises in line counts.

- [ ] **Step 8.3: Create the commit**

Run:

```bash
git commit -m "$(cat <<'EOF'
docs(urp): add URP-3.1D local index closeout probe

Freezes the Stage 3 Local Index boundary into a replayable,
drift-guarded closeout before Stage 4 Choose opens any share/PoI/
mint/federation surface. Stacks on:

  URP_3_1C_LOCAL_INDEX_CLI_REMOTE_CI_VERIFIED         (12debb3)
  URP_3_1C_PLUS_LOCAL_INDEX_READ_SURFACE_REMOTE_CI_VERIFIED  (020d36d)
  URP_3_1C_TER_LOCAL_INDEX_VERIFY_REMOTE_CI_VERIFIED  (b1a932f)

Shape B+: docs + replayable real-chain demo script + check.mjs
harness probe. No new dema subcommand. No persistent closeout
receipt. No share/PoI/mint/federation/network.

Files:
- scripts/urp-stage3-closeout.mjs (NEW · ~210 LOC) — stdlib-only
  Node script that runs the real cryptographic chain inside a
  throwaway DEMA_HOME (authorship key init -> sign -> proof
  passport -> urp index -> urp list -> urp verify) and emits one
  bizra.dema.urp_stage3_closeout_demo.v0.1 envelope. Per-subprocess
  wall-time bound (URP_STAGE3_CLOSEOUT_TIMEOUT_MS, default 30000).
  Tmpdir cleaned in finally. Truth label
  URP_STAGE_3_LOCAL_INDEX_DEMO_VERIFIED on success, exit 0.
- scripts/check.mjs — one tuple added so npm run check exercises
  the closeout on every full check; execFileSync throws on any
  non-zero exit.
- docs/security/URP_LOCAL_INDEX_CLOSEOUT.md (NEW) — 8-section
  closeout pair-doc to URP_LOCAL_INDEX_PREFLIGHT.md. Freezes the
  boundary triplet (LOCAL_INDEX_ONLY / MARKED_LOCAL_ONLY /
  LOCAL_VERIFIED_RESOURCE_INDEX). States proves / does-not-prove.
  Uses "remote-CI verified and drift-guarded" wording (never
  "permanently sealed").
- docs/TESTING.md + docs/ARCHITECTURE.md — one row each for the
  new script + harness probe.
- docs/superpowers/specs/2026-05-28-urp-3-1d-stage3-closeout-design.md
  + docs/superpowers/plans/2026-05-28-urp-3-1d-stage3-closeout.md
  (NEW) — brainstormed spec + step-by-step plan (per superpowers
  discipline).

Local gates pre-push:
- node scripts/urp-stage3-closeout.mjs: exit 0,
  URP_STAGE_3_LOCAL_INDEX_DEMO_VERIFIED, tmpdir cleaned
- npm test: 3223/3223 PASS
- npm run check: verdict CLEAN (new probe wired in)
- node scripts/review/integration-check.mjs: ok=true (6/6)
- node scripts/review/actuator-check.mjs: findings=[]
- node .claude/skills/run-dema/driver.mjs --smoke: 33/33 PASS
- git diff --check: CLEAN

After CI green: truth label
URP_3_1D_LOCAL_INDEX_CLOSEOUT_REMOTE_CI_VERIFIED.

Stage 3 closeout is remote-CI verified and drift-guarded.
Stage 4 Choose preflight is unblocked.
Stage 4 and Stage 5 remain DESIGNED_NOT_LIVE.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8.4: Confirm commit landed**

Run: `git log -1 --pretty=format:'%h %s'`

Expected: `<short-sha> docs(urp): add URP-3.1D local index closeout probe`

- [ ] **Step 8.5: Push to origin/main**

Run: `git push origin main 2>&1 | tail -5`

Expected: `<prev-sha>..<new-sha>  main -> main` and `μ-layer gate passed`.

- [ ] **Step 8.6: Arm a Monitor for the 4 CI workflows**

Use the Monitor tool (or `gh run watch <run-id>` if Monitor unavailable) with a 900s timeout, polling `gh run list --branch main --commit <new-sha> --json name,status,conclusion` every 30s. Emit one event per completed workflow.

Expected: 4 events, all `conclusion: success`:

- gitleaks
- CodeQL
- check
- BIZRA Review Gate

- [ ] **Step 8.7: Record truth label on green**

When all 4 workflows are SUCCESS, record in the session ledger:

```
URP_3_1D_LOCAL_INDEX_CLOSEOUT_REMOTE_CI_VERIFIED at <new-sha>
```

Mark URP-3.1D as DONE. Stage 3 closeout is complete. Stage 4 Choose preflight is the next brainstorming-gated slice.

---

## Self-review

**Spec coverage check** (every spec section → at least one task):

| Spec §                                 | Coverage                                                                                                                                                                                                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1 Purpose                             | Task 3 (doc body) + Task 4 (probe wiring)                                                                                                                                                                                                                        |
| §2 Evidence basis                      | Task 8.3 commit body cites all 3 prior SHAs                                                                                                                                                                                                                      |
| §3 File layout (5 files)               | Task 1 (script) · Task 3 (doc) · Task 4 (check.mjs) · Task 5 (TESTING.md) · Task 6 (ARCHITECTURE.md)                                                                                                                                                             |
| §4 Demo script flow (6 steps)          | Task 1.1 implements all 6 with exact consent phrases + isolation env                                                                                                                                                                                             |
| §5 Envelope schema (success + failure) | Task 1.1 emits both shapes; Task 2.2 asserts success shape                                                                                                                                                                                                       |
| §6 Harness probe design                | Task 4 inserts the exact tuple at line 119                                                                                                                                                                                                                       |
| §7 Closeout doc outline (8 sections)   | Task 3.1 writes all 8 sections in order                                                                                                                                                                                                                          |
| §8 Verification gates (8)              | Task 7 runs all 8                                                                                                                                                                                                                                                |
| §9 DOD (10 items)                      | DOD items 1–6 covered by Tasks 1–6; items 7–8 by Task 8.5–8.7; item 9 deferred (decided at commit time); item 10 enforced by Task 1 absence of new package/test/schema                                                                                           |
| §10 Non-goals (9 locked)               | Task 1.1 implements with no new package/test/schema/CLI/persistent receipt; Tasks 5–6 add no new schema row                                                                                                                                                      |
| §11 Risk / self-review                 | R1 mitigated by exact consent phrases in Task 1.1; R2 by stdlib `spawn` + no `RegExp.exec`; R3 by `try/finally rm -rf`; R4 by stable string literal; R5 by real-chain only; R6 by this plan + spec gate; R7 by Task 3 wording; R8 by Task 7.2 fix-don't-suppress |

**Placeholder scan:** no TBD / TODO / "add error handling" / "similar to Task N" anywhere. Every code block is complete.

**Type consistency:** schema string `bizra.dema.urp_stage3_closeout_demo.v0.1` used identically in Task 1 (emission) and Task 5 / Task 6 (doc rows). Truth labels `URP_STAGE_3_LOCAL_INDEX_DEMO_VERIFIED` / `_FAILED` used identically in Task 1, Task 2.2, Task 3 §6, Task 5, Task 6. Boundary block field names match between Task 1 success and failure envelopes and across Task 3 §6 and Task 5 / Task 6 rows.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-28-urp-3-1d-stage3-closeout.md`. Two execution options per writing-plans skill:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. Each task is fully self-contained.
2. **Inline Execution** — execute tasks in the current session using `superpowers:executing-plans`, batch execution with checkpoints.

Per Mumu's /A mode + recurring "proceed" pattern, default is Inline Execution unless overridden.
