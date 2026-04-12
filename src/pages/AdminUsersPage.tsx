import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search, Users, Mail, Phone, Shield } from "lucide-react";
import { SubAdminManager } from "@/components/admin/SubAdminManager";

const AdminUsersPage = () => {
  const [search, setSearch] = useState("");

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin-all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["admin-all-subs"],
    queryFn: async () => {
      const { data } = await supabase.from("user_subscriptions").select("user_id, tier, plan_key, status");
      return data || [];
    },
  });

  const subMap = Object.fromEntries(subscriptions.map((s) => [s.user_id, s]));

  const filtered = profiles.filter(
    (p) => !search || p.full_name?.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-heading font-bold">User Management</h1>

        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search users..." className="pl-9 bg-muted border-border" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-4 text-xs text-muted-foreground font-medium">User</th>
                  <th className="p-4 text-xs text-muted-foreground font-medium">Plan</th>
                  <th className="p-4 text-xs text-muted-foreground font-medium">KYC</th>
                  <th className="p-4 text-xs text-muted-foreground font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="p-4"><div className="h-4 bg-muted rounded w-32 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-muted rounded w-16 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-muted rounded w-16 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-muted rounded w-20 animate-pulse" /></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No users found</td></tr>
                ) : (
                  filtered.map((p) => {
                    const sub = subMap[p.id];
                    return (
                      <tr key={p.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="p-4">
                          <div>
                            <p className="font-medium">{p.full_name || "—"}</p>
                            <p className="text-xs text-muted-foreground">{p.email}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${sub?.tier === "pro" ? "bg-warning/10 text-warning" : sub?.tier === "basic" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {sub?.tier || "free"}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${p.kyc_status === "verified" ? "bg-success/10 text-success" : p.kyc_status === "pending" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>
                            {p.kyc_status || "none"}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-muted-foreground">
                          {p.created_at ? new Date(p.created_at).toLocaleDateString("en-IN") : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sub-Admins Section */}
        <div className="glass-card p-6">
          <SubAdminManager />
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminUsersPage;
