import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { ingestionMode } from "./mode.ts";

Deno.test("dry_run true enables a read-only news check", () => {
  assertEquals(ingestionMode({ dry_run: true }), { dryRun: true, fetchOnly: false });
});
Deno.test("scheduled fetch_only true disables AI processing", () => {
  assertEquals(ingestionMode({ fetch_only: true }), { dryRun: false, fetchOnly: true });
});