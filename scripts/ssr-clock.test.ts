import { describe, expect, test } from "bun:test";
import { getFreshness, relativeTimeNo } from "../src/lib/freshness";
import { formatOsloDate } from "../src/lib/osloDate";

describe("SSR clock contract", () => {
  test("freshness depends on a shared explicit reference time", () => {
    const date = "2026-11-25T12:00:00Z";
    const now = Date.parse("2026-11-25T12:30:00Z");
    expect(getFreshness(date, now)).toBe("live");
    expect(relativeTimeNo(date, now)).toBe("30 min siden");
  });
  test("publication time is formatted in Oslo, including summer time", () => {
    expect(formatOsloDate("2026-11-25T12:00:00Z", "HH:mm")).toBe("13:00");
    expect(formatOsloDate("2026-06-25T12:00:00Z", "HH:mm")).toBe("14:00");
  });
});
