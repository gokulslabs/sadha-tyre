import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TyreModule } from "./TyreModule";
import { AuthGate } from "./components/AuthGate";
import "./styles.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthGate><TyreModule /></AuthGate>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  </React.StrictMode>,
);
