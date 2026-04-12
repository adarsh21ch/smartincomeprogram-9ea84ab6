import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { MemberRoute } from "@/components/auth/MemberRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import ResetPassword from "./pages/ResetPassword";
import MemberHome from "./pages/MemberHome";
// MemberProfile is now integrated into MemberHome profile tab
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
// PaymentsPage removed - no payment gateway
import AnalyticsPage from "./pages/AnalyticsPage";
import ProfilePage from "./pages/ProfilePage";
import KYCPage from "./pages/KYCPage";
import SettingsPage from "./pages/SettingsPage";
// BillingPage removed - no payment gateway
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
import SubAdminAccessPage from "./pages/SubAdminAccessPage";

/** Redirects old paths like /funnels/:id/edit → /admin/funnels/:id/edit */
const LegacyRedirect = ({ prefix }: { prefix: string }) => {
  const location = useLocation();
  // Extract the wildcard part after the matched path segment
  const segments = location.pathname.split("/").filter(Boolean);
  const rest = segments.slice(1).join("/"); // drop the first segment (e.g. "funnels")
  const target = rest ? `${prefix}/${rest}` : prefix;
  return <Navigate to={target + location.search + location.hash} replace />;
};

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

              {/* Member Routes */}
              <Route path="/home" element={<MemberRoute><MemberHome tab="about" /></MemberRoute>} />
              <Route path="/home/program" element={<MemberRoute><MemberHome tab="program" /></MemberRoute>} />
              <Route path="/home/courses" element={<MemberRoute><MemberHome tab="courses" /></MemberRoute>} />
              <Route path="/home/profile" element={<MemberRoute><MemberHome tab="profile" /></MemberRoute>} />
              <Route path="/home/manage-access" element={<MemberRoute><SubAdminAccessPage /></MemberRoute>} />
              <Route path="/profile" element={<Navigate to="/home/profile" replace />} />

              {/* Legacy redirects — preserve sub-paths */}
              <Route path="/dashboard" element={<Navigate to="/home" replace />} />
              <Route path="/funnels/*" element={<LegacyRedirect prefix="/admin/funnels" />} />
              <Route path="/landing-pages/*" element={<LegacyRedirect prefix="/admin/landing-pages" />} />
              <Route path="/videos/*" element={<LegacyRedirect prefix="/admin/videos" />} />
              <Route path="/leads/*" element={<LegacyRedirect prefix="/admin/leads" />} />
              <Route path="/payments" element={<Navigate to="/home" replace />} />
              <Route path="/analytics/*" element={<LegacyRedirect prefix="/admin/analytics" />} />
              <Route path="/live/*" element={<LegacyRedirect prefix="/admin/live" />} />

              {/* Admin Routes */}
              <Route path="/admin" element={<AdminRoute><Navigate to="/admin/dashboard" replace /></AdminRoute>} />
              <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/admin/funnels" element={<AdminRoute><FunnelsPage /></AdminRoute>} />
              <Route path="/admin/funnels/create" element={<AdminRoute><FunnelEditor /></AdminRoute>} />
              <Route path="/admin/funnels/:id" element={<AdminRoute><FunnelDetail /></AdminRoute>} />
              <Route path="/admin/funnels/:id/edit" element={<AdminRoute><FunnelEditor /></AdminRoute>} />
              <Route path="/admin/landing-pages" element={<AdminRoute><LandingPagesPage /></AdminRoute>} />
              <Route path="/admin/landing-pages/create" element={<AdminRoute><LandingPageEditor /></AdminRoute>} />
              <Route path="/admin/landing-pages/:id" element={<AdminRoute><LandingPageDetail /></AdminRoute>} />
              <Route path="/admin/landing-pages/:id/edit" element={<AdminRoute><LandingPageEditor /></AdminRoute>} />
              <Route path="/admin/live" element={<AdminRoute><LivePage /></AdminRoute>} />
              <Route path="/admin/live/:id" element={<AdminRoute><LiveDetailPage /></AdminRoute>} />
              <Route path="/admin/videos" element={<AdminRoute><AdminVideosPage /></AdminRoute>} />
              <Route path="/admin/leads" element={<AdminRoute><LeadsPage /></AdminRoute>} />
              {/* Payments route removed - no payment gateway */}
              <Route path="/admin/analytics" element={<AdminRoute><AnalyticsPage /></AdminRoute>} />
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
