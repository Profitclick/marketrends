import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

// Use public client configuration without logging values or obtaining privileged tokens.
const config = readFileSync(".env", "utf8");
const value = (name: string) => config.match(new RegExp(`^${name}=["']?([^"'\\r\\n]+)`, "m"))?.[1];
const base = value("VITE_SUPABASE_URL");
const key = value("VITE_SUPABASE_PUBLISHABLE_KEY");

async function deniedRPC(name: string, body: Record<string, unknown>) {
  if (!base || !key) throw new Error("Public test configuration unavailable");
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  expect([401, 403]).toContain(response.status);
  const error = await response.json();
  expect(error.code).toBe("42501");
  expect(error.message).toContain("permission denied for function");
}

test("anonymous callers cannot start operational pipeline runs", async () => {
  await deniedRPC("start_pipeline_run", { _job: "phase7d2-negative-test", _stale_minutes: 30 });
});

test("anonymous callers cannot complete operational pipeline runs", async () => {
  await deniedRPC("complete_pipeline_run", {
    _id: "00000000-0000-0000-0000-000000000000", _status: "success",
  });
});