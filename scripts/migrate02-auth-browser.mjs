import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3000";
if (process.env.MARKETRENDS_AUDIT_ORIGIN !== origin) throw Error("Isolated local preview required");
const api = new URL(process.env.VITE_SUPABASE_URL);
const storageKey = "sb-" + api.hostname.split(".")[0] + "-auth-token";
const browser = await chromium.launch({ headless: true });
const evidence = [];
try {
  for (const scenario of ["visitor", "member", "admin", "role-error"]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      if (scenario !== "visitor") {
        const id = "11111111-1111-4111-8111-111111111111";
        await context.addInitScript(({ key, id }) => {
          if (location.origin !== "http://127.0.0.1:3000") return;
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, JSON.stringify({
              access_token: "fixture-only", refresh_token: "fixture-only",
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              user: { id, aud: "authenticated", role: "authenticated",
                user_metadata: {}, app_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
            }));
          }
          window.sawDeniedWhilePending = false;
          new MutationObserver(() => {
            if (document.body?.innerText.includes("Tilgang nektet")) window.sawDeniedWhilePending = true;
          }).observe(document, { subtree: true, childList: true, characterData: true });
        }, { key: storageKey, id });
      }
      let releaseRole;
      const roleGate = new Promise(resolve => { releaseRole = resolve; });
      await context.route(url => url.origin !== origin, async route => {
        const url = new URL(route.request().url());
        if (url.origin !== api.origin) return route.abort();
        const headers = { "access-control-allow-origin": origin,
          "access-control-allow-headers": "*", "access-control-allow-methods": "GET, OPTIONS" };
        if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
        if (route.request().method() !== "GET") return route.abort();
        if (url.pathname === "/rest/v1/user_roles") {
          await roleGate;
          if (scenario === "role-error") return route.fulfill({ status: 500, headers, json: { message: "fixture" } });
          return route.fulfill({ headers, json: scenario === "admin" ? [{ role: "admin" }] : [] });
        }
        return route.fulfill({ headers, json: [] });
      });
      const requestedRole = scenario === "visitor" ? null : page.waitForRequest(
        request => new URL(request.url()).pathname === "/rest/v1/user_roles" && request.method() === "GET", { timeout: 15000 });
      const response = await page.goto(origin + "/dashboard", { waitUntil: "domcontentloaded" });
      assert.equal(response.status(), 200);
      const html = await response.text();
      assert.match(html, /name="robots"[^>]*content="noindex, nofollow"/);
      assert.doesNotMatch(html, /rel="canonical"|Redaksjonelt Dashboard/);
      if (requestedRole) {
        await requestedRole;
        await page.getByText("Verifiserer tilgang…").waitFor();
        assert.equal(await page.getByText("Tilgang nektet").count(), 0);
        releaseRole();
        if (scenario === "admin") {
          await page.getByText("Redaksjonelt Dashboard").waitFor({ timeout: 15000 });
          assert.equal(await page.evaluate(() => window.sawDeniedWhilePending), false);
        } else {
          await page.getByRole("heading", { name: "Tilgang nektet" }).waitFor({ timeout: 15000 });
          assert.equal(await page.getByText("Redaksjonelt Dashboard").count(), 0);
        }
      } else {
        await page.waitForURL(origin + "/auth", { timeout: 15000 });
        await page.getByRole("button", { name: "Logg inn" }).waitFor();
      }
      evidence.push({ scenario, result: "PASS" });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  console.log(JSON.stringify({ authFixtures: evidence }, null, 2));
}
