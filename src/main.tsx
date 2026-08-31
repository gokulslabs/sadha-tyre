import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthGate } from "./components/AuthGate";
import "./styles.css";

const TyreModule = React.lazy(() => import("./TyreModule").then((module) => ({ default: module.TyreModule })));

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthGate><Suspense fallback={<div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Loading Sadha…</div>}><TyreModule /></Suspense></AuthGate>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  </React.StrictMode>,
);
