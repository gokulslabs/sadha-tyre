import { useEffect, useState, type ReactNode } from "react";
import { Bell, Menu, MessageCircle, Moon, Search, Settings, Sun, Truck, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppShell({ children, onNavigate, activeKey }: { children: ReactNode; onNavigate?: (key: string) => void; activeKey?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem("sadha-theme") === "dark"; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    try { localStorage.setItem("sadha-theme", darkMode ? "dark" : "light"); } catch { /* storage may be unavailable */ }
  }, [darkMode]);
  const menuItems = [
    ["view", "Tyre View"],
    ["inventory", "Tyre Inventory"],
    ["fitment", "Tyre Fitment"],
    ["teeth", "Excavator Teeth"],
    ["services", "Services"],
    ["audit", "Audit Log"],
  ] as const;
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,oklch(0.98_0.008_255)_0%,var(--background)_32%)]">
      <header className="sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-border/70 bg-card/95 px-4 shadow-sm backdrop-blur md:px-6">
        <button type="button" aria-label="Open Sidebar Menu" onClick={() => setSidebarOpen(true)} className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 border-r border-border pr-4">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-700 text-white"><Truck className="h-4 w-4" /></span>
          <span className="hidden text-sm font-semibold tracking-tight text-foreground sm:inline">SADHA</span>
        </div>
        <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
          <div className="relative flex h-9 w-[280px] items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground">
            <Search className="h-4 w-4" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vehicle or menu items" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
            {search && <div className="absolute left-0 right-0 top-10 z-50 rounded-md border border-border bg-card p-1 shadow-lg">{menuItems.filter(([, label]) => label.toLowerCase().includes(search.toLowerCase())).map(([key, label]) => <button key={key} type="button" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { onNavigate?.(key); setSearch(""); }}>{label}</button>)}{menuItems.every(([, label]) => !label.toLowerCase().includes(search.toLowerCase())) && <p className="px-3 py-2 text-xs text-muted-foreground">No matching menu item</p>}</div>}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold sm:flex"><WalletCards className="h-4 w-4 text-blue-700" /> ₹0.00</div>
          <Button size="sm" className="hidden bg-blue-700 hover:bg-blue-800 sm:inline-flex"><Truck className="h-4 w-4" /> Add Trip</Button>
          <button type="button" aria-label="Notification" className="relative rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"><Bell className="h-5 w-5" /><span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">0</span></button>
          <button type="button" aria-label="Settings" className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"><Settings className="h-5 w-5" /></button>
          <button type="button" aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"} title={darkMode ? "Light mode" : "Dark mode"} onClick={() => setDarkMode((v) => !v)} className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground">{darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>
          <button type="button" aria-label="John Doe" className="hidden h-8 w-8 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 sm:grid">JD</button>
        </div>
      </header>
      {sidebarOpen && (
        <>
          <button type="button" aria-label="Close Sidebar Menu" className="fixed inset-0 z-40 bg-slate-950/25" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-[280px] border-r border-border bg-card p-5 shadow-xl">
            <div className="mb-7 flex items-center justify-between"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-700 text-white"><Truck className="h-4 w-4" /></span><span className="text-sm font-semibold">SADHA</span></div><button type="button" aria-label="Close Sidebar Menu" className="rounded-md p-2 text-muted-foreground hover:bg-muted" onClick={() => setSidebarOpen(false)}>×</button></div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Maintenance</p>
            <nav className="space-y-1">{menuItems.map(([key, label]) => <a key={key} href={`#${key}`} onClick={(e) => { e.preventDefault(); onNavigate?.(key); setSidebarOpen(false); }} className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ${activeKey === key ? "bg-blue-50 font-medium text-blue-800 dark:bg-blue-950/50 dark:text-blue-200" : "text-muted-foreground hover:bg-muted"}`}><Truck className="h-4 w-4" /> {label}</a>)}</nav>
          </aside>
        </>
      )}
      <div className="mx-auto max-w-[1600px] p-3 md:p-4 lg:p-5">{children}</div>
      {chatOpen && <div className="fixed bottom-24 right-5 z-40 w-[280px] rounded-xl border border-border bg-card p-4 shadow-xl"><div className="flex items-center justify-between"><p className="font-semibold">Support</p><button type="button" aria-label="Close support chat" className="text-muted-foreground hover:text-foreground" onClick={() => setChatOpen(false)}>×</button></div><p className="mt-2 text-sm text-muted-foreground">How can we help with your tyre records?</p><div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Support chat is ready.</div></div>}
      <button type="button" aria-label="Toggle support chat" onClick={() => setChatOpen((v) => !v)} className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-blue-700 text-white shadow-lg transition hover:bg-blue-800"><MessageCircle className="h-6 w-6" /></button>
    </main>
  );
}
