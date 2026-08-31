import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,oklch(0.98_0.008_255)_0%,var(--background)_32%)] p-3 md:p-4 lg:p-5">
      <div className="mx-auto max-w-[1600px]">{children}</div>
    </main>
  );
}
