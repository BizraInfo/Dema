// DEMA-KNOWLEDGE-BUNDLE-READER-1A — read-only gatherer.
//
// Plain fs reads over the bundle directory: top-level index.md/log.md presence,
// one level of card folders, and every .md card's bytes, sha256, and minimal
// frontmatter (type / title / source presence). No write, no network, no
// content beyond the card files themselves. The kernel stays pure — this file
// owns every effect.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

import { DEFAULT_KNOWLEDGE_BUNDLE_PATH } from "../../../../packages/core/src/dema-knowledge-bundle-reader.js";

// Minimal frontmatter scan: the block between a leading `---` line and the next
// `---` line. No YAML dependency (zero-dep law); only the three fields the card
// law needs, matched at line starts.
function scanFrontmatter(markdown) {
  if (!markdown.startsWith("---")) return { type: null, title: null, has_source: false };
  const end = markdown.indexOf("\n---", 3);
  if (end === -1) return { type: null, title: null, has_source: false };
  const block = markdown.slice(3, end);
  const field = (name) => {
    const m = block.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
  };
  return {
    type: field("type"),
    title: field("title"),
    has_source: /^source:\s*\S/m.test(block),
  };
}

export function gatherKnowledgeBundle({ path } = {}) {
  const bundlePath =
    path || process.env.BIZRA_KNOWLEDGE_DIR || DEFAULT_KNOWLEDGE_BUNDLE_PATH;

  const indexPath = join(bundlePath, "index.md");
  if (!existsSync(indexPath)) {
    return {
      ok: false,
      bundle_path: bundlePath,
      error: "no knowledge bundle (index.md absent)",
    };
  }

  const folders = [];
  for (const entry of readdirSync(bundlePath, { withFileTypes: true })) {
    // Dot-directories (.git, .claude, …) are machinery, never card folders —
    // measured on the first live run against the real bundle.
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const folderPath = join(bundlePath, entry.name);
    const cards = [];
    for (const fileEntry of readdirSync(folderPath, { withFileTypes: true })) {
      if (!fileEntry.isFile() || !fileEntry.name.endsWith(".md")) continue;
      const filePath = join(folderPath, fileEntry.name);
      const raw = readFileSync(filePath);
      const front = scanFrontmatter(raw.toString("utf8"));
      cards.push({
        file: `${entry.name}/${fileEntry.name}`,
        bytes: statSync(filePath).size,
        sha256: createHash("sha256").update(raw).digest("hex"),
        type: front.type,
        title: front.title,
        has_source: front.has_source,
      });
    }
    folders.push({ name: entry.name, cards });
  }

  return {
    ok: true,
    observations: {
      bundle_path: bundlePath,
      index_present: true,
      log_present: existsSync(join(bundlePath, "log.md")),
      folders,
    },
  };
}
