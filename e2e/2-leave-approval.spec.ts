import { expect, test } from "@playwright/test";
import { addDays, displayDate, istDateKey, loginAs, logout } from "./helpers";

test("employee applies for leave, manager approves, employee sees approved and reduced balance", async ({ page }) => {
  await loginAs(page, "Employee");
  await page.goto("/leave");

  const available = page.getByTestId("balance-CL-available");
  const before = Number(await available.textContent());

  const form = page.getByTestId("apply-leave-form");
  await form.getByLabel("Leave type").selectOption({ label: "Casual Leave (CL)" });

  // Find a single future working day (skipping weekends/holidays) using the live preview.
  let day = addDays(istDateKey(), 28);
  for (let i = 0; i < 14; i++) {
    await form.getByLabel("First day of leave").fill(day);
    await form.getByLabel("Last day of leave").fill(day);
    const text = await page.getByTestId("leave-preview").textContent();
    if (text?.includes("1 working day")) break;
    day = addDays(day, 1);
  }
  await expect(page.getByTestId("leave-preview-days")).toHaveText("1 working day");
  // The preview says when the employee is back in office: a day after the leave.
  await expect(page.getByTestId("leave-preview-back")).toContainText("You'll be back in office on");
  await form.getByLabel("Reason").fill("E2E test: personal errand");
  await form.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByText("Leave request submitted for approval.")).toBeVisible();

  const row = page.getByTestId("leave-request-row").filter({ hasText: displayDate(day) });
  await expect(row.getByTestId("leave-status")).toHaveText("Pending");
  await expect(row.getByTestId("back-in-office")).toContainText("Back in office");
  await expect(available).toHaveText(String(before - 1));
  await logout(page);

  // Manager approves
  await loginAs(page, "Manager");
  await page.goto("/approvals");
  const approval = page.getByTestId("approval-row").filter({ hasText: "Arjun Mehta" }).filter({ hasText: displayDate(day) });
  await approval.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Approve request" }).click();
  await expect(page.getByText("Approved Arjun Mehta's leave.")).toBeVisible();
  await expect(approval).toHaveCount(0);
  await logout(page);

  // Employee sees it approved and the balance reduced
  await loginAs(page, "Employee");
  await page.goto("/leave");
  await expect(page.getByTestId("leave-request-row").filter({ hasText: displayDate(day) }).getByTestId("leave-status")).toHaveText("Approved");
  await expect(page.getByTestId("balance-CL-available")).toHaveText(String(before - 1));
  await expect(page.getByTestId("balance-CL")).toContainText(/\d+ used/);
});
