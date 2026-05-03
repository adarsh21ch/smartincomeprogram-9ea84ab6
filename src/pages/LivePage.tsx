import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Radio, Plus, Calendar, Users, Copy, Pencil, Trash2, Share2, ExternalLink,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { LiveSessionWizard } from "@/components/live/LiveSessionWizard";

const StatusBadge = ({ status }: { status: string }) => {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 uppercase tracking-wider">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
        </span>
        Live
      </span>
    );
  }
  const styles: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    scheduled: "bg-blue-500/10 text-blue-500",
    ended: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/10 text-destructive line-through",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${styles[status] || styles.draft}`}>
      {status}
    </span>
  );
};

const nextSlotLabel = (s: any): string => {
  const slots = (s.scheduled_times ?? []).map((t: string) => new Date(t)).sort((a: Date, b: Date) => a.getTime() - b.getTime());
  const now = Date.now();
  if (s.status === "live") return "● Currently live";
  const upcoming = slots.find((d: Date) => d.getTime() > now);
  if (upcoming) return `Next: ${format(upcoming, "MMM d, h:mm a")} (in ${formatDistanceToNow(upcoming)})`;
  const past = [...slots].reverse().find((d: Date) => d.getTime() <= now);
  if (past) return `Last played: ${format(past, "MMM d, h:mm a")}`;
  return "Not scheduled yet";
};

const repeatLabel = (s: any) => {
  if (s.repeat_type === "daily") return "Daily";
  if (s.repeat_type === "interval") return `Every ${s.repeat_interval_hours ?? "?"}h`;
  if (s.repeat_type === "custom") return "Custom";
  return null;
};

const LivePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["live-sessions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const stats = useMemo(() => ({
    total: sessions.length,
    views: sessions.reduce((sum: number, s: any) => sum + (s.total_views ?? 0), 0),
    regs: sessions.reduce((sum: number, s: any) => sum + (s.registered_count ?? s.registration_count ?? 0), 0),
    live: sessions.filter((s: any) => s.status === "live").length,
  }), [sessions]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("live_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Session deleted");
      queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
    },
  });

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/s/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  const shareWhatsApp = (s: any) => {
    const url = `${window.location.origin}/s/${s.slug}`;
    const slots = (s.scheduled_times ?? []).map((t: string) => new Date(t)).sort((a: Date, b: Date) => a.getTime() - b.getTime());
    const next = slots.find((d: Date) => d.getTime() > Date.now()) ?? slots[0];
    const time = next ? format(next, "MMM d, h:mm a") : "soon";
    const msg = encodeURIComponent(`Join ${s.title} — live at ${time}. Click here: ${url}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold">Live</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Schedule videos to play live, or run real meetings — all from one link.
            </p>
          </div>
          <Button variant="hero" onClick={() => setWizardOpen(true)}>
            <Plus size={16} /> New Session
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total Sessions</p>
            <p className="text-2xl font-heading font-bold">{stats.total}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total Views</p>
            <p className="text-2xl font-heading font-bold">{stats.views}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Registrations</p>
            <p className="text-2xl font-heading font-bold">{stats.regs}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Currently Live</p>
            <p className="text-2xl font-heading font-bold text-red-500">{stats.live}</p>
          </Card>
        </div>

        {/* List */}
        {isLoading ? (
          <Card className="p-12 text-center"><p className="text-sm text-muted-foreground">Loading…</p></Card>
        ) : sessions.length === 0 ? (
          <Card className="p-12 text-center">
            <Radio size={40} className="text-muted-foreground mx-auto mb-3" />
            <h3 className="font-heading font-semibold mb-1">No live sessions yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Create your first session to start reaching your audience live.
            </p>
            <Button variant="hero" onClick={() => setWizardOpen(true)}>
              <Plus size={16} /> Create First Session
            </Button>
          </Card>
        ) : (
          <div className="grid gap-3">
            {sessions.map((s: any) => {
              const max = s.max_attendees;
              const reg = s.registered_count ?? s.registration_count ?? 0;
              const pct = max ? Math.min(100, Math.round((reg / max) * 100)) : 0;
              const barColor = pct > 85 ? "bg-red-500" : pct > 60 ? "bg-yellow-500" : "bg-primary";
              return (
                <Card key={s.id} className="p-4 hover:border-primary/40 transition-colors">
                  <div className="flex flex-col gap-3">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/admin/live/${s.id}`)}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-heading font-semibold text-sm truncate">{s.title}</h3>
                          <StatusBadge status={s.status} />
                          {s.session_type === "external_link" ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">External Link</span>
                          ) : s.video_asset_id ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">Video</span>
                          ) : null}
                          {repeatLabel(s) && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{repeatLabel(s)}</span>
                          )}
                          {max && pct === 100 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 uppercase">Full</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Calendar size={11} /> {nextSlotLabel(s)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Users size={11} /> {reg} registered{max ? ` • ${reg}/${max}` : ""}
                        </p>
                        {max != null && (
                          <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                            <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                      <Button variant="outline" size="sm" onClick={() => copyLink(s.slug)}><Copy size={12} /> Copy</Button>
                      <Button variant="outline" size="sm" onClick={() => shareWhatsApp(s)}><Share2 size={12} /> WhatsApp</Button>
                      <Button variant="outline" size="sm" onClick={() => window.open(`/s/${s.slug}`, "_blank")}><ExternalLink size={12} /> Preview</Button>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/live/${s.id}`)}><Pencil size={12} /> Manage</Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => {
                        if (confirm(`Delete "${s.title}"? This cannot be undone.`)) deleteMutation.mutate(s.id);
                      }}><Trash2 size={12} /></Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <LiveSessionWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      </div>
    </DashboardLayout>
  );
};

export default LivePage;
