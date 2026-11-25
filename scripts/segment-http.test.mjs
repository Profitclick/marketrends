import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import http from 'node:http';
import {Duplex, Readable} from 'node:stream';
import test from 'node:test';
import {gzipSync} from 'node:zlib';
import {measureHttp} from './segment-http.mjs';

test('first socket byte time excludes delayed headers, body and earlier guard overhead', async () => {
  let time = 500;
  const clock = () => time;
  const signal = AbortSignal.timeout(1000);
  const request = (input, opts, respond) => {
    assert.equal(input, 'http://127.0.0.1:3000/dummy');
    assert.equal(opts.method, 'GET');
    assert.equal(opts.signal, signal);
    assert.equal(opts.agent, false);
    const req = new EventEmitter();
    req.end = () => {
      const socket = new EventEmitter();
      req.emit('socket', socket);
      time += 12;
      socket.emit('data', Buffer.from('H'));
      time += 90;
      socket.emit('data', Buffer.from('TTP/1.1'));
      const incoming = Readable.from([gzipSync('offline body')]);
      incoming.headers = {'content-type': 'text/html', 'content-encoding': 'gzip'};
      incoming.statusCode = 200;
      respond(incoming);
    };
    return req;
  };
  const result = await measureHttp('http://127.0.0.1:3000/dummy', {signal}, request, clock);
  assert.equal(result.dispatched, 500);
  assert.equal(result.httpTtfbMs, 12);
  assert.equal(await result.response.text(), 'offline body');
});

test('missing first socket byte fails timing evidence', async () => {
  const request = (_input, _opts, respond) => {
    const req = new EventEmitter();
    req.end = () => respond(Readable.from([]));
    return req;
  };
  await assert.rejects(measureHttp('dummy', {}, request), /HTTP_TTFB_MISSING/);
});

test('the Node HTTP parser sees complete headers after the first byte on an in-memory socket', async () => {
  let time = 100;
  const request = (input, opts, respond) => http.request(input, {
    ...opts, agent: undefined,
    createConnection: () => new Duplex({
      read() {},
      write(_chunk, _encoding, done) {
        setImmediate(() => {
          time += 10;
          this.push(Buffer.from('HTTP/1.1 200 OK\r\nContent-Length: 4\r\n'));
          setImmediate(() => {
            time += 50;
            this.push(Buffer.from('\r\ndemo'));
            this.push(null);
          });
        });
        done();
      },
    }),
  }, respond);
  const result = await measureHttp('http://127.0.0.1:3000/dummy', {signal: AbortSignal.timeout(1000)}, request, () => time);
  assert.equal(result.httpTtfbMs, 10);
  assert.equal(time, 160);
  assert.equal(await result.response.text(), 'demo');
});
