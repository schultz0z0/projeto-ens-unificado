import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import UserManagement from "./pages/admin/UserManagement";
import ValidatedWorks from "./pages/manager/ValidatedWorks";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { marketingOpsFlags } from "./lib/marketingOps/flags";

const queryClient = new QueryClient();
const CampaignListPage = lazy(() => import("./pages/marketing-ops/CampaignListPage"));
const marketingOps = marketingOpsFlags(import.meta.env);

const CampaignRouteLoading = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-text-secondary">
    <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-primary" />
    Carregando campanhas
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requireAdmin>
                  <UserManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="/manager/validated-works"
              element={
                <ProtectedRoute requireManager>
                  <ValidatedWorks />
                </ProtectedRoute>
              }
            />

            {marketingOps.read ? (
              <Route
                path="/marketing-ops/campaigns"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<CampaignRouteLoading />}>
                      <CampaignListPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
            ) : null}

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
