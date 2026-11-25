import http from 'node:http';
import {performance} from 'node:perf_hooks';
import {pipeline, Readable} from 'node:stream';
import {createBrotliDecompress, createGunzip, createUnzip} from 'node:zlib';

const decoders = {
  gzip: createGunzip,
  deflate: createUnzip,
  br: createBrotliDecompress,
};

// A dedicated HTTP/1.1 connection lets us timestamp the first socket data
// before the parser waits for complete response headers.
export function measureHttp(input, options, request = http.request, now = () => performance.now()) {
  return new Promise((resolve, reject) => {
    let firstByte;
    const dispatched = now();
    const req = request(input, {
      agent: false, method: 'GET', signal: options.signal,
      headers: {'accept-encoding': 'gzip, deflate', ...options.headers},
    }, incoming => {
      try {
        if (!Number.isFinite(firstByte) || firstByte < dispatched) throw new Error('HTTP_TTFB_MISSING');
        const decoder = Object.hasOwn(decoders, incoming.headers['content-encoding'])
          ? decoders[incoming.headers['content-encoding']] : null;
        const noBody = [204, 205, 304].includes(incoming.statusCode);
        if (noBody) incoming.resume();
        const body = noBody ? null : Readable.toWeb(decoder ? pipeline(incoming, decoder(), () => {}) : incoming);
        const response = new Response(body, {status: incoming.statusCode, headers: incoming.headers});
        resolve({response, httpTtfbMs: firstByte - dispatched, dispatched});
      } catch (error) {
        incoming.destroy();
        reject(error);
      }
    });
    req.on('error', reject);
    req.on('socket', socket => {
      socket.prependOnceListener('data', () => { firstByte = now(); });
    });
    req.end();
  });
}
