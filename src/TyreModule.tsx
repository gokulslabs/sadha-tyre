import { Children, cloneElement, isValidElement, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Plus,
  Package,
  Wrench,
  Cog,
  Hammer,
  History,
  Truck,
  Wand2,
  ClipboardCheck,
  AlertTriangle,
  List,
  LayoutPanelTop,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { FleetOverview } from "@/components/FleetOverview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useVehicles,
  useTyres,
  useAllTyres,
  useProvisionTyres,
  useSetExistingTyre,
  useSaveTyre,
  useAddTyreEvent,
  useTyreEvents,
  useAddVehicle,
  type Tyre,
} from "@/hooks/useTyres";
import {
  healthClasses,
  shortKm,
  tyreHealth,
  costPerKm,
  inr,
  WHEEL_CONFIGS,
  tyrePositions,
} from "@/lib/tyres";
import {
  AUDIT_TABLE_LABELS,
  OLD_TYRE_STATUSES,
  STORAGE_PLACES,
  TYRE_ENTRY_TYPES,
  useAddServiceEntry,
  useAddTeethFitment,
  useAddTeethPurchase,
  useAddTyreFitment,
  useAddTyreInventory,
  useUpdateTyreInventory,
  useDeleteTyreInventory,
  useDeleteTyreFitment,
  useUpdateTyreFitment,
  useDeleteTeethPurchase,
  useUpdateTeethPurchase,
  useDeleteTeethFitment,
  useUpdateTeethFitment,
  useDeleteServiceEntry,
  useUpdateServiceEntry,
  useServiceEntries,
  useAddTyreMaintenance,
  useTyreMaintenance,
  useTeethFitment,
  useTeethPurchase,
  useTyreAuditLog,
  useTyreFitment,
  useTyreInventory,
  type TyreAuditLog,
  type TyreInventory,
  type TyreFitment,
  type TeethPurchase,
  type TeethFitment,
  type ServiceEntry,
  type TyreMaintenance,
} from "@/hooks/useTyreModule";
import { supabase } from "@/integrations/supabase/client";

function VehicleSelect({
  value,
  onChange,
  id,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  required?: boolean;
}) {
  const { data: vehicles } = useVehicles();
  return (
    <Select
      value={value || "none"}
      onValueChange={(v) => onChange(v === "none" ? "" : v)}
    >
      <SelectTrigger id={id} aria-required={required}>
        <SelectValue placeholder="Select vehicle" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">— None —</SelectItem>
        {(vehicles ?? []).map((v) => (
          <SelectItem key={v.id} value={v.id}>
            {v.vehicle_number}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  const controlId = useId();
  function labelFirstControl(node: ReactNode): ReactNode {
    if (!isValidElement(node)) return node;
    if (node.type === Input || node.type === SelectTrigger || node.type === VehicleSelect) {
      return cloneElement(node as React.ReactElement<{ id?: string; required?: boolean; "aria-required"?: boolean }>, { id: controlId, "aria-required": required, ...(node.type === VehicleSelect ? { required } : {}) });
    }
    const props = (node as React.ReactElement<{ children?: ReactNode }>).props;
    if (props.children !== undefined) {
      const nested = props.children;
      return cloneElement(node as React.ReactElement<{ children?: ReactNode }>, {
        children: Children.map(nested, labelFirstControl),
      });
    }
    return node;
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={controlId}>{label}{required && <span aria-hidden="true" className="ml-1 text-destructive">*</span>}</Label>
      {labelFirstControl(children)}
    </div>
  );
}

function SignedDocumentLink({ path, children = "Open" }: { path: string; children?: ReactNode }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    void supabase.storage.from("tyre-documents").createSignedUrl(path, 300).then(({ data, error }) => {
      if (active && !error && data?.signedUrl) setUrl(data.signedUrl);
    });
    return () => { active = false; };
  }, [path]);
  return url
    ? <a href={url} target="_blank" rel="noreferrer" className="text-primary underline">{children}</a>
    : <span className="text-muted-foreground" title="Document link is loading or unavailable">…</span>;
}

function displayDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) {
    toast.info("There are no records to export yet");
    return;
  }
  const headers = Object.keys(rows[0]);
  const csv = [headers, ...rows.map((row) => headers.map((key) => String(row[key] ?? "").replaceAll('"', '""')))]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md bg-card shadow-panel">{children}</div>;
}

function QueryErrorRow({ colSpan, onRetry }: { colSpan: number; onRetry: () => void }) {
  return <TableRow><TableCell colSpan={colSpan} className="py-8 text-center"><p role="alert" className="text-sm text-destructive">Could not load these records. Check your connection and try again.</p><Button type="button" className="mt-3" variant="outline" size="sm" onClick={onRetry}>Retry</Button></TableCell></TableRow>;
}

function QueryErrorBanner({ label, onRetry }: { label: string; onRetry: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"><span className="text-destructive">Could not load {label}. Some information may be unavailable.</span><Button type="button" variant="outline" size="sm" onClick={onRetry}>Retry</Button></div>;
}

function useAccessibleDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("keydown", handleKeyDown); previous?.focus?.(); };
  }, [open]);
  return ref;
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function TableToolbar({ query, onQueryChange, total, shown, loading = false, page = 1, pages = 1, onPageChange, fromDate, toDate, onFromDateChange, onToDateChange, sort, onSortChange }: { query: string; onQueryChange: (value: string) => void; total: number; shown: number; loading?: boolean; page?: number; pages?: number; onPageChange?: (page: number) => void; fromDate?: string; toDate?: string; onFromDateChange?: (value: string) => void; onToDateChange?: (value: string) => void; sort?: "newest" | "oldest"; onSortChange?: (value: "newest" | "oldest") => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-card px-3 py-2">
      <div className="flex flex-wrap items-center gap-2"><Input className="h-9 max-w-sm" value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="Search records…" aria-label="Search records" /><Input className="h-9 w-36" type="date" value={fromDate ?? ""} onChange={(e) => onFromDateChange?.(e.target.value)} aria-label="From date" /><Input className="h-9 w-36" type="date" value={toDate ?? ""} onChange={(e) => onToDateChange?.(e.target.value)} aria-label="To date" /></div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><select aria-label="Sort records" className="h-9 rounded-md border border-input bg-background px-2" value={sort ?? "newest"} onChange={(e) => onSortChange?.(e.target.value as "newest" | "oldest")}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select><span aria-live="polite">{loading ? "Loading records…" : `Showing ${shown} of ${total}`}</span>{!loading && pages > 1 && <><Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange?.(page - 1)}>Previous</Button><span>Page {page} / {pages}</span><Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => onPageChange?.(page + 1)}>Next</Button></>}</div>
    </div>
  );
}

function filterRows<T extends object>(rows: T[], query: string, fromDate = "", toDate = "", sort: "newest" | "oldest" = "newest"): T[] {
  const needle = query.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    const matchesQuery = !needle || Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(needle));
    const dateValue = String((row as Record<string, unknown>).entry_date ?? (row as Record<string, unknown>).changed_at ?? "").slice(0, 10);
    return matchesQuery && (!fromDate || dateValue >= fromDate) && (!toDate || dateValue <= toDate);
  });
  return [...filtered].sort((a, b) => { const getDate = (row: T) => String((row as Record<string, unknown>).entry_date ?? (row as Record<string, unknown>).changed_at ?? ""); const result = getDate(b).localeCompare(getDate(a)); return sort === "newest" ? result : -result; });
}

function RecordEditDialog({ title, row, fields, pending, onClose, onSave }: { title: string; row: Record<string, unknown>; fields: { key: string; label: string; type?: string }[]; pending: boolean; onClose: () => void; onSave: (patch: Record<string, unknown>) => void | Promise<void> }) {
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => [field.key, String(row[field.key] ?? "")] )));
  const dialogRef = useAccessibleDialog(true, onClose);
  return <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="record-edit-title" tabIndex={-1} className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"><form className="w-full max-w-xl space-y-4 rounded-2xl border border-border bg-card p-6 shadow-lift" onSubmit={async (event) => { event.preventDefault(); try { await onSave(Object.fromEntries(fields.map((field) => [field.key, field.type === "number" ? Number(draft[field.key]) || 0 : draft[field.key] || null]))); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save changes"); } }}><div><h3 id="record-edit-title" className="text-xl font-bold">Edit {title}</h3><p className="mt-1 text-sm text-muted-foreground">Changes are recorded in the audit log.</p></div><div className="grid gap-3 sm:grid-cols-2">{fields.map((field) => <Field key={field.key} label={field.label}><Input type={field.type ?? "text"} value={draft[field.key] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))} /></Field>)}</div><div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button></div></form></div>;
}

/* ================= Tyre Inventory ================= */
function TyreInventorySection() {
  const { data, isLoading, isError, refetch } = useTyreInventory();
  const add = useAddTyreInventory();
  const remove = useDeleteTyreInventory();
  const update = useUpdateTyreInventory();
  const [editing, setEditing] = useState<TyreInventory | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [form, setForm] = useState({
    entry_type: "new",
    entry_date: new Date().toISOString().slice(0, 10),
    brand: "",
    tyre_no: "",
    tyre_size: "",
    quantity: "",
  });
  const filteredData = useMemo(() => filterRows(data ?? [], query, fromDate, toDate, sort), [data, query, fromDate, toDate, sort]);
  const pages = Math.max(1, Math.ceil(filteredData.length / 25));
  const visibleData = useMemo(() => filteredData.slice((page - 1) * 25, page * 25), [filteredData, page]);

  async function submit() {
    if (!form.brand.trim() || !form.tyre_no.trim() || !form.tyre_size.trim() || Number(form.quantity) <= 0) {
      toast.error("Enter brand, tyre number, tyre size, and a quantity greater than zero");
      return;
    }
    try {
      await add.mutateAsync({
        entry_type: form.entry_type,
        entry_date: form.entry_date,
        brand: form.brand.trim() || null,
        tyre_no: form.tyre_no.trim() || null,
        tyre_size: form.tyre_size.trim() || null,
        quantity: Number(form.quantity) || 0,
      });
      toast.success("Tyre stock added");
      setForm((f) => ({
        ...f,
        brand: "",
        tyre_no: "",
        tyre_size: "",
        quantity: "",
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add stock");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button variant="outline" onClick={() => exportCsv("tyre-inventory.csv", data ?? [])}>Export CSV</Button></div>
      <TableToolbar query={query} onQueryChange={(value) => { setQuery(value); setPage(1); }} total={filteredData.length} shown={visibleData.length} loading={isLoading} page={page} pages={pages} onPageChange={setPage} fromDate={fromDate} toDate={toDate} onFromDateChange={(value) => { setFromDate(value); setPage(1); }} onToDateChange={(value) => { setToDate(value); setPage(1); }} sort={sort} onSortChange={(value) => { setSort(value); setPage(1); }} />
      <Card>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Entry type">
            <Select
              value={form.entry_type}
              onValueChange={(v) => setForm((f) => ({ ...f, entry_type: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYRE_ENTRY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date">
            <Input
              type="date"
              value={form.entry_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, entry_date: e.target.value }))
              }
            />
          </Field>
          <Field label="Brand name" required>
            <Input
              value={form.brand}
              onChange={(e) =>
                setForm((f) => ({ ...f, brand: e.target.value }))
              }
            />
          </Field>
          <Field label="Tyre no" required>
            <Input
              value={form.tyre_no}
              onChange={(e) =>
                setForm((f) => ({ ...f, tyre_no: e.target.value }))
              }
            />
          </Field>
          <Field label="Tyre size" required>
            <Input
              value={form.tyre_size}
              onChange={(e) =>
                setForm((f) => ({ ...f, tyre_size: e.target.value }))
              }
            />
          </Field>
          <Field label="Quantity (no of tyres)" required>
            <Input
              type="number"
              min={0}
              value={form.quantity}
              onChange={(e) =>
                setForm((f) => ({ ...f, quantity: e.target.value }))
              }
            />
          </Field>
        </div>
        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button onClick={submit} disabled={add.isPending}>
            <Plus className="mr-2 h-4 w-4" /> Add stock
          </Button>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto"><Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Tyre no</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : isError ? <QueryErrorRow colSpan={7} onRetry={() => { void refetch(); }} /> : visibleData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-16 text-center text-muted-foreground"
                >
                  No tyre stock entries yet
                </TableCell>
              </TableRow>
            ) : (
              visibleData.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.entry_date}</TableCell>
                  <TableCell className="font-medium uppercase">
                    {r.entry_type}
                  </TableCell>
                  <TableCell>{r.brand || "—"}</TableCell>
                  <TableCell>{r.tyre_no || "—"}</TableCell>
                  <TableCell>{r.tyre_size || "—"}</TableCell>
                  <TableCell className="text-right">{r.quantity}</TableCell>
                  <TableCell><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => setEditing(r)}>Edit</Button><Button variant="ghost" size="sm" onClick={() => window.confirm("Delete this inventory entry?") && remove.mutate(r.id)}>Delete</Button></div></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table></div>
      </Card>
      {editing && <RecordEditDialog title="tyre inventory" row={editing} fields={[{ key: "entry_date", label: "Date", type: "date" }, { key: "entry_type", label: "Entry type" }, { key: "brand", label: "Brand" }, { key: "tyre_no", label: "Tyre number" }, { key: "tyre_size", label: "Tyre size" }, { key: "quantity", label: "Quantity", type: "number" }]} pending={update.isPending} onClose={() => setEditing(null)} onSave={async (patch) => { await update.mutateAsync({ id: editing.id, ...patch } as never); setEditing(null); toast.success("Inventory updated"); }} />}
    </div>
  );
}

/* ================= Tyre Fitment ================= */
function TyreFitmentSection() {
  const { data: vehicles = [] } = useVehicles();
  const { data, isLoading, isError, refetch } = useTyreFitment();
  const { data: inventory = [] } = useTyreInventory();
  const add = useAddTyreFitment();
  const remove = useDeleteTyreFitment();
  const update = useUpdateTyreFitment();
  const [editing, setEditing] = useState<TyreFitment | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    brand: "",
    tyre_no: "",
    tyre_size: "",
    vehicle_id: "",
    driver_name: "",
    tyre_place: "",
    km: "",
    remarks: "",
    old_tyre_status: "NEW",
    old_tyre_stock: "",
    tyre_inventory_id: "",
  });
  const stockUsed = useMemo(() => (data ?? []).reduce<Record<string, number>>((counts, row) => {
    if (row.tyre_inventory_id) counts[row.tyre_inventory_id] = (counts[row.tyre_inventory_id] ?? 0) + 1;
    return counts;
  }, {}), [data]);
  const availableStock = inventory.filter((item) => Number(item.quantity) > (stockUsed[item.id] ?? 0));
  const selectedVehicle = vehicles.find((v) => v.id === form.vehicle_id);
  const filteredData = useMemo(() => filterRows(data ?? [], query, fromDate, toDate, sort), [data, query, fromDate, toDate, sort]);
  const pages = Math.max(1, Math.ceil(filteredData.length / 25));
  const visibleData = useMemo(() => filteredData.slice((page - 1) * 25, page * 25), [filteredData, page]);

  async function submit() {
    if (!form.vehicle_id || !form.tyre_place || !form.km.trim() || Number(form.km) < 0) {
      toast.error("Select a vehicle and wheel position, then enter a valid KM reading");
      return;
    }
    try {
      await add.mutateAsync({
        entry_date: form.entry_date,
        brand: form.brand.trim() || null,
        tyre_no: form.tyre_no.trim() || null,
        tyre_size: form.tyre_size.trim() || null,
        vehicle_id: form.vehicle_id || null,
        driver_name: form.driver_name.trim() || null,
        tyre_place: form.tyre_place.trim() || null,
        km: Number(form.km) || 0,
        remarks: form.remarks.trim() || null,
        old_tyre_status: form.old_tyre_status,
        old_tyre_stock: form.old_tyre_stock.trim() || null,
        tyre_inventory_id: form.tyre_inventory_id || null,
      });
      toast.success("Fitment recorded");
      setForm((f) => ({
        ...f,
        brand: "",
        tyre_no: "",
        tyre_size: "",
        driver_name: "",
        tyre_place: "",
        km: "",
        remarks: "",
        old_tyre_stock: "",
        tyre_inventory_id: "",
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record fitment");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button variant="outline" onClick={() => exportCsv("tyre-fitment.csv", data ?? [])}>Export CSV</Button></div>
      <TableToolbar query={query} onQueryChange={(value) => { setQuery(value); setPage(1); }} total={filteredData.length} shown={visibleData.length} loading={isLoading} page={page} pages={pages} onPageChange={setPage} fromDate={fromDate} toDate={toDate} onFromDateChange={(value) => { setFromDate(value); setPage(1); }} onToDateChange={(value) => { setToDate(value); setPage(1); }} sort={sort} onSortChange={(value) => { setSort(value); setPage(1); }} />
      <Card>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Tyre from available stock (optional)"><Select value={form.tyre_inventory_id || "manual"} onValueChange={(value) => { const stockItem = inventory.find((item) => item.id === value); setForm((current) => ({ ...current, tyre_inventory_id: value === "manual" ? "" : value, brand: stockItem?.brand ?? current.brand, tyre_no: stockItem?.tyre_no ?? current.tyre_no, tyre_size: stockItem?.tyre_size ?? current.tyre_size })); }}><SelectTrigger><SelectValue placeholder="Enter tyre details manually" /></SelectTrigger><SelectContent><SelectItem value="manual">Manual entry — not from stock</SelectItem>{availableStock.map((item) => <SelectItem key={item.id} value={item.id}>{item.brand || "Unbranded"} · {item.tyre_no || "No tyre no."} · {item.tyre_size || "No size"} · {Number(item.quantity) - (stockUsed[item.id] ?? 0)} available</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Choosing stock links one available unit to this fitment.</p></Field>
          <Field label="Date">
            <Input
              type="date"
              value={form.entry_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, entry_date: e.target.value }))
              }
            />
          </Field>
          <Field label="Brand name">
            <Input
              value={form.brand}
              readOnly={Boolean(form.tyre_inventory_id)}
              onChange={(e) =>
                setForm((f) => ({ ...f, brand: e.target.value }))
              }
            />
          </Field>
          <Field label="Tyre no">
            <Input
              value={form.tyre_no}
              readOnly={Boolean(form.tyre_inventory_id)}
              onChange={(e) =>
                setForm((f) => ({ ...f, tyre_no: e.target.value }))
              }
            />
          </Field>
          <Field label="Tyre size">
            <Input
              value={form.tyre_size}
              readOnly={Boolean(form.tyre_inventory_id)}
              onChange={(e) =>
                setForm((f) => ({ ...f, tyre_size: e.target.value }))
              }
            />
          </Field>
          <Field label="Vehicle no" required>
            <VehicleSelect
              value={form.vehicle_id}
              onChange={(v) => setForm((f) => ({ ...f, vehicle_id: v }))}
            />
          </Field>
          <Field label="Driver name">
            <Input
              value={form.driver_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, driver_name: e.target.value }))
              }
            />
          </Field>
          <Field label="Tyre place / wheel position" required>
            <Select
              value={form.tyre_place || "none"}
              onValueChange={(v) => setForm((f) => ({ ...f, tyre_place: v === "none" ? "" : v }))}
            >
              <SelectTrigger><SelectValue placeholder="Select wheel position" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select position —</SelectItem>
                {(selectedVehicle ? tyrePositions(selectedVehicle.wheels) : []).map((p) => (
                  <SelectItem key={p.pos} value={p.pos}>{p.pos} · {p.axle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="KM" required>
            <Input
              type="number"
              min={0}
              value={form.km}
              onChange={(e) => setForm((f) => ({ ...f, km: e.target.value }))}
            />
          </Field>
          <Field label="Remarks">
            <Input
              value={form.remarks}
              onChange={(e) =>
                setForm((f) => ({ ...f, remarks: e.target.value }))
              }
            />
          </Field>
          <Field label="Old tyre status">
            <Select
              value={form.old_tyre_status}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, old_tyre_status: v }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OLD_TYRE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Old tyre stock">
            <Input
              value={form.old_tyre_stock}
              onChange={(e) =>
                setForm((f) => ({ ...f, old_tyre_stock: e.target.value }))
              }
            />
          </Field>
        </div>
        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button onClick={submit} disabled={add.isPending}>
            <Plus className="mr-2 h-4 w-4" /> Record fitment
          </Button>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto"><Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Tyre no</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Place</TableHead>
              <TableHead className="text-right">KM</TableHead>
              <TableHead>Old status</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : isError ? <QueryErrorRow colSpan={9} onRetry={() => { void refetch(); }} /> : visibleData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-16 text-center text-muted-foreground"
                >
                  No fitment records yet
                </TableCell>
              </TableRow>
            ) : (
              visibleData.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.entry_date}</TableCell>
                  <TableCell>{vehicles.find((v) => v.id === r.vehicle_id)?.vehicle_number || r.vehicle_id || "—"}</TableCell>
                  <TableCell>{r.tyre_no || "—"}</TableCell>
                  <TableCell>{r.driver_name || "—"}</TableCell>
                  <TableCell>{r.tyre_place || "—"}</TableCell>
                  <TableCell className="text-right">{r.km}</TableCell>
                  <TableCell>{r.old_tyre_status}</TableCell>
                  <TableCell>{r.old_tyre_stock || "—"}</TableCell>
                  <TableCell><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => setEditing(r)}>Edit</Button><Button variant="ghost" size="sm" onClick={() => window.confirm("Delete this fitment record?") && remove.mutate(r.id)}>Delete</Button></div></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table></div>
      </Card>
      {editing && <RecordEditDialog title="tyre fitment" row={editing} fields={[{ key: "entry_date", label: "Date", type: "date" }, { key: "brand", label: "Brand" }, { key: "tyre_no", label: "Tyre number" }, { key: "tyre_size", label: "Tyre size" }, { key: "driver_name", label: "Driver" }, { key: "tyre_place", label: "Wheel position" }, { key: "km", label: "KM", type: "number" }, { key: "remarks", label: "Remarks" }, { key: "old_tyre_status", label: "Old tyre status" }, { key: "old_tyre_stock", label: "Old tyre stock" }]} pending={update.isPending} onClose={() => setEditing(null)} onSave={async (patch) => { await update.mutateAsync({ id: editing.id, ...patch } as never); setEditing(null); toast.success("Fitment updated"); }} />}
    </div>
  );
}

/* ================= Teeth (Purchase + Fitment) ================= */
function TeethSection() {
  const [section, setSection] = useState<"purchase" | "fitment">("purchase");
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Excavator teeth records" className="flex w-fit gap-1 rounded-lg border border-border bg-card p-1">
        <button type="button" role="tab" aria-selected={section === "purchase"} aria-controls="teeth-purchase-panel" onClick={() => setSection("purchase")} className={`rounded-md px-4 py-2 text-sm font-medium ${section === "purchase" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Purchases</button>
        <button type="button" role="tab" aria-selected={section === "fitment"} aria-controls="teeth-fitment-panel" onClick={() => setSection("fitment")} className={`rounded-md px-4 py-2 text-sm font-medium ${section === "fitment" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Fitment</button>
      </div>
      <section id="teeth-purchase-panel" role="tabpanel" hidden={section !== "purchase"} aria-label="Teeth purchases"><TeethPurchaseSection /></section>
      <section id="teeth-fitment-panel" role="tabpanel" hidden={section !== "fitment"} aria-label="Teeth fitment"><TeethFitmentSection /></section>
    </div>
  );
}

function TeethPurchaseSection() {
  const { data, isLoading, isError, refetch } = useTeethPurchase();
  const add = useAddTeethPurchase();
  const remove = useDeleteTeethPurchase();
  const update = useUpdateTeethPurchase();
  const [editing, setEditing] = useState<TeethPurchase | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    purchase_shop: "",
    teeth_model: "",
    rock_teeth: "",
    washer: "",
    lock_pin: "",
    qty: "",
    storage_place: "1.CONTAINER",
  });
  const filteredData = useMemo(() => filterRows(data ?? [], query, fromDate, toDate, sort), [data, query, fromDate, toDate, sort]);
  const pages = Math.max(1, Math.ceil(filteredData.length / 25));
  const visibleData = useMemo(() => filteredData.slice((page - 1) * 25, page * 25), [filteredData, page]);

  async function submit() {
    if (!form.purchase_shop.trim() || !form.teeth_model.trim() || Number(form.qty) <= 0) {
      toast.error("Enter purchase shop, teeth model, and a quantity greater than zero");
      return;
    }
    try {
      await add.mutateAsync({
        entry_date: form.entry_date,
        purchase_shop: form.purchase_shop.trim() || null,
        teeth_model: form.teeth_model.trim() || null,
        rock_teeth: Number(form.rock_teeth) || 0,
        washer: Number(form.washer) || 0,
        lock_pin: Number(form.lock_pin) || 0,
        qty: Number(form.qty) || 0,
        storage_place: form.storage_place,
      });
      toast.success("Teeth purchase added");
      setForm((f) => ({
        ...f,
        purchase_shop: "",
        teeth_model: "",
        rock_teeth: "",
        washer: "",
        lock_pin: "",
        qty: "",
      }));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not add teeth purchase",
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button variant="outline" onClick={() => exportCsv("teeth-purchases.csv", data ?? [])}>Export CSV</Button></div>
      <h3 className="text-base font-semibold text-foreground">
        Excavator Teeth — Purchase
      </h3>
      <TableToolbar query={query} onQueryChange={(value) => { setQuery(value); setPage(1); }} total={filteredData.length} shown={visibleData.length} loading={isLoading} page={page} pages={pages} onPageChange={setPage} fromDate={fromDate} toDate={toDate} onFromDateChange={(value) => { setFromDate(value); setPage(1); }} onToDateChange={(value) => { setToDate(value); setPage(1); }} sort={sort} onSortChange={(value) => { setSort(value); setPage(1); }} />
      <Card>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Date">
            <Input
              type="date"
              value={form.entry_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, entry_date: e.target.value }))
              }
            />
          </Field>
          <Field label="Purchase shop" required>
            <Input
              value={form.purchase_shop}
              onChange={(e) =>
                setForm((f) => ({ ...f, purchase_shop: e.target.value }))
              }
            />
          </Field>
          <Field label="Teeth model" required>
            <Input
              value={form.teeth_model}
              onChange={(e) =>
                setForm((f) => ({ ...f, teeth_model: e.target.value }))
              }
            />
          </Field>
          <Field label="Qty" required>
            <Input
              type="number"
              min={0}
              value={form.qty}
              onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
            />
          </Field>
          <Field label="Rock teeth">
            <Input
              type="number"
              min={0}
              value={form.rock_teeth}
              onChange={(e) =>
                setForm((f) => ({ ...f, rock_teeth: e.target.value }))
              }
            />
          </Field>
          <Field label="Washer">
            <Input
              type="number"
              min={0}
              value={form.washer}
              onChange={(e) =>
                setForm((f) => ({ ...f, washer: e.target.value }))
              }
            />
          </Field>
          <Field label="Lock pin">
            <Input
              type="number"
              min={0}
              value={form.lock_pin}
              onChange={(e) =>
                setForm((f) => ({ ...f, lock_pin: e.target.value }))
              }
            />
          </Field>
          <Field label="Storage place">
            <Select
              value={form.storage_place}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, storage_place: v }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STORAGE_PLACES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button onClick={submit} disabled={add.isPending}>
            <Plus className="mr-2 h-4 w-4" /> Add purchase
          </Button>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto"><Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Shop</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Rock</TableHead>
              <TableHead className="text-right">Washer</TableHead>
              <TableHead className="text-right">Pin</TableHead>
              <TableHead>Storage</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : isError ? <QueryErrorRow colSpan={9} onRetry={() => { void refetch(); }} /> : visibleData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-12 text-center text-muted-foreground"
                >
                  No teeth purchases yet
                </TableCell>
              </TableRow>
            ) : (
              visibleData.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.entry_date}</TableCell>
                  <TableCell>{r.purchase_shop || "—"}</TableCell>
                  <TableCell>{r.teeth_model || "—"}</TableCell>
                  <TableCell className="text-right">{r.qty}</TableCell>
                  <TableCell className="text-right">{r.rock_teeth}</TableCell>
                  <TableCell className="text-right">{r.washer}</TableCell>
                  <TableCell className="text-right">{r.lock_pin}</TableCell>
                  <TableCell>{r.storage_place || "—"}</TableCell>
                  <TableCell><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => setEditing(r)}>Edit</Button><Button variant="ghost" size="sm" onClick={() => window.confirm("Delete this teeth purchase?") && remove.mutate(r.id)}>Delete</Button></div></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table></div>
      </Card>
      {editing && <RecordEditDialog title="teeth purchase" row={editing} fields={[{ key: "entry_date", label: "Date", type: "date" }, { key: "purchase_shop", label: "Purchase shop" }, { key: "teeth_model", label: "Teeth model" }, { key: "qty", label: "Quantity", type: "number" }, { key: "rock_teeth", label: "Rock teeth", type: "number" }, { key: "washer", label: "Washer", type: "number" }, { key: "lock_pin", label: "Lock pin", type: "number" }, { key: "storage_place", label: "Storage place" }]} pending={update.isPending} onClose={() => setEditing(null)} onSave={async (patch) => { await update.mutateAsync({ id: editing.id, ...patch } as never); setEditing(null); toast.success("Teeth purchase updated"); }} />}
    </div>
  );
}

function TeethFitmentSection() {
  const { data: vehicles = [] } = useVehicles();
  const { data, isLoading, isError, refetch } = useTeethFitment();
  const add = useAddTeethFitment();
  const remove = useDeleteTeethFitment();
  const update = useUpdateTeethFitment();
  const [editing, setEditing] = useState<TeethFitment | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    vehicle_id: "",
    new_teeth_qty: "",
    incharge_name: "",
    operator_name: "",
    km: "",
    hours: "",
    place: "",
    old_teeth_status: "",
  });
  const filteredData = useMemo(() => filterRows(data ?? [], query, fromDate, toDate, sort), [data, query, fromDate, toDate, sort]);
  const pages = Math.max(1, Math.ceil(filteredData.length / 25));
  const visibleData = useMemo(() => filteredData.slice((page - 1) * 25, page * 25), [filteredData, page]);

  async function submit() {
    if (!form.vehicle_id || Number(form.new_teeth_qty) <= 0) {
      toast.error("Select a vehicle and enter a teeth quantity greater than zero");
      return;
    }
    try {
      await add.mutateAsync({
        entry_date: form.entry_date,
        vehicle_id: form.vehicle_id || null,
        new_teeth_qty: Number(form.new_teeth_qty) || 0,
        incharge_name: form.incharge_name.trim() || null,
        operator_name: form.operator_name.trim() || null,
        km: Number(form.km) || 0,
        hours: Number(form.hours) || 0,
        place: form.place.trim() || null,
        old_teeth_status: form.old_teeth_status.trim() || null,
      });
      toast.success("Teeth fitment recorded");
      setForm((f) => ({
        ...f,
        new_teeth_qty: "",
        incharge_name: "",
        operator_name: "",
        km: "",
        hours: "",
        place: "",
        old_teeth_status: "",
      }));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not record teeth fitment",
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button variant="outline" onClick={() => exportCsv("teeth-fitment.csv", data ?? [])}>Export CSV</Button></div>
      <h3 className="text-base font-semibold text-foreground">
        Excavator Teeth — Fitment
      </h3>
      <TableToolbar query={query} onQueryChange={(value) => { setQuery(value); setPage(1); }} total={filteredData.length} shown={visibleData.length} loading={isLoading} page={page} pages={pages} onPageChange={setPage} fromDate={fromDate} toDate={toDate} onFromDateChange={(value) => { setFromDate(value); setPage(1); }} onToDateChange={(value) => { setToDate(value); setPage(1); }} sort={sort} onSortChange={(value) => { setSort(value); setPage(1); }} />
      <Card>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Date">
            <Input
              type="date"
              value={form.entry_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, entry_date: e.target.value }))
              }
            />
          </Field>
          <Field label="Vehicle no" required>
            <VehicleSelect
              value={form.vehicle_id}
              onChange={(v) => setForm((f) => ({ ...f, vehicle_id: v }))}
            />
          </Field>
          <Field label="New teeth qty" required>
            <Input
              type="number"
              min={0}
              value={form.new_teeth_qty}
              onChange={(e) =>
                setForm((f) => ({ ...f, new_teeth_qty: e.target.value }))
              }
            />
          </Field>
          <Field label="Incharge name">
            <Input
              value={form.incharge_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, incharge_name: e.target.value }))
              }
            />
          </Field>
          <Field label="Operator name">
            <Input
              value={form.operator_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, operator_name: e.target.value }))
              }
            />
          </Field>
          <Field label="KM">
            <Input
              type="number"
              min={0}
              value={form.km}
              onChange={(e) => setForm((f) => ({ ...f, km: e.target.value }))}
            />
          </Field>
          <Field label="Hours">
            <Input
              type="number"
              min={0}
              value={form.hours}
              onChange={(e) =>
                setForm((f) => ({ ...f, hours: e.target.value }))
              }
            />
          </Field>
          <Field label="Place">
            <Input
              value={form.place}
              onChange={(e) =>
                setForm((f) => ({ ...f, place: e.target.value }))
              }
            />
          </Field>
          <Field label="Old teeth status">
            <Input
              value={form.old_teeth_status}
              onChange={(e) =>
                setForm((f) => ({ ...f, old_teeth_status: e.target.value }))
              }
            />
          </Field>
        </div>
        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button onClick={submit} disabled={add.isPending}>
            <Plus className="mr-2 h-4 w-4" /> Record fitment
          </Button>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto"><Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Incharge</TableHead>
              <TableHead>Operator</TableHead>
              <TableHead className="text-right">KM</TableHead>
              <TableHead className="text-right">Hrs</TableHead>
              <TableHead>Old status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : isError ? <QueryErrorRow colSpan={9} onRetry={() => { void refetch(); }} /> : visibleData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-12 text-center text-muted-foreground"
                >
                  No teeth fitment records yet
                </TableCell>
              </TableRow>
            ) : (
              visibleData.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.entry_date}</TableCell>
                  <TableCell>{vehicles.find((v) => v.id === r.vehicle_id)?.vehicle_number || r.vehicle_id || "—"}</TableCell>
                  <TableCell className="text-right">
                    {r.new_teeth_qty}
                  </TableCell>
                  <TableCell>{r.incharge_name || "—"}</TableCell>
                  <TableCell>{r.operator_name || "—"}</TableCell>
                  <TableCell className="text-right">{r.km}</TableCell>
                  <TableCell className="text-right">{r.hours}</TableCell>
                  <TableCell>{r.old_teeth_status || "—"}</TableCell>
                  <TableCell><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => setEditing(r)}>Edit</Button><Button variant="ghost" size="sm" onClick={() => window.confirm("Delete this teeth fitment?") && remove.mutate(r.id)}>Delete</Button></div></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table></div>
      </Card>
      {editing && <RecordEditDialog title="teeth fitment" row={editing} fields={[{ key: "entry_date", label: "Date", type: "date" }, { key: "new_teeth_qty", label: "New teeth quantity", type: "number" }, { key: "incharge_name", label: "Incharge" }, { key: "operator_name", label: "Operator" }, { key: "km", label: "KM", type: "number" }, { key: "hours", label: "Hours", type: "number" }, { key: "place", label: "Place" }, { key: "old_teeth_status", label: "Old teeth status" }]} pending={update.isPending} onClose={() => setEditing(null)} onSave={async (patch) => { await update.mutateAsync({ id: editing.id, ...patch } as never); setEditing(null); toast.success("Teeth fitment updated"); }} />}
    </div>
  );
}

/* ================= Audit Log ================= */
function diffSummary(log: TyreAuditLog): string {
  const label = (field: string) => field.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const oldD = (log.old_data ?? {}) as Record<string, unknown>;
  const newD = (log.new_data ?? {}) as Record<string, unknown>;
  if (log.action === "INSERT") {
    const pick: string[] = [];
    for (const [k, v] of Object.entries(newD)) {
      if (["id", "created_at", "updated_at"].includes(k)) continue;
      if (v !== null && v !== undefined && v !== "")
        pick.push(`${label(k)}: ${String(v)}`);
      if (pick.length >= 4) break;
    }
    return pick.length ? pick.join(" · ") : "New record created";
  }
  if (log.action === "DELETE") {
    const keys = Object.keys(oldD);
    return keys.length
      ? `Record removed (${keys.length} fields)`
      : "Record removed";
  }
  const changes: string[] = [];
  for (const k of Object.keys(newD)) {
    if (["id", "created_at", "updated_at"].includes(k)) continue;
    if (JSON.stringify(oldD[k]) !== JSON.stringify(newD[k])) {
      changes.push(
        `${label(k)}: ${String(oldD[k] ?? "—")} → ${String(newD[k] ?? "—")}`,
      );
    }
  }
  return changes.length
    ? changes.join(" · ")
    : "No field-level change captured";
}

function AuditLogSection() {
  const { data, isLoading, isError, refetch } = useTyreAuditLog();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => { let active = true; void supabase.auth.getUser().then(({ data: { user } }) => { if (active) setCurrentUserId(user?.id ?? null); }); return () => { active = false; }; }, []);
  const actorIds = useMemo(() => [...new Set((data ?? []).flatMap((log) => log.changed_by ? [log.changed_by] : []))], [data]);
  const { data: actors = [] } = useQuery({
    queryKey: ["audit-actor-profiles", actorIds],
    enabled: actorIds.length > 0,
    queryFn: async () => {
      const { data: rows, error } = await supabase.from("profiles").select("id, display_name").in("id", actorIds);
      if (error) throw error;
      return rows ?? [];
    },
  });
  const actorsById = useMemo(() => new Map(actors.map((actor) => [actor.id, actor.display_name])), [actors]);

  const rows = filterRows(data ?? [], query, fromDate, toDate).filter(
    (l) => filter === "all" || l.table_name === filter || l.action === filter,
  );

  const actionClass = (a: string) =>
    a === "INSERT"
      ? "text-success"
      : a === "DELETE"
        ? "text-destructive"
        : "text-warning";

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button variant="outline" onClick={() => exportCsv("tyre-audit-log.csv", rows)}>Export CSV</Button></div>
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <Input className="h-9 min-w-[180px] flex-1" aria-label="Search audit history" placeholder="Search changes or account ID…" value={query} onChange={(event) => setQuery(event.target.value)} />
          <Input className="h-9 w-36" type="date" aria-label="Audit history from date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <Input className="h-9 w-36" type="date" aria-label="Audit history to date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Tyre Maintenance Audit Trail
            </h3>
            <p className="text-xs text-muted-foreground">
              Every insert, update, and delete across inventory, fitment, tyre
              maintenance, teeth, services, and tyre positions.
            </p>
          </div>
          <div className="w-56">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All activity</SelectItem>
                <SelectItem value="INSERT">Only inserts</SelectItem>
                <SelectItem value="UPDATE">Only updates</SelectItem>
                <SelectItem value="DELETE">Only deletes</SelectItem>
                {Object.entries(AUDIT_TABLE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto"><Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Changed by</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : isError ? <QueryErrorRow colSpan={5} onRetry={() => { void refetch(); }} /> : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-16 text-center text-muted-foreground"
                >
                  No activity recorded yet — changes made from the other tabs
                  will appear here.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(l.changed_at).toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell>
                    <span className={`font-semibold ${actionClass(l.action)}`}>
                      {l.action}
                    </span>
                  </TableCell>
                  <TableCell>
                    {AUDIT_TABLE_LABELS[l.table_name] ?? l.table_name}
                  </TableCell>
                  <TableCell className="text-xs">
                    {l.changed_by ? <span title={l.changed_by}>{l.changed_by === currentUserId ? "You" : actorsById.get(l.changed_by) || `User · ${l.changed_by.slice(0, 8)}`}</span> : "System"}
                  </TableCell>
                  <TableCell className="max-w-[420px] text-xs">
                    <details>
                      <summary className="cursor-pointer truncate" title={diffSummary(l)}>{diffSummary(l)}</summary>
                      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-[11px]">{JSON.stringify({ before: l.old_data, after: l.new_data }, null, 2)}</pre>
                    </details>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table></div>
      </Card>
    </div>
  );
}

/* ================= Services ================= */
function ServicesSection() {
  const { data: vehicles = [] } = useVehicles();
  const { data, isLoading, isError, refetch } = useServiceEntries();
  const add = useAddServiceEntry();
  const remove = useDeleteServiceEntry();
  const update = useUpdateServiceEntry();
  const [editing, setEditing] = useState<ServiceEntry | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    vehicle_id: "",
    driver_name: "",
    from_km: "",
    to_km: "",
    particular: "",
    place: "",
    amount: "",
  });
  const filteredData = useMemo(() => filterRows(data ?? [], query, fromDate, toDate, sort), [data, query, fromDate, toDate, sort]);
  const pages = Math.max(1, Math.ceil(filteredData.length / 25));
  const visibleData = useMemo(() => filteredData.slice((page - 1) * 25, page * 25), [filteredData, page]);

  async function submit() {
    if (!form.vehicle_id || !form.particular.trim() || !form.from_km.trim() || !form.to_km.trim() || Number(form.to_km) < Number(form.from_km)) {
      toast.error("Select a vehicle and service, and enter a valid KM range");
      return;
    }
    try {
      await add.mutateAsync({
        entry_date: form.entry_date,
        vehicle_id: form.vehicle_id || null,
        driver_name: form.driver_name.trim() || null,
        from_km: Number(form.from_km) || 0,
        to_km: Number(form.to_km) || 0,
        particular: form.particular.trim() || null,
        place: form.place.trim() || null,
        amount: Number(form.amount) || 0,
      });
      toast.success("Service entry added");
      setForm((f) => ({
        ...f,
        driver_name: "",
        from_km: "",
        to_km: "",
        particular: "",
        place: "",
        amount: "",
      }));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not add service entry",
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button variant="outline" onClick={() => exportCsv("services.csv", data ?? [])}>Export CSV</Button></div>
      <TableToolbar query={query} onQueryChange={(value) => { setQuery(value); setPage(1); }} total={filteredData.length} shown={visibleData.length} loading={isLoading} page={page} pages={pages} onPageChange={setPage} fromDate={fromDate} toDate={toDate} onFromDateChange={(value) => { setFromDate(value); setPage(1); }} onToDateChange={(value) => { setToDate(value); setPage(1); }} sort={sort} onSortChange={(value) => { setSort(value); setPage(1); }} />
      <Card>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Date">
            <Input
              type="date"
              value={form.entry_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, entry_date: e.target.value }))
              }
            />
          </Field>
          <Field label="Vehicle no" required>
            <VehicleSelect
              value={form.vehicle_id}
              onChange={(v) => setForm((f) => ({ ...f, vehicle_id: v }))}
            />
          </Field>
          <Field label="Driver name">
            <Input
              value={form.driver_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, driver_name: e.target.value }))
              }
            />
          </Field>
          <Field label="From KM" required>
            <Input
              type="number"
              min={0}
              value={form.from_km}
              onChange={(e) =>
                setForm((f) => ({ ...f, from_km: e.target.value }))
              }
            />
          </Field>
          <Field label="To KM" required>
            <Input
              type="number"
              min={0}
              value={form.to_km}
              onChange={(e) =>
                setForm((f) => ({ ...f, to_km: e.target.value }))
              }
            />
          </Field>
          <Field label="Particular" required>
            <Input
              value={form.particular}
              onChange={(e) =>
                setForm((f) => ({ ...f, particular: e.target.value }))
              }
            />
          </Field>
          <Field label="Place">
            <Input
              value={form.place}
              onChange={(e) =>
                setForm((f) => ({ ...f, place: e.target.value }))
              }
            />
          </Field>
          <Field label="Amount">
            <Input
              type="number"
              min={0}
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
            />
          </Field>
        </div>
        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button onClick={submit} disabled={add.isPending}>
            <Plus className="mr-2 h-4 w-4" /> Add service
          </Button>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto"><Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>From KM</TableHead>
              <TableHead>To KM</TableHead>
              <TableHead>Particular</TableHead>
              <TableHead>Place</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : isError ? <QueryErrorRow colSpan={9} onRetry={() => { void refetch(); }} /> : visibleData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-16 text-center text-muted-foreground"
                >
                  No service records yet
                </TableCell>
              </TableRow>
            ) : (
              visibleData.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.entry_date}</TableCell>
                  <TableCell>{vehicles.find((v) => v.id === r.vehicle_id)?.vehicle_number || r.vehicle_id || "—"}</TableCell>
                  <TableCell>{r.driver_name || "—"}</TableCell>
                  <TableCell className="text-right">{r.from_km}</TableCell>
                  <TableCell className="text-right">{r.to_km}</TableCell>
                  <TableCell>{r.particular || "—"}</TableCell>
                  <TableCell>{r.place || "—"}</TableCell>
                  <TableCell className="text-right">{r.amount}</TableCell>
                  <TableCell><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => setEditing(r)}>Edit</Button><Button variant="ghost" size="sm" onClick={() => window.confirm("Delete this service entry?") && remove.mutate(r.id)}>Delete</Button></div></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table></div>
      </Card>
      {editing && <RecordEditDialog title="service entry" row={editing} fields={[{ key: "entry_date", label: "Date", type: "date" }, { key: "driver_name", label: "Driver" }, { key: "from_km", label: "From KM", type: "number" }, { key: "to_km", label: "To KM", type: "number" }, { key: "particular", label: "Particular" }, { key: "place", label: "Place" }, { key: "amount", label: "Amount", type: "number" }]} pending={update.isPending} onClose={() => setEditing(null)} onSave={async (patch) => { await update.mutateAsync({ id: editing.id, ...patch } as never); setEditing(null); toast.success("Service updated"); }} />}
    </div>
  );
}

/* ================= Tyre Maintenance ================= */
const MAINTENANCE_TYPES = ["Inspection", "Puncture repair", "Rotation", "Alignment", "Retread", "Replacement", "Other"] as const;

function TyreMaintenanceSection() {
  const { data: vehicles = [] } = useVehicles();
  const { data: tyres = [] } = useAllTyres();
  const { data: records = [], isLoading, isError, refetch } = useTyreMaintenance();
  const add = useAddTyreMaintenance();
  const [vehicleId, setVehicleId] = useState("");
  const [document, setDocument] = useState<File | null>(null);
  const [form, setForm] = useState({
    tyre_id: "",
    entry_date: new Date().toISOString().slice(0, 10),
    maintenance_type: "Inspection",
    km_reading: "",
    driver_name: "",
    expense_account: "",
    payment_mode: "Cash",
    amount: "",
    next_alert_date: "",
    next_alert_km: "",
    remark: "",
    condition_after: "",
    tread_depth_mm: "",
    damage_notes: "",
  });

  const vehicleTyres = tyres.filter((tyre) => tyre.vehicle_id === vehicleId);
  const tyresById = useMemo(() => new Map(tyres.map((tyre) => [tyre.id, tyre])), [tyres]);
  const vehiclesById = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);
  const today = new Date().toISOString().slice(0, 10);
  const latestByTyre = useMemo(() => {
    const latest = new Map<string, TyreMaintenance>();
    for (const record of records) if (!latest.has(record.tyre_id)) latest.set(record.tyre_id, record);
    return [...latest.values()];
  }, [records]);
  const thresholdDate = new Date(`${today}T00:00:00`);
  thresholdDate.setDate(thresholdDate.getDate() + 30);
  const dueNow = latestByTyre.filter((record) => {
    const vehicle = vehiclesById.get(tyresById.get(record.tyre_id)?.vehicle_id ?? "");
    return Boolean((record.next_alert_date && record.next_alert_date <= today) || (record.next_alert_km != null && Number(vehicle?.odometer ?? 0) >= Number(record.next_alert_km)));
  });
  const dueSoon = latestByTyre.filter((record) => {
    if (dueNow.includes(record)) return false;
    const vehicle = vehiclesById.get(tyresById.get(record.tyre_id)?.vehicle_id ?? "");
    const dateSoon = record.next_alert_date && record.next_alert_date <= thresholdDate.toISOString().slice(0, 10);
    const kmRemaining = record.next_alert_km == null ? Number.POSITIVE_INFINITY : Number(record.next_alert_km) - Number(vehicle?.odometer ?? 0);
    return Boolean(dateSoon || (kmRemaining > 0 && kmRemaining <= 1000));
  });
  const selectedVehicle = vehiclesById.get(vehicleId);

  async function submit() {
    if (!form.tyre_id || !form.km_reading) {
      toast.error("Select a vehicle, tyre position, and kilometre reading");
      return;
    }
    const kmReading = Number(form.km_reading);
    if (!Number.isFinite(kmReading) || kmReading < 0) {
      toast.error("Enter a valid non-negative odometer reading");
      return;
    }
    if (selectedVehicle && kmReading < Number(selectedVehicle.odometer)) {
      toast.error(`Odometer cannot go backwards from ${Number(selectedVehicle.odometer).toLocaleString("en-IN")} km. Confirm or correct the vehicle reading first.`);
      return;
    }
    try {
      let documentPath: string | null = null;
      if (document) {
        const safeName = document.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `maintenance/${form.tyre_id}/${Date.now()}-${safeName}`;
        const upload = await supabase.storage.from("tyre-documents").upload(path, document, { upsert: true });
        if (upload.error) throw upload.error;
        documentPath = path;
      }
      await add.mutateAsync({
        tyre_id: form.tyre_id,
        entry_date: form.entry_date,
        maintenance_type: form.maintenance_type,
        km_reading: kmReading,
        driver_name: form.driver_name.trim() || null,
        expense_account: form.expense_account.trim() || null,
        payment_mode: form.payment_mode,
        amount: Number(form.amount) || 0,
        next_alert_date: form.next_alert_date || null,
        next_alert_km: form.next_alert_km ? Number(form.next_alert_km) : null,
        condition_after: form.condition_after || null,
        tread_depth_mm: form.tread_depth_mm ? Number(form.tread_depth_mm) : null,
        damage_notes: form.damage_notes.trim() || null,
        remark: form.remark.trim() || null,
        document_path: documentPath,
      });
      toast.success("Tyre maintenance recorded");
      setForm((current) => ({ ...current, tyre_id: "", km_reading: "", driver_name: "", expense_account: "", amount: "", next_alert_date: "", next_alert_km: "", remark: "", condition_after: "", tread_depth_mm: "", damage_notes: "" }));
      setDocument(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save tyre maintenance");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-card px-5 py-4 shadow-panel">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Tyre Maintenance</h1>
          <p className="mt-1 text-xs text-muted-foreground">Log inspections, repairs, rotations, costs, documents, and next-service alerts for every tyre position.</p>
        </div>
        <Button variant="outline" onClick={() => exportCsv("tyre-maintenance.csv", records)}>Export CSV</Button>
      </div>
      {dueNow.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div><strong>{dueNow.length} tyre maintenance item{dueNow.length === 1 ? "" : "s"} overdue</strong><p className="mt-1 text-muted-foreground">A date or vehicle odometer threshold has been reached. Review before the next trip.</p></div>
        </div>
      )}
      {dueSoon.length > 0 && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100"><strong>{dueSoon.length} tyre service{dueSoon.length === 1 ? "" : "s"} due soon</strong><p className="mt-1 opacity-80">Within the next 30 days or 1,000 vehicle kilometres.</p></div>}
      <Card>
        <div className="space-y-4 p-4">
          <section className="space-y-3 rounded-lg border border-border p-4"><div><h2 className="text-sm font-semibold">Vehicle and tyre</h2><p className="mt-1 text-xs text-muted-foreground">The odometer updates the vehicle record when you save.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="Vehicle" required><VehicleSelect value={vehicleId} required onChange={(value) => { setVehicleId(value); const nextVehicle = vehiclesById.get(value); setForm((current) => ({ ...current, tyre_id: "", km_reading: nextVehicle ? String(nextVehicle.odometer) : "" })); }} /></Field><Field label="Tyre position" required><Select value={form.tyre_id || "none"} onValueChange={(value) => setForm((current) => ({ ...current, tyre_id: value === "none" ? "" : value }))}><SelectTrigger><SelectValue placeholder={vehicleId ? "Select tyre position" : "Select a vehicle first"} /></SelectTrigger><SelectContent><SelectItem value="none">— None —</SelectItem>{vehicleTyres.map((tyre) => <SelectItem key={tyre.id} value={tyre.id}>{tyre.position_code} · {tyre.brand || "Unbranded"} · {tyre.serial_no || "No serial"}</SelectItem>)}</SelectContent></Select></Field><Field label="Vehicle odometer (km)" required><Input type="number" min={0} value={form.km_reading} onChange={(event) => setForm((current) => ({ ...current, km_reading: event.target.value }))} placeholder={selectedVehicle ? String(selectedVehicle.odometer) : "Select a vehicle"} />{selectedVehicle && Date.now() - new Date(selectedVehicle.odometer_updated_at).getTime() > 30 * 86400000 && <p className="text-xs text-warning">Last updated over 30 days ago—confirm this reading.</p>}</Field></div></section>
          <section className="space-y-3 rounded-lg border border-border p-4"><div><h2 className="text-sm font-semibold">Inspection or work</h2><p className="mt-1 text-xs text-muted-foreground">Condition and tread depth are optional, but help catch wear before a breakdown.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="Maintenance type"><Select value={form.maintenance_type} onValueChange={(value) => setForm((current) => ({ ...current, maintenance_type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MAINTENANCE_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></Field><Field label="Date"><Input type="date" value={form.entry_date} onChange={(event) => setForm((current) => ({ ...current, entry_date: event.target.value }))} /></Field><Field label="Driver"><Input value={form.driver_name} onChange={(event) => setForm((current) => ({ ...current, driver_name: event.target.value }))} placeholder="Optional" /></Field><Field label="Condition after work"><Select value={form.condition_after || "none"} onValueChange={(value) => setForm((current) => ({ ...current, condition_after: value === "none" ? "" : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not assessed</SelectItem><SelectItem value="good">Good</SelectItem><SelectItem value="monitor">Monitor</SelectItem><SelectItem value="replace">Replace</SelectItem></SelectContent></Select></Field><Field label="Tread depth (mm)"><Input type="number" min={0} step="0.1" value={form.tread_depth_mm} onChange={(event) => setForm((current) => ({ ...current, tread_depth_mm: event.target.value }))} placeholder="Optional measurement" /></Field><Field label="Damage / inspection notes"><Input value={form.damage_notes} onChange={(event) => setForm((current) => ({ ...current, damage_notes: event.target.value }))} placeholder="Cut, puncture, uneven wear…" /></Field><div className="sm:col-span-2 lg:col-span-3"><Field label="Work notes"><Input value={form.remark} onChange={(event) => setForm((current) => ({ ...current, remark: event.target.value }))} placeholder="Work completed or observations" /></Field></div></div></section>
          <section className="space-y-3 rounded-lg border border-border p-4"><div><h2 className="text-sm font-semibold">Cost and next service</h2><p className="mt-1 text-xs text-muted-foreground">In-app due-soon reminders appear within 30 days or 1,000 km of a threshold.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="Expense account"><Input value={form.expense_account} onChange={(event) => setForm((current) => ({ ...current, expense_account: event.target.value }))} placeholder="Workshop / vendor" /></Field><Field label="Payment mode"><Select value={form.payment_mode} onValueChange={(value) => setForm((current) => ({ ...current, payment_mode: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Credit">Credit</SelectItem></SelectContent></Select></Field><Field label="Amount"><Input type="number" min={0} value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0" /></Field><Field label="Next alert date"><Input type="date" value={form.next_alert_date} onChange={(event) => setForm((current) => ({ ...current, next_alert_date: event.target.value }))} /></Field><Field label="Next alert odometer (km)"><Input type="number" min={0} value={form.next_alert_km} onChange={(event) => setForm((current) => ({ ...current, next_alert_km: event.target.value }))} /></Field><Field label="Document"><Input type="file" className="cursor-pointer text-xs" onChange={(event) => setDocument(event.target.files?.[0] ?? null)} /></Field></div></section>
        </div>
        <div className="flex justify-end border-t border-border px-4 py-3"><Button onClick={submit} disabled={add.isPending}><ClipboardCheck className="mr-2 h-4 w-4" />{add.isPending ? "Saving…" : "Save maintenance"}</Button></div>
      </Card>
      <Card>
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Vehicle / tyre</TableHead><TableHead>Work</TableHead><TableHead>KM</TableHead><TableHead>Condition</TableHead><TableHead>Tread</TableHead><TableHead>Amount</TableHead><TableHead>Next alert</TableHead><TableHead>Document</TableHead></TableRow></TableHeader><TableBody>
          {isLoading ? <TableRow><TableCell colSpan={9}><Skeleton className="h-8 w-full" /></TableCell></TableRow> : isError ? <QueryErrorRow colSpan={9} onRetry={() => { void refetch(); }} /> : records.length === 0 ? <TableRow><TableCell colSpan={9} className="py-16 text-center text-muted-foreground">No tyre-maintenance records yet. Record an inspection or repair above to start this history.</TableCell></TableRow> : records.map((record: TyreMaintenance) => {
            const tyre = tyresById.get(record.tyre_id); const vehicle = tyre ? vehiclesById.get(tyre.vehicle_id) : undefined; const isDue = (record.next_alert_date && record.next_alert_date <= today) || (record.next_alert_km != null && Number(vehicle?.odometer ?? 0) >= Number(record.next_alert_km));
            return <TableRow key={record.id}><TableCell>{displayDate(record.entry_date)}</TableCell><TableCell><div className="font-medium">{vehicle?.vehicle_number || "—"} · {tyre?.position_code || "—"}</div><div className="text-xs text-muted-foreground">{tyre?.serial_no || tyre?.brand || "Tyre"}</div></TableCell><TableCell><div>{record.maintenance_type}</div>{record.remark && <div className="max-w-48 truncate text-xs text-muted-foreground" title={record.remark}>{record.remark}</div>}</TableCell><TableCell>{Number(record.km_reading).toLocaleString("en-IN")}</TableCell><TableCell className="capitalize">{record.condition_after || "—"}</TableCell><TableCell>{record.tread_depth_mm == null ? "—" : `${Number(record.tread_depth_mm)} mm`}</TableCell><TableCell>{inr(Number(record.amount))}</TableCell><TableCell className={isDue ? "font-semibold text-warning" : ""}>{record.next_alert_date ? displayDate(record.next_alert_date) : "—"}{record.next_alert_km != null && <div className="text-xs">{Number(record.next_alert_km).toLocaleString("en-IN")} km</div>}</TableCell><TableCell>{record.document_path ? <SignedDocumentLink path={record.document_path} /> : "—"}</TableCell></TableRow>;
          })}
        </TableBody></Table></div>
      </Card>
    </div>
  );
}

/* ================= Truck Tyre View (TMS Prime-style interactive layout) ================= */
function TyreViewSection({ vehicleId, onVehicleChange, focusTyreId, onFocusHandled }: { vehicleId: string; onVehicleChange: (id: string) => void; focusTyreId: string; onFocusHandled: () => void }) {
  const { data: vehicles = [], isLoading: loadingVehicles, isError: vehiclesError, refetch: refetchVehicles } = useVehicles();
  const vehiclesById = useMemo(() => new Map(vehicles.map((item) => [item.id, item])), [vehicles]);
  const { data: allTyres = [], isError: allTyresError, refetch: refetchAllTyres } = useAllTyres();
  const { data: maintenance = [], isError: maintenanceError, refetch: refetchMaintenance } = useTyreMaintenance();
  const [viewMode, setViewMode] = useState<"visual" | "list">("visual");
  const [visualOrientation, setVisualOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [selected, setSelected] = useState<Tyre | null>(null);
  useEffect(() => {
    if (!focusTyreId || allTyresError) return;
    const targetTyre = allTyres.find((tyre) => tyre.id === focusTyreId);
    if (!targetTyre) return;
    if (targetTyre.vehicle_id !== vehicleId) onVehicleChange(targetTyre.vehicle_id);
    setSelected(targetTyre);
    onFocusHandled();
  }, [focusTyreId, allTyres, allTyresError, vehicleId, onVehicleChange, onFocusHandled]);
  const [editingDetails, setEditingDetails] = useState(false);
  const [replacementOpen, setReplacementOpen] = useState(false);
  const [replacement, setReplacement] = useState({
    event_date: new Date().toISOString().slice(0, 10),
    km_reading: "0",
    tyre_type: "New",
    source: "Existing",
    amount: "0",
    serial_no: "",
    remark: "",
  });
  const [replacementDocument, setReplacementDocument] = useState<File | null>(null);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    vehicle_number: "",
    wheels: "6",
    odometer: "0",
  });
  const [draft, setDraft] = useState({
    brand: "",
    serial_no: "",
    current_km: "",
    cost: "",
    remark: "",
  });
  const tyreDialogRef = useAccessibleDialog(Boolean(selected) && !replacementOpen, () => { setSelected(null); setEditingDetails(false); });
  const replacementDialogRef = useAccessibleDialog(replacementOpen, () => setReplacementOpen(false));
  const vehicle = vehicles.find((v) => v.id === (vehicleId || vehicles[0]?.id));
  const verticalScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (visualOrientation === "vertical") verticalScrollRef.current?.scrollTo({ top: 0, left: 0 });
  }, [visualOrientation, vehicle?.id]);
  const { data: tyres = [], isLoading: loadingTyres } = useTyres(vehicle?.id);
  const { data: tyreEvents = [] } = useTyreEvents(
    selected && !selected.id.startsWith("missing-") && !selected.id.startsWith("preview-")
      ? selected.id
      : undefined,
  );
  const selectedHistory = selected ? [
    ...tyreEvents.map((event) => ({ id: event.id, type: event.event_type, date: event.event_date, km: event.km_reading, note: event.note, documentPath: event.note?.match(/Document:\s*([^·]+)/i)?.[1]?.trim() ?? null })),
    ...maintenance.filter((record) => record.tyre_id === selected.id).map((record) => ({ id: record.id, type: record.maintenance_type, date: record.entry_date, km: record.km_reading, note: record.damage_notes || record.remark, documentPath: record.document_path })),
  ].sort((a, b) => b.date.localeCompare(a.date)) : [];
  const provision = useProvisionTyres();
  const setExisting = useSetExistingTyre();
  const save = useSaveTyre();
  const addVehicle = useAddVehicle();
  const addEvent = useAddTyreEvent();

  const axleGroups = useMemo(() => {
    const groups = new Map<string, Tyre[]>();
    for (const tyre of tyres) {
      const label =
        tyre.axle_label ?? `AXLE ${parseInt(tyre.position_code, 10) || 0}`;
      groups.set(label, [...(groups.get(label) ?? []), tyre]);
    }
    return [...groups.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { numeric: true }),
    );
  }, [tyres]);

  const missingCount = useMemo(() => {
    if (!vehicle || showAddVehicle) return 0;
    const present = new Set(tyres.map((t) => t.position_code));
    return tyrePositions(vehicle.wheels).filter((p) => !present.has(p.pos))
      .length;
  }, [vehicle, showAddVehicle, tyres]);

  const maintenanceByTyre = useMemo(() => {
    const latest = new Map<string, TyreMaintenance>();
    for (const entry of maintenance) {
      const current = latest.get(entry.tyre_id);
      if (!current || entry.entry_date > current.entry_date) latest.set(entry.tyre_id, entry);
    }
    return latest;
  }, [maintenance]);

  const isMaintenanceDue = (tyre: Tyre) => {
    const record = maintenanceByTyre.get(tyre.id);
    if (!record) return false;
    const today = new Date().toISOString().slice(0, 10);
    return Boolean(
      (record.next_alert_date && record.next_alert_date <= today) ||
      (record.next_alert_km != null && Number(vehiclesById.get(tyre.vehicle_id)?.odometer ?? 0) >= Number(record.next_alert_km)),
    );
  };

  const tyreConditionLabel = (tyre: Tyre) => {
    const condition = maintenanceByTyre.get(tyre.id)?.condition_after ?? tyre.condition;
    if (condition === "good") return "Good";
    if (condition === "monitor") return "Moderate";
    if (condition === "replace") return "Replace";
    return tyreHealth(Number(tyre.current_km));
  };

  // While adding a vehicle, show the selected wheel layout immediately as a preview.
  const displayGroups = useMemo(() => {
    if (!showAddVehicle) {
      const actual = new Map(tyres.map((t) => [t.position_code, t]));
      const all = tyrePositions(vehicle?.wheels ?? 0).map(
        (p, i) =>
          actual.get(p.pos) ??
          ({
            id: `missing-${i}`,
            position_code: p.pos,
            axle_label: p.axle,
            current_km: 0,
            tyre_type: "New",
            brand: null,
            serial_no: null,
            cost: 0,
            remark: null,
          } as Tyre),
      );
      const groups = new Map<string, Tyre[]>();
      for (const tyre of all)
        groups.set(tyre.axle_label ?? "", [
          ...(groups.get(tyre.axle_label ?? "") ?? []),
          tyre,
        ]);
      return [...groups.entries()];
    }
    const preview = tyrePositions(Number(newVehicle.wheels)).map(
      (p, i) =>
        ({
          id: `preview-${i}`,
          position_code: p.pos,
          axle_label: p.axle,
          current_km: 0,
          tyre_type: "New",
          brand: null,
          serial_no: null,
          cost: 0,
          remark: null,
        }) as Tyre,
    );
    const groups = new Map<string, Tyre[]>();
    for (const tyre of preview)
      groups.set(tyre.axle_label ?? "", [
        ...(groups.get(tyre.axle_label ?? "") ?? []),
        tyre,
      ]);
    return [...groups.entries()];
  }, [showAddVehicle, newVehicle.wheels, axleGroups]);

  // TMS Prime places the first/front axle before the cab; the remaining axles sit behind it.
  const leftAxles = displayGroups.slice(0, 1);
  const rightAxles = displayGroups.slice(1);
  const rightAxleWidths = rightAxles.map(([, list]) => {
    const rightCount = list.filter((t) => /R/.test(t.position_code.replace(/^\d+/, ""))).length;
    const leftCount = list.filter((t) => /L/.test(t.position_code.replace(/^\d+/, ""))).length;
    return Math.max(170, Math.max(rightCount, leftCount) * 114 + 16);
  });
  const rightAxlesWidth = rightAxleWidths.reduce((total, width) => total + width, 0) + Math.max(0, rightAxleWidths.length - 1) * 16;

  function selectTyre(tyre: Tyre) {
    setSelected(tyre);
    setEditingDetails(false);
    setDraft({
      brand: tyre.brand ?? "",
      serial_no: tyre.serial_no ?? "",
      current_km: String(tyre.current_km ?? 0),
      cost: String(tyre.cost ?? 0),
      remark: tyre.remark ?? "",
    });
  }

  async function createPositions() {
    if (!vehicle) return;
    try {
      const count = await provision.mutateAsync(vehicle);
      toast.success(
        count
          ? `${count} tyre positions created`
          : "All tyre positions already exist",
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not create tyre positions",
      );
    }
  }

  async function setSingleExistingTyre() {
    if (!vehicle || !selected?.id.startsWith("missing-")) return;
    try {
      await setExisting.mutateAsync({
        vehicleId: vehicle.id,
        positionCode: selected.position_code,
        axleLabel: selected.axle_label,
      });
      toast.success(`Tyre position ${selected.position_code} added`);
      setSelected(null);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not set tyre position",
      );
    }
  }

  async function saveSelected() {
    if (!selected) return;
    try {
      await save.mutateAsync({
        id: selected.id,
        brand: draft.brand || null,
        serial_no: draft.serial_no || null,
        current_km: Number(draft.current_km) || 0,
        cost: Number(draft.cost) || 0,
        remark: draft.remark || null,
      });
      toast.success(`Tyre ${selected.position_code} updated`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update tyre");
    }
  }

  async function replaceSelected() {
    if (!selected) return;
    try {
      let documentPath = "";
      if (replacementDocument) {
        const safeName = replacementDocument.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${selected.vehicle_id}/${selected.id}/${Date.now()}-${safeName}`;
        const upload = await supabase.storage.from("tyre-documents").upload(path, replacementDocument, { upsert: true });
        if (upload.error) {
          toast.warning("Tyre saved; document storage is not enabled on this Supabase project yet.");
        } else {
          documentPath = path;
        }
      }
      await save.mutateAsync({
        id: selected.id,
        tyre_type: replacement.tyre_type,
        serial_no: replacement.serial_no || null,
        fitted_on: replacement.event_date,
        fitted_km: Number(replacement.km_reading) || 0,
        current_km: 0,
        cost: Number(replacement.amount) || 0,
        status: "running",
        remark: replacement.remark || null,
      });
      await addEvent.mutateAsync({
        tyre_id: selected.id,
        event_date: replacement.event_date,
        event_type: "replaced",
        km_reading: Number(replacement.km_reading) || 0,
        cost: Number(replacement.amount) || 0,
        note: [`Source: ${replacement.source}`, replacement.remark, documentPath ? `Document: ${documentPath}` : replacementDocument ? `Document: ${replacementDocument.name}` : ""].filter(Boolean).join(" · "),
      });
      toast.success(`Tyre ${selected.position_code} replaced`);
      setReplacementOpen(false);
      setSelected(null);
      setReplacementDocument(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not replace tyre");
    }
  }

  async function addNewVehicle() {
    if (!newVehicle.vehicle_number.trim()) return;
    try {
      const created = await addVehicle.mutateAsync({
        vehicle_number: newVehicle.vehicle_number.trim(),
        wheels: Number(newVehicle.wheels),
        odometer: Number(newVehicle.odometer) || 0,
      });
      onVehicleChange(created.id);
      setShowAddVehicle(false);
      setNewVehicle({ vehicle_number: "", wheels: "6", odometer: "0" });
      toast.success("Vehicle added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add vehicle");
    }
  }

  const tyreButton = (t: Tyre, compact = false) => {
    const hasData =
      !t.id.startsWith("missing-") && !t.id.startsWith("preview-");
    const health = tyreConditionLabel(t);
    const cls = healthClasses[health];
    const costPerKmValue = costPerKm(Number(t.cost), Number(t.current_km));
    const tyreStatus = isMaintenanceDue(t) ? "Maintenance Due" : health === "Replace" ? "Replace Soon" : health;
    return (
      <button
        key={t.id}
        type="button"
        disabled={t.id.startsWith("preview-")}
        onClick={() => selectTyre(t)}
        aria-label={hasData ? `Tyre ${t.position_code}, ${t.tyre_type}, ${Number(t.current_km).toLocaleString("en-IN")} kilometres used, ${tyreStatus}, cost ${inr(Number(t.cost))}, ${inr(costPerKmValue)} per kilometre` : `Tyre ${t.position_code}, no tyre data recorded`}
        className={`group relative ${compact ? "h-[82px] w-[82px]" : "h-[110px] w-[110px]"} shrink-0 rounded-full transition hover:z-[60] hover:scale-105 focus-visible:z-[60] ${hasData ? `${cls.fill} ring-2 ${cls.ring}` : "border-2 border-dashed border-muted-foreground/20 bg-muted/10"} ${selected?.id === t.id ? "ring-4 ring-primary" : ""} ${t.id.startsWith("preview-") ? "cursor-default" : ""}`}
      >
        <span className={`absolute inset-x-0 ${compact ? "top-1 text-[8px]" : "top-2 text-[10px]"} font-semibold`}>{t.position_code}</span>
        <span className={`absolute left-1 top-1/2 -translate-y-1/2 -rotate-45 whitespace-nowrap ${compact ? "text-[7px]" : "text-[9px]"} text-muted-foreground`}>{hasData ? shortKm(Number(t.current_km)) : "N/A"}</span>
        {hasData && <span className={`absolute right-1 top-1/2 -translate-y-1/2 rotate-45 whitespace-nowrap ${compact ? "text-[6px]" : "text-[8px]"} text-muted-foreground`}>{inr(costPerKmValue)}/km</span>}
        {hasData && <span className={`absolute left-1/2 top-1/2 ${compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} -translate-x-1/2 -translate-y-1/2 rounded-full ${cls.dot}`} />}
        {hasData && isMaintenanceDue(t) && <span title="Maintenance due" className={`absolute ${compact ? "right-1 top-1 h-2 w-2" : "right-2 top-2 h-2.5 w-2.5"} rounded-full bg-warning ring-2 ring-card`} />}
        {hasData && <span className={`absolute inset-x-0 ${compact ? "bottom-1 text-[7px]" : "bottom-2 text-[9px]"} uppercase text-muted-foreground`}>{t.tyre_type}</span>}
        {hasData && <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-[70] mb-2 hidden w-[220px] -translate-x-1/2 rounded-lg bg-primary px-3 py-2 text-left text-xs leading-5 text-primary-foreground shadow-xl group-hover:block group-focus-visible:block">
          <span className="block"><strong>Position:</strong> {t.position_code}</span>
          <span className="block"><strong>Type:</strong> {t.tyre_type}</span>
          <span className="block"><strong>KM Usage:</strong> {Number(t.current_km).toLocaleString("en-IN")} km</span>
          <span className="block"><strong>Status:</strong> {tyreStatus}</span>
          <span className="block"><strong>Tyre Cost:</strong> {inr(Number(t.cost))}</span>
          <span className="block"><strong>Cost per KM:</strong> {inr(costPerKmValue)}/km</span>
        </span>}
      </button>
    );
  };

  const axleBlock = (label: string, list: Tyre[]) => (
    <div key={label} className="p-1">
      <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="space-y-2">
        {[
          list.filter((t) => /R/.test(t.position_code.replace(/^\d+/, ""))),
          list.filter((t) => /L/.test(t.position_code.replace(/^\d+/, ""))),
        ].map((row, i) => (
          <div key={i} className="flex justify-center gap-2">
            {row.map((tyre) => tyreButton(tyre))}
          </div>
        ))}
      </div>
    </div>
  );

  const topDownAxleBlock = (label: string, list: Tyre[], width = 170) => {
    const topSide = list.filter((t) => /R/.test(t.position_code.replace(/^\d+/, "")));
    const bottomSide = list.filter((t) => /L/.test(t.position_code.replace(/^\d+/, "")));
    return (
      <div key={label} className="relative flex h-[270px] min-w-[120px] flex-none flex-col items-center justify-center" style={{ width: `${width}px` }}>
        <p className="absolute -top-5 left-0 right-0 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="flex h-[110px] items-end gap-1">{topSide.map((tyre) => tyreButton(tyre))}</div>
        <div className="h-9 w-full" />
        <div className="flex h-[110px] items-start gap-1">{bottomSide.map((tyre) => tyreButton(tyre))}</div>
      </div>
    );
  };

  const verticalAxleBlock = (label: string, list: Tyre[]) => {
    const rightSide = list.filter((t) => /R/.test(t.position_code.replace(/^\d+/, "")));
    const leftSide = list.filter((t) => /L/.test(t.position_code.replace(/^\d+/, "")));
    return (
      <div key={label} className="relative z-10 grid w-[1000px] grid-cols-[minmax(0,1fr)_260px_minmax(0,1fr)] items-center gap-x-8 py-1">
        <div className="flex items-center justify-end gap-2"><span className="shrink-0 rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground shadow-sm">{label}</span>{rightSide.map((t) => tyreButton(t))}</div>
        <div className="h-[110px] w-[260px]" aria-hidden="true" />
        <div className="flex justify-start gap-2">{leftSide.map((t) => tyreButton(t))}</div>
      </div>
    );
  };

  if (loadingVehicles)
    return (
      <Card>
        <div className="p-10 text-center text-muted-foreground">
          Loading trucks…
        </div>
      </Card>
    );
  if (!vehicle)
    return (
      <Card>
        <div className="space-y-4 p-6">
          {vehiclesError ? <QueryErrorBanner label="vehicles" onRetry={() => { void refetchVehicles(); }} /> : <><div><h2 className="text-lg font-semibold">Add your first vehicle</h2><p className="mt-1 text-sm text-muted-foreground">Create a vehicle to start recording its tyre positions and maintenance history.</p></div><div className="grid gap-3 sm:grid-cols-3"><Field label="Vehicle number"><Input value={newVehicle.vehicle_number} placeholder="MH12XX0000" onChange={(event) => setNewVehicle((v) => ({ ...v, vehicle_number: event.target.value }))} /></Field><Field label="Wheel configuration"><Select value={newVehicle.wheels} onValueChange={(wheels) => setNewVehicle((v) => ({ ...v, wheels }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{WHEEL_CONFIGS.map((wheels) => <SelectItem key={wheels} value={String(wheels)}>{wheels} wheeler</SelectItem>)}</SelectContent></Select></Field><Field label="Current odometer"><Input type="number" min={0} value={newVehicle.odometer} onChange={(event) => setNewVehicle((v) => ({ ...v, odometer: event.target.value }))} /></Field></div><div className="flex justify-end"><Button onClick={addNewVehicle} disabled={addVehicle.isPending || !newVehicle.vehicle_number.trim()}>{addVehicle.isPending ? "Creating…" : "Create vehicle"}</Button></div></>}
        </div>
      </Card>
    );

  return (
    <div className="space-y-5">
      {allTyresError && <QueryErrorBanner label="tyre position records" onRetry={() => { void refetchAllTyres(); }} />}
      {maintenanceError && <QueryErrorBanner label="maintenance alerts" onRetry={() => { void refetchMaintenance(); }} />}
      {loadingTyres && <div role="status" className="rounded-md border border-border bg-card px-4 py-2 text-sm text-muted-foreground">Loading tyre positions…</div>}
      <div className="grid gap-3 px-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
        <div className="hidden md:block" />
        <h2 className="justify-self-center border-b-4 border-indigo-400 pb-1 text-center text-[22px] font-semibold tracking-[-0.02em]">Truck Tyre View</h2>
        <div className="flex flex-wrap justify-center gap-2 md:justify-end">
          <Select
            value={vehicle.id}
            onValueChange={(v) => {
              onVehicleChange(v);
              setSelected(null);
            }}
          >
            <SelectTrigger className="w-[250px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.vehicle_number} · {v.wheels} wheeler
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex rounded-md border border-input bg-background p-0.5">
            <Button type="button" size="sm" variant={viewMode === "visual" ? "default" : "ghost"} onClick={() => setViewMode("visual")}><LayoutPanelTop className="mr-1.5 h-4 w-4" />Visual</Button>
            <Button type="button" size="sm" variant={viewMode === "list" ? "default" : "ghost"} onClick={() => setViewMode("list")}><List className="mr-1.5 h-4 w-4" />List View</Button>
          </div>
          {viewMode === "visual" && <div className="flex rounded-md border border-input bg-background p-0.5" aria-label="Visual orientation">
            <Button type="button" size="sm" variant={visualOrientation === "vertical" ? "default" : "ghost"} onClick={() => setVisualOrientation("vertical")}>Vertical</Button>
            <Button type="button" size="sm" variant={visualOrientation === "horizontal" ? "default" : "ghost"} onClick={() => setVisualOrientation("horizontal")}>Horizontal</Button>
          </div>}
          <Button
            variant="outline"
            className="bg-background"
            onClick={() => setShowAddVehicle((v) => !v)}
          >
            <Plus className="mr-2 h-4 w-4" /> Add vehicle
          </Button>
        </div>
      </div>
      {showAddVehicle && (
        <Card>
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            <Field label="Vehicle number">
              <Input
                value={newVehicle.vehicle_number}
                placeholder="MH12XX0000"
                onChange={(e) =>
                  setNewVehicle((v) => ({
                    ...v,
                    vehicle_number: e.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Wheel configuration">
              <Select
                value={newVehicle.wheels}
                onValueChange={(v) =>
                  setNewVehicle((f) => ({ ...f, wheels: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WHEEL_CONFIGS.map((w) => (
                    <SelectItem key={w} value={String(w)}>
                      {w} wheeler
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Current odometer">
              <Input
                type="number"
                value={newVehicle.odometer}
                onChange={(e) =>
                  setNewVehicle((v) => ({ ...v, odometer: e.target.value }))
                }
              />
            </Field>
          </div>
          <div className="flex justify-end border-t border-border px-4 py-3">
            <Button
              onClick={addNewVehicle}
              disabled={
                addVehicle.isPending || !newVehicle.vehicle_number.trim()
              }
            >
              Create vehicle
            </Button>
          </div>
        </Card>
      )}
      <div className="flex flex-wrap items-center justify-center gap-8 rounded-xl border border-border/70 bg-card px-5 py-5 text-sm shadow-panel">
        <span className="flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 font-medium text-success dark:bg-emerald-500/15 dark:text-emerald-300">
          <span className="h-3 w-3 rounded-full bg-success" /> Good{" "}
          <span className="font-normal text-muted-foreground">
            (&lt;50k km)
          </span>
        </span>
        <span className="flex items-center gap-2 rounded-full bg-warning/15 px-3 py-1.5 font-medium text-warning-foreground dark:bg-amber-400/15 dark:text-amber-200">
          <span className="h-3 w-3 rounded-full bg-warning" /> Moderate{" "}
          <span className="font-normal text-muted-foreground">(50–80k km)</span>
        </span>
        <span className="flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1.5 font-medium text-destructive dark:bg-rose-500/15 dark:text-rose-300">
          <span className="h-3 w-3 rounded-full bg-destructive" /> Replace{" "}
          <span className="font-normal text-muted-foreground">
            (&gt;80k km)
          </span>
        </span>
      </div>
      {missingCount > 0 && !showAddVehicle && !loadingTyres && !allTyresError && (
        <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <span>
            <strong>{missingCount} positions have no tyre record</strong>
            <br />
            <span className="text-muted-foreground">
              Set company-fitted tyres that came with the truck, without
              creating a purchase or expense.
            </span>
          </span>
          <Button onClick={createPositions} disabled={provision.isPending}>
            <Wand2 className="mr-2 h-4 w-4" /> Set Existing Tyres
          </Button>
        </div>
      )}
      {viewMode === "visual" && visualOrientation === "horizontal" && <div role="region" aria-label="Horizontal truck tyre layout" aria-describedby="horizontal-scroll-instructions" tabIndex={0} className="overflow-x-auto overscroll-x-contain scroll-smooth rounded-xl border border-border bg-card p-4 shadow-panel">
        <p id="horizontal-scroll-instructions" className="mb-2 text-center text-xs font-medium text-muted-foreground">Scroll horizontally to follow the axles from front to rear →</p>
        <div className="mx-auto w-fit" style={{ width: `${Math.max(700, 132 + 260 + Math.max(170, rightAxlesWidth) + 80)}px` }}>
          <div className="mb-2 flex items-center gap-2 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"><span>Front / cab</span><span className="ml-auto">Rear</span></div>
          <div className="relative flex min-h-[350px] items-stretch rounded-xl border border-border bg-muted/35 p-3 dark:bg-slate-900/70">
            <div className="relative z-10 flex w-[132px] shrink-0 items-center justify-center px-1">
              {leftAxles.map(([label, list]) => topDownAxleBlock(label, list))}
            </div>
            <div className="z-20 grid w-[260px] shrink-0 grid-cols-[50px_1fr] items-center gap-5 rounded-lg border border-zinc-300 bg-gradient-to-r from-zinc-200 to-zinc-400 px-5 py-4 shadow-inner dark:border-slate-600 dark:from-slate-700 dark:to-slate-800">
              <div className="flex h-full items-center justify-center border-r border-zinc-500/40"><span className="[writing-mode:vertical-rl] rotate-180 text-xl font-black tracking-[0.22em] text-zinc-700 dark:text-zinc-100">{showAddVehicle ? newVehicle.vehicle_number || "NEW TRUCK" : vehicle.vehicle_number}</span></div>
              <div className="space-y-5 text-center"><Truck className="mx-auto h-14 w-14 text-zinc-700 dark:text-zinc-100" aria-label="truck cab" /><div className="grid grid-cols-2 divide-x divide-zinc-500/50 text-xs"><div><div className="text-zinc-600 dark:text-zinc-200">AXLES</div><strong className="text-xl text-zinc-800 dark:text-white">{displayGroups.length}</strong></div><div><div className="text-zinc-600 dark:text-zinc-200">READING</div><strong className="text-xl text-zinc-800 dark:text-white">{showAddVehicle ? Number(newVehicle.odometer).toLocaleString("en-IN") : Number(vehicle.odometer).toLocaleString("en-IN")} km</strong></div></div></div>
            </div>
            <div className="relative min-w-0 flex-none overflow-visible bg-muted/35 px-4 py-4 dark:bg-slate-900/70" style={{ width: `${Math.max(170, rightAxlesWidth)}px` }}>
              <div className="relative z-10 flex h-full items-center justify-start gap-4">{rightAxles.map(([label, list], index) => topDownAxleBlock(label, list, rightAxleWidths[index]))}</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground"><span>Top = truck RIGHT side</span><span>Bottom = truck LEFT side</span><span>Select a tyre to view details</span></div>
        </div>
      </div>}
      {viewMode === "visual" && visualOrientation === "vertical" && <div ref={verticalScrollRef} role="region" aria-label="Vertical truck tyre layout" aria-describedby="vertical-scroll-instructions" tabIndex={0} className="max-h-[640px] overflow-auto overscroll-contain scroll-smooth rounded-xl border border-border bg-card p-3 shadow-panel sm:p-4">
        <p id="vertical-scroll-instructions" className="sticky top-0 z-30 mb-2 bg-card/95 py-2 text-center text-xs font-medium text-muted-foreground backdrop-blur">Front at top · axle order runs toward the rear ↓ · inner/outer tyres sit across the truck</p>
        <div className="relative mx-auto flex min-w-[1000px] flex-col items-center gap-3 rounded-xl border border-border/70 bg-muted/35 px-6 pb-5 pt-[220px] dark:bg-slate-900/70" style={{ minHeight: `${Math.max(520, 220 + displayGroups.length * 138 + 48)}px` }}>
          <div className="pointer-events-none absolute inset-y-5 left-1/2 z-0 w-[260px] -translate-x-1/2 rounded-2xl border border-zinc-300 bg-gradient-to-b from-zinc-100 via-zinc-200 to-zinc-300 shadow-inner dark:border-slate-600 dark:from-slate-700 dark:via-slate-800 dark:to-slate-700">
            <div className="absolute left-1/2 top-5 flex -translate-x-1/2 flex-col items-center gap-1 text-[10px] font-bold tracking-[0.18em] text-zinc-600 dark:text-zinc-200"><span>FRONT</span><Truck className="h-9 w-9 rotate-[-90deg] text-zinc-700 dark:text-zinc-100" role="img" aria-label="truck cab facing front" /></div>
            <div className="absolute left-1/2 top-[55%] flex h-[142px] w-[390px] -translate-x-1/2 -translate-y-1/2 rotate-90 flex-col justify-center gap-3 bg-transparent px-5 py-3 text-center">
              <div className="truncate text-lg font-black tracking-wide text-zinc-800 dark:text-zinc-100">{showAddVehicle ? newVehicle.vehicle_number || "NEW TRUCK" : vehicle.vehicle_number}</div>
              <div className="grid grid-cols-2 divide-x divide-zinc-400/70 text-xs"><div className="px-2"><div className="font-semibold tracking-wide text-zinc-600 dark:text-zinc-300">AXLES</div><strong className="text-lg text-zinc-900 dark:text-white">{displayGroups.length}</strong></div><div className="px-2"><div className="font-semibold tracking-wide text-zinc-600 dark:text-zinc-300">ODOMETER</div><strong className="whitespace-nowrap text-sm text-zinc-900 dark:text-white">{showAddVehicle ? Number(newVehicle.odometer).toLocaleString("en-IN") : Number(vehicle.odometer).toLocaleString("en-IN")} km</strong></div></div>
            </div>
          </div>
          {leftAxles.map(([label, list]) => verticalAxleBlock(label, list))}
          {rightAxles.map(([label, list]) => verticalAxleBlock(label, list))}
        </div>
      </div>}
      {viewMode === "list" && <Card>
        <div className="border-b border-border px-4 py-3"><h3 className="font-semibold">Tyre List View</h3><p className="mt-0.5 text-xs text-muted-foreground">Maintenance due is highlighted from the latest saved alert for each position.</p></div>
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Position</TableHead><TableHead>Tyre / serial</TableHead><TableHead>Condition</TableHead><TableHead>Current KM</TableHead><TableHead>Last maintenance</TableHead><TableHead>Next service</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>
          {displayGroups.flatMap(([, group]) => group).map((tyre) => {
            const maintenanceRecord = maintenanceByTyre.get(tyre.id); const due = isMaintenanceDue(tyre); const missing = tyre.id.startsWith("missing-");
            return <TableRow key={tyre.id} className={due ? "bg-warning/10" : ""}><TableCell className="font-semibold">{tyre.position_code}</TableCell><TableCell><div>{tyre.brand || "Unbranded"}</div><div className="text-xs text-muted-foreground">{tyre.serial_no || "No serial"}</div></TableCell><TableCell>{missing ? "Not recorded" : tyreConditionLabel(tyre)}</TableCell><TableCell>{missing ? "—" : `${Number(tyre.current_km).toLocaleString("en-IN")} km`}</TableCell><TableCell>{maintenanceRecord ? <><div>{maintenanceRecord.maintenance_type}</div><div className="text-xs text-muted-foreground">{displayDate(maintenanceRecord.entry_date)}</div></> : "No record"}</TableCell><TableCell className={due ? "font-semibold text-warning" : ""}>{maintenanceRecord?.next_alert_date ? displayDate(maintenanceRecord.next_alert_date) : maintenanceRecord?.next_alert_km != null ? `${Number(maintenanceRecord.next_alert_km).toLocaleString("en-IN")} km` : "—"}</TableCell><TableCell><Button variant="outline" size="sm" disabled={tyre.id.startsWith("preview-")} onClick={() => selectTyre(tyre)}>{missing ? "Set tyre" : "Details"}</Button></TableCell></TableRow>;
          })}
        </TableBody></Table></div>
      </Card>}
      {selected && !replacementOpen && (
        <div
          ref={tyreDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tyre-details-title"
          tabIndex={-1}
          aria-label={`Tyre ${selected.position_code} details`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-[520px] rounded-2xl border border-border bg-card p-6 shadow-lift">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 id="tyre-details-title" className="text-2xl font-bold"><span className="sr-only">Tyre </span>{selected.position_code}<span className="sr-only"> details</span></h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected.axle_label || "Truck tyre"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${tyreHealth(Number(selected.current_km)) === "Replace" ? "bg-destructive text-destructive-foreground" : tyreHealth(Number(selected.current_km)) === "Moderate" ? "bg-warning text-warning-foreground" : "bg-success text-success-foreground"}`}
                >
                  {tyreHealth(Number(selected.current_km)) === "Replace"
                    ? "Replace Soon"
                    : tyreHealth(Number(selected.current_km))}
                </span>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </div>
            </div>
            {selected.id.startsWith("missing-") ? (
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  No tyre data available for this wheel position.
                </p>
                <div className="flex justify-end">
                  <Button
                    onClick={setSingleExistingTyre}
                    disabled={setExisting.isPending}
                  >
                    Set Existing Tyre
                  </Button>
                </div>
              </div>
            ) : !editingDetails ? (
              <>
                <div className="mb-4 rounded-lg bg-destructive/10 p-4">
                  <p className="text-xs text-muted-foreground">Tyre Type</p>
                  <p className="mt-1 text-xl font-bold text-destructive">
                    🆕 {selected.tyre_type} Tyre
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatCell
                    label="Installed On"
                    value={displayDate(selected.fitted_on)}
                  />
                  <StatCell
                    label="At KM Reading"
                    value={Number(selected.fitted_km ?? 0).toLocaleString(
                      "en-IN",
                    )}
                  />
                  <StatCell
                    label="Current Vehicle KM"
                    value={Number(vehicle.odometer).toLocaleString("en-IN")}
                  />
                  <StatCell
                    label="Tyre Usage"
                    value={`${Math.max(0, Number(vehicle.odometer) - Number(selected.fitted_km ?? 0)).toLocaleString("en-IN")} km`}
                  />
                  <StatCell
                    label="Cost per km"
                    value={`${inr(costPerKm(Number(selected.cost), Math.max(0, Number(vehicle.odometer) - Number(selected.fitted_km ?? 0))))}/km`}
                  />
                  <div className="sm:col-span-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Installation Cost
                    </p>
                    <p className="mt-1 text-xl font-bold text-primary">
                      {inr(Number(selected.cost))}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <StatCell
                      label="Part / Serial Number"
                      value={selected.serial_no || "—"}
                    />
                  </div>
                </div>
                <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Maintenance history</p>
                    <span className="text-[11px] text-muted-foreground">{selectedHistory.length} event{selectedHistory.length === 1 ? "" : "s"}</span>
                  </div>
                  {selectedHistory.length ? (
                    <div className="mt-2 space-y-2">
                      {selectedHistory.slice(0, 5).map((event) => (
                        <div key={event.id} className="flex items-center justify-between rounded-md bg-card px-2.5 py-2 text-xs">
                          <span className="font-medium capitalize">{event.type}{event.note && <span className="ml-2 font-normal normal-case text-muted-foreground">{event.note}</span>}</span>
                          <span className="flex items-center gap-2 text-muted-foreground">
                            {displayDate(event.date)} · {Number(event.km).toLocaleString("en-IN")} km
                            {event.documentPath && <SignedDocumentLink path={event.documentPath}>Open document</SignedDocumentLink>}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="mt-2 text-xs text-muted-foreground">No maintenance events recorded yet.</p>}
                </div>
                <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setEditingDetails(true)}
                  >
                    Edit Details
                  </Button>
                  <Button onClick={() => setReplacementOpen(true)}>
                    Replace Tyre
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Brand">
                    <Input
                      value={draft.brand}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, brand: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Serial No">
                    <Input
                      value={draft.serial_no}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, serial_no: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Current KM">
                    <Input
                      type="number"
                      value={draft.current_km}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, current_km: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Cost">
                    <Input
                      type="number"
                      value={draft.cost}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, cost: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Remark">
                    <Input
                      value={draft.remark}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, remark: e.target.value }))
                      }
                    />
                  </Field>
                </div>
                <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setEditingDetails(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={saveSelected} disabled={save.isPending}>
                    Save Tyre
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {replacementOpen && selected && (
        <div
          ref={replacementDialogRef}
          role="dialog"
          aria-labelledby="replace-tyre-title"
          aria-modal="true"
          tabIndex={-1}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-[560px] rounded-2xl border border-border bg-card p-6 shadow-lift">
            <div className="mb-5">
              <h3 id="replace-tyre-title" className="text-xl font-bold">Replace Tyre</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {vehicle.vehicle_number} · Position {selected.position_code}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date">
                <Input
                  type="date"
                  value={replacement.event_date}
                  onChange={(e) =>
                    setReplacement((r) => ({
                      ...r,
                      event_date: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="KM Reading">
                <Input
                  type="number"
                  value={replacement.km_reading}
                  onChange={(e) =>
                    setReplacement((r) => ({
                      ...r,
                      km_reading: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Tyre Placement">
                <Input value={`${selected.axle_label || "Axle"} · Position ${selected.position_code}`} disabled />
              </Field>
              <Field label="Tyre Type">
                <Select
                  value={replacement.tyre_type}
                  onValueChange={(v) =>
                    setReplacement((r) => ({ ...r, tyre_type: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Remould">Remould</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tyre Source">
                <Select
                  value={replacement.source}
                  onValueChange={(v) => setReplacement((r) => ({ ...r, source: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Existing">Existing (came with truck)</SelectItem>
                    <SelectItem value="From Warehouse">From Warehouse</SelectItem>
                    <SelectItem value="Direct Purchase">Direct Purchase</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Amount">
                <Input
                  type="number"
                  value={replacement.amount}
                  onChange={(e) =>
                    setReplacement((r) => ({ ...r, amount: e.target.value }))
                  }
                />
              </Field>
              <Field label="Part / Serial Number">
                <Input
                  value={replacement.serial_no}
                  placeholder="Enter part number"
                  onChange={(e) =>
                    setReplacement((r) => ({ ...r, serial_no: e.target.value }))
                  }
                />
              </Field>
              <Field label="Remark">
                <Input
                  value={replacement.remark}
                  placeholder="Enter remark"
                  onChange={(e) =>
                    setReplacement((r) => ({ ...r, remark: e.target.value }))
                  }
                />
              </Field>
              <Field label="Document">
                <Input
                  type="file"
                  className="cursor-pointer text-xs"
                  onChange={(e) => setReplacementDocument(e.target.files?.[0] ?? null)}
                />
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                onClick={() => setReplacementOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={replaceSelected}
                disabled={save.isPending || addEvent.isPending}
              >
                Save Tyre
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TABS = [
  { key: "overview", label: "Fleet Overview", icon: LayoutPanelTop },
  { key: "view", label: "Tyre View", icon: Truck },
  { key: "inventory", label: "Tyre Inventory", icon: Package },
  { key: "fitment", label: "Tyre Fitment", icon: Wrench },
  { key: "maintenance", label: "Tyre Maintenance", icon: ClipboardCheck },
  { key: "teeth", label: "Excavator Teeth", icon: Hammer },
  { key: "services", label: "Services", icon: Cog },
  { key: "audit", label: "Audit Log", icon: History },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function TyreModule() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [focusTyreId, setFocusTyreId] = useState("");
  const currentTab = TABS.find((item) => item.key === tab)!;
  const descriptions: Record<TabKey, string> = {
    overview: "See fleet health, upcoming work, odometer freshness, and recent maintenance spend.",
    view: "Inspect tyre positions, condition, and service status by vehicle.",
    inventory: "Record purchased and returned tyre stock.",
    fitment: "Install tyres on a vehicle and track the wheel position and odometer reading.",
    maintenance: "Log inspections, repairs, costs, documents, and next-service alerts.",
    teeth: "Manage excavator teeth purchases and fitment records.",
    services: "Track vehicle service work and related costs.",
    audit: "Review and filter recorded changes across fleet modules.",
  };

  return (
    <AppShell activeKey={tab} onNavigate={(key) => setTab(key as TabKey)} onSelectVehicle={setSelectedVehicleId}>
      <div className="space-y-4">
        {tab !== "view" && tab !== "maintenance" && tab !== "overview" && (
          <div className="rounded-md bg-card px-5 py-4 shadow-panel">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground">
              {currentTab.label}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {descriptions[tab]}
            </p>
          </div>
        )}

        <nav aria-label="Tyre management modules" className="overflow-x-auto rounded-xl border border-border/70 bg-card p-1.5 shadow-sm">
          <div className="flex min-w-max flex-nowrap gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                aria-current={tab === t.key ? "page" : undefined}
                onClick={() => setTab(t.key)}
                className={`flex shrink-0 items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  tab === t.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
          </div>
        </nav>

        {tab === "view" && <TyreViewSection vehicleId={selectedVehicleId} onVehicleChange={setSelectedVehicleId} focusTyreId={focusTyreId} onFocusHandled={() => setFocusTyreId("")} />}
        {tab === "overview" && <FleetOverview onNavigate={(key) => setTab(key as TabKey)} onSelectVehicle={setSelectedVehicleId} onSelectTyre={(vehicleId, tyreId) => { setSelectedVehicleId(vehicleId); setFocusTyreId(tyreId); }} />}
        {tab === "inventory" && <TyreInventorySection />}
        {tab === "fitment" && <TyreFitmentSection />}
        {tab === "maintenance" && <TyreMaintenanceSection />}
        {tab === "teeth" && <TeethSection />}
        {tab === "services" && <ServicesSection />}
        {tab === "audit" && <AuditLogSection />}
      </div>
    </AppShell>
  );
}
