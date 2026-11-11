import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { ingestionMode } from "./mode.ts";

Deno.test("dry_run true enables a read-only news check", () => {
  assertEquals(ingestionMode({ dry_run: true }), { dryRun: true, fetchOnly: false, autoPublish: false });
});
Deno.test("scheduled fetch_only true disables AI processing", () => {
  assertEquals(ingestionMode({ fetch_only: true }), { dryRun: false, fetchOnly: true, autoPublish: false });
});
Deno.test("production cron body selects fetch-only without disabling collection", () => {
  const scheduledBody = JSON.parse('{"fetch_only":true}');
  assertEquals(ingestionMode(scheduledBody), { dryRun: false, fetchOnly: true, autoPublish: false });
});
Deno.test("auto publishing requires exact explicit opt-in", () => {
  assertEquals(ingestionMode({ auto_publish: true }), { dryRun: false, fetchOnly: false, autoPublish: true });
  assertEquals(ingestionMode({ auto_publish: "true" }), { dryRun: false, fetchOnly: false, autoPublish: false });
});
Deno.test("fetch-only requires the exact boolean request flag", () => {
  assertEquals(ingestionMode({ fetch_only: "true", fetchOnly: true }), { dryRun: false, fetchOnly: false, autoPublish: false });
});