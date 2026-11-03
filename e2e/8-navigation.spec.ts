import { type Page, expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

// Every sidebar link must open its page on the first click, and in-page filters
// must update the page in place (no full reload, no lost typing).

const ADMIN_PAGES: [label: string, path: string, heading: RegExp][] = [
  ["My attendance", "/attendance", /^My attendance$/],
  ["Leave", "/leave", /^Leave$/],
  ["Holidays", "/holidays", /^Holidays$/],
  ["Team", "/team", /^Team$/],
  ["Approvals", "/approvals", /^Approvals$/],
  ["Reports", "/reports", /^Reports$/],
  ["Employees", "/admin/employees", /^Employees$/],
  ["Departments", "/admin/departments", /^Departments$/],
  ["Leave types", "/admin/leave-types", /^Leave types$/],
  ["Manage holidays", "/admin/holidays", /^Manage holidays$/],
  ["Settings", "/admin/settings", /^Settings$/],
  ["Branding", "/admin/branding", /^Branding$/],
  ["Audit log", "/admin/audit", /^Audit log$/],
  ["Dashboard", "/dashboard", /^Hello, /],
];

/** Set a flag that only survives client-side navigation, not a full page reload. */
const markPage = (page: Page) => page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
const wasNotReloaded = (page: Page) => page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload === true);

test("login page has only the email and password form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByText("Demo accounts")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Log in as/ })).toHaveCount(0);
});

test("every sidebar link opens its page on the first click", async ({ page }) => {
  await loginAs(page, "HR Admin");
  await markPage(page);
  const nav = page.getByRole("navigation", { name: "Main" }).first();

  for (const [label, path, heading] of ADMIN_PAGES) {
    // By href: the Approvals link's name also includes its pending-count badge.
    const link = nav.locator(`a[href="${path}"]`);
    await expect(link).toContainText(label);
    await link.click();
    await expect(page, label).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByTestId("page-loading")).toHaveCount(0);
    await expect(link).toHaveAttribute("aria-current", "page");
  }
  expect(await wasNotReloaded(page), "navigating should never reload the whole page").toBe(true);
});

test("filters update the page in place", async ({ page }) => {
  await loginAs(page, "HR Admin");

  // Search: typing keeps focus and text while results update.
  await page.goto("/admin/employees");
  await markPage(page);
  const search = page.getByRole("textbox", { name: "Search" });
  await search.pressSequentially("Arjun", { delay: 50 });
  await expect(page).toHaveURL(/q=Arjun/);
  await expect(page.locator("main table tbody tr")).toHaveCount(1);
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("Arjun");

  // Reports filter form: no full reload, and the Leave tab stays selected.
  await page.getByRole("navigation", { name: "Main" }).first().getByRole("link", { name: "Reports" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
  await page.getByRole("tab", { name: "Leave" }).click();
  await page.getByLabel("Status").selectOption("APPROVED");
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page).toHaveURL(/tab=leave.*status=APPROVED/);
  await expect(page.getByRole("tab", { name: "Leave" })).toHaveAttribute("aria-selected", "true");
  expect(await wasNotReloaded(page)).toBe(true);
});

test("employee can move between months and pages without reloads", async ({ page }) => {
  await loginAs(page, "Employee");
  await markPage(page);
  const nav = page.getByRole("navigation", { name: "Main" }).first();

  await nav.getByRole("link", { name: "My attendance" }).click();
  const calendar = page.getByRole("grid", { name: "Attendance calendar" });
  await expect(calendar).toBeVisible();
  const title = page.getByRole("heading", { level: 1, name: "My attendance" }).locator("xpath=following-sibling::p");
  const thisMonth = await title.textContent();
  await page.getByRole("link", { name: "Previous month" }).click();
  await expect(page).toHaveURL(/month=\d{4}-\d{2}/);
  await expect(title).not.toHaveText(thisMonth ?? "");

  // Quick clicks: the last one wins.
  await nav.getByRole("link", { name: "Holidays" }).click();
  await nav.getByRole("link", { name: "Leave" }).click();
  await expect(page).toHaveURL(/\/leave$/);
  await expect(page.getByRole("heading", { level: 1, name: "Leave" })).toBeVisible();
  expect(await wasNotReloaded(page)).toBe(true);
});
