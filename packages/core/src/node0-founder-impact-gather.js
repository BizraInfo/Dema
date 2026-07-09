// NODE0-FOUNDER-IMPACT-GATHER-0A — read-only gatherer for the founder-impact loop.
//
// Reads ONLY the DECLARED bounded source set named in a manifest, over an INJECTED fs (no node:fs import
// here → this module stays kernel-purity-clean). Local filesystem only: every declared path is resolved
// under the manifest root and a path that escapes the root is refused (traversal guard). It reads each
// file's text (for the pure kernel to hash / sanitize / digest) and shapes the loop input — it performs
// NO write, NO network, NO model, and never mutates a source.
//
// The gatherer is the ONLY place source content is read; the pure kernel receives that text transiently to
// bind a hash, and the receipt stores hashes, never bytes.

import { isAbsolute, resolve, sep } from "node:path";

export const NODE0_FOUNDER_IMPACT_GATHER_SCHEMA = "bizra.dema.founder_impact_gather.v0.1";

// Resolve a declared source path under the manifest root; refuse anything that escapes it.
function resolveWithinRoot(root, p) {
  const abs = isAbsolute(p) ? resolve(p) : resolve(root, p);
  const rootAbs = resolve(root);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + sep)) return null;
  return abs;
}

// Validate the manifest shape without reading anything. Returns { ok, blocked_by, normalized }.
export function validateFounderImpactManifest(manifest) {
  const blocked_by = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { ok: false, blocked_by: ["manifest_not_object"], normalized: null };
  }
  if (typeof manifest.root !== "string" || manifest.root.trim() === "") blocked_by.push("manifest_root_missing");
  if (!Array.isArray(manifest.sources) || manifest.sources.length === 0) blocked_by.push("manifest_sources_missing");
  else {
    manifest.sources.forEach((s, i) => {
      if (!s || typeof s !== "object") blocked_by.push(`source_not_object:${i}`);
      else {
        if (typeof s.path !== "string" || s.path.trim() === "") blocked_by.push(`source_path_missing:${i}`);
        if (typeof s.type !== "string" || s.type.trim() === "") blocked_by.push(`source_type_missing:${i}`);
      }
    });
  }
  return {
    ok: blocked_by.length === 0,
    blocked_by,
    normalized: blocked_by.length === 0
      ? {
          root: manifest.root,
          sources: manifest.sources.map((s) => ({ path: s.path, type: s.type })),
          claims: manifest.claims && typeof manifest.claims === "object" ? manifest.claims : { claims: [], evidence: {} },
          fde_input: manifest.fde_input && typeof manifest.fde_input === "object" ? manifest.fde_input : {},
        }
      : null,
  };
}

// Read the declared bounded source set (read-only) and shape the loop input. `fs` is injected and must
// provide async `readFile(path, "utf8")` and `stat(path)`; `nowUnused` is intentionally absent (no clock).
export async function gatherFounderImpactSources({ manifest, fs } = {}) {
  const validation = validateFounderImpactManifest(manifest);
  if (!validation.ok) return { ok: false, blocked_by: validation.blocked_by, input: null };
  if (!fs || typeof fs.readFile !== "function" || typeof fs.stat !== "function") {
    return { ok: false, blocked_by: ["fs_not_injected"], input: null };
  }

  const { root, sources, claims, fde_input } = validation.normalized;
  const blocked_by = [];
  const gathered = [];
  for (const s of sources) {
    const abs = resolveWithinRoot(root, s.path);
    if (!abs) {
      blocked_by.push(`path_escapes_root:${s.path}`);
      continue;
    }
    let st;
    try {
      st = await fs.stat(abs);
    } catch {
      blocked_by.push(`source_unreadable:${s.path}`);
      continue;
    }
    if (st && typeof st.isDirectory === "function" && st.isDirectory()) {
      blocked_by.push(`source_is_directory:${s.path}`);
      continue;
    }
    let text;
    try {
      text = await fs.readFile(abs, "utf8");
    } catch {
      blocked_by.push(`source_unreadable:${s.path}`);
      continue;
    }
    gathered.push({ source: s.path, type: s.type, text });
  }

  if (blocked_by.length > 0) return { ok: false, blocked_by, input: null };
  return {
    ok: true,
    blocked_by: [],
    input: { sources: gathered, claims, fde_input },
  };
}
