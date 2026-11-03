import { expect, test } from "@playwright/test";
import { loginAs, loginWith, logout } from "./helpers";

test("admin creates an employee who can then log in", async ({ page }) => {
  const email = `new.hire.${Date.now()}@example.com`;
  const password = "Welcome@2024";

  await loginAs(page, "HR Admin");
  await page.goto("/admin/employees");
  await page.getByRole("button", { name: "Add employee" }).click();

  const dialog = page.getByRole("dialog");
  // Submitting empty shows field errors
  await dialog.getByRole("button", { name: "Add employee" }).click();
  await expect(dialog.getByTestId("emp-name-error")).toBeVisible();

  await dialog.getByLabel("Full name").fill("Nisha Agarwal");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Role").selectOption("EMPLOYEE");
  await dialog.getByLabel("Department").selectOption({ label: "Engineering" });
  await dialog.getByLabel("Manager").selectOption({ label: "Rahul Sharma" });
  await dialog.getByLabel("Initial password").fill(password);
  await dialog.getByRole("button", { name: "Add employee" }).click();
  await expect(page.getByText("Nisha Agarwal was added.")).toBeVisible();
  await expect(page.getByTestId("employee-row").filter({ hasText: email })).toBeVisible();
  await logout(page);

  await loginWith(page, email, password);
  await expect(page.getByTestId("current-user-name")).toHaveText("Nisha Agarwal");
  await expect(page.getByTestId("role-badge")).toHaveText("Employee");
  // New employees get this year's balances right away
  await expect(page.getByTestId("balance-CL-available")).toHaveText("12");
});
