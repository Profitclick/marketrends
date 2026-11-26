import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {QUARANTINE_RECOVERY, checkpointKey, reservationFor, updateRegister, verifyRegisteredSource} from './segment-register.mjs';

const plan = {recoveryRevision: 'a'.repeat(40), snapshotSha256: 'b'.repeat(64),
  sourceJournalSha256: 'c'.repeat(64), sourceId: '123', sourceSha: 'd'.repeat(64), limit: 250};
const artifact = {id: '101', sha256: 'e'.repeat(64)};
const registerUrl = new URL('./segment-register.mjs', import.meta.url).href;

function repo(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'register-test-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  assert.equal(spawnSync('git', ['init', '--bare', '--quiet', dir]).status, 0);
  return dir;
}

function attempt(remote, record, status) {
  const js = `import {updateRegister} from ${JSON.stringify(registerUrl)};
    try {
      updateRegister(process.argv[1], JSON.parse(process.argv[2]), process.argv[3],
        {id: '101', sha256: 'e'.repeat(64)});
    } catch (error) {
      console.error(error.message);
      process.exitCode = 70;
    }`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', js, remote, JSON.stringify(record), status],
    {stdio: ['ignore', 'ignore', 'pipe']});
  return new Promise((resolve, reject) => {
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({code, stderr}));
  });
}

test('identical reservations and competing runs race in separate Git processes', async t => {
  const remote = repo(t);
  const reservation = reservationFor(plan, '7');
  const repacked = reservationFor({...plan, sourceId: '999', sourceSha: 'f'.repeat(64), limit: 1}, '8');
  assert.equal(reservation.key, repacked.key);
  assert.notEqual(reservation.key, checkpointKey({...plan, sourceJournalSha256: 'f'.repeat(64)}));
  const racing = await Promise.all([reservation, reservation, repacked].map(r => attempt(remote, r, 'RESERVED')));
  assert.deepEqual(racing.map(r => r.code).sort((a, b) => a - b), [0, 70, 70]);
  assert.ok(racing.filter(r => r.code === 70).every(r => /REGISTER_WRITE_FAILED/.test(r.stderr)));
});

test('a runner exiting after reservation leaves it blocked for later runs', async t => {
  const remote = repo(t);
  const first = reservationFor(plan, '7'), second = reservationFor(plan, '8');
  assert.equal((await attempt(remote, first, 'RESERVED')).code, 0);
  assert.equal((await attempt(remote, second, 'RESERVED')).code, 70);
  assert.throws(() => updateRegister(remote, second, 'QUARANTINE'), /REGISTER_TRANSITION_DENIED/);
  assert.throws(() => updateRegister(remote, first, 'RELEASED'), /REGISTER_TRANSITION/);
  assert.throws(() => updateRegister(remote, first, 'PASS', {}), /REGISTER_ARTIFACT/);
  assert.equal((await attempt(remote, first, 'QUARANTINE')).code, 0);
  assert.equal((await attempt(remote, first, 'PASS')).code, 70);
  assert.equal((await attempt(remote, second, 'RESERVED')).code, 70);
});

test('only one terminal transition commits and PASS pins the artifact bytes', async t => {
  const remote = repo(t);
  const reservation = reservationFor(plan, '7');
  assert.throws(() => updateRegister(remote, reservation, 'PASS', artifact), /REGISTER_WRITE_FAILED/);
  updateRegister(remote, reservation, 'RESERVED');
  const finishes = await Promise.all([attempt(remote, reservation, 'PASS'), attempt(remote, reservation, 'PASS')]);
  assert.deepEqual(finishes.map(r => r.code).sort((a, b) => a - b), [0, 70]);
  const next = {...plan, sourceId: artifact.id, sourceSha: artifact.sha256};
  const gate = {sourceCheckpointKey: reservation.key, registerRunId: reservation.runId};
  verifyRegisteredSource(remote, next, gate);
  assert.throws(() => verifyRegisteredSource(remote, {...next, sourceSha: plan.sourceSha}, gate), /REGISTER_SOURCE_NOT_PASS/);
  assert.throws(() => updateRegister(remote, reservation, 'RESERVED'), /REGISTER_WRITE_FAILED/);
});

test('the pinned zero-probe authorization has a single independent reservation key', t => {
  const remote = repo(t);
  const stopped = QUARANTINE_RECOVERY;
  const source = {...plan, sourceId: stopped.sourceId, sourceSha: stopped.sourceSha, prior: 1722, historyCount: 1725,
    recoveryRevision: '091837a1a5b1ed2be2c41fcba2d6032f2dfc3395',
    snapshotSha256: '3e4cd3b4931f9918bf3136badf60c8a699435d212ca2abc0cf458c8b8f264d73',
    sourceJournalSha256:'22ef87b6f2a2cbf1b1fcaa84ed98f625e0da8ea65e737897988cd62e044e7217'};
  const original = reservationFor(source, stopped.run);
  assert.equal(original.key, stopped.key);
  updateRegister(remote, original, 'RESERVED');
  updateRegister(remote, original, 'QUARANTINE');
  const continued = {...source, quarantineCommit: stopped.terminalCommit};
  const approved = reservationFor(continued, '8');
  assert.notEqual(approved.key, original.key);
  assert.equal(approved.key, reservationFor(continued,'9').key);
  for(const changed of [{sourceId:'999'}, {prior:1723}, {limit:50}, {quarantineCommit:'f'.repeat(40)}]){
    assert.throws(() => reservationFor({...continued,...changed},'8'), /REGISTER_QUARANTINE_PIN/);
  }
  updateRegister(remote, approved, 'RESERVED');
  assert.throws(() => updateRegister(remote, reservationFor(continued,'9'), 'RESERVED'), /REGISTER_WRITE_FAILED/);
  assert.throws(() => updateRegister(remote, original, 'RESERVED'), /REGISTER_WRITE_FAILED/);
});

test('a registered PASS must preserve the approved baseline lineage', t => {
  const remote = repo(t);
  const baselineArtifactId = '15080475107';
  const reservation = reservationFor({...plan,baselineArtifactId},'7');
  updateRegister(remote,reservation,'RESERVED');
  updateRegister(remote,reservation,'PASS',artifact);
  const next = {...plan,sourceId:artifact.id,sourceSha:artifact.sha256};
  const gate = {sourceCheckpointKey:reservation.key,registerRunId:'7'};
  verifyRegisteredSource(remote,{...next,baselineArtifactId},gate);
  assert.throws(()=>verifyRegisteredSource(remote,next,gate),/REGISTER_SOURCE_NOT_PASS/);
});
