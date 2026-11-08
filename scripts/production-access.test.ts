import { test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";

// Read local browser configuration without printing it; no mutation requests.
const config = readFileSync(".env", "utf8");
const value = (key: string) => config.match(new RegExp(`^${key}=["']?([^"'\\r\\n]+)`, "m"))?.[1];
const base = value("VITE_SUPABASE_URL");
const key = value("VITE_SUPABASE_PUBLISHABLE_KEY");
const sessionPath = `${homedir()}/.cache/lovable-auth/session.json`;
const session = existsSync(sessionPath) ? JSON.parse(readFileSync(sessionPath, "utf8")).session : undefined;

async function request(path: string, token = key) {
  if (!base || !key || !token) throw new Error("Test configuration unavailable");
  return fetch(`${base}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
}

test("anonymous users cannot read inactive RSS feeds", async () => {
  const response = await request("rss_feeds?select=id&active=eq.false");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([]);
});

test("public link endpoints reject nonexistent and unknown targets", async () => {
  if (!base || !key) throw new Error("Test configuration unavailable");
  for (const type of ["article", "intent", "unknown"]) {
    const response = await fetch(`${base}/rest/v1/rpc/is_public_link_endpoint`, {
      method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint_type: type, endpoint_slug: "phase7c1-nonexistent-test-target" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toBe(false);
  }
});

test("public editorial links remain readable", async () => {
  const response = await request("internal_links?select=source_type,target_type&limit=1");
  expect(response.status).toBe(200);
  expect((await response.json()).length).toBe(1);
});

test("existing admin can still read RSS configuration", async () => {
  if (!session?.access_token) throw new Error("Managed admin test session unavailable");
  const response = await request("rss_feeds?select=id&limit=1", session.access_token);
  expect(response.status).toBe(200);
  expect((await response.json()).length).toBe(1);
});