import {
  buildKeyMakerCompliancePreview,
  buildKeyMakerComplianceSummary,
} from "../../../../packages/core/src/key-maker-compliance.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_key_maker_check(ctx) {
  const { argv } = ctx;
  const door = argValue(argv, "--door") ?? "";
  const preview = argv.includes("--summary")
    ? buildKeyMakerComplianceSummary({ door })
    : buildKeyMakerCompliancePreview({ door });
  console.log(JSON.stringify(preview, null, 2));
  process.exit(process.exitCode ?? 0);
}
