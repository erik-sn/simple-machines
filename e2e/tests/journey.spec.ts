// The template's core journey: sign in against the real backend, load real
// data through the generated client, render it. Grows with the project;
// depends on the seed_e2e management command.
import { expect, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./a11y";

test("sign in and read notes end to end", async ({ page }) => {
  await page.goto("/");
  // Unauthenticated visits land on the sign-in screen.
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expectNoAccessibilityViolations(page);

  await page.getByLabel("Username").fill("e2e");
  await page.getByLabel("Password").fill("e2e-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Notes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "First note" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Second note" })).toBeVisible();
  await expectNoAccessibilityViolations(page);
});
