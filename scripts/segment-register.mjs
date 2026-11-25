import {execFileSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const hex = (s, size) => typeof s === 'string' && s.length === size && /^[a-f0-9]+$/.test(s);
const id = s => typeof s === 'string' && /^[1-9][0-9]*$/.test(s);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(ok, code) {
  if (!ok) throw new Error(code);
}

export function checkpointKey({recoveryRevision, snapshotSha256, sourceJournalSha256}) {
  check(hex(recoveryRevision, 40) && hex(snapshotSha256, 64) && hex(sourceJournalSha256, 64),
    'REGISTER_CHECKPOINT_IDENTITY');
  return createHash('sha256').update([recoveryRevision, snapshotSha256, sourceJournalSha256].join(':')).digest('hex');
}

export function reservationFor(plan, runId) {
  check(id(runId) && id(plan.sourceId) && hex(plan.sourceSha, 64) &&
    Number.isSafeInteger(plan.limit) && plan.limit > 0 && plan.limit <= 250, 'REGISTER_RESERVATION');
  return {version: 1, status: 'RESERVED', key: checkpointKey(plan), runId,
    sourceId: plan.sourceId, sourceSha: plan.sourceSha, limit: plan.limit};
}

export function verifyReservation(plan, runId, reservation) {
  check(same(reservationFor(plan, runId), reservation), 'REGISTER_RESERVATION_MISMATCH');
}

export function updateRegister(remote, reservation, status, artifact) {
  check(hex(reservation.key, 64) && id(reservation.runId) &&
    reservation.version === 1 && reservation.status === 'RESERVED', 'REGISTER_RECORD');
  check(['RESERVED', 'PASS', 'QUARANTINE'].includes(status), 'REGISTER_TRANSITION');
  if (status === 'PASS') {
    check(id(artifact?.id) && hex(artifact?.sha256, 64), 'REGISTER_ARTIFACT');
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'segment-register-'));
  const git = (args, input) => execFileSync('git', ['-C', dir, ...args], {
    input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000,
    env: {...process.env, GIT_TERMINAL_PROMPT: '0', GIT_AUTHOR_NAME: 'Segment register',
      GIT_AUTHOR_EMAIL: 'actions@users.noreply.github.com', GIT_COMMITTER_NAME: 'Segment register',
      GIT_COMMITTER_EMAIL: 'actions@users.noreply.github.com'},
  }).trim();
  const ref = 'refs/heads/diagnostics/migrate02-register/' + reservation.key;
  try {
    git(['init', '--bare', '--quiet']);
    let parent = [];
    let record = reservation;
    if (status !== 'RESERVED') {
      git(['fetch', '--quiet', '--no-tags', remote, ref]);
      const head = git(['rev-parse', 'FETCH_HEAD']);
      const previous = JSON.parse(git(['show', '-s', '--format=%s', head]));
      check(same(previous, reservation), 'REGISTER_TRANSITION_DENIED');
      parent = ['-p', head];
      record = {...reservation, status, ...(status === 'PASS' ? {artifact} : {})};
    }
    const empty = git(['mktree'], '');
    const sha = git(['commit-tree', empty, ...parent], JSON.stringify(record) + '\n\n' + randomUUID() + '\n');
    const lease = `--force-with-lease=${ref}:${parent[1] ?? ''}`;
    // The explicit lease requires absence on creation and exact parent on transition.
    // Every permitted transition advances the ref by exactly one commit.
    git(['push', '--quiet', lease, '--', remote, `${sha}:${ref}`]);
    return sha;
  } catch (error) {
    if ('stderr' in error) throw new Error('REGISTER_WRITE_FAILED');
    throw error;
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
}

export function verifyRegisteredSource(remote, plan, gate) {
  const key = gate.sourceCheckpointKey;
  check(hex(key, 64) && id(gate.registerRunId), 'REGISTER_SOURCE_PROVENANCE');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'segment-register-source-'));
  const git = args => execFileSync('git', ['-C', dir, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000,
    env: {...process.env, GIT_TERMINAL_PROMPT: '0'},
  }).trim();
  try {
    git(['init', '--bare', '--quiet']);
    git(['fetch', '--quiet', '--no-tags', remote, 'refs/heads/diagnostics/migrate02-register/' + key]);
    const record = JSON.parse(git(['show', '-s', '--format=%s', 'FETCH_HEAD']));
    check(record.version === 1 && record.status === 'PASS' && record.key === key &&
      record.runId === gate.registerRunId && record.artifact?.id === plan.sourceId &&
      record.artifact?.sha256 === plan.sourceSha, 'REGISTER_SOURCE_NOT_PASS');
  } catch (error) {
    if ('stderr' in error) throw new Error('REGISTER_SOURCE_UNAVAILABLE');
    throw error;
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    check(process.env.GITHUB_REPOSITORY === 'Profitclick/marketrends' &&
      process.env.GITHUB_RUN_ATTEMPT === '1', 'REGISTER_WORKFLOW');
    const out = process.env.SEGMENT_EVIDENCE;
    const remote = 'https://github.com/Profitclick/marketrends.git';
    const [command, status, artifactId, sha256] = process.argv.slice(2);
    const plan = read(path.join(out, 'segment-plan.json'));
    const file = path.join(out, 'segment-reservation.json');
    if (command === 'verify-source') {
      const source = process.env.SEGMENT_SOURCE_DIR;
      const gate = read(path.join(source, 'segment-gate.json'));
      check(gate.registerRunId === process.env.SEGMENT_SOURCE_RUN, 'REGISTER_SOURCE_RUN');
      verifyRegisteredSource(remote, plan, gate);
    } else if (command === 'reserve') {
      const reservation = reservationFor(plan, process.env.GITHUB_RUN_ID);
      updateRegister(remote, reservation, 'RESERVED');
      fs.writeFileSync(file, JSON.stringify(reservation) + '\n', {flag: 'wx'});
    } else if (command === 'finish') {
      const reservation = read(file);
      verifyReservation(plan, process.env.GITHUB_RUN_ID, reservation);
      check(['PASS', 'QUARANTINE'].includes(status), 'REGISTER_TERMINAL_STATUS');
      updateRegister(remote, reservation, status, {id: artifactId, sha256});
    } else {
      throw new Error('REGISTER_COMMAND');
    }
  } catch (error) {
    console.error('SEGMENT REGISTER ' + error.message);
    process.exitCode = 70;
  }
}
