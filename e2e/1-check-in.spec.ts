import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test("employee checks in, sees status update, then checks out", async ({ page }) => {
  await loginAs(page, "Employee");
  const card = page.getByTestId("check-in-card");
  await expect(card).toBeVisible();

  const checkIn = card.getByRole("button", { name: "Check In" });
  test.skip(!(await checkIn.isVisible()), "Today is a weekend or holiday, so check-in is closed.");

  await expect(card.getByTestId("check-in-time")).toHaveText("—");
  await checkIn.click();
  await expect(page.getByText(/Checked in at \d{2}:\d{2}/)).toBeVisible();
  await expect(card.getByTestId("today-status")).toContainText("Checked in");
  await expect(card.getByTestId("check-in-time")).not.toHaveText("—");
  await expect(card.getByRole("button", { name: "Check In" })).toHaveCount(0);

  await card.getByRole("button", { name: "Check Out" }).click();
  await expect(page.getByText(/Checked out at \d{2}:\d{2}/)).toBeVisible();
  await expect(card.getByTestId("check-out-time")).not.toHaveText("—");
  await expect(card.getByRole("button", { name: "Check Out" })).toHaveCount(0);
  await expect(card.getByText("You're done for today")).toBeVisible();
});
