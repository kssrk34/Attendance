import { expect, test } from "@playwright/test";
import { loginAs, logout } from "./helpers";

// A tiny 2x2 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGNgYGD4z8DAwMDAwMDAAAANAAH9e7mXAAAAAElFTkSuQmCC",
  "base64",
);

test("admin rebrands the app, then resets to the generic look", async ({ page }) => {
  await loginAs(page, "HR Admin");
  await page.goto("/admin/branding");

  await page.getByLabel("App name").fill("People Hub");
  await page.getByLabel("Company name").fill("Test Org Ltd");
  await page.getByRole("textbox", { name: "Primary color", exact: true }).fill("#16a34a");
  await page.getByTestId("logo-input").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("img", { name: "Test Org Ltd logo" }).first()).toHaveAttribute("src", /^data:image\/png;base64,/);
  await page.getByRole("button", { name: "Save branding" }).click();
  await expect(page.getByText("Branding saved.")).toBeVisible();

  // Sidebar, theme color and tab title update right away
  await page.goto("/dashboard");
  const sidebar = page.getByTestId("sidebar-brand").first();
  await expect(sidebar.getByTestId("brand-company-name")).toHaveText("Test Org Ltd");
  await expect(sidebar.getByTestId("brand-app-name")).toHaveText("People Hub");
  await expect(sidebar.locator("img")).toHaveAttribute("alt", "Test Org Ltd logo");
  await expect(page).toHaveTitle("Dashboard · People Hub");
  const primary = await page.evaluate(() => document.documentElement.style.getPropertyValue("--primary"));
  expect(primary).toBe("#16a34a");

  // Login page too
  await logout(page);
  await expect(page.getByTestId("login-company-name")).toHaveText("Test Org Ltd");
  await expect(page.getByTestId("login-app-name")).toHaveText("People Hub");
  await expect(page.getByRole("img", { name: "Test Org Ltd logo" })).toBeVisible();
  const icon = await page.request.get("/brand-icon");
  expect(icon.headers()["content-type"]).toBe("image/png");

  // Reset to defaults
  await loginAs(page, "HR Admin");
  await page.goto("/admin/branding");
  await page.getByRole("button", { name: "Reset to defaults" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText("Branding reset to defaults.")).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByTestId("sidebar-brand").first().getByTestId("brand-company-name")).toHaveText("Your Company");
  await expect(page.getByTestId("sidebar-brand").first().locator("img")).toHaveCount(0);
  await logout(page);
  await expect(page.getByTestId("login-company-name")).toHaveText("Your Company");
  await expect(page.getByTestId("login-app-name")).toHaveText("Attendance Portal");
  await expect(page.getByRole("img", { name: "Your Company logo" })).toHaveText("YC");
  await expect(page).toHaveTitle("Log in · Attendance Portal");
});
