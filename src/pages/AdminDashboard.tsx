import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Layers, Video, BarChart3, Shield, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const AdminDashboard = () => {
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => { const { data } = await supabase.from("profiles").select("id, full_name, email, created_at, kyc_status"); return data || []; },
  });

  const { data: funnels = [] } = useQuery({
    queryKey: ["admin-funnels-count"],
    queryFn: async () => { const { data } = await supabase.from("funnels").select("id, total_views, total_leads, total_payments"); return data || []; },
  });

  const { data: videos = [] } = useQuery({
    queryKey: ["admin-videos-count"],
    queryFn: async () => { const { data } = await supabase.from("video_assets").select("id"); return data || []; },
  });


  const { data: kycPending = [] } = useQuery({
    queryKey: ["admin-kyc-pending"],
    queryFn: async () => { const { data } = await supabase.from("user_kyc_submissions").select("id").eq("status", "pending"); return data || []; },
  });

  
  const totalViews = funnels.reduce((a, f) => a + ((f as any).total_views || 0), 0);
  const totalLeads = funnels.reduce((a, f) => a + ((f as any).total_leads || 0), 0);

  const kpis = [
    { icon: Users, label: "Total Users", value: String(profiles.length), color: "text-primary" },
    { icon: Layers, label: "Total Funnels", value: String(funnels.length), color: "text-primary" },
    { icon: Video, label: "Total Videos", value: String(videos.length), color: "text-primary" },
    { icon: BarChart3, label: "Total Views", value: totalViews.toLocaleString("en-IN"), color: "text-primary" },
    { icon: Users, label: "Total Leads", value: totalLeads.toLocaleString("en-IN"), color: "text-success" },
    { icon: Shield, label: "KYC Pending", value: String(kycPending.length), color: "text-destructive" },
  ];


  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Platform overview and management.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <div key={k.label} className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <k.icon size={16} className={k.color} />
                <span className="text-xs text-muted-foreground">{k.label}</span>
              </div>
              <div className="text-2xl font-heading font-bold">{k.value}</div>
            </div>
          ))}
        </div>

      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
