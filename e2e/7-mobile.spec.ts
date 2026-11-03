import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test("works on a phone: hamburger menu and a full-width check-in card", async ({ page }) => {
  await loginAs(page, "Manager");

  // Sidebar is hidden; the menu button opens navigation
  await page.getByRole("button", { name: "Open menu" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("link", { name: "Approvals" })).toBeVisible();
  await sheet.getByRole("link", { name: "My attendance" }).click();
  await expect(page).toHaveURL(/\/attendance/);
  await expect(page.getByRole("grid", { name: "Attendance calendar" })).toBeVisible();

  await page.goto("/dashboard");
  const card = page.getByTestId("check-in-card");
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  expect(box!.width).toBeGreaterThan(330);

  // No horizontal scrolling on the page
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
