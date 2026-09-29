import { expect, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./a11y";

async function dragBetween(
  page: import("@playwright/test").Page,
  from: import("@playwright/test").Locator,
  to: import("@playwright/test").Locator,
) {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (a === null || b === null) {
    throw new Error("A port is not on screen");
  }
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
}

test("building on the bench: a weight hung from a lever survives a reload", async ({
  page,
}) => {
  await page.goto("/theatre");
  await expect(
    page.getByRole("heading", { name: /Theatre of Machines/ }),
  ).toBeVisible();
  const bench = page.getByRole("img", { name: "The bench" });

  await page.getByRole("button", { name: "Lever" }).click();
  await expect(bench).toHaveAttribute("data-nodes", "1");
  await page.getByRole("button", { name: "Weight" }).click();
  await expect(bench).toHaveAttribute("data-nodes", "2");
  await expectNoAccessibilityViolations(page);

  await dragBetween(
    page,
    page.locator('[data-node="we1"][data-port="rope-end"]'),
    page.locator('[data-node="le1"][data-port="load-hook"]'),
  );
  await expect(bench).toHaveAttribute("data-links", "1");
  await expect(page).toHaveURL(/#c=/);

  await page.reload();
  await expect(page.getByRole("img", { name: "The bench" })).toHaveAttribute(
    "data-nodes",
    "2",
  );
  await expect(page.getByRole("img", { name: "The bench" })).toHaveAttribute(
    "data-links",
    "1",
  );
});
