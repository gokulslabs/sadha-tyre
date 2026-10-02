import { expect, test } from "@playwright/test";

test("real Supabase vehicle, tyre edit, maintenance, alert, and audit workflow", async ({ page }) => {
  const email = process.env.SUPABASE_TEST_USER_A_EMAIL;
  const password = process.env.SUPABASE_TEST_USER_A_PASSWORD;
  if (!email || !password) throw new Error("Test-user login is missing.");

  const plate = "E2E-" + Date.now().toString().slice(-8);
  await page.goto("/auth");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Truck Tyre View" })).toBeVisible();

  await page.getByRole("button", { name: "Add vehicle", exact: true }).click();
  await page.getByPlaceholder("MH12XX0000").fill(plate);
  await page.getByRole("button", { name: "Create vehicle", exact: true }).click();
  await expect(page.getByText("Vehicle added")).toBeVisible();

  const tyre = page.getByRole("button", { name: /Tyre 1R/ });
  await expect(tyre).toBeVisible();
  await tyre.click();
  await page.getByRole("button", { name: "Edit Details" }).click();
  await page.getByLabel("Brand").fill("E2E Test Brand");
  await page.getByLabel("Serial No").fill(plate + "-1R");
  await page.getByLabel("Current KM").fill("500");
  await page.getByRole("button", { name: "Save Tyre" }).click();
  await expect(page.getByText("Tyre 1R updated")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Vertical" }).click();
  await expect(page.getByRole("button", { name: /Tyre 1R.*500 kilometres used/ })).toBeVisible();
  await page.getByRole("button", { name: "Horizontal" }).click();

  await page.getByRole("button", { name: "Tyre Maintenance", exact: true }).click();
  await page.getByRole("combobox").nth(0).click();
  await page.getByRole("option", { name: plate }).click();
  await page.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: /1R/ }).click();
  await page.getByLabel("Vehicle odometer (km)").fill("6000");
  await page.getByLabel("Amount").fill("1250");
  await page.getByLabel("Tread depth (mm)").fill("8.1");
  await page.getByLabel("Damage / inspection notes").fill("Real Supabase integration check");
  await page.getByLabel("Next alert odometer (km)").fill("7000");
  await page.getByRole("button", { name: "Save maintenance" }).click();
  await expect(page.getByText("Tyre maintenance recorded")).toBeVisible();
  await expect(page.getByText("1 tyre service due soon")).toBeVisible();

  await page.getByRole("button", { name: "Fleet Overview", exact: true }).click();
  await expect(page.getByRole("button", { name: new RegExp(plate + ".*1R.*Inspection") })).toBeVisible();

  await page.getByRole("button", { name: "Audit Log", exact: true }).click();
  await expect(page.getByText(plate)).toBeVisible();
  await expect(page.getByText("Tyre Maintenance")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Truck Tyre View" })).toBeVisible();
  await page.getByRole("button", { name: "Tyre Maintenance", exact: true }).click();
  await expect(page.getByText(plate)).toBeVisible();
});
