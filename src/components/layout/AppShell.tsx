import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ClipboardCheck, Cog, Hammer, History, LayoutPanelTop, Menu, Moon, Package, Search, Sun, Truck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useVehicles } from "@/hooks/useTyres";

export function AppShell({ children, onNavigate, onSelectVehicle, activeKey }: { children: ReactNode; onNavigate?: (key: string) => void; onSelectVehicle?: (vehicleId: string) => void; activeKey?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [profile, setProfile] = useState({ name: "Account", email: "" });
  const [profileOpen, setProfileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem("sadha-theme") === "dark"; } catch { return false; }
  });
  const sidebarTriggerRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!sidebarOpen) return;
    const trigger = sidebarTriggerRef.current;
    const sidebar = sidebarRef.current;
    const first = sidebar?.querySelector<HTMLElement>("button:not([disabled])");
    first?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); setSidebarOpen(false); return; }
      if (event.key !== "Tab" || !sidebar) return;
      const controls = Array.from(sidebar.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled])'));
      if (!controls.length) return;
      const firstControl = controls[0]; const lastControl = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === firstControl) { event.preventDefault(); lastControl.focus(); }
      else if (!event.shiftKey && document.activeElement === lastControl) { event.preventDefault(); firstControl.focus(); }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("keydown", handleKeyDown); trigger?.focus(); };
  }, [sidebarOpen]);
  const { data: vehicles = [], isError: vehiclesError } = useVehicles();
  const profileRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!profileOpen) return;
    function handleProfileKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileOpen(false);
        profileTriggerRef.current?.focus();
      }
    }
    function handlePointerDown(event: PointerEvent) {
      if (!profileRef.current?.contains(event.target as Node) && !profileTriggerRef.current?.contains(event.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("keydown", handleProfileKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleProfileKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [profileOpen]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    try { localStorage.setItem("sadha-theme", darkMode ? "dark" : "light"); } catch { /* storage may be unavailable */ }
  }, [darkMode]);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (user?.email) setProfile({ name: user.user_metadata?.full_name || user.email.split("@")[0], email: user.email });
    }).catch(() => { /* anonymous demo mode has no user */ });
  }, []);
  const menuItems = [
    ["overview", "Fleet Overview"],
    ["view", "Tyre View"],
    ["inventory", "Tyre Inventory"],
    ["fitment", "Tyre Fitment"],
    ["maintenance", "Tyre Maintenance"],
    ["teeth", "Excavator Teeth"],
    ["services", "Services"],
    ["audit", "Audit Log"],
  ] as const;
  const menuIcons = { overview: LayoutPanelTop, view: Truck, inventory: Package, fitment: Wrench, maintenance: ClipboardCheck, teeth: Hammer, services: Cog, audit: History };
  const searchResults = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    if (!needle) return { menus: [], vehicles: [] };
    return {
      menus: menuItems.filter(([, label]) => label.toLocaleLowerCase().includes(needle)),
      vehicles: vehicles.filter((vehicle) => vehicle.vehicle_number.toLocaleLowerCase().includes(needle)).slice(0, 6),
    };
  }, [search, vehicles]);
  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-border/70 bg-card/95 px-4 shadow-sm backdrop-blur md:px-6">
        <button ref={sidebarTriggerRef} type="button" aria-label="Open Sidebar Menu" aria-expanded={sidebarOpen} aria-controls="maintenance-sidebar" onClick={() => setSidebarOpen(true)} className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 border-r border-border pr-4">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-700 text-white"><Truck className="h-4 w-4" /></span>
          <span className="hidden text-sm font-semibold tracking-tight text-foreground sm:inline">SADHA</span>
        </div>
        <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
          <div className="relative flex h-9 w-[280px] items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground">
            <Search className="h-4 w-4" /><input aria-label="Search vehicles and modules" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setSearch(""); }} placeholder="Search vehicles or modules" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
            {search.trim() && <div className="absolute left-0 right-0 top-10 z-50 max-h-80 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg" role="region" aria-label="Search results">
              {searchResults.menus.length > 0 && <><p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Modules</p>{searchResults.menus.map(([key, label]) => <button key={key} type="button" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { onNavigate?.(key); setSearch(""); }}>{label}</button>)}</>}
              {searchResults.vehicles.length > 0 && <><p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Vehicles</p>{searchResults.vehicles.map((vehicle) => <button key={vehicle.id} type="button" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { onNavigate?.("view"); onSelectVehicle?.(vehicle.id); setSearch(""); }}>{vehicle.vehicle_number} <span className="text-xs text-muted-foreground">· {vehicle.wheels} wheeler</span></button>)}</>}
              {searchResults.menus.length === 0 && searchResults.vehicles.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">{vehiclesError ? "Vehicle search is unavailable. Check your connection and try again." : "No matching vehicles or modules"}</p>}
            </div>}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={() => onNavigate?.("fitment")} className="hidden bg-blue-700 hover:bg-blue-800 sm:inline-flex"><Truck className="h-4 w-4" /> Record Fitment</Button>
          <button type="button" aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"} title={darkMode ? "Light mode" : "Dark mode"} onClick={() => setDarkMode((v) => !v)} className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground">{darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>
          <button ref={profileTriggerRef} type="button" aria-label={profile.email ? `Account: ${profile.email}` : "Account menu"} aria-expanded={profileOpen} aria-controls="account-menu" title={profile.email || "Account"} onClick={() => setProfileOpen((v) => !v)} className="hidden h-8 w-8 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 sm:grid">{profile.name.slice(0, 2).toUpperCase()}</button>
        </div>
      </header>
      {profileOpen && <div ref={profileRef} id="account-menu" role="dialog" aria-label="Account details" className="fixed right-4 top-[62px] z-50 w-72 rounded-xl border border-border bg-card p-4 shadow-xl"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Signed in</p><p className="mt-1 font-semibold">{profile.name}</p><p className="text-sm text-muted-foreground">{profile.email}</p><div className="mt-4"><Button size="sm" variant="outline" onClick={async () => { try { const { error } = await supabase.auth.signOut(); if (error) throw error; setProfileOpen(false); toast.success("Signed out"); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not sign out"); } }}>Sign out</Button></div></div>}
      {sidebarOpen && (
        <>
          <button type="button" aria-label="Close Sidebar Menu" className="fixed inset-0 z-40 bg-slate-950/25" onClick={() => setSidebarOpen(false)} />
          <aside ref={sidebarRef} id="maintenance-sidebar" role="dialog" aria-modal="true" aria-label="Maintenance navigation" tabIndex={-1} className="fixed inset-y-0 left-0 z-50 w-[280px] border-r border-border bg-card p-5 shadow-xl">
            <div className="mb-7 flex items-center justify-between"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-700 text-white"><Truck className="h-4 w-4" /></span><span className="text-sm font-semibold">SADHA</span></div><button type="button" aria-label="Close Sidebar Menu" className="rounded-md p-2 text-muted-foreground hover:bg-muted" onClick={() => setSidebarOpen(false)}>×</button></div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Maintenance</p>
            <nav className="space-y-1">{menuItems.map(([key, label]) => { const Icon = menuIcons[key]; return <button key={key} type="button" onClick={() => { onNavigate?.(key); setSidebarOpen(false); }} aria-current={activeKey === key ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm ${activeKey === key ? "bg-blue-50 font-medium text-blue-800 dark:bg-blue-950/50 dark:text-blue-200" : "text-muted-foreground hover:bg-muted"}`}><Icon className="h-4 w-4" /> {label}</button>; })}</nav>
          </aside>
        </>
      )}
      <div className="mx-auto max-w-[1600px] p-3 md:p-4 lg:p-5">{children}</div>
    </main>
  );
}
