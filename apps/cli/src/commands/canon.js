import { buildDemaFirstLessonCanon, verifyDemaFirstLessonCanon } from "../../../../packages/core/src/dema-first-lesson-canon.js";
import {
  buildKnowledgeBundleView,
  verifyKnowledgeBundleView,
} from "../../../../packages/core/src/dema-knowledge-bundle-reader.js";
import { readFirstLessonMarkdown } from "./first-lesson-gatherer.js";
import { gatherKnowledgeBundle } from "./knowledge-bundle-gatherer.js";

export async function cmd_canon(ctx) {
  const { argv } = ctx;
  const sub = argv[1];
  const wantJson = argv.includes("--json");
  const pathIdx = argv.indexOf("--path");
  const explicitPath = pathIdx !== -1 ? argv[pathIdx + 1] : undefined;

  if (sub === "knowledge") {
    return cmd_canon_knowledge({ wantJson, explicitPath });
  }

  if (sub !== "first-lesson") {
    console.error(
      "dema canon: local canon surfaces (read-only). Subcommands:\n" +
        "  dema canon first-lesson [--json] [--path <abs.md>]\n" +
        "  dema canon knowledge [--json] [--path <bundle-dir>]",
    );
    process.exitCode = 1;
    return;
  }

  const read = readFirstLessonMarkdown({ path: explicitPath });
  if (!read.ok) {
    const msg = `Failed to read first lesson at ${read.source_path}: ${read.error}`;
    if (wantJson) {
      console.log(JSON.stringify({ error: msg, source_path: read.source_path }, null, 2));
    } else {
      console.error(msg);
    }
    process.exitCode = 1;
    return;
  }

  const canon = buildDemaFirstLessonCanon({
    lesson_markdown: read.lesson_markdown,
    source_path: read.source_path,
    read_at_iso: new Date().toISOString(),
  });
  const verify = verifyDemaFirstLessonCanon(canon);

  if (wantJson) {
    console.log(JSON.stringify({ ...canon, verify }, null, 2));
    process.exitCode = canon.rejected || !verify.ok ? 1 : 0;
    return;
  }

  if (canon.rejected) {
    console.error(`First lesson canon rejected: ${canon.reason_code}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Dema first lesson canon (retrieval seed) — ${canon.truth_label}`);
  console.log(`  source: ${canon.source_path}`);
  console.log(`  hash:   ${canon.content_hash?.slice(0, 16)}…`);
  console.log(`  axioms: ${canon.axioms_detected} detected · ${canon.retrieval_char_count} retrieval chars`);
  console.log(`  verify: ${verify.ok ? "ok" : verify.blocked_by.join(", ")}`);
  console.log("  Use with talk: dema talk \"…\" --with-first-lesson --consent \"GO: invoke …\"");
  console.log("  This does not teach weights — retrieval injection only.");
}

// DEMA-KNOWLEDGE-BUNDLE-READER-1A — `dema canon knowledge`.
// The verdict is computed INSIDE the emit path: an envelope whose summaries do
// not re-derive from its own rows is refused with exit 1, never printed.
function cmd_canon_knowledge({ wantJson, explicitPath }) {
  const gathered = gatherKnowledgeBundle({ path: explicitPath });
  if (!gathered.ok) {
    const msg = `dema canon knowledge: ${gathered.error} at ${gathered.bundle_path}`;
    if (wantJson) {
      console.log(JSON.stringify({ error: msg, bundle_path: gathered.bundle_path }, null, 2));
    } else {
      console.error(msg);
    }
    process.exitCode = 1;
    return;
  }

  const view = buildKnowledgeBundleView(gathered.observations);
  const verify = verifyKnowledgeBundleView(view);
  if (!verify.ok) {
    console.error(`dema canon knowledge: envelope refused (${verify.reason}) — not printing an unverifiable view`);
    process.exitCode = 1;
    return;
  }

  if (wantJson) {
    console.log(JSON.stringify(view, null, 2));
    return;
  }

  console.log(`Dema knowledge bundle — ${view.truth_label}`);
  console.log(`  bundle: ${view.bundle_path}`);
  console.log(`  cards: ${view.card_count} across ${view.folders.length} folders · change log: ${view.log_present ? "present" : "ABSENT"}`);
  for (const folder of view.folders) {
    console.log(`    ${folder.name}: ${folder.card_count}`);
  }
  const types = Object.entries(view.type_counts)
    .map(([t, n]) => `${t}=${n}`)
    .join(" ");
  console.log(`  types: ${types || "none"}`);
  // Always stated, even when zero — silence never means lawful.
  console.log(`  law violations: ${view.law_violation_count}`);
  for (const violation of view.law_violations) {
    console.log(`    LAWLESS ${violation.file} — missing ${violation.missing.join("+")}`);
  }
  console.log(`  verify: ok`);
  console.log("  Read-only observation. Proves what Dema can enumerate, not what it has understood.");
}
