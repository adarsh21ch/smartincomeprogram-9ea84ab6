import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import FunnelsPage from "./pages/FunnelsPage";
import FunnelEditor from "./pages/FunnelEditor";
import FunnelDetail from "./pages/FunnelDetail";
import PublicFunnel from "./pages/PublicFunnel";
import LandingPagesPage from "./pages/LandingPagesPage";
import LandingPageEditor from "./pages/LandingPageEditor";
import LandingPageDetail from "./pages/LandingPageDetail";
import PublicLandingPage from "./pages/PublicLandingPage";
import VideosPage from "./pages/VideosPage";
import PublicVideoPage from "./pages/PublicVideoPage";
import LeadsPage from "./pages/LeadsPage";
import PaymentsPage from "./pages/PaymentsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ProfilePage from "./pages/ProfilePage";
import KYCPage from "./pages/KYCPage";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage from "./pages/SettingsPage";
import BillingPage from "./pages/BillingPage";
import LivePage from "./pages/LivePage";
import LiveDetailPage from "./pages/LiveDetailPage";
import PublicLivePage from "./pages/PublicLivePage";
import PricingFullPage from "./pages/PricingFullPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminVideosPage from "./pages/AdminVideosPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminKYCPage from "./pages/AdminKYCPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import AdminInviteCodesPage from "./pages/AdminInviteCodesPage";
import AdminLandingPageManager from "./pages/AdminLandingPageManager";
import AdminProgramPage from "./pages/AdminProgramPage";
import NotFound from "./pages/NotFound";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import FeaturesPage from "./pages/FeaturesPage";
import FAQPage from "./pages/FAQPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import RefundPolicyPage from "./pages/RefundPolicyPage";
import InstallApp from "./pages/InstallApp";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <Routes>
              {/* Public */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/auth/reset-password" element={<ResetPassword />} />
              <Route path="/pricing" element={<PricingFullPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/refund-policy" element={<RefundPolicyPage />} />
              <Route path="/install" element={<InstallApp />} />
              <Route path="/f/:slug" element={<PublicFunnel />} />
              <Route path="/l/:slug" element={<PublicLandingPage />} />
              <Route path="/video/:id" element={<PublicVideoPage />} />
              <Route path="/s/:slug" element={<PublicLivePage />} />

              {/* Auth Required */}
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/funnels" element={<ProtectedRoute><FunnelsPage /></ProtectedRoute>} />
              <Route path="/landing-pages" element={<ProtectedRoute><LandingPagesPage /></ProtectedRoute>} />
              <Route path="/landing-pages/create" element={<ProtectedRoute><LandingPageEditor /></ProtectedRoute>} />
              <Route path="/landing-pages/:id" element={<ProtectedRoute><LandingPageDetail /></ProtectedRoute>} />
              <Route path="/landing-pages/:id/edit" element={<ProtectedRoute><LandingPageEditor /></ProtectedRoute>} />
              <Route path="/funnels/create" element={<ProtectedRoute><FunnelEditor /></ProtectedRoute>} />
              <Route path="/funnels/:id" element={<ProtectedRoute><FunnelDetail /></ProtectedRoute>} />
              <Route path="/funnels/:id/edit" element={<ProtectedRoute><FunnelEditor /></ProtectedRoute>} />
              <Route path="/videos" element={<ProtectedRoute><VideosPage /></ProtectedRoute>} />
              <Route path="/leads" element={<ProtectedRoute><LeadsPage /></ProtectedRoute>} />
              <Route path="/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
              <Route path="/live" element={<ProtectedRoute><LivePage /></ProtectedRoute>} />
              <Route path="/live/:id" element={<ProtectedRoute><LiveDetailPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/kyc" element={<ProtectedRoute><KYCPage /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
              <Route path="/upgrade" element={<ProtectedRoute><PricingFullPage /></ProtectedRoute>} />

              {/* Admin */}
              <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/admin/videos" element={<AdminRoute><AdminVideosPage /></AdminRoute>} />
              <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
              <Route path="/admin/kyc" element={<AdminRoute><AdminKYCPage /></AdminRoute>} />
              <Route path="/admin/invite-codes" element={<AdminRoute><AdminInviteCodesPage /></AdminRoute>} />
              <Route path="/admin/landing-page" element={<AdminRoute><AdminLandingPageManager /></AdminRoute>} />
              <Route path="/admin/settings" element={<AdminRoute><AdminSettingsPage /></AdminRoute>} />
              <Route path="/admin/program" element={<AdminRoute><AdminProgramPage /></AdminRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
