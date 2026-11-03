import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test("employee cannot open approvals, team, reports or admin pages", async ({ page }) => {
  await loginAs(page, "Employee");

  // Links for other roles aren't shown...
  const nav = page.getByRole("navigation", { name: "Main" }).first();
  await expect(nav.getByRole("link", { name: "Approvals" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Employees" })).toHaveCount(0);

  // ...and typing the URL is blocked on the server.
  for (const path of [
    "/approvals",
    "/team",
    "/reports",
    "/admin/employees",
    "/admin/departments",
    "/admin/leave-types",
    "/admin/holidays",
    "/admin/settings",
    "/admin/branding",
    "/admin/audit",
  ]) {
    await page.goto(path);
    await expect(page.getByTestId("forbidden"), path).toBeVisible();
  }

  const csv = await page.request.get("/api/reports/attendance");
  expect(csv.status()).toBe(403);
});

test("signed-out visitors are sent to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
