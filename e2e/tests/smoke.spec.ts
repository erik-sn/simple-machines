import { expect, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./a11y";

test("the book opens on its title page", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Simple Machines" }),
  ).toBeVisible();
  await expectNoAccessibilityViolations(page);
});
