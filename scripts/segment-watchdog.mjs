import fs from 'node:fs';
import path from 'node:path';
import {fork} from 'node:child_process';
import {randomUUID} from 'node:crypto';

export const monotonicMs = () => Number(process.hrtime.bigint() / 1000000n);
export const SAMPLE_INTERVAL_MS = 1000;
export const MAX_GAP_MS = 2500;
const write = (out, name, data) => {
  const file = path.join(out, name);
  const temp = file + '.' + randomUUID() + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(data) + '\n', {flag: 'wx'});
  fs.renameSync(temp, file);
};
const read = (out, name) => JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'));
const codeOf = error => error.code ?? 'GUARD_EVIDENCE_UNAVAILABLE';

export function checkPulse(pulse, previous, now = monotonicMs(), maxGap = MAX_GAP_MS) {
  if (!Number.isSafeInteger(pulse?.sequence) || pulse.sequence !== (previous?.sequence ?? 0) + 1 ||
      !Number.isSafeInteger(pulse.at) || pulse.at > now) {
    throw Object.assign(new Error('TELEMETRY_SEQUENCE'), {code: 'TELEMETRY_SEQUENCE'});
  }
  checkFresh(pulse, now, maxGap);
  if (previous && (pulse.at < previous.at || pulse.at - previous.at >= maxGap)) {
    throw Object.assign(new Error('TELEMETRY_GAP'), {code: 'TELEMETRY_GAP'});
  }
}

function checkFresh(pulse, now, maxGap) {
  if (!pulse || now - pulse.at >= maxGap) {
    throw Object.assign(new Error('TELEMETRY_STALE'), {code: 'TELEMETRY_STALE'});
  }
}

export function supervise({entry, args, out, revision, sample, stopRuntime, env = process.env,
  interval = SAMPLE_INTERVAL_MS, maxGap = MAX_GAP_MS}) {
  return new Promise((resolve, reject) => {
    let child, timer, heartbeat, telemetry, stopped = false;
    let phase = 'active';
    const boot = monotonicMs();
    const stop = code => {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      const quarantine = () => {
        try {
          const starts = path.join(out, 'probe-starts.jsonl');
          const started = fs.existsSync(starts) ? fs.readFileSync(starts, 'utf8').split('\n').length - 1 : 0;
          const evidence = {status: 'QUARANTINE', code, phase, started, recoveryRevision: revision,
            resumeAllowed: false, at: new Date().toISOString()};
          write(out, 'guard-stop.json', evidence);
          write(out, 'segment-gate.json', evidence);
          reject(Object.assign(new Error(code), {code}));
        } catch (error) {
          reject(error);
        }
      };
      try { stopRuntime(); } catch (error) { code = codeOf(error); }
      if (child?.pid && child.exitCode === null && child.signalCode === null) {
        child.once('exit', quarantine);
        child.kill('SIGKILL');
      } else {
        quarantine();
      }
    };
    const emit = (source, requestId) => {
      checkFresh(heartbeat ?? {at: boot}, monotonicMs(), maxGap);
      const start = monotonicMs();
      const data = sample(phase, source);
      const pulse = {sequence: (telemetry?.sequence ?? 0) + 1, at: monotonicMs()};
      checkFresh({at: start}, pulse.at, maxGap);
      checkPulse(pulse, telemetry ?? {sequence: 0, at: boot}, pulse.at, maxGap);
      fs.appendFileSync(path.join(out, 'runtime-resources.jsonl'),
        JSON.stringify({...data, telemetry: pulse}) + '\n');
      checkFresh(pulse, monotonicMs(), maxGap);
      child.send({type: 'sample', pulse, requestId});
      telemetry = pulse;
    };
    const checked = fn => {
      if (stopped) return;
      try { fn(); } catch (error) { stop(codeOf(error)); }
    };
    checked(() => {
      child = fork(entry, args, {env, stdio: ['ignore', 'inherit', 'inherit', 'ipc']});
      child.on('error', () => stop('WATCHDOG_CHILD_ERROR'));
      child.on('message', message => checked(() => {
        if (message?.type === 'heartbeat') {
          checkPulse(message.pulse, heartbeat ?? {sequence: 0, at: boot}, monotonicMs(), maxGap);
          heartbeat = message.pulse;
        } else if (message?.type === 'sample-request' && Number.isSafeInteger(message.id)) {
          if (message.source === 'passive-start' && phase === 'active') phase = 'passive';
          else if (!(message.source === 'pre-probe' && phase === 'active') &&
                   !(message.source === 'passive-end' && phase === 'passive')) {
            stop('WATCHDOG_PROTOCOL');
            return;
          }
          emit(message.source, message.id);
        } else {
          stop('WATCHDOG_PROTOCOL');
        }
      }));
      child.on('exit', (code, signal) => checked(() => {
        if (code !== 0 || signal) {
          const file = path.join(out, 'guard-child-stop.json');
          stop(fs.existsSync(file) ? read(out, 'guard-child-stop.json').code : 'AUDIT_PROCESS_EXIT');
          return;
        }
        checkFresh(heartbeat, monotonicMs(), maxGap);
        checkFresh(telemetry, monotonicMs(), maxGap);
        const result = read(out, 'segment-result.json');
        if (result.status !== 'PASS') { stop('AUDIT_RESULT_MISSING'); return; }
        write(out, 'segment-gate.json', result);
        clearInterval(timer);
        stopped = true;
        resolve(result);
      }));
      emit('initial');
      timer = setInterval(() => checked(() => emit('periodic')), interval);
    });
  });
}

export function watchChild(stop, {interval = SAMPLE_INTERVAL_MS, maxGap = MAX_GAP_MS} = {}) {
  let previous, pending, requestId = 0, sequence = 0;
  const boot = monotonicMs();
  const assertFresh = () => checkFresh(previous, monotonicMs(), maxGap);
  const heartbeat = () => process.send({type: 'heartbeat', pulse: {sequence: ++sequence, at: monotonicMs()}});
  process.on('disconnect', () => stop('WATCHDOG_DISCONNECTED'));
  process.on('message', message => {
    try {
      if (message?.type !== 'sample') { stop('WATCHDOG_PROTOCOL'); return; }
      checkPulse(message.pulse, previous, monotonicMs(), maxGap);
      previous = message.pulse;
      if (message.requestId !== undefined) {
        if (!pending || message.requestId !== pending.id) { stop('WATCHDOG_PROTOCOL'); return; }
        const {resolve} = pending;
        pending = null;
        resolve();
      }
    } catch (error) { stop(codeOf(error)); }
  });
  heartbeat();
  const timer = setInterval(() => {
    try {
      checkFresh(previous ?? {at: boot}, monotonicMs(), maxGap);
      heartbeat();
    } catch (error) { stop(codeOf(error)); }
  }, interval);
  return {
    assertFresh,
    sample: source => new Promise(resolve => {
      if (pending) { stop('WATCHDOG_PROTOCOL'); return; }
      pending = {id: ++requestId, resolve};
      process.send({type: 'sample-request', source, id: pending.id});
    }),
    close() { clearInterval(timer); },
  };
}
