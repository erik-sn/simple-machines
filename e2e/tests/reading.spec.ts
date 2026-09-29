import { expect, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./a11y";

test("turning the pages from the title page into the first chapter", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Simple Machines" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL("/introduction/2");
  await expect(page.getByRole("heading", { name: "The trade" })).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL("/introduction/3");
  await expect(
    page.getByRole("heading", { name: "Archimedes at Syracuse" }),
  ).toBeVisible();
  for (const stage of [4, 5, 6]) {
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(`/introduction/${stage}`);
  }
  await expect(
    page.getByRole("heading", { name: "How to read" }),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL("/lever");
  await expect(page.getByRole("heading", { name: /The Lever/ })).toBeVisible();
  await expectNoAccessibilityViolations(page);

  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL("/introduction/6");
});

test("the settings hint shows once and the chosen paper persists", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("tooltip")).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expectNoAccessibilityViolations(page);

  await page.getByRole("radio", { name: "Graph paper" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "graph");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "graph");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

test("the contents jump straight to a chapter", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "About" }).click();
  await expect(page.getByRole("heading", { name: "Contents" })).toBeVisible();
  await expectNoAccessibilityViolations(page);

  await page.getByRole("link", { name: /The Screw/ }).click();
  await expect(page).toHaveURL("/screw");
  await expect(page.getByRole("heading", { name: /The Screw/ })).toBeVisible();
});
