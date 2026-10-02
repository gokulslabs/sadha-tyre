import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarClock, CircleCheck, Gauge, Truck, Upload, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAllTyres, useImportFleetVehicles, useVehicles, type Tyre, type Vehicle } from "@/hooks/useTyres";
import { useServiceEntries, useTyreFitment, useTyreInventory, useTyreMaintenance, type TyreMaintenance } from "@/hooks/useTyreModule";
import { inr, WHEEL_CONFIGS } from "@/lib/tyres";
import { toast } from "sonner";

type Props = { onNavigate: (key: string) => void; onSelectVehicle: (id: string) => void; onSelectTyre: (vehicleId: string, tyreId: string) => void };
type ImportVehicle = { vehicle_number: string; wheels: number; odometer: number };
type FleetAlert = { record: TyreMaintenance; tyre: Tyre; vehicle: Vehicle; state: "Overdue" | "Due soon"; reason: string };

function Card({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card shadow-panel ${className}`}>{children}</div>;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += char;
  }
  values.push(value.trim());
  return values;
}

function parseVehicleCsv(text: string): ImportVehicle[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Add a header row and at least one vehicle row.");
  const headers = parseCsvLine(lines[0]).map((value) => value.toLowerCase().replaceAll(" ", "_"));
  const numberIndex = headers.indexOf("vehicle_number");
  const wheelsIndex = headers.indexOf("wheels");
  const odometerIndex = headers.indexOf("odometer");
  if (numberIndex < 0 || wheelsIndex < 0) throw new Error("CSV needs vehicle_number and wheels columns. odometer is optional.");
  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const vehicle_number = cells[numberIndex]?.trim().toUpperCase();
    const wheels = Number(cells[wheelsIndex]);
    const odometer = odometerIndex < 0 ? 0 : Number(cells[odometerIndex] || 0);
    if (!vehicle_number || !WHEEL_CONFIGS.includes(wheels as (typeof WHEEL_CONFIGS)[number]) || odometer < 0 || !Number.isFinite(odometer)) throw new Error(`Check vehicle row ${index + 2}: number, supported wheel configuration, or odometer is invalid.`);
    return { vehicle_number, wheels, odometer };
  });
}

function VehicleImport({ onDone }: { onDone: () => void }) {
  const { data: existing = [] } = useVehicles();
  const importVehicles = useImportFleetVehicles();
  const [rows, setRows] = useState<ImportVehicle[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function readFile(file?: File) {
    if (!file) return;
    try { setRows(parseVehicleCsv(await file.text())); setError(""); }
    catch (reason) { setRows([]); setError(reason instanceof Error ? reason.message : "Could not read this CSV."); }
  }
  async function importRows() {
    const known = new Set(existing.map((vehicle) => vehicle.vehicle_number.toUpperCase()));
    const seen = new Set<string>();
    const duplicates = rows.filter((row) => {
      if (known.has(row.vehicle_number) || seen.has(row.vehicle_number)) return true;
      seen.add(row.vehicle_number);
      return false;
    });
    if (duplicates.length) { setError(`Already in fleet: ${duplicates.map((row) => row.vehicle_number).join(", ")}. Remove duplicates from the file first.`); return; }
    setBusy(true);
    try {
      const completed = await importVehicles.mutateAsync(rows);
      toast.success(`${completed ?? rows.length} vehicles imported with tyre positions`);
      onDone();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Import failed; no rows were imported.";
      setError(message);
      toast.error(message);
    } finally { setBusy(false); }
  }
  return <div className="space-y-3 rounded-lg border border-border bg-card p-4">
    <div><h3 className="font-semibold">Import your fleet</h3><p className="mt-1 text-sm text-muted-foreground">CSV columns: <code>vehicle_number,wheels,odometer</code>. Odometer is optional. One vehicle per row.</p></div>
    <input type="file" accept=".csv,text/csv" aria-label="Choose fleet CSV" onChange={(event) => void readFile(event.target.files?.[0])} className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-2" />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {rows.length > 0 && <>
      <p className="text-sm">Preview: {rows.length} vehicle{rows.length === 1 ? "" : "s"}. Tyre positions will be created from each wheel count.</p>
      <div className="flex flex-wrap gap-2">{rows.slice(0, 5).map((row, index) => <span key={`${row.vehicle_number}-${index}`} className="rounded bg-muted px-2 py-1 text-xs">{row.vehicle_number} · {row.wheels} wheels · {row.odometer.toLocaleString("en-IN")} km</span>)}</div>
      <Button onClick={() => void importRows()} disabled={busy || importVehicles.isPending}>{importVehicles.isPending ? "Importing fleet…" : `Import ${rows.length} vehicles`}</Button>
    </>}
  </div>;
}

function Stat({ label, value, helper, icon: Icon, tone = "neutral" }: { label: string; value: string; helper: string; icon: typeof Truck; tone?: "neutral" | "warning" | "info" }) {
  return <Card className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></div><span className={`rounded-lg p-2 ${tone === "warning" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : tone === "info" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" : "bg-muted text-muted-foreground"}`}><Icon className="h-5 w-5" /></span></div></Card>;
}

export function FleetOverview({ onNavigate, onSelectVehicle, onSelectTyre }: Props) {
  const { data: vehicles = [], isLoading: vehiclesLoading, isError: vehiclesError } = useVehicles();
  const { data: tyres = [], isLoading: tyresLoading } = useAllTyres();
  const { data: maintenance = [], isLoading: maintenanceLoading } = useTyreMaintenance();
  const { data: services = [] } = useServiceEntries();
  const { data: inventory = [] } = useTyreInventory();
  const { data: fitments = [] } = useTyreFitment();
  const [importOpen, setImportOpen] = useState(false);
  const isLoading = vehiclesLoading || tyresLoading || maintenanceLoading;
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(`${today}T00:00:00`);
  cutoff.setDate(cutoff.getDate() + 30);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const fleet = useMemo(() => {
    const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
    const tyreById = new Map(tyres.map((tyre) => [tyre.id, tyre]));
    const latest = new Map<string, TyreMaintenance>();
    for (const record of maintenance) if (!latest.has(record.tyre_id)) latest.set(record.tyre_id, record);
    const rows = [...latest.values()].flatMap<FleetAlert>((record) => {
      const tyre = tyreById.get(record.tyre_id);
      const vehicle = tyre ? vehicleById.get(tyre.vehicle_id) : undefined;
      if (!tyre || !vehicle) return [];
      const dueDate = Boolean(record.next_alert_date && record.next_alert_date <= today);
      const dueKm = record.next_alert_km != null && Number(vehicle.odometer) >= Number(record.next_alert_km);
      const soonDate = Boolean(record.next_alert_date && record.next_alert_date > today && record.next_alert_date <= cutoffDate);
      const kmRemaining = record.next_alert_km == null ? Number.POSITIVE_INFINITY : Number(record.next_alert_km) - Number(vehicle.odometer);
      const soonKm = kmRemaining > 0 && kmRemaining <= 1000;
      return dueDate || dueKm ? [{ record, tyre, vehicle, state: "Overdue", reason: dueDate ? `Date reached ${record.next_alert_date}` : `Odometer reached ${Number(record.next_alert_km).toLocaleString("en-IN")} km` }]
        : soonDate || soonKm ? [{ record, tyre, vehicle, state: "Due soon", reason: soonDate ? `Due by ${record.next_alert_date}` : `${kmRemaining.toLocaleString("en-IN")} km remaining` }] : [];
    });
    return { vehicleById, dueNow: rows.filter((row) => row.state === "Overdue"), dueSoon: rows.filter((row) => row.state === "Due soon") };
  }, [vehicles, tyres, maintenance, today, cutoffDate]);
  const odometerUpdatedAt = (vehicle: Vehicle) => vehicle.odometer_updated_at || vehicle.updated_at;
  const staleOdometers = vehicles.filter((vehicle) => Date.now() - new Date(odometerUpdatedAt(vehicle)).getTime() > 30 * 86400000);
  const maintenanceSpend = maintenance.filter((record) => record.entry_date >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)).reduce((total, record) => total + Number(record.amount), 0);
  const serviceSpend = services.filter((record) => record.entry_date >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)).reduce((total, record) => total + Number(record.amount), 0);
  const usedStock = fitments.reduce<Record<string, number>>((counts, row) => { if (row.tyre_inventory_id) counts[row.tyre_inventory_id] = (counts[row.tyre_inventory_id] ?? 0) + 1; return counts; }, {});
  const availableUnits = inventory.reduce((total, row) => total + Math.max(0, Number(row.quantity) - (usedStock[row.id] ?? 0)), 0);
  const recentAlerts = [...fleet.dueNow, ...fleet.dueSoon].slice(0, 6);

  return <div className="space-y-4">
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-5 shadow-panel"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Fleet overview</p><h1 className="mt-1 text-2xl font-semibold">Maintenance at a glance</h1><p className="mt-1 text-sm text-muted-foreground">Spot overdue work, plan the next service, and keep vehicle readings current.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => onNavigate("maintenance")}><Wrench className="mr-2 h-4 w-4" />Log maintenance</Button><Button onClick={() => onNavigate("view")}><Truck className="mr-2 h-4 w-4" />Tyre view</Button></div></section>
    {vehiclesError && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Fleet data could not load. Check your connection and refresh before making maintenance decisions.</div>}
    {isLoading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Card key={i} className="h-28 animate-pulse bg-muted/50" />)}</div> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Stat label="Vehicles" value={String(vehicles.length)} helper={`${staleOdometers.length} with stale odometer`} icon={Truck} tone={staleOdometers.length ? "warning" : "neutral"} /><Stat label="Tyre positions" value={String(tyres.length)} helper={`${availableUnits} stock units available`} icon={Gauge} /><Stat label="Overdue" value={String(fleet.dueNow.length)} helper="Alert threshold reached" icon={AlertTriangle} tone={fleet.dueNow.length ? "warning" : "neutral"} /><Stat label="Due soon" value={String(fleet.dueSoon.length)} helper="Within 30 days or 1,000 km" icon={CalendarClock} tone={fleet.dueSoon.length ? "info" : "neutral"} /><Stat label="Spend · 30 days" value={inr(maintenanceSpend + serviceSpend)} helper="Service and tyre maintenance" icon={CircleCheck} /></div>}
    {vehicles.length === 0 && !vehiclesLoading ? <Card className="space-y-4 p-5"><div><h2 className="text-lg font-semibold">Set up your fleet</h2><p className="mt-1 text-sm text-muted-foreground">Start by adding vehicles and their wheel configurations. We’ll create the matching tyre positions automatically.</p></div><Button onClick={() => onNavigate("view")}><Truck className="mr-2 h-4 w-4" />Add your first vehicle</Button><Button variant="outline" onClick={() => setImportOpen((open) => !open)}><Upload className="mr-2 h-4 w-4" />Import CSV</Button>{importOpen && <VehicleImport onDone={() => setImportOpen(false)} />}</Card> : <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
      <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-border px-4 py-3"><div><h2 className="font-semibold">Maintenance attention</h2><p className="text-xs text-muted-foreground">Latest service threshold for each tyre</p></div><Button variant="ghost" size="sm" onClick={() => onNavigate("maintenance")}>View all <ArrowRight className="ml-1 h-4 w-4" /></Button></div>{recentAlerts.length === 0 ? <div className="p-8 text-center"><CircleCheck className="mx-auto h-8 w-8 text-emerald-600" /><p className="mt-2 font-medium">No due or upcoming tyre alerts</p><p className="mt-1 text-sm text-muted-foreground">Add next-service date or odometer when logging maintenance.</p></div> : <div className="divide-y divide-border">{recentAlerts.map(({ record, tyre, vehicle, state, reason }) => <button key={record.id} type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50" onClick={() => { onSelectVehicle(vehicle.id); onSelectTyre(vehicle.id, tyre.id); onNavigate("view"); }}><div className="min-w-0"><p className="truncate font-medium">{vehicle.vehicle_number} <span className="text-muted-foreground">· {tyre.position_code}</span></p><p className="truncate text-xs text-muted-foreground">{record.maintenance_type} · {reason}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${state === "Overdue" ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200"}`}>{state}</span></button>)}</div>}</Card>
      <Card className="overflow-hidden"><div className="border-b border-border px-4 py-3"><h2 className="font-semibold">Fleet odometer check</h2><p className="text-xs text-muted-foreground">Readings older than 30 days need confirmation</p></div><div className="divide-y divide-border">{vehicles.slice(0, 6).map((vehicle) => { const stale = staleOdometers.includes(vehicle); return <button key={vehicle.id} type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50" onClick={() => { onSelectVehicle(vehicle.id); onNavigate("view"); }}><span><span className="block font-medium">{vehicle.vehicle_number}</span><span className="text-xs text-muted-foreground">{Number(vehicle.odometer).toLocaleString("en-IN")} km · updated {new Date(odometerUpdatedAt(vehicle)).toLocaleDateString("en-IN")}</span></span>{stale && <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">Confirm reading</span>}</button>; })}{vehicles.length === 0 && <p className="p-6 text-sm text-muted-foreground">No vehicles yet.</p>}</div></Card>
    </div>}
    {vehicles.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"><div><p className="font-medium">Need to add or import vehicles?</p><p className="text-xs text-muted-foreground">CSV headers: vehicle_number, wheels, odometer</p></div><Button variant="outline" onClick={() => setImportOpen((open) => !open)}><Upload className="mr-2 h-4 w-4" />{importOpen ? "Close import" : "Import fleet CSV"}</Button>{importOpen && <div className="w-full"><VehicleImport onDone={() => setImportOpen(false)} /></div>}</div>}
    <p className="text-xs text-muted-foreground">Alerts shown here are in-app only. Email, SMS, or WhatsApp reminders need a delivery provider to be configured.</p>
  </div>;
}
