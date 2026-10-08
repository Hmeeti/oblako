import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("landing renders brand", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Stolio" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Оставить заявку" })).toBeVisible();
  });
});
