import { type Page, expect } from "@playwright/test";

export type DemoRole = "Employee" | "Manager" | "HR Admin";

export async function loginAs(page: Page, role: DemoRole) {
  await page.goto("/login");
  await page.getByRole("button", { name: `Log in as ${role}` }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function loginWith(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** "YYYY-MM-DD" in Asia/Kolkata. */
export function istDateKey(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Matches the app's single-date format, e.g. "01 Dec 2026". */
export function displayDate(key: string): string {
  const d = new Date(`${key}T12:00:00Z`);
  const month = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  return `${key.slice(8)} ${month} ${key.slice(0, 4)}`;
}
