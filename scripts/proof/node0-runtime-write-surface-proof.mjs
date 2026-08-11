#!/usr/bin/env node
// NODE0-RUNTIME-WRITE-SURFACE-1A — the producer for `remote_write`.
//
//   node scripts/proof/node0-runtime-write-surface-proof.mjs [--dema-home <p>] [--json]
//
// Observes the REAL Genesis host, read-only, across the five required surfaces,
// and records the verdict as an artefact the closure adapter can read.
//
// SUBJECT AND DESTINATION ARE SEPARATE, and that separation is an authorization
// boundary, not a convenience. The invariant's subject is the REAL sovereign
// home, but writing an artefact into the very directory whose write surface is
// being judged would both mutate it and change the thing measured. So
// --subject-home names what is OBSERVED (default: the real DEMA_HOME, read-only)
// and --dema-home names where the artefact is WRITTEN (a disposable directory).
// The observed subject is recorded in the artefact: a verdict about an unnamed
// home is not a verdict about this node.
//
// BOUNDARY: strictly read-only against the host. Reads metadata, lists sockets
// and process names, reads git config. Never chmods, mounts, opens or closes a
// port, restarts a service, kills a process, fetches, pushes, or elevates.
// authority_delta = 0, effect_delta = 0.

import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256CanonicalJsonV1 } from "../../packages/canon/src/sha256-canonical-json-v1.js";
import { buildRuntimeWriteSurfaceObservation } from "../../packages/core/src/node0-runtime-write-surface.js";
import {
  currentRuntimeWriteSurfaceKernelHash,
  RUNTIME_WRITE_SURFACE_ARTEFACT_RELPATH,
} from "../../packages/core/src/node0-runtime-write-surface-adapter.js";
import {
  gatherRuntimeWriteSurface,
  resolveDemaHome,
} from "../../apps/cli/src/node0-runtime-write-surface-gatherer.js";

const argv = process.argv.slice(2);
const JSON_MODE = argv.includes("--json");
const hi = argv.indexOf("--dema-home");
const DEMA_HOME = hi !== -1 ? argv[hi + 1] : mkdtempSync(join(tmpdir(), "node0-write-surface-"));
const ni = argv.indexOf("--node-id");
const NODE_ID = ni !== -1 ? argv[ni + 1] : null;
const si = argv.indexOf("--subject-home");
// Default subject is the REAL sovereign home — observed read-only, never written.
const SUBJECT_HOME = si !== -1 ? argv[si + 1] : resolveDemaHome();

const { subject, surfaces } = await gatherRuntimeWriteSurface({
  demaHome: SUBJECT_HOME, nodeId: NODE_ID,
});

const observation = buildRuntimeWriteSurfaceObservation({
  surfaces,
  subject,
  evidenceClass: "OBSERVED",
  observedAt: new Date().toISOString(),
  executedCodeHash: currentRuntimeWriteSurfaceKernelHash(),
  hash: sha256CanonicalJsonV1,
});

const artefact = join(DEMA_HOME, RUNTIME_WRITE_SURFACE_ARTEFACT_RELPATH);
mkdirSync(dirname(artefact), { recursive: true });
// The artefact the ADAPTER reads must be EXACTLY what was hashed, so the raw
// probe evidence goes in a sibling file rather than into the hashed body.
writeFileSync(artefact, `${JSON.stringify(observation, null, 2)}\n`);
const evidencePath = join(DEMA_HOME, "node0", "write-surface", "probe-evidence.json");
writeFileSync(evidencePath, `${JSON.stringify({ subject, surfaces }, null, 2)}\n`);

const report = {
  schema: "bizra.dema.node0_runtime_write_surface_proof.v0.1",
  dema_home: DEMA_HOME,
  artefact,
  probe_evidence: evidencePath,
  surface_verdict: observation.surface_verdict,
  observed: observation.observed,
  surface_states: observation.surface_states,
  writers_observed: observation.writers_observed,
  coverage: observation.coverage,
  observation_hash: observation.observation_hash,
  what_this_does_not_prove:
    "Does not prove that a compromised kernel, root actor, firmware or hypervisor could never "
    + "mutate this directory; those sit beneath every probe here. A CLOSED verdict is bounded to "
    + "the five required surfaces at observation time, on the host that was actually observed.",
};

if (JSON_MODE) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`verdict:    ${report.surface_verdict}   observed=${report.observed}`);
  console.log(`subject:    ${observation.subject.dema_home}`);
  for (const [k, v] of Object.entries(report.surface_states)) console.log(`  ${k.padEnd(16)} ${v}`);
  if (report.writers_observed.length) console.log(`WRITERS:    ${report.writers_observed.join(", ")}`);
  if (report.coverage.unavailable.length) console.log(`unavailable: ${report.coverage.unavailable.join(", ")}`);
  if (report.coverage.unresolved.length) console.log(`unresolved:  ${report.coverage.unresolved.join(", ")}`);
  console.log(`artefact:   ${artefact}`);
}
// A decided verdict exits 0 whichever way it decided; an undecided one exits 1,
// because "we could not tell" is not a successful observation.
process.exit(observation.observed === null ? 1 : 0);
