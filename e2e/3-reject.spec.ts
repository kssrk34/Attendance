import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test("manager can't reject without a note, but can with one", async ({ page }) => {
  await loginAs(page, "Manager");
  await page.goto("/approvals");

  const row = page.getByTestId("approval-row").filter({ hasText: "Karthik Subramanian" });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Reject" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Reject request" }).click();
  await expect(dialog.getByText("Please explain why this request is rejected.")).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(row).toHaveCount(1);

  await dialog.getByLabel("Reason for rejection").fill("Overlaps with the quarterly release. Please pick other dates.");
  await dialog.getByRole("button", { name: "Reject request" }).click();
  await expect(page.getByText("Rejected Karthik Subramanian's leave.")).toBeVisible();
  await expect(row).toHaveCount(0);

  await page.getByRole("tab", { name: "Decided by me" }).click();
  await expect(page.getByRole("tabpanel").getByText("Overlaps with the quarterly release.")).toBeVisible();
});
