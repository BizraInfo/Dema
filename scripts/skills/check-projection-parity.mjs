#!/usr/bin/env node
/**
 * check-projection-parity.mjs
 *
 * CI parity gate: verify that all harness projections match the canonical
 * skills-src/ source. Fails if any projection has diverged.
 *
 * Usage:
 *   node scripts/skills/check-projection-parity.mjs [--json]
 *
 * Exit 0 = all projections match canonical source.
 * Exit 1 = drift detected or canonical source missing.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = join(import.meta.dirname, '..', '..');
const SKILLS_SRC = join(ROOT, 'skills-src');
const REGISTRY_PATH = join(SKILLS_SRC, 'registry.json');

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function listFilesRecursive(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

function hashDir(dir) {
  const files = listFilesRecursive(dir);
  const hashes = {};
  for (const f of files) {
    const rel = relative(dir, f);
    hashes[rel] = sha256(readFileSync(f));
  }
  return hashes;
}

function checkParity() {
  const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
  const results = [];
  let allOk = true;

  for (const skill of registry.skills) {
    const sourceDir = join(SKILLS_SRC, skill.skill_id);
    if (!existsSync(sourceDir)) {
      results.push({
        skill_id: skill.skill_id,
        status: 'MISSING_SOURCE',
        ok: false
      });
      allOk = false;
      continue;
    }

    const sourceHashes = hashDir(sourceDir);

    for (const target of registry.projection_targets) {
      const targetDir = join(ROOT, target, 'skills', skill.skill_id);
      if (!existsSync(targetDir)) {
        results.push({
          skill_id: skill.skill_id,
          projection: target,
          status: 'MISSING_PROJECTION',
          ok: false
        });
        allOk = false;
        continue;
      }

      // Filter out non-canonical files from comparison
      const EXCLUDED = ['projection-manifest.json'];
      const shouldExclude = (p) => EXCLUDED.includes(p) || p.includes('__pycache__');
      const targetHashes = hashDir(targetDir);
      const divergences = [];

      // Check for files in source missing from projection
      for (const [rel, hash] of Object.entries(sourceHashes)) {
        if (shouldExclude(rel)) continue;
        if (targetHashes[rel] !== hash) {
          divergences.push({
            file: rel,
            source_hash: hash.substring(0, 12),
            projection_hash: (targetHashes[rel] || 'MISSING').substring(0, 12)
          });
        }
      }

      // Check for extra files in projection not in source
      for (const rel of Object.keys(targetHashes)) {
        if (shouldExclude(rel)) continue;
        if (!sourceHashes[rel]) {
          divergences.push({
            file: rel,
            source_hash: 'NOT_IN_SOURCE',
            projection_hash: targetHashes[rel].substring(0, 12)
          });
        }
      }

      const ok = divergences.length === 0;
      if (!ok) allOk = false;

      results.push({
        skill_id: skill.skill_id,
        projection: target,
        status: ok ? 'PARITY' : 'DRIFT',
        ok,
        divergences: ok ? undefined : divergences
      });
    }
  }

  return { allOk, results, registry_hash: sha256(readFileSync(REGISTRY_PATH)) };
}

function main() {
  const jsonMode = process.argv.includes('--json');
  const { allOk, results, registry_hash } = checkParity();

  if (jsonMode) {
    console.log(JSON.stringify({ ok: allOk, registry_hash, results }, null, 2));
  } else {
    console.log('=== Projection Parity Check ===');
    console.log(`Registry hash: sha256:${registry_hash}`);
    console.log('');

    for (const r of results) {
      const icon = r.ok ? '✓' : '✗';
      const detail = r.divergences
        ? ` (${r.divergences.length} divergent file(s))`
        : '';
      console.log(`  ${icon} ${r.skill_id} @ ${r.projection}: ${r.status}${detail}`);
      if (r.divergences) {
        for (const d of r.divergences) {
          console.log(`      ${d.file}: source=${d.source_hash} projection=${d.projection_hash}`);
        }
      }
    }

    console.log('');
    console.log(allOk ? 'PARITY: all projections match canonical source' : 'DRIFT DETECTED — fix divergences before merging');
  }

  process.exit(allOk ? 0 : 1);
}

main();
