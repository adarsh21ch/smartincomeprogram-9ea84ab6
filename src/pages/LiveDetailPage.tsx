import { useState, useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Radio, Copy, ExternalLink, Share2, Pencil, Calendar, Users,
  Search, Download, Eye, X, MessageCircle, BarChart3,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { LiveSessionWizard } from "@/components/live/LiveSessionWizard";

const StatusBadge = ({ status }: { status: string }) => {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-red-500/10 text-red-500 uppercase tracking-wider">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        Live
      </span>
    );
  }
  const styles: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    scheduled: "bg-blue-500/10 text-blue-500",
    ended: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/10 text-destructive",
  };
  return (
    <span className={`text-[11px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${styles[status] || styles.draft}`}>
      {status}
    </span>
  );
};

const LiveDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: session, isLoading } = useQuery({
    queryKey: ["live-session", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("live_sessions").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["live-registrations", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("live_session_registrations")
        .select("*")
        .eq("session_id", id!)
        .order("registered_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("live_sessions").update(updates as any).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["live-session", id] }),
  });

  if (isLoading || !session) {
    return <DashboardLayout><div className="py-20 text-center text-sm text-muted-foreground">Loading…</div></DashboardLayout>;
  }

  const slots: Date[] = (Array.isArray(session.scheduled_times) ? session.scheduled_times : []).map((t: any) => new Date(t)).sort((a: Date, b: Date) => a.getTime() - b.getTime());
  const now = Date.now();
  const upcoming = slots.find((d) => d.getTime() > now);
  const lastPlayed = [...slots].reverse().find((d) => d.getTime() <= now);
  const publicUrl = `${window.location.origin}/s/${session.slug}`;
  const filteredRegs = registrations.filter((r: any) =>
    !search || [r.name, r.email, r.phone].some((v) => v?.toLowerCase().includes(search.toLowerCase())),
  );

  // Registrations-over-time (last 14 days)
  const regChartData = useMemo(() => {
    const days: { day: string; count: number; date: number }[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      days.push({ day: format(d, "MMM d"), count: 0, date: d.getTime() });
    }
    for (const r of registrations as any[]) {
      const t = new Date(r.registered_at).getTime();
      const day = days.find((d) => t >= d.date && t < d.date + 86400000);
      if (day) day.count++;
    }
    return days;
  }, [registrations]);

  const joinedRate = registrations.length
    ? Math.round((registrations.filter((r: any) => r.joined_at).length / registrations.length) * 100)
    : 0;

  const shareOnWhatsApp = () => {
    const text = `🎬 You're invited to: *${session.title}*\n\n${upcoming ? `📅 ${format(upcoming, "EEE, MMM d 'at' h:mm a")}\n\n` : ""}Register here: ${publicUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const goLive = async () => {
    await updateMutation.mutateAsync({ status: "live" });
    toast.success(`🔴 Your session "${session.title}" is now live!`);
  };
  const endSession = async () => {
    await updateMutation.mutateAsync({ status: "ended" });
    toast.success(`Session ended. ${registrations.length} viewer${registrations.length === 1 ? "" : "s"} watched.`);
  };
  const cancelSession = async () => {
    await updateMutation.mutateAsync({ status: "cancelled" });
    toast.success("Session cancelled");
  };
  const togglePublish = async (v: boolean) => {
    await updateMutation.mutateAsync({ is_published: v });
    toast.success(v ? "Session published" : "Session unpublished");
  };

  const exportCsv = () => {
    const headers = ["Name", "Email", "Phone", "Registered at", "Joined"];
    const rows = registrations.map((r: any) => [
      r.name ?? "", r.email ?? "", r.phone ?? "",
      r.registered_at ? format(new Date(r.registered_at), "yyyy-MM-dd HH:mm") : "",
      r.joined_at ? "yes" : "no",
    ]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${session.slug}-registrations.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/live")} className="h-8 w-8 mt-1">
            <ArrowLeft size={16} />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-heading font-bold truncate">{session.title}</h1>
              <StatusBadge status={session.status} />
            </div>
            {session.description && <p className="text-xs text-muted-foreground">{session.description}</p>}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {session.status === "scheduled" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="hero"><Radio size={14} /> Go Live Now</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Start this session now?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Viewers will be taken to the live player immediately.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={goLive}>Go Live</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {session.status === "live" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive"><X size={14} /> End Session</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>End this live session?</AlertDialogTitle>
                  <AlertDialogDescription>Viewers will see the session has ended.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={endSession}>End Session</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {session.status === "scheduled" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">Cancel Session</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this session?</AlertDialogTitle>
                  <AlertDialogDescription>Registered viewers will not be notified automatically.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction onClick={cancelSession}>Yes, cancel</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <Button variant="outline" onClick={shareOnWhatsApp}><MessageCircle size={14} /> WhatsApp</Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil size={14} /> Edit</Button>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="mt-1"><StatusBadge status={session.status} /></div>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Registrations</p>
            <p className="text-2xl font-heading font-bold">{registrations.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{upcoming ? "Next slot" : lastPlayed ? "Last played" : "Schedule"}</p>
            <p className="text-sm font-semibold mt-1">
              {upcoming ? format(upcoming, "MMM d, h:mm a") : lastPlayed ? format(lastPlayed, "MMM d, h:mm a") : "Not scheduled"}
            </p>
            {upcoming && <p className="text-[11px] text-muted-foreground">in {formatDistanceToNow(upcoming)}</p>}
          </Card>
        </div>

        {/* Schedule Timeline */}
        {slots.length > 0 && (
          <Card className="p-4">
            <h3 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2"><Calendar size={14} /> Schedule</h3>
            <div className="space-y-1.5">
              {slots.slice(0, 12).map((d, i) => {
                const ended = d.getTime() + (session.video_duration_seconds ?? 0) * 1000 < now;
                const live = d.getTime() <= now && d.getTime() + (session.video_duration_seconds ?? 3600) * 1000 >= now;
                const future = d.getTime() > now;
                return (
                  <div key={i} className={`flex items-center justify-between text-xs p-2 rounded-lg ${live ? "bg-red-500/10" : ended ? "bg-muted/40" : "bg-muted/20"}`}>
                    <div className="flex items-center gap-2">
                      <span>{live ? "🟢" : ended ? "🔴" : "⏳"}</span>
                      <span className="font-medium">Session {i + 1}</span>
                      <span className="text-muted-foreground">— {format(d, "MMM d, h:mm a")}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {live ? "● Live now" : ended ? (session.replay_enabled ? "Ended • Replay available" : "Ended") : `In ${formatDistanceToNow(d)}`}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 text-center">All sessions share the same public link</p>
          </Card>
        )}

        {/* Public link */}
        <Card className="p-4">
          <Label className="text-xs text-muted-foreground">Public Session Link</Label>
          <div className="flex items-center gap-2 mt-1">
            <code className="text-sm text-primary flex-1 truncate">{publicUrl}</code>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Copied!"); }}>
              <Copy size={14} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(publicUrl, "_blank")}>
              <ExternalLink size={14} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
              const next = upcoming ?? lastPlayed;
              const time = next ? format(next, "MMM d, h:mm a") : "soon";
              const msg = encodeURIComponent(`Join ${session.title} — live at ${time}. Click here: ${publicUrl}`);
              window.open(`https://wa.me/?text=${msg}`, "_blank");
            }}>
              <Share2 size={14} />
            </Button>
          </div>
        </Card>

        {/* Publish + Replay summary */}
        <div className="grid sm:grid-cols-2 gap-3">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Published</p>
              <p className="text-[11px] text-muted-foreground">
                {session.is_published ? "Link is active for viewers" : 'Viewers see "Not available"'}
              </p>
            </div>
            <Switch checked={!!session.is_published} onCheckedChange={togglePublish} />
          </Card>
          <Card className="p-4">
            <p className="text-sm font-semibold">Replay</p>
            <p className="text-[11px] text-muted-foreground">
              {session.replay_enabled
                ? `Enabled${session.replay_delay_minutes ? ` • after ${session.replay_delay_minutes}m` : " • immediately"}`
                : "Disabled"}
            </p>
            <button onClick={() => setEditOpen(true)} className="text-[11px] text-primary mt-1 hover:underline">Edit settings</button>
          </Card>
        </div>

        {/* Registrations */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className="font-heading font-semibold text-sm">Registrations ({registrations.length})</h3>
            {registrations.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportCsv}><Download size={12} /> Export CSV</Button>
            )}
          </div>
          {registrations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No registrations yet.</p>
          ) : (
            <>
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-9 h-9" />
              </div>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {filteredRegs.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-2.5 bg-muted/40 rounded-lg text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{r.name || "Anonymous"}</p>
                      <div className="flex flex-wrap gap-2 text-muted-foreground">
                        {r.email && <span>{r.email}</span>}
                        {r.phone && <span>{r.phone}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-muted-foreground">{format(new Date(r.registered_at), "MMM d, h:mm a")}</p>
                      {r.joined_at && <span className="text-[10px] text-emerald-500">✓ Joined</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <LiveSessionWizard open={editOpen} onClose={() => setEditOpen(false)} editing={session as any} />
      </div>
    </DashboardLayout>
  );
};

export default LiveDetailPage;
