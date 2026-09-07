import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startUrp0Server } from '../scripts/genesis/urp0-server.mjs';
import { admissionCard, bindWorldCellSystemPlane, worldState } from '../scripts/genesis/urp0-runtime.mjs';

test('World-Cell: ordinary Node0 interface cannot bootstrap or manage the system even with a copied exact phrase', async () => {
  const root = mkdtempSync(join(tmpdir(), 'urp-plane-'));
  const { server, url } = await startUrp0Server({ stateRootDir: root, port: 0, worldCell: true });
  try {
    for (const actor of ['PAT-1', 'NODE0_HUMAN_USER_ROLE', 'DEMA', 'FOUNDER_GENESIS_BOOTSTRAP_ROLE', 'SAT-1']) {
      const response = await fetch(`${url}/api/admit`, { method: 'POST', headers: {'content-type':'application/json'},
        body: JSON.stringify({ actor, phrase: admissionCard().required_phrase }) });
      assert.equal(response.status, 403, `${actor} must not acquire system management through the human interface`);
      assert.equal((await response.json()).blocked_by[0], 'system_management_not_exposed');
    }
    for (const path of ['/api/block0/seal', '/api/authorize', '/api/sat/manage', '/api/private-memory', '/api/self-authorize']) {
      const response = await fetch(`${url}${path}`, {method:'POST', body:'{}'});
      assert.equal(response.status, 403, path);
    }
    const state = await (await fetch(`${url}/api/realm`)).json();
    assert.equal(state.human, null);
    assert.equal(state.sat.registered, null);
  } finally {
    await new Promise(resolve => server.close(resolve));
    rmSync(root, {recursive:true, force:true});
  }
});

test('World-Cell: system binding replays durably, preserves ordinary human separation, and rejects duplicate or widened binding', async () => {
  const root = mkdtempSync(join(tmpdir(), 'urp-binding-'));
  try {
    const { appendEvent } = await import('../scripts/genesis/urp0-store.mjs');
    const args = { authority_source_sha256:'a'.repeat(64), root_bindings:[{path:'/fixture/root',sha256:'b'.repeat(64)}], now_iso:'2026-09-07T00:00:00Z' };
    const bound = bindWorldCellSystemPlane(root,args);
    assert.equal(bound.ok,true);
    const world = worldState(root);
    assert.equal(world.system_plane.owner,'BIZRA_SYSTEM');
    assert.equal(world.system_plane.founder_authority_inherited,false);
    assert.equal(world.sat.owner,'BIZRA_SYSTEM');
    assert.equal(world.sat.inventory.length,5);
    assert.equal(world.dema.status,'HEALTH_UNPROVEN');
    assert.equal(bindWorldCellSystemPlane(root,args).ok,false);
    assert.equal(worldState(root).urp.state_root,world.urp.state_root);
    const { spawnSync } = await import('node:child_process');
    const run = spawnSync(process.execPath,['--input-type=module','-e',
      `import { worldState } from './scripts/genesis/urp0-runtime.mjs'; console.log(JSON.stringify(worldState(process.argv[1])));`,root],{encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    assert.equal(JSON.parse(run.stdout).urp.state_root,world.urp.state_root);
    for (const altered of [{owner:'NODE0'},{founder_authority_inherited:true},{principal:'Mumu'}]) {
      const temp = mkdtempSync(join(tmpdir(),'urp-hostile-'));
      try {
        assert.equal(appendEvent(temp,'SYSTEM_PLANE_BOUND',{...bound.event.payload,...altered}).ok,false);
        assert.equal(worldState(temp).urp.events_applied,0);
      } finally { rmSync(temp,{recursive:true,force:true}); }
    }
  } finally { rmSync(root,{recursive:true,force:true}); }
});
