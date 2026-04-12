import { Link, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "@/components/landing/Logo";
import {
  LayoutDashboard, Layers, Video, Users, IndianRupee, BarChart3,
  User, LogOut, ChevronLeft, ChevronRight,
  Shield, Sun, Moon, Radio, FileCheck,
  FileText, Menu, Settings, Ticket, UserCheck, Cog, Eye,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import {
  Sheet, SheetContent, SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin/dashboard" },
  { icon: Settings, label: "Program", path: "/admin/program" },
  { icon: Layers, label: "Funnels", path: "/admin/funnels" },
  { icon: FileText, label: "Landing Pages", path: "/admin/landing-pages" },
  { icon: Radio, label: "Live", path: "/admin/live" },
  { icon: Video, label: "Videos", path: "/admin/videos" },
  { icon: Users, label: "Leads", path: "/admin/leads" },
  { icon: BarChart3, label: "Analytics", path: "/admin/analytics" },
];

const adminItems = [
  { icon: Users, label: "Users", path: "/admin/users" },
  { icon: UserCheck, label: "KYC", path: "/admin/kyc" },
  { icon: Ticket, label: "Invite Codes", path: "/admin/invite-codes" },
  { icon: Cog, label: "Settings", path: "/admin/settings" },
];

const bottomItems = [
  { icon: User, label: "Profile", path: "/profile" },
  { icon: Eye, label: "View as Member", path: "/home" },
];

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const renderNavItem = (item: typeof navItems[0]) => {
    const active = location.pathname.startsWith(item.path);
    return (
      <Link key={item.path} to={item.path}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
          active ? "bg-primary/10 text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}>
        <item.icon size={18} />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  };

  const renderMobileNavItem = (item: typeof navItems[0]) => {
    const active = location.pathname.startsWith(item.path);
    return (
      <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
          active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
        )}>
        <item.icon size={18} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className={cn("hidden md:flex flex-col border-r border-border bg-sidebar transition-all duration-200 sticky top-0 h-screen", collapsed ? "w-16" : "w-60")}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-border shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-primary" />
              <span className="font-heading font-bold text-sm text-foreground">Admin Panel</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors">
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={() => setCollapsed(!collapsed)} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors">
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {!collapsed && <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Main</p>}
          {navItems.map(renderNavItem)}

          {!collapsed && <p className="px-3 py-1 pt-4 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Admin</p>}
          {collapsed && <div className="border-t border-border my-2" />}
          {adminItems.map(renderNavItem)}
        </nav>

        <div className="border-t border-border py-4 px-2 space-y-1 shrink-0">
          {bottomItems.map(renderNavItem)}
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-all w-full">
            <LogOut size={18} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen">
        {/* Mobile top header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="text-muted-foreground hover:text-foreground p-2 rounded-md">
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground p-2 rounded-md">
                  <Menu size={18} />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-0">
                <div className="p-4 border-b border-border">
                  <Logo size="sm" />
                </div>
                <nav className="py-2 px-2 space-y-0.5 overflow-y-auto max-h-[calc(100vh-160px)]">
                  <p className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Main</p>
                  {navItems.map(renderMobileNavItem)}
                  <div className="border-t border-border my-2" />
                  <p className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Admin</p>
                  {adminItems.map(renderMobileNavItem)}
                  <div className="border-t border-border my-2" />
                  {bottomItems.map(renderMobileNavItem)}
                </nav>
                <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-border bg-card">
                  <button onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-all w-full">
                    <LogOut size={18} />
                    <span>Logout</span>
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="flex-1 p-4 md:p-8 pb-20 md:pb-8 overflow-auto">{children}</div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border flex justify-around py-1.5 z-50 safe-area-pb">
        {[
          { icon: LayoutDashboard, label: "Home", path: "/admin/dashboard" },
          { icon: Layers, label: "Funnels", path: "/admin/funnels" },
          { icon: Radio, label: "Live", path: "/admin/live" },
          { icon: Video, label: "Videos", path: "/admin/videos" },
          { icon: User, label: "Profile", path: "/profile" },
        ].map((item) => {
          const active = location.pathname.startsWith(item.path);
          return (
            <Link key={item.path} to={item.path}
              className={cn("flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] transition-colors min-w-0", active ? "text-primary" : "text-muted-foreground")}>
              <item.icon size={20} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
