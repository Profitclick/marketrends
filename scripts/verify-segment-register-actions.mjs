import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {reservationFor} from './segment-register.mjs';

const {GITHUB_EVENT_NAME: event, GITHUB_REPOSITORY: repository, GITHUB_REF: branch,
  GITHUB_RUN_ID: runId, GITHUB_RUN_ATTEMPT: attempt, GITHUB_SHA: commit, REGISTER_PHASE: phase,
  SEGMENT_EVIDENCE: evidence} = process.env;

assert.equal(repository, 'Profitclick/marketrends');
assert.equal(branch, 'refs/heads/diagnostics/migrate02-3a7-4-1');
assert.equal(event, 'push');
assert.equal(attempt, '1');
assert.ok(['claim', 'verify'].includes(phase));

const plan = {
  recoveryRevision: '091837a1a5b1ed2be2c41fcba2d6032f2dfc3395',
  snapshotSha256: '0'.repeat(64),
  sourceJournalSha256: createHash('sha256').update('MIGRATE-02.3A.7.4.2 GitHub Actions offline register test 2026-11-25').digest('hex'),
  sourceId: '1',
  sourceSha: '0'.repeat(64),
  limit: 1,
};
const reservation = reservationFor(plan, runId);
const ref = 'refs/heads/diagnostics/migrate02-register/' + reservation.key;
const remote = 'https://github.com/Profitclick/marketrends.git';
const git = (...args) => execFileSync('git', args, {encoding: 'utf8', timeout: 30000}).trim();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-actions-register-'));
const register = fileURLToPath(new URL('./segment-register.mjs', import.meta.url));

function invoke(dir, ...args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [register, ...args], {
      env: {...process.env, SEGMENT_EVIDENCE: dir}, stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('close', code => resolve({code, stderr: stderr.trim()}));
  });
}

function makePlan(name) {
  const dir = path.join(fixture, name);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'segment-plan.json'), JSON.stringify(plan));
  return dir;
}

function verifyDenial(result) {
  assert.deepEqual(result, {code: 70, stderr: 'SEGMENT REGISTER REGISTER_WRITE_FAILED'});
}

function readHistory() {
  git('-C', fixture, 'fetch', '--quiet', '--no-tags', remote, ref);
  return git('-C', fixture, 'log', '--format=%H%x09%s', 'FETCH_HEAD').split('\n').map(line => {
    const [sha, raw] = line.split('\t');
    return {sha, record: JSON.parse(raw)};
  });
}

function expectQuarantine(history) {
  assert.equal(history.length, 2);
  const [terminal, initial] = history;
  assert.match(initial.record.runId, /^[1-9][0-9]*$/);
  const original = reservationFor(plan, initial.record.runId);
  assert.deepEqual(initial.record, original);
  assert.deepEqual(terminal.record, {...original, status: 'QUARANTINE'});
  return terminal;
}

try {
  git('-C', fixture, 'init', '--bare', '--quiet');
  let result;
  if (phase === 'claim') {
    assert.equal(git('ls-remote', remote, ref), '', 'the synthetic ref must begin absent');
    const contenders = [makePlan('first'), makePlan('second')];
    const outcomes = await Promise.all(contenders.map(dir => invoke(dir, 'reserve')));
    assert.deepEqual(outcomes.map(item => item.code).sort((a, b) => a - b), [0, 70]);
    const winner = outcomes.findIndex(item => item.code === 0);
    verifyDenial(outcomes[1 - winner]);
    const history = readHistory();
    assert.equal(history.length, 1);
    assert.deepEqual(history[0].record, reservation);

    assert.deepEqual(await invoke(contenders[winner], 'finish', 'QUARANTINE'), {code: 0, stderr: ''});
    const terminal = expectQuarantine(readHistory());
    assert.equal(terminal.record.runId, runId);
    verifyDenial(await invoke(makePlan('quarantined'), 'reserve'));
    result = {reservationSucceeded: 1, concurrentReservationDenied: 1, sameRunReuseDenied: true,
      reservedSha: history[0].sha, quarantineSha: terminal.sha};
  } else {
    const terminal = expectQuarantine(readHistory());
    assert.notEqual(terminal.record.runId, runId, 'verification requires a distinct Actions run');
    verifyDenial(await invoke(makePlan('cross-run'), 'reserve'));
    assert.deepEqual(expectQuarantine(readHistory()), terminal);
    result = {priorRunId: terminal.record.runId, crossRunReuseDenied: true, quarantineSha: terminal.sha};
  }
  const report = {status: 'PASS', phase, runId, commit, ref, ssrProbes: 0, ...result};
  fs.writeFileSync(path.join(evidence, 'hosted-register.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  fs.rmSync(fixture, {recursive: true, force: true});
}
