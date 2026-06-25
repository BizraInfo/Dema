import { buildDemaFirstLessonCanon, verifyDemaFirstLessonCanon } from "../../../../packages/core/src/dema-first-lesson-canon.js";
import { readFirstLessonMarkdown } from "./first-lesson-gatherer.js";

export async function cmd_canon(ctx) {
  const { argv } = ctx;
  const sub = argv[1];
  const wantJson = argv.includes("--json");
  const pathIdx = argv.indexOf("--path");
  const explicitPath = pathIdx !== -1 ? argv[pathIdx + 1] : undefined;

  if (sub !== "first-lesson") {
    console.error(
      "dema canon: local canon surfaces (read-only). Subcommands:\n" +
        "  dema canon first-lesson [--json] [--path <abs.md>]",
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
