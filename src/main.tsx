import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthGate } from "./components/AuthGate";
import "./styles.css";

const TyreModule = React.lazy(() => import("./TyreModule").then((module) => ({ default: module.TyreModule })));

class AppErrorBoundary extends React.Component<React.PropsWithChildren, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return <div className="grid min-h-screen place-items-center bg-background p-6"><div className="max-w-lg rounded-2xl border border-destructive/30 bg-card p-6 text-center shadow-lift"><h1 className="text-xl font-bold">Sadha could not load</h1><p className="mt-2 text-sm text-muted-foreground">{this.state.error.message}</p><button className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={() => window.location.reload()}>Reload app</button></div></div>;
    return this.props.children;
  }
}

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthGate><AppErrorBoundary><Suspense fallback={<div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Loading Sadha…</div>}><TyreModule /></Suspense></AppErrorBoundary></AuthGate>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  </React.StrictMode>,
);
