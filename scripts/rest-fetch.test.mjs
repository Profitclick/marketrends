import { test, expect } from "bun:test";
import { restFetch, isTransientStatus, MAX_ATTEMPTS } from "./rest-fetch.mjs";

const resp = (status, body = []) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const run = (seq) => {
  let calls = 0;
  const fetchImpl = async () => { const r = seq[calls++]; if (r instanceof Error) throw r; return r; };
  return { calls: () => calls, opts: { fetchImpl, sleep: async () => {}, rand: () => 0.5 } };
};

test("max attempts is 3", () => expect(MAX_ATTEMPTS).toBe(3));
test("transient statuses are 408, 429, 5xx only", () => {
  for (const s of [408, 429, 500, 502, 503, 504]) expect(isTransientStatus(s)).toBe(true);
  for (const s of [400, 401, 403, 404, 416]) expect(isTransientStatus(s)).toBe(false);
});
test("retries 503 then succeeds", async () => {
  const r = run([resp(503), resp(200, [1])]);
  expect(await restFetch("u", {}, r.opts)).toEqual([1]);
  expect(r.calls()).toBe(2);
});
test("retries network error then succeeds", async () => {
  const r = run([new Error("reset"), resp(200, [2])]);
  expect(await restFetch("u", {}, r.opts)).toEqual([2]);
});
test("fails closed after 3 transient failures", async () => {
  const r = run([resp(500), resp(429), resp(408), resp(200)]);
  await expect(restFetch("u", {}, r.opts)).rejects.toThrow("HTTP 408");
  expect(r.calls()).toBe(3);
});
test("does not retry 404", async () => {
  const r = run([resp(404), resp(200)]);
  await expect(restFetch("u", {}, r.opts)).rejects.toThrow("HTTP 404");
  expect(r.calls()).toBe(1);
});
