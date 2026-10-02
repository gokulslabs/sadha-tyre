import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const required = [
  "SUPABASE_TEST_URL", "SUPABASE_TEST_PUBLISHABLE_KEY", "SUPABASE_TEST_PROJECT_REF",
  "SUPABASE_TEST_ORG_A_ID", "SUPABASE_TEST_ORG_B_ID",
  "SUPABASE_TEST_USER_A_EMAIL", "SUPABASE_TEST_USER_A_PASSWORD",
  "SUPABASE_TEST_USER_B_EMAIL", "SUPABASE_TEST_USER_B_PASSWORD",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error("Missing integration-test settings: " + missing.join(", "));
if (process.env.SUPABASE_TEST_DISPOSABLE !== "true") {
  throw new Error("Refusing mutations. Set SUPABASE_TEST_DISPOSABLE=true only for a dedicated disposable Supabase project.");
}

const url = new URL(process.env.SUPABASE_TEST_URL);
const expectedRef = process.env.SUPABASE_TEST_PROJECT_REF;
if (url.hostname.endsWith(".supabase.co")) {
  const actualRef = url.hostname.split(".")[0];
  if (actualRef !== expectedRef || actualRef === "dbrxphegxhkjfakqljdr") {
    throw new Error("The URL must match the declared test project ref and must not target production.");
  }
} else if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
  throw new Error("Use local Supabase or a dedicated Supabase test project.");
}
assert.notEqual(process.env.SUPABASE_TEST_ORG_A_ID, process.env.SUPABASE_TEST_ORG_B_ID);

const clientFor = async (email, password) => {
  const client = createClient(process.env.SUPABASE_TEST_URL, process.env.SUPABASE_TEST_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  assert.ok(data.session, "Could not sign in test member " + email);
  return client;
};

const userA = await clientFor(process.env.SUPABASE_TEST_USER_A_EMAIL, process.env.SUPABASE_TEST_USER_A_PASSWORD);
const userB = await clientFor(process.env.SUPABASE_TEST_USER_B_EMAIL, process.env.SUPABASE_TEST_USER_B_PASSWORD);
const nonce = randomUUID().slice(0, 8).toUpperCase();
const plate = "E2E-ISO-" + nonce;

const { data: vehicle, error: createError } = await userA.rpc("create_fleet_vehicle", {
  p_record: { vehicle_number: plate, wheels: 4, odometer: 5000 },
});
assert.ifError(createError);
assert.ok(vehicle?.id, "Atomic vehicle create did not return its vehicle");
const { data: ownedVehicle, error: ownedVehicleError } = await userA
  .from("vehicles").select("organization_id").eq("id", vehicle.id).single();
assert.ifError(ownedVehicleError);
assert.equal(ownedVehicle.organization_id, process.env.SUPABASE_TEST_ORG_A_ID, "Fixture user must be a member of exactly the declared Organization A");

const { data: positions, error: positionsError } = await userA
  .from("tyres").select("id,position_code").eq("vehicle_id", vehicle.id);
assert.ifError(positionsError);
assert.equal(positions.length, 4, "Vehicle and its four positions should be created together");
const tyreId = positions[0].id;

const documentPath = vehicle.id + "/" + tyreId + "/" + nonce + ".txt";
const { error: documentUploadError } = await userA.storage.from("tyre-documents")
  .upload(documentPath, new Uint8Array([83, 97, 100, 104, 97]), { contentType: "text/plain" });
assert.ifError(documentUploadError);
const { error: crossOrgDocumentError } = await userB.storage.from("tyre-documents")
  .createSignedUrl(documentPath, 60);
assert.ok(crossOrgDocumentError, "Organization B must not get a signed link to Organization A's tyre document");

const { data: hiddenVehicles, error: hiddenReadError } = await userB
  .from("vehicles").select("id").eq("id", vehicle.id);
assert.ifError(hiddenReadError);
assert.equal(hiddenVehicles.length, 0, "Organization B must not read Organization A's vehicle");

const { data: crossOrgUpdate, error: crossOrgUpdateError } = await userB
  .from("vehicles").update({ odometer: 999999 }).eq("id", vehicle.id).select("id");
assert.ifError(crossOrgUpdateError);
assert.equal(crossOrgUpdate.length, 0, "Organization B must not update Organization A's vehicle");

const { error: crossOrgInsertError } = await userB.from("vehicles").insert({
  organization_id: process.env.SUPABASE_TEST_ORG_A_ID,
  vehicle_number: "E2E-CROSS-" + nonce,
  wheels: 4,
});
assert.ok(crossOrgInsertError, "Organization B must not insert a row into Organization A");

const { data: hiddenAudit, error: hiddenAuditError } = await userB
  .from("tyre_audit_log").select("id").eq("record_id", vehicle.id);
assert.ifError(hiddenAuditError);
assert.equal(hiddenAudit.length, 0, "Organization B must not read Organization A's audit history");

const { data: vehicleAudit, error: vehicleAuditError } = await userA
  .from("tyre_audit_log").select("id").eq("record_id", vehicle.id).limit(1).single();
assert.ifError(vehicleAuditError);
assert.ok(vehicleAudit?.id, "Vehicle insert should create an audit row");
const { error: auditRewriteError } = await userA.from("tyre_audit_log")
  .update({ action: "DELETE" }).eq("id", vehicleAudit.id);
assert.ok(auditRewriteError, "Authenticated users must not rewrite audit history");

const { data: beforeOdo, error: beforeOdoError } = await userA
  .from("vehicles").select("odometer").eq("id", vehicle.id).single();
assert.ifError(beforeOdoError);
const invalidMaintenance = await userA.rpc("record_tyre_maintenance", {
  p_record: { tyre_id: tyreId, maintenance_type: "not-a-supported-type", km_reading: 6000, amount: 100 },
});
assert.ok(invalidMaintenance.error, "Invalid maintenance should fail");
const { data: afterRejectedMaintenance, error: rejectedReadError } = await userA
  .from("vehicles").select("odometer").eq("id", vehicle.id).single();
assert.ifError(rejectedReadError);
assert.equal(afterRejectedMaintenance.odometer, beforeOdo.odometer, "Rejected maintenance must not partly advance the odometer");
const { data: noRejectedRow, error: noRejectedRowError } = await userA
  .from("tyre_maintenance").select("id").eq("tyre_id", tyreId);
assert.ifError(noRejectedRowError);
assert.equal(noRejectedRow.length, 0, "Rejected maintenance must not leave a history record");

const { data: savedMaintenance, error: validMaintenanceError } = await userA.rpc("record_tyre_maintenance", {
  p_record: { tyre_id: tyreId, maintenance_type: "Inspection", km_reading: 6000, amount: 100, condition_after: "good", document_path: documentPath },
});
assert.ifError(validMaintenanceError);
assert.ok(savedMaintenance, "Valid maintenance should save");
assert.equal(savedMaintenance.document_path, documentPath, "Maintenance should retain the attached document reference");
const { data: updatedVehicle, error: updatedVehicleError } = await userA
  .from("vehicles").select("odometer").eq("id", vehicle.id).single();
assert.ifError(updatedVehicleError);
assert.equal(updatedVehicle.odometer, 6000, "Maintenance should update the vehicle odometer in the same commit");

const crossTenantMaintenance = await userB.rpc("record_tyre_maintenance", {
  p_record: { tyre_id: tyreId, maintenance_type: "Inspection", km_reading: 7000 },
});
assert.ok(crossTenantMaintenance.error, "Organization B must not attach maintenance to Organization A's tyre");

const duplicateBatchPlate = "E2E-IMPORT-" + nonce;
const duplicateBatch = await userA.rpc("import_fleet_vehicles", {
  p_rows: [
    { vehicle_number: duplicateBatchPlate, wheels: 4, odometer: 1000 },
    { vehicle_number: duplicateBatchPlate, wheels: 6, odometer: 2000 },
  ],
});
assert.ok(duplicateBatch.error, "Duplicate rows must reject the complete import");
const { data: noPartialImport, error: noPartialImportError } = await userA
  .from("vehicles").select("id").eq("vehicle_number", duplicateBatchPlate);
assert.ifError(noPartialImportError);
assert.equal(noPartialImport.length, 0, "A rejected CSV batch must not leave a partial vehicle");

const { data: fitment, error: fitmentError } = await userA.rpc("record_tyre_fitment", {
  p_record: { vehicle_id: vehicle.id, tyre_place: "2L", km: 6000, tyre_no: "E2E-FIT-" + nonce },
});
assert.ifError(fitmentError);
assert.ok(fitment?.id, "Fitment record should persist");
const { data: fittedPosition, error: fittedPositionError } = await userA
  .from("tyres").select("serial_no,fitted_km").eq("vehicle_id", vehicle.id).eq("position_code", "2L").single();
assert.ifError(fittedPositionError);
assert.equal(fittedPosition.serial_no, "E2E-FIT-" + nonce, "Fitment should update the shared tyre position");

const { data: replacedTyre, error: replacementError } = await userA.rpc("replace_tyre", {
  p_tyre_id: tyreId,
  p_record: { tyre_type: "New", serial_no: "E2E-REPL-" + nonce, event_date: new Date().toISOString().slice(0, 10), km_reading: 6000, amount: 1200, source: "integration test" },
});
assert.ifError(replacementError);
assert.equal(replacedTyre.serial_no, "E2E-REPL-" + nonce, "Replacement should update the tyre position");
const { data: replacementEvents, error: replacementEventsError } = await userA
  .from("tyre_events").select("id").eq("tyre_id", tyreId).eq("event_type", "replaced");
assert.ifError(replacementEventsError);
assert.ok(replacementEvents.length > 0, "Replacement history event should be committed with the tyre update");

console.log("PASS: two-org access boundaries, append-only audit, and transactional vehicle/maintenance workflows.");
console.log("Created fixture " + plate + "; it is intentionally left in the disposable project for inspection.");
