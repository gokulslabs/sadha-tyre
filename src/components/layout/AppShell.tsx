import type { ReactNode } from "react";
import { Bell, Menu, Search, Settings, Truck, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,oklch(0.98_0.008_255)_0%,var(--background)_32%)]">
      <header className="sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-border/70 bg-card/95 px-4 shadow-sm backdrop-blur md:px-6">
        <button type="button" aria-label="Open Sidebar Menu" className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 border-r border-border pr-4">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white"><Truck className="h-4 w-4" /></span>
          <span className="hidden text-sm font-semibold tracking-tight text-foreground sm:inline">SADHA TYRE MANAGEMENT</span>
        </div>
        <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
          <div className="flex h-9 w-[280px] items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground">
            <Search className="h-4 w-4" /><span>Search vehicle or menu items</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold sm:flex"><WalletCards className="h-4 w-4 text-indigo-600" /> ₹0.00</div>
          <Button size="sm" className="hidden bg-indigo-600 hover:bg-indigo-700 sm:inline-flex"><Truck className="h-4 w-4" /> Add Trip</Button>
          <button type="button" aria-label="Notification" className="relative rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"><Bell className="h-5 w-5" /><span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">0</span></button>
          <button type="button" aria-label="Settings" className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"><Settings className="h-5 w-5" /></button>
        </div>
      </header>
      <div className="mx-auto max-w-[1600px] p-3 md:p-4 lg:p-5">{children}</div>
    </main>
  );
}
