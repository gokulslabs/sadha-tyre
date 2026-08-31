import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type TyreInventory = Tables<"tyre_inventory">;
export type TyreFitment = Tables<"tyre_fitment">;
export type TeethPurchase = Tables<"teeth_purchase">;
export type TeethFitment = Tables<"teeth_fitment">;
export type ServiceEntry = Tables<"service_entries">;

export const TYRE_ENTRY_TYPES = ["new", "mines", "retrading"] as const;
export const OLD_TYRE_STATUSES = ["NEW", "BURST", "PUNCHAR", "CLAIM", "RETRADING"] as const;
export const STORAGE_PLACES = [
  "1.CONTAINER",
  "2.NEW OFFICE-MUSIRI",
  "3.MAIN OFFICE STORE ROOM",
] as const;

/* ---------------- Tyre Inventory ---------------- */
export function useTyreInventory() {
  return useQuery({
    queryKey: ["tyre-inventory"],
    queryFn: async (): Promise<TyreInventory[]> => {
      const { data, error } = await supabase
        .from("tyre_inventory")
        .select("*")
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddTyreInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: TablesInsert<"tyre_inventory">) => {
      const { error } = await supabase.from("tyre_inventory").insert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tyre-inventory"] }),
  });
}

export function useUpdateTyreInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<TyreInventory> & { id: string }) => {
      const { error } = await supabase.from("tyre_inventory").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tyre-inventory"] }),
  });
}

/* ---------------- Tyre Fitment ---------------- */
export function useTyreFitment() {
  return useQuery({
    queryKey: ["tyre-fitment"],
    queryFn: async (): Promise<TyreFitment[]> => {
      const { data, error } = await supabase
        .from("tyre_fitment")
        .select("*")
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddTyreFitment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: TablesInsert<"tyre_fitment">) => {
      const { data: fitment, error } = await supabase
        .from("tyre_fitment")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      const position = row.tyre_place?.trim().toUpperCase() ?? "";
      if (row.vehicle_id && /^\d+(R|L|RI|RO|LI|LO)$/.test(position)) {
        const { data: tyre, error: tyreError } = await supabase
          .from("tyres")
          .upsert(
            {
              vehicle_id: row.vehicle_id,
              position_code: position,
              axle_label: `AXLE ${parseInt(position, 10)}`,
              brand: row.brand ?? null,
              serial_no: row.tyre_no ?? null,
              current_km: 0,
              fitted_km: row.km ?? 0,
              fitted_on: row.entry_date ?? null,
              tyre_type: "New",
              status: "running",
              remark: row.remarks ?? null,
            },
            { onConflict: "vehicle_id,position_code" },
          )
          .select("id")
          .single();
        if (tyreError) throw tyreError;
        const { error: eventError } = await supabase.from("tyre_events").insert({
          tyre_id: tyre.id,
          event_date: row.entry_date ?? new Date().toISOString().slice(0, 10),
          event_type: "fitted",
          km_reading: row.km ?? 0,
          cost: 0,
          note: "Fitment recorded",
        });
        if (eventError) throw eventError;
      }
      return fitment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tyre-fitment"] });
      qc.invalidateQueries({ queryKey: ["tyres"] });
      qc.invalidateQueries({ queryKey: ["tyre-events"] });
    },
  });
}

/* ---------------- Teeth Purchase ---------------- */
export function useTeethPurchase() {
  return useQuery({
    queryKey: ["teeth-purchase"],
    queryFn: async (): Promise<TeethPurchase[]> => {
      const { data, error } = await supabase
        .from("teeth_purchase")
        .select("*")
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddTeethPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: TablesInsert<"teeth_purchase">) => {
      const { error } = await supabase.from("teeth_purchase").insert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teeth-purchase"] }),
  });
}

/* ---------------- Teeth Fitment ---------------- */
export function useTeethFitment() {
  return useQuery({
    queryKey: ["teeth-fitment"],
    queryFn: async (): Promise<TeethFitment[]> => {
      const { data, error } = await supabase
        .from("teeth_fitment")
        .select("*")
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddTeethFitment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: TablesInsert<"teeth_fitment">) => {
      const { error } = await supabase.from("teeth_fitment").insert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teeth-fitment"] }),
  });
}

/* ---------------- Service Entries ---------------- */
export function useServiceEntries() {
  return useQuery({
    queryKey: ["service-entries"],
    queryFn: async (): Promise<ServiceEntry[]> => {
      const { data, error } = await supabase
        .from("service_entries")
        .select("*")
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddServiceEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: TablesInsert<"service_entries">) => {
      const { error } = await supabase.from("service_entries").insert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["service-entries"] }),
  });
}

/* ---------------- Audit Log ---------------- */
export type TyreAuditLog = Tables<"tyre_audit_log">;

export const AUDIT_TABLE_LABELS: Record<string, string> = {
  tyre_inventory: "Tyre Inventory",
  tyre_fitment: "Tyre Fitment",
  teeth_purchase: "Teeth Purchase",
  teeth_fitment: "Teeth Fitment",
  service_entries: "Services",
  tyres: "Tyre Position",
  tyre_events: "Tyre Event",
  vehicles: "Vehicle",
};

export function useTyreAuditLog() {
  return useQuery({
    queryKey: ["tyre-audit-log"],
    queryFn: async (): Promise<TyreAuditLog[]> => {
      const { data, error } = await supabase
        .from("tyre_audit_log")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}
