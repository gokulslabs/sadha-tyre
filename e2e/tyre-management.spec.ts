import { expect, test } from "@playwright/test";

async function loginIfRequired(page: import("@playwright/test").Page) {
  const landingCta = page.getByRole("link", { name: "Open tyre management" });
  if (await landingCta.isVisible().catch(() => false)) await landingCta.click();
  const heading = page.getByRole("heading", { name: "Sign in to Tyre Management" });
  if (!(await heading.isVisible().catch(() => false))) return;
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) throw new Error("Set E2E_EMAIL and E2E_PASSWORD when VITE_REQUIRE_AUTH=true");
  await page.getByPlaceholder("Email address").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Truck Tyre View" })).toBeVisible();
}

test.describe("Sadha Tyre Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\/rest\/v1\//, (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": "0-0/*" }, body: "[]" }));
    await page.route(/\/auth\/v1\/user/, (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "No session" }) }));
  });

  test("renders the public landing page with an accessible sign-in action", async ({ page }) => {
    await page.goto("/");
    const landingHeading = page.getByRole("heading", { name: /Know every tyre/i });
    if (await landingHeading.isVisible().catch(() => false)) {
      await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    } else {
      await expect(page.getByRole("navigation", { name: "Tyre management modules" })).toBeVisible();
    }
  });

  test("renders the dashboard and every maintenance module", async ({ page }) => {
    await page.goto("/");
    await loginIfRequired(page);
    await expect(page.getByRole("heading", { name: "Maintenance at a glance" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Set up your fleet" })).toBeVisible();
    for (const label of ["Tyre View", "Tyre Inventory", "Tyre Fitment", "Tyre Maintenance", "Excavator Teeth", "Services", "Audit Log"]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
  });

  test("shared navigation and global search include Tyre Maintenance and vehicles", async ({ page }) => {
    await page.goto("/");
    await loginIfRequired(page);
    await page.getByRole("button", { name: "Open Sidebar Menu" }).click();
    const sidebar = page.getByRole("dialog", { name: "Maintenance navigation" });
    await expect(sidebar.getByRole("button", { name: "Tyre Maintenance", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sidebar).toHaveCount(0);
    await page.getByRole("button", { name: "Open Sidebar Menu" }).click();
    await page.getByRole("dialog", { name: "Maintenance navigation" }).getByRole("button", { name: "Tyre Maintenance", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Tyre Maintenance" })).toBeVisible();
    const search = page.getByRole("textbox", { name: "Search vehicles and modules" });
    await search.fill("Maintenance");
    const results = page.getByRole("region", { name: "Search results" });
    await expect(results.getByRole("button", { name: "Tyre Maintenance" })).toBeVisible();
    await results.getByRole("button", { name: "Tyre Maintenance" }).click();
    await expect(page.getByRole("heading", { name: "Tyre Maintenance" })).toBeVisible();
    await page.getByRole("button", { name: "Tyre View", exact: true }).last().click();
    const vehicleSelector = page.getByRole("combobox").first();
    if (await page.getByRole("heading", { name: "Truck Tyre View" }).isVisible().catch(() => false)) {
      const vehicleNumber = (await vehicleSelector.innerText()).split("·")[0].trim();
      await search.fill(vehicleNumber);
      await expect(page.getByRole("region", { name: "Search results" }).getByRole("button").filter({ hasText: vehicleNumber })).toBeVisible();
    }
  });

  test("vertical tyre view shows the vehicle centered with axle labels and a keyboard-safe detail dialog", async ({ page }) => {
    const vehicleId = "test-vehicle-1";
    await page.route(/\/rest\/v1\/vehicles(?:\?|$)/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: vehicleId, vehicle_number: "TEST-1234", wheels: 4, odometer: 10500, odometer_updated_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }]) }));
    const tyres = ["1R", "1L", "2R", "2L"].map((position_code, index) => ({ id: `test-tyre-${index}`, vehicle_id: vehicleId, position_code, axle_label: `AXLE ${position_code[0]}`, brand: "Demo", serial_no: `SN-${index}`, current_km: 1200 + index * 100, fitted_km: 0, fitted_on: "2026-01-01", cost: 1200, tyre_type: "New", status: "running", remark: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }));
    await page.route(/\/rest\/v1\/tyres(?:\?|$)/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tyres) }));
    await page.goto("/");
    await page.getByRole("button", { name: "Tyre View", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Truck Tyre View" })).toBeVisible();
    await page.getByRole("button", { name: "Vertical" }).click();
    await expect(page.getByText("AXLE 1").first()).toBeVisible();
    await expect(page.getByRole("img", { name: "truck cab facing front" })).toBeVisible();
    const tyre = page.getByRole("button", { name: /Tyre 1R/ });
    await expect(tyre).toBeVisible();
    await tyre.hover();
    const tyreTooltip = page.getByRole("tooltip");
    await expect(tyreTooltip).toContainText("Position: 1R");
    await expect(tyreTooltip).toContainText("KM Usage: 1,200 km");
    await expect(tyreTooltip).toContainText("Cost per KM:");
    await tyre.click();
    await expect(page.getByRole("dialog", { name: "Tyre 1R details" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Tyre 1R details" })).toHaveCount(0);
  });

  test("tyre edits are shared between horizontal and vertical layouts", async ({ page }) => {
    const vehicleId = "shared-view-vehicle";
    const vehicle = { id: vehicleId, vehicle_number: "TN23TEST42", wheels: 4, odometer: 10500, odometer_updated_at: "2026-09-26T00:00:00Z", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
    let tyres = ["1R", "1L", "2R", "2L"].map((position_code, index) => ({ id: `shared-tyre-${index}`, vehicle_id: vehicleId, position_code, axle_label: `AXLE ${position_code[0]}`, brand: "Demo", serial_no: `SN-${index}`, current_km: 1200 + index * 100, fitted_km: 0, fitted_on: "2026-01-01", cost: 1200, tyre_type: "New", status: "running", remark: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }));
    await page.route(/\/rest\/v1\/vehicles(?:\?|$)/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([vehicle]) }));
    await page.route(/\/rest\/v1\/tyres(?:\?|$)/, async (route) => {
      if (route.request().method() === "PATCH") {
        const patch = route.request().postDataJSON() as { current_km?: number };
        const url = new URL(route.request().url());
        const id = url.searchParams.get("id")?.replace("eq.", "");
        const updated = tyres.find((tyre) => tyre.id === id)!;
        Object.assign(updated, patch);
        await route.fulfill({ status: 200, contentType: "application/vnd.pgrst.object+json", body: JSON.stringify(updated) });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tyres) });
      }
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Tyre View", exact: true }).click();
    const originalTyre = page.getByRole("button", { name: /Tyre 1R/ });
    await expect(originalTyre).toHaveAttribute("aria-label", /1,200 kilometres used/);
    await originalTyre.click();
    await page.getByRole("button", { name: "Edit Details" }).click();
    await page.getByLabel("Current KM").fill("5678");
    await page.getByRole("button", { name: "Save Tyre" }).click();
    await page.getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: "Vertical" }).click();
    await expect(page.getByRole("button", { name: /Tyre 1R.*5,678 kilometres used/ })).toBeVisible();
    await page.getByRole("button", { name: "Horizontal" }).click();
    await expect(page.getByRole("button", { name: /Tyre 1R.*5,678 kilometres used/ })).toBeVisible();
  });

  test("records maintenance against the selected tyre and refreshes its due state", async ({ page }) => {
    const vehicleId = "maintenance-test-vehicle";
    const tyreId = "maintenance-test-tyre";
    const vehicle = { id: vehicleId, vehicle_number: "TN23TEST42", wheels: 6, odometer: 10000, odometer_updated_at: "2026-09-26T00:00:00Z", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
    let tyre = { id: tyreId, vehicle_id: vehicleId, position_code: "1R", axle_label: "AXLE 1", brand: "Demo", serial_no: "SN-1", current_km: 1000, fitted_km: 0, fitted_on: "2026-01-01", cost: 1200, tyre_type: "New", status: "running", remark: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
    const saved: Record<string, unknown>[] = [];
    await page.route(/\/rest\/v1\/vehicles(?:\?|$)/, async (route) => {
      if (route.request().method() === "PATCH") {
        Object.assign(vehicle, route.request().postDataJSON());
        return route.fulfill({ status: 204, body: "" });
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([vehicle]) });
    });
    await page.route(/\/rest\/v1\/tyres(?:\?|$)/, async (route) => {
      if (route.request().method() === "PATCH") {
        Object.assign(tyre, route.request().postDataJSON());
        return route.fulfill({ status: 204, body: "" });
      }
      if (route.request().headers().accept?.includes("application/vnd.pgrst.object+json")) {
        return route.fulfill({ status: 200, contentType: "application/vnd.pgrst.object+json", body: JSON.stringify({ vehicle_id: tyre.vehicle_id, fitted_km: tyre.fitted_km }) });
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([tyre]) });
    });
    await page.route(/\/rest\/v1\/rpc\/record_tyre_maintenance(?:\?|$)/, async (route) => {
      const { p_record } = route.request().postDataJSON() as { p_record: Record<string, unknown> };
      saved.push(p_record);
      Object.assign(tyre, { current_km: Number(p_record.km_reading), condition: p_record.condition_after, tread_depth_mm: p_record.tread_depth_mm });
      if (Number(p_record.km_reading) >= Number(vehicle.odometer)) Object.assign(vehicle, { odometer: p_record.km_reading });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(p_record) });
    });
    await page.route(/\/rest\/v1\/tyre_maintenance(?:\?|$)/, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(saved.map((record, index) => ({ id: `saved-${index}`, ...record }))) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Tyre Maintenance", exact: true }).click();
    await page.getByRole("combobox").nth(0).click();
    await page.getByRole("option", { name: "TN23TEST42" }).click();
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: /1R/ }).click();
    await page.getByRole("spinbutton").nth(0).fill("9000");
    await page.getByRole("button", { name: "Save maintenance" }).click();
    await expect(page.getByText("Odometer cannot go backwards from 10,000 km", { exact: false })).toBeVisible();
    expect(saved).toHaveLength(0);
    await page.getByRole("spinbutton").nth(0).fill("11000");
    await page.getByLabel("Tread depth (mm)").fill("7.2");
    await page.getByLabel("Damage / inspection notes").fill("Mock puncture inspection");
    await page.getByLabel("Amount").fill("2500");
    await page.getByLabel("Next alert odometer (km)").fill("12000");
    await page.getByRole("button", { name: "Save maintenance" }).click();
    await expect(page.getByText("Tyre maintenance recorded")).toBeVisible();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ tyre_id: tyreId, km_reading: 11000, tread_depth_mm: 7.2, damage_notes: "Mock puncture inspection", amount: 2500, next_alert_km: 12000 });
    await expect(page.getByText("1 tyre service due soon")).toBeVisible();
  });

  test("fleet alerts open the matching vehicle tyre and show its maintenance history", async ({ page }) => {
    const vehicleId = "alert-test-vehicle";
    const tyreId = "alert-test-tyre";
    const vehicle = { id: vehicleId, vehicle_number: "TN23ALERT01", wheels: 4, odometer: 11000, odometer_updated_at: "2026-09-26T00:00:00Z", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
    const tyre = { id: tyreId, vehicle_id: vehicleId, position_code: "1R", axle_label: "AXLE 1", brand: "Demo", serial_no: "ALERT-SN-1", current_km: 1000, fitted_km: 10000, fitted_on: "2026-01-01", cost: 1200, tyre_type: "New", status: "running", remark: null, condition: "monitor", tread_depth_mm: 8, created_at: "2026-01-01", updated_at: "2026-01-01" };
    const maintenance = { id: "alert-maintenance-1", tyre_id: tyreId, entry_date: "2026-09-25", maintenance_type: "Inspection", km_reading: 11000, amount: 250, next_alert_km: 12000, next_alert_date: null, condition_after: "monitor", tread_depth_mm: 8, damage_notes: "Test tread check", remark: "Test inspection", document_path: null };
    await page.route(/\/rest\/v1\/vehicles(?:\?|$)/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([vehicle]) }));
    await page.route(/\/rest\/v1\/tyres(?:\?|$)/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([tyre]) }));
    await page.route(/\/rest\/v1\/tyre_maintenance(?:\?|$)/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([maintenance]) }));
    await page.goto("/");
    const alert = page.getByRole("button", { name: /TN23ALERT01.*1R.*Inspection/ });
    await expect(alert).toBeVisible();
    await alert.click();
    const details = page.getByRole("dialog", { name: "Tyre 1R details" });
    await expect(details).toBeVisible();
    await expect(page.getByText("TN23ALERT01", { exact: true })).toBeVisible();
    await expect(details).toContainText("Test tread check");
  });

  test("rejects invalid fleet CSV rows before creating vehicles", async ({ page }) => {
    let vehicleWrites = 0;
    await page.route(/\/rest\/v1\/vehicles(?:\?|$)/, async (route) => {
      if (route.request().method() === "POST") vehicleWrites++;
      const body = route.request().method() === "GET" ? JSON.stringify([{ id: "existing-fleet-vehicle", vehicle_number: "TN23EXIST01", wheels: 4, odometer: 100, created_at: "2026-01-01", updated_at: "2026-01-01" }]) : "[]";
      await route.fulfill({ status: 200, contentType: "application/json", body });
    });
    await page.route(/\/rest\/v1\/rpc\/import_fleet_vehicles(?:\?|$)/, async (route) => {
      vehicleWrites++;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Unexpected import write" }) });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Fleet Overview", exact: true }).click();
    await page.getByRole("button", { name: /Import (?:fleet )?CSV/ }).click();
    await page.getByLabel("Choose fleet CSV").setInputFiles({
      name: "invalid-fleet.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("vehicle_number,wheels,odometer\nTN23BAD0001,7,1200\n"),
    });
    await expect(page.getByRole("alert")).toContainText("vehicle row 2");
    await expect(page.getByRole("button", { name: /Import 1 vehicle/ })).toHaveCount(0);
    expect(vehicleWrites).toBe(0);
  });

  test("blocks duplicate vehicle plates from an existing fleet or within one CSV", async ({ page }) => {
    let vehicleWrites = 0;
    await page.route(/\/rest\/v1\/vehicles(?:\?|$)/, async (route) => {
      if (route.request().method() === "POST") vehicleWrites++;
      const body = route.request().method() === "GET" ? JSON.stringify([{ id: "existing-fleet-vehicle", vehicle_number: "TN23EXIST01", wheels: 4, odometer: 100, created_at: "2026-01-01", updated_at: "2026-01-01" }]) : "[]";
      await route.fulfill({ status: 200, contentType: "application/json", body });
    });
    await page.route(/\/rest\/v1\/rpc\/import_fleet_vehicles(?:\?|$)/, async (route) => {
      vehicleWrites++;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Unexpected import write" }) });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Fleet Overview", exact: true }).click();
    await page.getByRole("button", { name: "Import fleet CSV" }).click();
    const csv = page.getByLabel("Choose fleet CSV");
    await csv.setInputFiles({ name: "duplicate.csv", mimeType: "text/csv", buffer: Buffer.from("vehicle_number,wheels,odometer\nTN23EXIST01,10,1200\n") });
    await page.getByRole("button", { name: "Import 1 vehicle" }).click();
    await expect(page.getByRole("alert")).toContainText("Already in fleet: TN23EXIST01");
    await csv.setInputFiles({ name: "duplicate.csv", mimeType: "text/csv", buffer: Buffer.from("vehicle_number,wheels,odometer\nTN23NEW001,10,1200\nTN23NEW001,12,1400\n") });
    await page.getByRole("button", { name: "Import 2 vehicles" }).click();
    await expect(page.getByRole("alert")).toContainText("Already in fleet: TN23NEW001");
    expect(vehicleWrites).toBe(0);
  });

  test("imports a valid fleet CSV and creates the vehicle plus all tyre positions", async ({ page }) => {
    const vehicleId = "csv-import-vehicle-1";
    const now = "2026-09-26T00:00:00.000Z";
    const vehicles: Record<string, unknown>[] = [];
    const tyres: Record<string, unknown>[] = [];
    let insertedVehicle: Record<string, unknown> | undefined;
    let insertedPositions: Record<string, unknown>[] = [];

    await page.route(/\/rest\/v1\/vehicles(?:\?|$)/, async (route) => {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(vehicles) });
    });
    await page.route(/\/rest\/v1\/tyres(?:\?|$)/, async (route) => {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tyres) });
    });
    await page.route(/\/rest\/v1\/rpc\/import_fleet_vehicles(?:\?|$)/, async (route) => {
      const body = route.request().postDataJSON() as { p_rows: Array<Record<string, unknown>> };
      insertedVehicle = body.p_rows[0];
      const vehicle = { id: vehicleId, ...insertedVehicle, created_at: now, updated_at: now, odometer_updated_at: now };
      vehicles.push(vehicle);
      insertedPositions = ["1R", "1L", "2R", "2L", "3RI", "3RO", "3LI", "3LO", "4RI", "4RO", "4LI", "4LO"].map((position_code, index) => ({ vehicle_id: vehicleId, position_code, axle_label: `AXLE ${index < 4 ? Math.floor(index / 2) + 1 : Math.floor((index - 4) / 4) + 3}` }));
      tyres.push(...insertedPositions.map((row, index) => ({ id: `csv-import-tyre-${index}`, ...row, current_km: 0, fitted_km: 0, cost: 0, tyre_type: "New", status: "running", created_at: now, updated_at: now })));
      await route.fulfill({ status: 200, contentType: "application/json", body: "1" });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Fleet Overview", exact: true }).click();
    await page.getByRole("button", { name: "Import CSV", exact: true }).click();
    await page.getByLabel("Choose fleet CSV").setInputFiles("e2e/demo-csv-import-smoke.csv");
    await expect(page.getByText("TN23CSV2609 · 12 wheels · 10,000 km")).toBeVisible();
    await page.getByRole("button", { name: "Import 1 vehicle" }).click();

    await expect(page.getByText("1 vehicles imported with tyre positions")).toBeVisible();
    await expect(page.getByText("Tyre positions", { exact: true })).toBeVisible();
    await expect(page.getByText("Vehicles", { exact: true }).locator(".." )).toContainText("1");
    await expect(page.getByText("Tyre positions", { exact: true }).locator(".." )).toContainText("12");
    expect(insertedVehicle).toMatchObject({ vehicle_number: "TN23CSV2609", wheels: 12, odometer: 10000 });
    expect(insertedPositions).toHaveLength(12);
    expect(insertedPositions.map((row) => row.position_code)).toEqual(["1R", "1L", "2R", "2L", "3RI", "3RO", "3LI", "3LO", "4RI", "4RO", "4LI", "4LO"]);
    expect(insertedPositions.every((row) => row.vehicle_id === vehicleId)).toBe(true);
  });

  test("does not create a maintenance record when its document upload fails", async ({ page }) => {
    const vehicleId = "upload-failure-vehicle";
    const tyreId = "upload-failure-tyre";
    const vehicle = { id: vehicleId, vehicle_number: "TN23UPLOAD01", wheels: 4, odometer: 5000, odometer_updated_at: "2026-09-26T00:00:00Z", created_at: "2026-01-01", updated_at: "2026-01-01" };
    const tyre = { id: tyreId, vehicle_id: vehicleId, position_code: "1R", axle_label: "AXLE 1", current_km: 1000, fitted_km: 0, cost: 1000, tyre_type: "New", status: "running", created_at: "2026-01-01", updated_at: "2026-01-01" };
    let maintenanceWrites = 0;
    await page.route(/\/rest\/v1\/vehicles(?:\?|$)/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([vehicle]) }));
    await page.route(/\/rest\/v1\/tyres(?:\?|$)/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([tyre]) }));
    await page.route(/\/rest\/v1\/tyre_maintenance(?:\?|$)/, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await page.route(/\/rest\/v1\/rpc\/record_tyre_maintenance(?:\?|$)/, async (route) => {
      maintenanceWrites++;
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await page.route(/\/storage\/v1\/object\/tyre-documents\//, (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Synthetic upload failure" }) }));
    await page.goto("/");
    await page.getByRole("button", { name: "Tyre Maintenance", exact: true }).click();
    await page.getByRole("combobox").nth(0).click();
    await page.getByRole("option", { name: "TN23UPLOAD01" }).click();
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: /1R/ }).click();
    await page.getByLabel("Document").setInputFiles({ name: "failed-upload.pdf", mimeType: "application/pdf", buffer: Buffer.from("synthetic file") });
    await page.getByRole("button", { name: "Save maintenance" }).click();
    await expect(page.getByText(/Synthetic upload failure|Failed to upload/)).toBeVisible();
    expect(maintenanceWrites).toBe(0);
  });

  test("renders fleet overview with 500 vehicles and 5,000 tyre positions", async ({ page }) => {
    const now = new Date().toISOString();
    const vehicles = Array.from({ length: 500 }, (_, index) => ({ id: `load-v-${index}`, vehicle_number: `TN23LOAD${String(index).padStart(4, "0")}`, wheels: 10, odometer: 100000 + index, odometer_updated_at: now, created_at: now, updated_at: now }));
    const tyres = vehicles.flatMap((vehicle, vehicleIndex) => Array.from({ length: 10 }, (_, positionIndex) => ({ id: `load-t-${vehicleIndex}-${positionIndex}`, vehicle_id: vehicle.id, position_code: `${Math.floor(positionIndex / 2) + 1}${positionIndex % 2 ? "L" : "R"}`, axle_label: `AXLE ${Math.floor(positionIndex / 2) + 1}`, current_km: 10000 + positionIndex, fitted_km: 0, cost: 1000, tyre_type: "New", status: "running", created_at: now, updated_at: now })));
    for (const resource of ["vehicles", "tyres"]) {
      const rows = resource === "vehicles" ? vehicles : tyres;
      await page.route(new RegExp(`/rest/v1/${resource}(?:\\?|$)`), (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rows) }));
    }
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Maintenance at a glance" })).toBeVisible();
    await expect(page.getByText("500", { exact: true })).toBeVisible();
    await expect(page.getByText("5000", { exact: true })).toBeVisible();
  });

  test("keeps missing tyre positions explicit and usable on a narrow screen", async ({ page }) => {
    const vehicleId = "sparse-vehicle";
    await page.route(/\/rest\/v1\/vehicles(?:\?|$)/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: vehicleId, vehicle_number: "TN23SPARSE", wheels: 6, odometer: 2500, created_at: "2026-01-01", updated_at: "2026-01-01" }]) }));
    await page.route(/\/rest\/v1\/tyres(?:\?|$)/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "sparse-tyre-1", vehicle_id: vehicleId, position_code: "1R", axle_label: "AXLE 1", current_km: 400, fitted_km: 0, cost: 900, tyre_type: "New", status: "running", created_at: "2026-01-01", updated_at: "2026-01-01" }]) }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Tyre View", exact: true }).click();
    await page.getByRole("button", { name: "Vertical" }).click();
    await expect(page.getByRole("button", { name: /Tyre 1L, no tyre data recorded/ })).toBeVisible();
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.viewport + 1);
  });

  test("validates an empty inventory submission", async ({ page }) => {
    await page.goto("/#inventory");
    await loginIfRequired(page);
    await page.getByRole("button", { name: "Tyre Inventory", exact: true }).click();
    await expect(page.getByLabel("Brand name")).toBeVisible();
    await page.getByRole("button", { name: "Add stock", exact: true }).click();
    await expect(page.getByText("Enter brand, tyre number, tyre size, and a quantity greater than zero")).toBeVisible();
  });

  test("shows a retryable error instead of presenting failed inventory loading as an empty table", async ({ page }) => {
    // Replace the shared success stub for this case so the failure response is
    // unambiguous and unrelated REST reads still receive the normal empty data.
    await page.unrouteAll();
    let failedInventoryReads = 0;
    await page.route(/\/auth\/v1\/user/, (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "No session" }) }));
    await page.route(/\/rest\/v1\//, (route) => {
      const request = route.request();
      const corsHeaders = {
        "access-control-allow-origin": request.headers().origin ?? "*",
        "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "access-control-allow-headers": request.headers()["access-control-request-headers"] ?? "*",
        "access-control-expose-headers": "content-range, range",
      };
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders, body: "" });
      const failedInventoryRead = request.url().includes("/rest/v1/tyre_inventory?") && request.method() === "GET";
      if (failedInventoryRead) {
        failedInventoryReads++;
        return route.fulfill({ status: 500, contentType: "application/json", headers: corsHeaders, body: JSON.stringify({ message: "Temporary test failure" }) });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { ...corsHeaders, "content-range": "0-0/*" },
        body: "[]",
      });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Tyre Inventory", exact: true }).click();
    const inventoryResponse = await page.waitForResponse((response) => response.url().includes("/rest/v1/tyre_inventory") && response.request().method() === "GET", { timeout: 5_000 });
    expect(inventoryResponse.status()).toBe(500);
    const alert = page.getByRole("alert");
    await expect(alert).toContainText("Could not load these records", { timeout: 5_000 });
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    expect(failedInventoryReads).toBeGreaterThan(0);
  });

  test("toggles and persists dark mode", async ({ page }) => {
    await page.goto("/");
    await loginIfRequired(page);
    await page.getByRole("button", { name: /Switch to dark mode|Switch to light mode/ }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

});
