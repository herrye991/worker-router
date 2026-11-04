import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles.css";
import { Layout } from "./components/Layout";
import { OverviewPage } from "./pages/Overview";
import { EndpointPage } from "./pages/Endpoint";
import { ProvidersPage } from "./pages/Providers";
import { ModelsPage } from "./pages/Models";
import { CombosPage } from "./pages/Combos";
import { UsagePage } from "./pages/Usage";
import { LogsPage } from "./pages/Logs";
import { SettingsPage } from "./pages/Settings";
import { LoginPage } from "./pages/Login";

const qc = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/endpoint" element={<EndpointPage />} />
            <Route path="/providers" element={<ProvidersPage />} />
            <Route path="/models" element={<ModelsPage />} />
            <Route path="/combos" element={<CombosPage />} />
            <Route path="/usage" element={<UsagePage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
