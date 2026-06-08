/**
 * ADR-027 Reward Receipt Local Writer Prototype - Tests (G31)
 * [PROTOTYPE] [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * Tests exercise the first controlled local writer.
 * All writes are strictly under a temporary DEMA_HOME.
 * No public, network, economic, or minting side effects.
 *
 * NO_RECEIPT_MINTING
 * NO_PUBLIC_RECEIPT_WRITING
 * NO_PUBLISHING
 * NO_BRIDGING
 * NO_REWARD_AUTHORIZATION
 * NO_REWARD_LOGIC
 * NO_TOKEN_LOGIC
 * NO_CONTRACTS
 * NO_MARKETPLACE
 * NO_NODE1
 * NO_PUBLIC_URP_BRIDGE
 * NO_SHARIAH_COMPLIANCE_CLAIM
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import {
  writeLocalRewardReceipt,
  loadExampleLocalWriterInput,
  REWARD_RECEIPT_LOCAL_WRITER_CONSENT
} from '../scripts/reward-receipt-local-writer.mjs';

async function withTempDemaHome(fn) {
  const tempRoot = await mkdtemp(join(tmpdir(), 'dema-g31-writer-test-'));
  try {
    return await fn(tempRoot);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

// 1. writes one local receipt artifact under temporary DEMA_HOME only
test('writes one local receipt artifact under temporary DEMA_HOME only', async () => {
  await withTempDemaHome(async (demaHome) => {
    const input = loadExampleLocalWriterInput();
    const result = await writeLocalRewardReceipt({ requireConsent: REWARD_RECEIPT_LOCAL_WRITER_CONSENT, demaHome }, input);
    assert.strictEqual(result.write_result_status, 'local_write_performed_local_only', 'performs local write [DECLARED]');
    const rel = relative(demaHome, result.final_local_path);
    assert.ok(rel && !rel.startsWith('..') && !rel.startsWith('/'), 'path is contained under DEMA_HOME [DECLARED]');
    assert.ok(result.read_back_verified, 'read-back succeeded [DECLARED]');
  });
});

// 2. rejects missing exact consent
test('rejects missing exact consent', async () => {
  await withTempDemaHome(async (demaHome) => {
    const input = loadExampleLocalWriterInput();
    await assert.rejects(
      () => writeLocalRewardReceipt({ requireConsent: 'WRONG', demaHome }, input),
      /CONSENT_REQUIRED/,
      'rejects missing exact consent [DECLARED]'
    );
  });
});

// 3. rejects unsafe path traversal
test('rejects unsafe path traversal', async () => {
  await withTempDemaHome(async (demaHome) => {
    const input = { ...loadExampleLocalWriterInput(), proposed_path: '../../etc/passwd' };
    const result = await writeLocalRewardReceipt({ requireConsent: REWARD_RECEIPT_LOCAL_WRITER_CONSENT, demaHome }, input);
    assert.strictEqual(result.write_result_status, 'local_write_refused_unsafe_path', 'rejects unsafe traversal [DECLARED]');
  });
});

// 4. rejects absolute arbitrary path
test('rejects absolute arbitrary path', async () => {
  await withTempDemaHome(async (demaHome) => {
    const input = { ...loadExampleLocalWriterInput(), proposed_path: '/tmp/evil.json' };
    const result = await writeLocalRewardReceipt({ requireConsent: REWARD_RECEIPT_LOCAL_WRITER_CONSENT, demaHome }, input);
    assert.strictEqual(result.write_result_status, 'local_write_refused_unsafe_path', 'rejects absolute arbitrary path [DECLARED]');
  });
});

// 5. writes canonical JSON and verifies content hash
test('writes canonical JSON and verifies content hash', async () => {
  await withTempDemaHome(async (demaHome) => {
    const input = loadExampleLocalWriterInput();
    const result = await writeLocalRewardReceipt({ requireConsent: REWARD_RECEIPT_LOCAL_WRITER_CONSENT, demaHome }, input);
    assert.ok(result.content_hash && result.content_hash.startsWith('sha256:'), 'content_hash present [DECLARED]');
    assert.ok(result.read_back_verified, 'integrity verified after write [DECLARED]');
  });
});

// 6. read-back verification succeeds
test('read-back verification succeeds', async () => {
  await withTempDemaHome(async (demaHome) => {
    const input = loadExampleLocalWriterInput();
    const result = await writeLocalRewardReceipt({ requireConsent: REWARD_RECEIPT_LOCAL_WRITER_CONSENT, demaHome }, input);
    assert.strictEqual(result.read_back_verified, true, 'read-back verification succeeds [DECLARED]');
  });
});

// 7. never returns forbidden economic/public fields
test('never returns forbidden economic/public fields', async () => {
  await withTempDemaHome(async (demaHome) => {
    const input = loadExampleLocalWriterInput();
    const result = await writeLocalRewardReceipt({ requireConsent: REWARD_RECEIPT_LOCAL_WRITER_CONSENT, demaHome }, input);
    const forbiddenFields = [
      'receipt_written',
      'receipt_minted',
      'reward_authorized',
      'token_amount',
      'reward_amount',
      'contract_call',
      'marketplace_listing',
      'public_url',
      'bridge_id',
      'node1_sync',
      'urp_publication',
      'shariah_compliant'
    ];
    for (const field of forbiddenFields) {
      assert.ok(!(field in result), `forbidden field absent: ${field} [DECLARED]`);
    }
  });
});

// 8. deterministic local_writer_result_id for same semantic write result, excluding created_at
test('deterministic local_writer_result_id for same semantic write result, excluding created_at', async () => {
  await withTempDemaHome(async (demaHome) => {
    const input = loadExampleLocalWriterInput();
    const r1 = await writeLocalRewardReceipt({ requireConsent: REWARD_RECEIPT_LOCAL_WRITER_CONSENT, demaHome }, input);
    const r2 = await writeLocalRewardReceipt({ requireConsent: REWARD_RECEIPT_LOCAL_WRITER_CONSENT, demaHome }, input);
    assert.strictEqual(r1.local_writer_result_id, r2.local_writer_result_id, 'deterministic id (excl. created_at) [DECLARED]');
  });
});

// 9. file mode expectation is 0o600
test('file mode expectation is 0o600', async () => {
  await withTempDemaHome(async (demaHome) => {
    const input = loadExampleLocalWriterInput();
    const result = await writeLocalRewardReceipt({ requireConsent: REWARD_RECEIPT_LOCAL_WRITER_CONSENT, demaHome }, input);
    assert.strictEqual(result.file_mode_expected, '0o600', 'file mode expectation 0o600 [DECLARED]');
  });
});

// 10. refuses proof_gaps empty
test('refuses proof_gaps empty', async () => {
  await withTempDemaHome(async (demaHome) => {
    const input = { ...loadExampleLocalWriterInput(), proof_gaps: [] };
    const result = await writeLocalRewardReceipt({ requireConsent: REWARD_RECEIPT_LOCAL_WRITER_CONSENT, demaHome }, input);
    assert.strictEqual(result.write_result_status, 'local_write_refused_proof_gaps', 'refuses empty proof_gaps [DECLARED]');
  });
});
