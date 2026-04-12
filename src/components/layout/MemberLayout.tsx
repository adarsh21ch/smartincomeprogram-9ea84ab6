import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Logo } from "@/components/landing/Logo";
import { House, Target, GraduationCap, User, LogOut, Shield, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useTheme } from "@/hooks/useTheme";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const tabs = [
  { icon: House, label: "Home", path: "/home" },
  { icon: Target, label: "Program", path: "/home/program" },
  { icon: GraduationCap, label: "Trainings", path: "/home/courses" },
  { icon: User, label: "Profile", path: "/home/profile" },
];

export const MemberLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get("preview") === "true";
  const { signOut, profile } = useAuth();
  const { isAdmin } = useAdmin();
  const { theme, toggleTheme } = useTheme();

  const firstName = profile?.full_name?.split(" ")[0] || "Member";
  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const isActive = (path: string) => {
    if (path === "/home") return location.pathname === "/home";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {isPreview && (
        <div className="bg-primary text-primary-foreground text-center text-xs py-1.5 font-medium sticky top-0 z-[60]">
          Preview Mode —{" "}
          <button onClick={() => navigate("/admin/program")} className="underline">
            Exit Preview
          </button>
        </div>
      )}

      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md" style={isPreview ? { top: 28 } : undefined}>
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 h-14">
          <Link to="/home">
            <Logo size="sm" />
          </Link>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="text-muted-foreground hover:text-foreground p-2 rounded-md hover:bg-muted transition-colors"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                    {initials}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium">{profile?.full_name || "Member"}</p>
                  <p className="text-xs text-muted-foreground">{profile?.email}</p>
                </div>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/admin/dashboard")}>
                      <Shield size={14} className="mr-2" /> Admin Panel
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut size={14} className="mr-2" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 pb-20 md:pb-8">
        <div className="max-w-5xl mx-auto px-4 py-6">{children}</div>
      </main>

      {/* Bottom Tab Bar — both mobile and desktop */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-50" style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}>
        <div className="max-w-5xl mx-auto flex justify-around">
          {tabs.map((tab) => {
            const active = isActive(tab.path);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2.5 text-[10px] font-medium transition-colors relative",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                )}
                <tab.icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
