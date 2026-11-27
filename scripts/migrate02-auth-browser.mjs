import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3000";
if (process.env.MARKETRENDS_AUDIT_ORIGIN !== origin) throw Error("Isolated local preview required");
const api = new URL(process.env.VITE_SUPABASE_URL);
const storageKey = "sb-" + api.hostname.split(".")[0] + "-auth-token";
const memberId = "11111111-1111-4111-8111-111111111111";
const adminId = "22222222-2222-4222-8222-222222222222";
const fixtureSession = (id) => ({
  access_token: "fixture-only", refresh_token: "fixture-only",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600, token_type: "bearer",
  user: { id, aud: "authenticated", role: "authenticated",
    user_metadata: {}, app_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
});
const browser = await chromium.launch({ headless: true });
const evidence = [];
try {
  for (const [entry, scenario] of [
    ["/dashboard", "visitor"], ["/admin", "visitor"],
    ["/dashboard", "member"], ["/admin", "member"],
    ["/dashboard", "admin"], ["/admin", "admin"],
    ["/dashboard", "role-error"], ["/admin", "logout-error"],
  ]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    let releaseRole;
    const roleGate = new Promise(resolve => { releaseRole = resolve; });
    let releaseLogout;
    const logoutGate = new Promise(resolve => { releaseLogout = resolve; });
    try {
      if (scenario !== "visitor") {
        await context.addInitScript(({ key, session }) => {
          if (location.origin !== "http://127.0.0.1:3000") return;
          if (!sessionStorage.getItem("auth-fixture-seeded")) {
            sessionStorage.setItem("auth-fixture-seeded", "yes");
            localStorage.setItem(key, JSON.stringify(session));
            localStorage.setItem("unrelated-preference", "keep");
          }
          window.sawDeniedWhilePending = false;
          new MutationObserver(() => {
            if (document.body?.innerText.includes("Tilgang nektet")) window.sawDeniedWhilePending = true;
          }).observe(document, { subtree: true, childList: true, characterData: true });
        }, { key: storageKey, session: fixtureSession(scenario === "admin" ? adminId : memberId) });
      }
      let logoutRequests = 0;
      await context.route(url => url.origin !== origin, async route => {
        const url = new URL(route.request().url());
        if (url.origin !== api.origin) return route.abort();
        const headers = { "access-control-allow-origin": origin,
          "access-control-allow-headers": route.request().headers()["access-control-request-headers"] || "*",
          "access-control-allow-methods": "GET, POST, OPTIONS" };
        if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
        if (route.request().method() === "POST" && url.pathname === "/auth/v1/logout") {
          logoutRequests += 1;
          await logoutGate;
          return scenario === "logout-error"
            ? route.fulfill({ status: 500, headers, json: { message: "fixture: revocation failed" } })
            : route.fulfill({ status: 204, headers });
        }
        if (route.request().method() === "POST" && url.pathname === "/auth/v1/token" &&
            url.searchParams.get("grant_type") === "password" && scenario === "member") {
          return route.fulfill({ headers, json: fixtureSession(adminId) });
        }
        if (route.request().method() !== "GET") return route.abort();
        if (url.pathname === "/rest/v1/user_roles") {
          await roleGate;
          if (scenario === "role-error") return route.fulfill({ status: 500, headers, json: { message: "fixture" } });
          const isAdmin = url.searchParams.get("user_id") === `eq.${adminId}`;
          return route.fulfill({ headers, json: isAdmin ? [{ role: "admin" }] : [] });
        }
        return route.fulfill({ headers, json: [] });
      });
      const requestedRole = scenario === "visitor" ? null : page.waitForRequest(
        request => new URL(request.url()).pathname === "/rest/v1/user_roles" && request.method() === "GET", { timeout: 15000 });
      const response = await page.goto(origin + entry, { waitUntil: "domcontentloaded" });
      assert.equal(response.status(), 200);
      const html = await response.text();
      assert.match(html, /name="robots"[^>]*content="noindex, nofollow"/);
      assert.doesNotMatch(html, /rel="canonical"|Redaksjonelt Dashboard|fixture-only|"access_token"/);
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
          if (scenario === "member" || scenario === "logout-error") {
            const logout = page.waitForRequest(request =>
              request.method() === "POST" && new URL(request.url()).pathname === "/auth/v1/logout");
            const deniedUrl = page.url();
            await page.getByRole("button", { name: "Logg ut / bytt konto" }).click();
            assert.equal(new URL((await logout).url()).searchParams.get("scope"), "local");
            assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), null);
            assert.equal(await page.getByRole("button", { name: "Logger ut…" }).isDisabled(), true);
            assert.equal(page.url(), deniedUrl);
            releaseLogout();

            if (scenario === "logout-error") {
              const alert = page.getByRole("alert").filter({ hasText: "Utlogging på serveren kunne ikke bekreftes." });
              await alert.waitFor();
              assert.equal(page.url(), deniedUrl);
              await page.getByRole("link", { name: "Gå til innlogging" }).click();
            }

            await page.waitForURL(origin + "/auth");
            await page.reload();
            await page.getByRole("button", { name: "Logg inn" }).waitFor();
            assert.equal(page.url(), origin + "/auth");
            assert.equal(await page.evaluate(() => localStorage.getItem("unrelated-preference")), "keep");
            assert.equal(logoutRequests, 1);

            if (scenario === "member") {
              await page.getByLabel("E-post").fill("admin-fixture@example.invalid");
              await page.getByLabel("Passord").fill("fixture-password");
              await page.getByRole("button", { name: "Logg inn" }).click();
              await page.waitForURL(origin + "/dashboard");
              await page.getByText("Redaksjonelt Dashboard").waitFor({ timeout: 15000 });
            }
          }
        }
      } else {
        await page.waitForURL(origin + "/auth", { timeout: 15000 });
        await page.getByRole("button", { name: "Logg inn" }).waitFor();
      }
      evidence.push({ entry, scenario, result: "PASS" });
    } finally {
      releaseRole();
      releaseLogout();
      await context.close();
    }
  }
} finally {
  await browser.close();
  console.log(JSON.stringify({ authFixtures: evidence }, null, 2));
}
