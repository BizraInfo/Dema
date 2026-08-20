// `dema web` — DEMA-WEB-WITNESS-1A (CLI surface over the witness kernel).
//
//   witness — one consented, credential-free GET → content-addressed witness.
//   diff    — pure comparison of two saved witnesses; no network at all.
//
// The CLI adds no policy of its own: the exact consent phrase, URL hygiene,
// bounds and the executed boundary all live in the kernel, fail-closed. The
// verdict is computed inside the emit path — a witness that fails its own
// re-verification is refused, never printed.
import nodeFs from "node:fs";
import {
  buildWebWitness,
  verifyWebWitness,
  diffWebWitness,
  DEMA_WEB_WITNESS_GO_PHRASE,
} from "../../../../packages/core/src/dema-web-witness.js";
import { gatherWebWitnessObservation } from "../web-witness-gatherer.js";

const USAGE = Object.freeze({
  schema: "bizra.dema.web_cli.v0.1",
  subcommands: Object.freeze({
    witness:
      'dema web witness <url> --consent "<witness phrase>" [--json]',
    diff: "dema web diff <earlier-witness.json> <later-witness.json> [--json]",
  }),
  witness_phrase: DEMA_WEB_WITNESS_GO_PHRASE,
  boundary:
    "one GET · no credentials · no cookies · no script execution · nothing written · raw body not retained",
});

function flagValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
}

function emit(obj, code) {
  console.log(JSON.stringify(obj, null, 2));
  process.exitCode = code;
}

function readJsonFile(path) {
  try {
    return { parsed: JSON.parse(nodeFs.readFileSync(path, "utf8")) };
  } catch {
    return { error: "file_unreadable_or_not_json" };
  }
}

export async function cmd_web(ctx) {
  const { argv } = ctx;
  const sub = argv[1];
  const wantJson = argv.includes("--json");

  if (sub === "witness") {
    const url = argv[2] && !argv[2].startsWith("--") ? argv[2] : null;
    const consent = flagValue(argv, "--consent");
    if (!url) return emit({ error: "url_required", usage: USAGE }, 1);
    if (consent !== DEMA_WEB_WITNESS_GO_PHRASE) {
      return emit(
        {
          error: "consent_exact_string_mismatch",
          required_phrase: DEMA_WEB_WITNESS_GO_PHRASE,
          note: "Nothing was fetched. The witness performs one network GET and only under this exact phrase.",
        },
        1,
      );
    }
    const gathered = await gatherWebWitnessObservation(url, {
      fetchImpl: ctx.fetchImpl ?? fetch,
    });
    if (!gathered.ok) {
      return emit({ error: gathered.reason, detail: gathered.detail }, 1);
    }
    const built = buildWebWitness({ consent, observation: gathered.observation });
    if (!built.ok) return emit({ error: built.reason }, 1);
    // The verdict is computed inside the emit path: a witness whose hash does
    // not re-derive from its own body is refused, never printed.
    const verdict = verifyWebWitness(built.witness);
    if (!verdict.ok) return emit({ error: verdict.reason }, 1);

    if (wantJson) return emit(built.witness, 0);
    const w = built.witness;
    console.log(`Dema web witness (read-only) — ${w.truth_label}`);
    console.log(`  url:     ${w.final_url}${w.redirected ? ` (redirected from ${w.request_url})` : ""}`);
    console.log(`  status:  ${w.status} · ${w.content_type ?? "unknown type"} · ${w.body_byte_length} bytes${w.body_overflow ? " · OVERFLOW (no hash)" : ""}`);
    console.log(`  body:    sha256:${w.body_sha256 ?? "—"}`);
    if (w.title) console.log(`  title:   ${w.title}`);
    console.log(`  links:   ${w.link_count_total} found${w.link_count_total > w.links.length ? ` (${w.links.length} carried)` : ""}`);
    console.log(`  witness: sha256:${w.witness_hash}`);
    console.log("  One GET, no credentials, no scripts executed; save with --json to diff later.");
    return;
  }

  if (sub === "diff") {
    const aPath = argv[2];
    const bPath = argv[3];
    if (!aPath || !bPath) return emit({ error: "two_witness_files_required", usage: USAGE }, 1);
    const a = readJsonFile(aPath);
    if (a.error) return emit({ error: a.error, file: aPath }, 1);
    const b = readJsonFile(bPath);
    if (b.error) return emit({ error: b.error, file: bPath }, 1);
    const verdict = diffWebWitness(a.parsed, b.parsed);
    if (!verdict.ok) return emit(verdict, 1);
    if (wantJson) return emit(verdict, 0);
    console.log("Dema web witness diff (pure — no network)");
    console.log(`  same url:   ${verdict.same_url}`);
    console.log(`  same body:  ${verdict.same_body}`);
    console.log(`  status:     ${verdict.status_changed ? "CHANGED" : "unchanged"}`);
    console.log(`  bytes Δ:    ${verdict.byte_length_delta ?? "—"}`);
    console.log(`  earlier:    ${verdict.earlier_fetched_at} · ${verdict.earlier_body_sha256?.slice(0, 16)}…`);
    console.log(`  later:      ${verdict.later_fetched_at} · ${verdict.later_body_sha256?.slice(0, 16)}…`);
    return;
  }

  return emit(USAGE, 1);
}
