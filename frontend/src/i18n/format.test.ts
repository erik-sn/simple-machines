// template-managed (bootstrap): do not edit. Delete this line to take ownership.
import { afterEach, expect, test } from "vitest";
import { formatCurrency, formatDateTime, formatNumber } from "./format";
import i18n from "./index";

afterEach(async () => {
  await i18n.changeLanguage("en");
});

// Tests run with TZ=UTC (vite.config.ts); ICU may separate with non-breaking
// spaces, hence \s in the patterns.
test("formatDateTime renders a medium date and short time", () => {
  expect(formatDateTime("2026-09-25T15:04:00Z")).toMatch(
    /^Sep 25, 2026, 3:04\sPM$/,
  );
});

test("formatting follows the active language", async () => {
  await i18n.changeLanguage("de");
  expect(formatDateTime("2026-09-25T15:04:00Z")).toMatch(
    /^25\.09\.2026, 15:04$/,
  );
  expect(formatNumber(1234.5)).toBe("1.234,5");
  expect(formatCurrency(12, "EUR")).toMatch(/^12,00\s€$/);
});

test("formatNumber and formatCurrency use Intl.NumberFormat", () => {
  expect(formatNumber(1234.5)).toBe("1,234.5");
  expect(formatNumber(0.256, { style: "percent" })).toBe("26%");
  expect(formatCurrency(12, "USD")).toBe("$12.00");
});
