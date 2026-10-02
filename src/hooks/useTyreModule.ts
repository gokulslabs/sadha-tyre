import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";

export type TyreInventory = Tables<"tyre_inventory">;
export type TyreFitment = Tables<"tyre_fitment">;
export type TeethPurchase = Tables<"teeth_purchase">;
export type TeethFitment = Tables<"teeth_fitment">;
export type ServiceEntry = Tables<"service_entries">;
export type TyreMaintenance = Tables<"tyre_maintenance">;

export function useTyreMaintenance() {
  return useQuery({
    queryKey: ["tyre-maintenance"],
    queryFn: async (): Promise<TyreMaintenance[]> => {
      const { data, error } = await supabase
        .from("tyre_maintenance")
        .select("*")
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddTyreMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: TablesInsert<"tyre_maintenance">) => {
      const { error } = await supabase.rpc("record_tyre_maintenance", { p_record: row as Json });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tyre-maintenance"] });
      qc.invalidateQueries({ queryKey: ["tyre-audit-log"] });
      qc.invalidateQueries({ queryKey: ["tyres"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
}

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tyre-inventory"] }); qc.invalidateQueries({ queryKey: ["tyre-audit-log"] }); },
  });
}

export function useUpdateTyreInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<TyreInventory> & { id: string }) => {
      const { error } = await supabase.from("tyre_inventory").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tyre-inventory"] }); qc.invalidateQueries({ queryKey: ["tyre-audit-log"] }); },
  });
}
export function useDeleteTyreInventory() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from("tyre_inventory").delete().eq("id", id); if (error) throw error; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["tyre-inventory"] }); qc.invalidateQueries({ queryKey: ["tyre-audit-log"] }); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete inventory entry") });
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
      const { data: fitment, error } = await supabase.rpc("record_tyre_fitment", { p_record: row as Json });
      if (error) throw error;
      return fitment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tyre-fitment"] });
      qc.invalidateQueries({ queryKey: ["tyre-audit-log"] });
      qc.invalidateQueries({ queryKey: ["tyres"] });
      qc.invalidateQueries({ queryKey: ["tyre-events"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
}

export function useReplaceTyre() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tyreId, record }: { tyreId: string; record: Json }) => {
      const { data, error } = await supabase.rpc("replace_tyre", { p_tyre_id: tyreId, p_record: record });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tyre-events"] });
      qc.invalidateQueries({ queryKey: ["tyre-audit-log"] });
      qc.invalidateQueries({ queryKey: ["tyres"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
}
export function useDeleteTyreFitment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from("tyre_fitment").delete().eq("id", id); if (error) throw error; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["tyre-fitment"] }); qc.invalidateQueries({ queryKey: ["tyre-audit-log"] }); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete fitment entry") });
}
export function useUpdateTyreFitment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, ...patch }: Partial<TyreFitment> & { id: string }) => { const { error } = await supabase.from("tyre_fitment").update(patch).eq("id", id); if (error) throw error; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["tyre-fitment"] }); qc.invalidateQueries({ queryKey: ["tyre-audit-log"] }); } });
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teeth-purchase"] }); qc.invalidateQueries({ queryKey: ["tyre-audit-log"] }); },
  });
}
export function useDeleteTeethPurchase() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from("teeth_purchase").delete().eq("id", id); if (error) throw error; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["teeth-purchase"] }); qc.invalidateQueries({ queryKey: ["tyre-audit-log"] }); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete teeth purchase") });
}
export function useUpdateTeethPurchase() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, ...patch }: Partial<TeethPurchase> & { id: string }) => { const { error } = await supabase.from("teeth_purchase").update(patch).eq("id", id); if (error) throw error; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["teeth-purchase"] }); qc.invalidateQueries({ queryKey: ["tyre-audit-log"] }); } });
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teeth-fitment"] }); qc.invalidateQueries({ queryKey: ["tyre-audit-log"] }); },
  });
}
export function useDeleteTeethFitment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from("teeth_fitment").delete().eq("id", id); if (error) throw error; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["teeth-fitment"] }); qc.invalidateQueries({ queryKey: ["tyre-audit-log"] }); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete teeth fitment") });
}
export function useUpdateTeethFitment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, ...patch }: Partial<TeethFitment> & { id: string }) => { const { error } = await supabase.from("teeth_fitment").update(patch).eq("id", id); if (error) throw error; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["teeth-fitment"] }); qc.invalidateQueries({ queryKey: ["tyre-audit-log"] }); } });
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
      if (row.vehicle_id && row.to_km != null) {
        const { error: vehicleError } = await supabase.from("vehicles").update({ odometer: row.to_km, odometer_updated_at: new Date().toISOString() }).eq("id", row.vehicle_id).lte("odometer", row.to_km);
        if (vehicleError) throw vehicleError;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["service-entries"] }); qc.invalidateQueries({ queryKey: ["tyre-audit-log"] }); qc.invalidateQueries({ queryKey: ["vehicles"] }); },
  });
}
export function useDeleteServiceEntry() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from("service_entries").delete().eq("id", id); if (error) throw error; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["service-entries"] }); qc.invalidateQueries({ queryKey: ["tyre-audit-log"] }); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete service entry") });
}
export function useUpdateServiceEntry() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, ...patch }: Partial<ServiceEntry> & { id: string }) => { const { error } = await supabase.from("service_entries").update(patch).eq("id", id); if (error) throw error; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["service-entries"] }); qc.invalidateQueries({ queryKey: ["tyre-audit-log"] }); } });
}

/* ---------------- Audit Log ---------------- */
export type TyreAuditLog = Tables<"tyre_audit_log">;

export const AUDIT_TABLE_LABELS: Record<string, string> = {
  tyre_inventory: "Tyre Inventory",
  tyre_fitment: "Tyre Fitment",
  tyre_maintenance: "Tyre Maintenance",
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
