import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import PipelinePage from "@/pages/PipelinePage";
import LeadsPage from "@/pages/LeadsPage";
import HojePage from "@/pages/HojePage";
import DashboardPage from "@/pages/DashboardPage";
import ConfiguracoesPage from "@/pages/ConfiguracoesPage";
import ImportLeadsPage from "@/pages/ImportLeadsPage";
import MetaAdsConfigPage from "@/pages/MetaAdsConfigPage";
import FunnelCampaignsPage from "@/pages/FunnelCampaignsPage";
import UsersPage from "@/pages/UsersPage";
import CamposPage from "@/pages/CamposPage";
import WebhookPage from "@/pages/configuracoes/WebhookPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AuthenticatedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/pipeline" replace />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/hoje" element={<HojePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/configuracoes" element={<ConfiguracoesPage />} />
        <Route path="/configuracoes/importar" element={<ImportLeadsPage />} />
        <Route path="/configuracoes/meta-ads" element={<MetaAdsConfigPage />} />
        <Route path="/configuracoes/vincular-campanhas" element={<FunnelCampaignsPage />} />
        <Route path="/configuracoes/webhook" element={<WebhookPage />} />
        <Route path="/configuracoes/usuarios" element={<UsersPage />} />
        <Route path="/configuracoes/campos" element={<CamposPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthenticatedRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
