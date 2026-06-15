import {
  buildExplainPreview,
  formatExplainPreview,
  getPerspective,
} from "../../../../packages/core/src/canon-glossary.js";
import { recordIntroSeen } from "../../../../packages/core/src/intro-line.js";

export async function cmd_explain(ctx) {
  const { argv } = ctx;
  // Parse perspective flags — these are mutually exclusive; last one wins.
  const PERSP_FLAGS = [
    "--simple",
    "--technical",
    "--arabic",
    "--game",
    "--all",
  ];
  let perspFlag = null;
  for (const f of PERSP_FLAGS) {
    if (argv.includes(f)) perspFlag = f;
  }
  const wantJson = argv.includes("--json");

  // Strip all flags to isolate the concept token.
  const conceptArgs = argv.slice(1).filter((a) => !a.startsWith("--"));
  const concept = conceptArgs[0] ?? null;

  // No-flag default behaves identically to --simple (preserves existing behavior).
  if (!perspFlag || perspFlag === "--simple") {
    const preview = buildExplainPreview(concept);
    if (wantJson) {
      // Add perspectives map (simple only) for JSON output.
      const persp = concept
        ? {
            simple: getPerspective(concept, "simple") ?? preview.short ?? null,
          }
        : undefined;
      const out =
        persp !== undefined ? { ...preview, perspectives: persp } : preview;
      console.log(JSON.stringify(out, null, 2));
      process.exit(process.exitCode ?? 0);
    }
    console.log(formatExplainPreview(preview));
    if (concept === "dema") {
      const { join: pj } = await import("node:path");
      const { homedir: hd } = await import("node:os");
      const explainHome = process.env.DEMA_HOME || pj(hd(), ".dema");
      await recordIntroSeen({
        home: explainHome,
        suppressedBy: "user-explain",
      });
    }
    process.exit(process.exitCode ?? 0);
  }

  // --all, --technical, --arabic, --game paths require a concept.
  const preview = buildExplainPreview(concept);

  // Listing or not-found fall through to standard formatter for these flags too.
  if (!concept || preview.mode === "listing" || preview.matched === false) {
    console.log(formatExplainPreview(preview));
    process.exit(process.exitCode ?? 0);
  }

  const PERSPECTIVES_ORDER = ["simple", "technical", "game", "arabic"];

  if (perspFlag === "--all") {
    if (wantJson) {
      const perspMap = {};
      for (const p of PERSPECTIVES_ORDER) {
        const t = getPerspective(concept, p);
        if (t !== null) perspMap[p] = t;
      }
      console.log(
        JSON.stringify({ ...preview, perspectives: perspMap }, null, 2),
      );
      process.exit(process.exitCode ?? 0);
    }
    const lines = [preview.title, ""];
    for (const p of PERSPECTIVES_ORDER) {
      const text = getPerspective(concept, p);
      lines.push(`── ${p.toUpperCase()} ──`);
      if (text !== null) {
        lines.push("  " + text);
      } else {
        lines.push(
          `  ⚠ The ${p} perspective for this concept is not yet authored.`,
        );
      }
      lines.push("");
    }
    lines.push(`  Truth label: ${preview.truth_label}`);
    if (preview.see_also && preview.see_also.length > 0) {
      lines.push("");
      lines.push("  See also: " + preview.see_also.join(", "));
    }
    console.log(lines.join("\n"));
    process.exit(process.exitCode ?? 0);
  }

  // Single named perspective: --technical, --arabic, --game.
  const perspName = perspFlag.slice(2); // strip leading "--"
  const text = getPerspective(concept, perspName);

  if (wantJson) {
    const perspMap = text !== null ? { [perspName]: text } : {};
    console.log(
      JSON.stringify({ ...preview, perspectives: perspMap }, null, 2),
    );
    process.exit(process.exitCode ?? 0);
  }

  if (text === null) {
    const available = PERSPECTIVES_ORDER.filter(
      (p) => getPerspective(concept, p) !== null,
    );
    console.log(
      [
        preview.title,
        "  " + (getPerspective(concept, "simple") ?? preview.short),
        "",
        `  ⚠ The ${perspName} perspective for this concept is not yet authored.`,
        `  Available perspectives: ${available.join(", ") || "simple"}`,
        `  Type \`dema explain ${concept}\` for the simple form, or`,
        `       \`dema explain --all ${concept}\` for all available perspectives.`,
      ].join("\n"),
    );
    process.exit(process.exitCode ?? 0);
  }

  console.log(
    [
      preview.title,
      "  " + text,
      "",
      `  Truth label: ${preview.truth_label}`,
      preview.see_also && preview.see_also.length > 0
        ? "  See also: " + preview.see_also.join(", ")
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  process.exit(process.exitCode ?? 0);
}
