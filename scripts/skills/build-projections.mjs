#!/usr/bin/env node
/**
 * build-projections.mjs
 *
 * Generate harness projections (.claude/skills and .agents/skills) from
 * the canonical skills-src/ registry. Each projection is a copy of the
 * canonical SKILL.md plus any referenced files, with a projection
 * manifest recording the source hash and projection target.
 *
 * Usage:
 *   node scripts/skills/build-projections.mjs [--dry-run] [--target .claude|.agents|both]
 *
 * The script does NOT overwrite files that already match the canonical
 * hash. To force overwrite, pass --force.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = join(import.meta.dirname, '..', '..');
const SKILLS_SRC = join(ROOT, 'skills-src');
const REGISTRY_PATH = join(SKILLS_SRC, 'registry.json');

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function loadRegistry() {
  const raw = readFileSync(REGISTRY_PATH, 'utf8');
  return JSON.parse(raw);
}

function loadContract(contractPath) {
  const full = join(ROOT, contractPath);
  const raw = readFileSync(full, 'utf8');
  return JSON.parse(raw);
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

function computeManifest(skillDir) {
  const files = listFilesRecursive(skillDir);
  const entries = [];
  for (const filePath of files) {
    const rel = relative(skillDir, filePath);
    const content = readFileSync(filePath);
    entries.push({
      path: rel,
      sha256: sha256(content),
      size: statSync(filePath).size
    });
  }
  const manifest = {
    schema: 'bizra.skill-manifest/v1',
    generated_at: new Date().toISOString(),
    source_root: 'skills-src',
    files: entries,
    total_files: entries.length,
    total_bytes: entries.reduce((sum, e) => sum + e.size, 0)
  };
  return manifest;
}

function projectSkill(skillId, targetDir, manifest, force) {
  const sourceDir = join(SKILLS_SRC, skillId);
  const targetSkillDir = join(targetDir, skillId);

  if (!existsSync(sourceDir)) {
    console.error(`  ✗ Source directory not found: ${sourceDir}`);
    return false;
  }

  const sourceFiles = listFilesRecursive(sourceDir);
  let projected = 0;
  let skipped = 0;

  for (const srcFile of sourceFiles) {
    const rel = relative(sourceDir, srcFile);
    const destFile = join(targetSkillDir, rel);
    const content = readFileSync(srcFile);
    const hash = sha256(content);

    // Check if dest already exists with same hash
    if (!force && existsSync(destFile)) {
      const existing = readFileSync(destFile);
      if (sha256(existing) === hash) {
        skipped++;
        continue;
      }
    }

    mkdirSync(dirname(destFile), { recursive: true });
    writeFileSync(destFile, content);
    projected++;
  }

  // Write projection manifest
  const projManifest = {
    schema: 'bizra.skill-projection/v1',
    skill_id: skillId,
    projection_target: targetDir.includes('.claude') ? '.claude' : '.agents',
    source_registry_hash: sha256(readFileSync(REGISTRY_PATH)),
    contract_hash: sha256(readFileSync(join(sourceDir, 'contract.json'))),
    generated_at: new Date().toISOString(),
    files_projected: projected,
    files_skipped: skipped
  };
  const manifestPath = join(targetSkillDir, 'projection-manifest.json');
  writeFileSync(manifestPath, JSON.stringify(projManifest, null, 2) + '\n');

  return { projected, skipped };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const targetIdx = args.indexOf('--target');
  const targetArg = targetIdx >= 0 ? args[targetIdx + 1] : 'both';

  console.log('=== Skill Projection Builder ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'WRITE'}`);
  console.log(`Target: ${targetArg}`);
  console.log(`Force: ${force}`);
  console.log('');

  const registry = loadRegistry();
  console.log(`Registry: ${registry.skills.length} skills`);
  console.log('');

  const targets = [];
  if (targetArg === 'both' || targetArg === '.claude') {
    targets.push(join(ROOT, '.claude', 'skills'));
  }
  if (targetArg === 'both' || targetArg === '.agents') {
    targets.push(join(ROOT, '.agents', 'skills'));
  }

  let allOk = true;

  for (const skill of registry.skills) {
    console.log(`--- ${skill.skill_id} v${skill.version} ---`);

    // Validate contract exists
    const contract = loadContract(skill.contract_path);
    if (contract.skill_id !== skill.skill_id) {
      console.error(`  ✗ Contract skill_id mismatch: ${contract.skill_id} != ${skill.skill_id}`);
      allOk = false;
      continue;
    }

    // Compute canonical manifest
    const sourceDir = join(SKILLS_SRC, skill.skill_id);
    const manifest = computeManifest(sourceDir);
    console.log(`  Files: ${manifest.total_files}, Bytes: ${manifest.total_bytes}`);

    for (const targetDir of targets) {
      const targetName = relative(ROOT, targetDir);
      if (dryRun) {
        console.log(`  [dry-run] Would project to ${targetName}/${skill.skill_id}/`);
      } else {
        const result = projectSkill(skill.skill_id, targetDir, manifest, force);
        if (result) {
          console.log(`  → ${targetName}: ${result.projected} projected, ${result.skipped} skipped (unchanged)`);
        } else {
          console.error(`  ✗ Failed to project to ${targetName}`);
          allOk = false;
        }
      }
    }
    console.log('');
  }

  // Compute and print registry root hash
  const registryHash = sha256(readFileSync(REGISTRY_PATH));
  console.log(`Registry root hash: sha256:${registryHash}`);
  console.log('');

  if (!allOk) {
    console.error('PROJECTION FAILED — see errors above');
    process.exit(1);
  }

  console.log(dryRun ? 'DRY RUN COMPLETE — no files written' : 'PROJECTIONS BUILT');
}

main();
