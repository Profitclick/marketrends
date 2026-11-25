import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {INITIAL_ID, INITIAL_SHA, INVENTORY, REV, SNAP} from './segmented-recovery-guard.mjs';
import {checkPulse} from './segment-watchdog.mjs';

const guard = new URL('./segmented-recovery-guard.mjs', import.meta.url);
const watchdog = new URL('./segment-watchdog.mjs', import.meta.url);
const register = new URL('./segment-register.mjs', import.meta.url);
const recovery = path.resolve(process.cwd());
const frozen = process.env.SEGMENT_TEST_SOURCE_DIR;
const hash = value => createHash('sha256').update(value).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value) + '\n');
const readLines = file => fs.readFileSync(file, 'utf8').trimEnd().split('\n').map(JSON.parse);

function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'segment-integration-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  return dir;
}

function command(entry, args, env = {}) {
  return spawnSync(process.execPath, [fileURLToPath(entry), ...args], {
    cwd: recovery, env: {...process.env, ...env}, encoding: 'utf8', timeout: 20000,
  });
}

function sourceEnv(source, out, passed, id = '800', sha = 'f'.repeat(64)) {
  return {SEGMENT_SOURCE_DIR: source, SEGMENT_EVIDENCE: out, SEGMENT_SOURCE_ID: id, SEGMENT_SOURCE_SHA: sha,
    SEGMENT_PRIOR_PASSED: String(passed), SEGMENT_PRIOR_HISTORY: String(passed + 3), SEGMENT_LIMIT: '250'};
}

function edgeSource(dir, remaining) {
  const source = path.join(dir, 'source');
  const checkpoint = path.join(source, 'recovery');
  fs.cpSync(path.join(frozen, 'recovery'), checkpoint, {recursive: true});
  const state = read(path.join(checkpoint, 'checkpoint.json'));
  const snapshot = read(path.join(checkpoint, 'snapshot.json'));
  // Also support running the suite against later workflow source artifacts.
  const originalRows = state.journal.trimEnd().split('\n').slice(0, 1324).map(JSON.parse);
  state.journal = originalRows.map(row => JSON.stringify(row)).join('\n')+'\n';
  const latest = new Map(originalRows.map(row => [row.url, row]));
  const pending = snapshot.entries.filter(entry => !latest.has(entry.url));
  for (const entry of pending.slice(0, pending.length - remaining)) {
    const row = {...entry, canonical: entry.url, status: 200, issues: [], title: 'Dummy', h1: 'Dummy',
      ttfbMs: 1, totalMs: 2, bytes: 100};
    state.journal += JSON.stringify(row) + '\n';
    latest.set(row.url, row);
  }
  state.journalSha256 = hash(state.journal);
  write(path.join(checkpoint, 'checkpoint.json'), state);
  fs.writeFileSync(path.join(checkpoint, 'attempt-history.jsonl'), state.journal);
  fs.writeFileSync(path.join(checkpoint, 'results.jsonl'), [...latest.values()].map(row => JSON.stringify(row)).join('\n')+'\n');
  write(path.join(checkpoint, 'summary.json'), {revision: REV, complete: remaining === 0,
    passed: latest.size, failed: 0, untested: remaining});
  write(path.join(source, 'segment-gate.json'), {status: 'PASS', recoveryRevision: REV, snapshotSha256: SNAP,
    passed: latest.size, historyLength: latest.size + 3, releaseComplete: remaining === 0});
  return source;
}

test('one remaining URL is scheduled, then the completed checkpoint needs zero probes', async t => {
  const dir = setup(t);
  const source = edgeSource(dir, 1);
  const out = path.join(dir, 'last');
  const env = sourceEnv(source, out, INVENTORY - 1);
  const prep = command(guard, ['prepare'], env);
  assert.equal(prep.status, 0, prep.stderr);
  const targets = read(path.join(out, 'targets.json'));
  assert.equal(targets.length, 1);
  const incomplete = command(guard, ['complete-inventory'], env);
  assert.equal(incomplete.status, 70);

  const {runAudit} = await import(pathToFileURL(path.join(recovery, 'scripts/full-sitemap-ssr-audit.mjs')));
  const url = targets[0].url;
  const html = '<head><title>Dummy</title><link rel="canonical" href="'+url+'">' +
    '<meta property="og:url" content="'+url+'"><meta name="description" content="Dummy">' +
    '<meta name="robots" content="index"><meta name="googlebot" content="index">' +
    '<script type="application/ld+json">'+JSON.stringify({'@type': 'NewsArticle', mainEntityOfPage: {'@id': url},
      author: {'@type': 'Organization', name: 'Marketrends.no'}, isBasedOn: 'https://example.invalid/',
      headline: 'Dummy'})+'</script></head><body><main><article><h1>Dummy</h1>' +
    '<a href="https://example.invalid/">Source</a></article></main></body>';
  let count = 0;
  const summary = await runAudit({origin: 'http://127.0.0.1:3000', dir: path.join(out, 'recovery'),
    resume: true, revision: REV, limit: 1, now: () => 10000, sleep: async () => {},
    fetcher: async input => {
      assert.equal(input, 'http://127.0.0.1:3000'+new URL(url).pathname+new URL(url).search);
      count++;
      return new Response(html, {headers: {'content-type': 'text/html'}});
    }});
  assert.equal(count, 1);
  assert.equal(summary.complete, true);
  assert.equal(summary.passed, INVENTORY);
  write(path.join(out,'segment-gate.json'), {status: 'PASS', recoveryRevision: REV, snapshotSha256: SNAP,
    passed: INVENTORY, historyLength: INVENTORY + 3, releaseComplete: true});

  const complete = path.join(dir, 'complete');
  const completeEnv = sourceEnv(out, complete, INVENTORY);
  const check = command(guard, ['prepare'], completeEnv);
  assert.equal(check.status, 0, check.stderr);
  const finish = command(guard, ['complete-inventory'], completeEnv);
  assert.equal(finish.status, 0, finish.stderr);
  assert.deepEqual(read(path.join(complete, 'targets.json')), []);
  assert.equal(read(path.join(complete, 'segment-gate.json')).batchAttempted, 0);
  assert.equal(fs.existsSync(path.join(complete, 'probe-starts.jsonl')), false);
  assert.equal(fs.existsSync(path.join(complete, 'segment-launch.lock')), false);
});

test('heartbeat sequence, historic gaps, stale and missing evidence fail closed', () => {
  const first = {sequence: 1, at: 100};
  checkPulse(first, undefined, 100, 50);
  assert.throws(() => checkPulse(null, first, 125, 50), /TELEMETRY_SEQUENCE/);
  assert.throws(() => checkPulse({sequence: 3, at: 125}, first, 125, 50), /TELEMETRY_SEQUENCE/);
  assert.throws(() => checkPulse({sequence: 2, at: 125}, first, 175, 50), /TELEMETRY_STALE/);
  assert.throws(() => checkPulse({sequence: 2, at: 150}, first, 150, 50), /TELEMETRY_GAP/);
});

for (const mode of ['rss','heartbeat','measurement']) {
  test('offline subprocess stop chain: '+mode, t => {
    const dir = setup(t);
    const source = edgeSource(dir, 2);
    const out = path.join(dir, 'evidence');
    const env = {...sourceEnv(source, out, INVENTORY - 2), MODE: mode,
      GITHUB_RUN_ID: '123', SEGMENT_RAW_LOG: path.join(dir, 'runtime.log'), TEST_REGISTER: path.join(dir, 'register')};
    const prep = command(guard, ['prepare'], env);
    assert.equal(prep.status, 0, prep.stderr);
    const audit = path.join(dir, 'audit.mjs');
    fs.writeFileSync(audit, `
import fs from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {auditChild} from ${JSON.stringify(guard.href)};
await auditChild(async input => {
  const sample = path.join(process.env.SEGMENT_EVIDENCE, 'native.jsonl');
  fs.appendFileSync(sample, JSON.stringify({pid: process.pid, input})+'\\n');
  if (process.env.MODE === 'heartbeat') Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10000);
  fs.appendFileSync(process.env.SEGMENT_RAW_LOG, '[wrangler:info] GET '+new URL(input).pathname+new URL(input).search+' 200 OK\\n');
  const url = 'https://marketrends.no'+new URL(input).pathname+new URL(input).search;
  const html = '<head><title>Dummy</title><link rel="canonical" href="'+url+'">' +
    '<meta property="og:url" content="'+url+'"><meta name="description" content="Dummy">' +
    '<meta name="robots" content="index"><meta name="googlebot" content="index">' +
    '<script type="application/ld+json">'+JSON.stringify({'@type': 'NewsArticle', mainEntityOfPage: {'@id': url},
      author: {'@type': 'Organization', name: 'Marketrends.no'}, isBasedOn: 'https://example.invalid/',
      headline: 'Dummy'})+'</script></head><body><main><article><h1>Dummy</h1>' +
    '<a href="https://example.invalid/">Source</a></article></main></body>';
  return {response: new Response(html, {headers: {'content-type': 'text/html'}}),
    httpTtfbMs: 10, dispatched: performance.now()};
});
`);
    const driver = path.join(dir, 'driver.mjs');
    fs.writeFileSync(driver, `
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn, execFileSync} from 'node:child_process';
import {once} from 'node:events';
import path from 'node:path';
import {supervise} from ${JSON.stringify(watchdog.href)};
import {verifyResource,RSS_MAX,REV} from ${JSON.stringify(guard.href)};
import {reservationFor,updateRegister} from ${JSON.stringify(register.href)};
const out = process.env.SEGMENT_EVIDENCE;
const repo = process.env.TEST_REGISTER;
const mode = process.env.MODE;
const plan = JSON.parse(fs.readFileSync(path.join(out,'segment-plan.json')));
const reservation = reservationFor(plan, process.env.GITHUB_RUN_ID);
execFileSync('git', ['init', '--bare', '--quiet', repo]);
updateRegister(repo, reservation, 'RESERVED');
fs.writeFileSync(path.join(out, 'segment-reservation.json'), JSON.stringify(reservation));
fs.writeFileSync(path.join(out, 'segment-launch.lock'), '');
const runtime = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'],
  {detached: true, stdio: 'ignore'});
const runtimeExit = once(runtime, 'exit');
fs.writeFileSync(process.env.SEGMENT_RAW_LOG, '');
const base = {memAvailableBytes: 800, memTotalBytes: 1000, hostOomKill: 0,
  cgroupOom: 0, cgroupOomKill: 0, cgroup: '/offline'};
let workerKeys;
try {
  await supervise({entry: ${JSON.stringify(audit)}, args: [], out, revision: REV,
    interval: 75,
    sample(phase, source) {
      const sent = fs.existsSync(path.join(out, 'native.jsonl'));
      if (sent && mode === 'measurement') Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2800);
      const rssBytes = sent && mode === 'rss' ? RSS_MAX + 1 : 1000;
      const sample = {...base, phase, source, processes: [{pid: runtime.pid, comm: 'workerd', startTicks: 1,rssBytes}]};
      workerKeys = verifyResource(base, sample, workerKeys ?? null);
      return sample;
    },
    stopRuntime() { process.kill(-runtime.pid, 'SIGKILL'); }
  });
  assert.fail('unexpected PASS');
} catch (error) {
  const [, signal] = await runtimeExit;
  assert.equal(signal, 'SIGKILL');
  const evidence = JSON.parse(fs.readFileSync(path.join(out, 'segment-gate.json')));
  assert.equal(evidence.status, 'QUARANTINE');
  assert.equal(evidence.resumeAllowed, false);
  assert.equal(evidence.started, 1);
  assert.equal(evidence.code, error.code);
  updateRegister(repo, reservation, 'QUARANTINE');
  assert.throws(() => updateRegister(repo, reservationFor(plan, '124'), 'RESERVED'), /REGISTER_WRITE_FAILED/);
  console.error(error.code);
  process.exitCode = 70;
}
`);
    const run = command(pathToFileURL(driver), [], env);
    assert.equal(run.status, 70, run.stderr);
    const expected = mode === 'rss' ? 'WORKER_RSS_LIMIT' : 'TELEMETRY_STALE';
    assert.match(run.stderr, new RegExp(expected));
    const calls = readLines(path.join(out, 'native.jsonl'));
    assert.equal(calls.length, 1);
    assert.equal(readLines(path.join(out, 'probe-starts.jsonl')).length, 1);
    assert.throws(() => process.kill(calls[0].pid, 0), {code: 'ESRCH'});
    const blocked = command(guard, ['prepare'], sourceEnv(out, path.join(dir, 'blocked'), INVENTORY - 2));
    assert.equal(blocked.status, 70, blocked.stderr);
    assert.match(blocked.stderr, /SOURCE_QUARANTINED/);
  });
}

test('the original source prepares with the pinned counts and artifact identity', t => {
  const summary = read(path.join(frozen, 'recovery/summary.json'));
  if (summary.passed !== 1321) return t.skip('source is a later verified segment');
  const out = setup(t);
  const result = command(guard, ['prepare'], sourceEnv(frozen, out, 1321, INITIAL_ID, INITIAL_SHA));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(read(path.join(out, 'segment-plan.json')).limit, 250);
});
