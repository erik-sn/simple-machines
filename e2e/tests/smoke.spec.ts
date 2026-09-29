import { expect, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./a11y";

test("the app serves and renders the sign-in screen", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expectNoAccessibilityViolations(page);
});
