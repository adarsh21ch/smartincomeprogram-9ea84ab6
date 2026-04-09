import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Logo } from "@/components/landing/Logo";
import {
  Calendar, Clock, Users, Radio, Play, ExternalLink, Lock, IndianRupee
} from "lucide-react";
import { format, formatDistanceToNow, isFuture, isPast } from "date-fns";

const PublicLivePage = () => {
  const { slug } = useParams();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registered, setRegistered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "" });
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("slug", slug!)
        .in("status", ["scheduled", "live", "ended"])
        .single();
      if (data) setSession(data);
      setLoading(false);
    };
    load();
  }, [slug]);

  // Countdown timer
  useEffect(() => {
    if (!session?.scheduled_at || !isFuture(new Date(session.scheduled_at))) return;
    const interval = setInterval(() => {
      const diff = new Date(session.scheduled_at).getTime() - Date.now();
      if (diff <= 0) { setCountdown("Starting now!"); clearInterval(interval); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${d > 0 ? d + "d " : ""}${h}h ${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [session?.scheduled_at]);

  const handleRegister = async () => {
    if (!session) return;
    setSubmitting(true);
    const { error } = await supabase.from("live_registrations").insert({
      session_id: session.id,
      name: form.name || null,
      phone: form.phone || null,
      email: form.email || null,
      city: form.city || null,
      status: "registered",
      payment_status: session.access_type === "paid" ? "pending" : "none",
    });

    // Update registration count
    await supabase.from("live_sessions").update({
      registration_count: (session.registration_count || 0) + 1
    }).eq("id", session.id);

    setSubmitting(false);
    if (error) { toast.error("Registration failed"); return; }
    setRegistered(true);
    toast.success("You're registered!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Logo size="lg" />
        <h1 className="text-xl font-heading font-bold">Session Not Found</h1>
        <p className="text-sm text-muted-foreground">This session may have been removed or hasn't been published yet.</p>
      </div>
    );
  }

  const isLive = session.status === "live";
  const isEnded = session.status === "ended";
  const isScheduled = session.status === "scheduled";
  const isPublicAccess = session.access_type === "public";
  const needsRegistration = session.access_type === "lead_gated" || session.access_type === "paid";
  const canJoin = (isLive || isScheduled) && session.meeting_url;
  const canShowJoinButton = isPublicAccess || registered;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <Logo size="sm" />
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Session Info */}
        <div className="text-center space-y-3">
          {isLive && (
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <span className="text-sm font-bold text-red-500 uppercase tracking-wider">Live Now</span>
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-heading font-bold">{session.title}</h1>
          {session.description && <p className="text-sm text-muted-foreground">{session.description}</p>}
        </div>

        {/* Countdown / Time Info */}
        {isScheduled && session.scheduled_at && isFuture(new Date(session.scheduled_at)) && (
          <div className="glass-card p-6 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Starts in</p>
            <p className="text-3xl sm:text-4xl font-heading font-bold text-primary tabular-nums">{countdown}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {format(new Date(session.scheduled_at), "EEEE, MMMM d, yyyy • h:mm a")}
            </p>
          </div>
        )}

        {/* Session details */}
        <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
          {session.scheduled_at && (
            <span className="flex items-center gap-1"><Calendar size={13} />{format(new Date(session.scheduled_at), "MMM d, h:mm a")}</span>
          )}
          <span className="flex items-center gap-1"><Clock size={13} />{session.duration_minutes} minutes</span>
          {session.access_type === "paid" && (
            <span className="flex items-center gap-1"><IndianRupee size={13} />₹{session.payment_amount}</span>
          )}
        </div>

        {/* Ended — Show Replay */}
        {isEnded && (
          <div className="glass-card p-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">This session has ended.</p>
            {session.replay_enabled && session.replay_url ? (
              <Button variant="hero" onClick={() => window.open(session.replay_url, "_blank")}>
                <Play size={16} /> Watch Replay
              </Button>
            ) : session.replay_enabled ? (
              <p className="text-xs text-muted-foreground">Replay will be available soon.</p>
            ) : (
              <p className="text-xs text-muted-foreground">No replay available for this session.</p>
            )}
          </div>
        )}

        {/* Registration Form */}
        {!isEnded && needsRegistration && !registered && (
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-heading font-semibold text-center">Register to Join</h3>
            {session.access_type === "paid" && (
              <div className="text-center p-3 bg-primary/5 rounded-xl">
                <p className="text-sm font-semibold text-primary">₹{session.payment_amount}</p>
                {session.payment_instructions && <p className="text-xs text-muted-foreground mt-1">{session.payment_instructions}</p>}
              </div>
            )}
            <div className="space-y-3">
              {session.show_name && (
                <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 bg-muted border-border" /></div>
              )}
              {session.show_phone && (
                <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 bg-muted border-border" placeholder="+91" /></div>
              )}
              {session.show_email && (
                <div><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 bg-muted border-border" /></div>
              )}
              {session.show_city && (
                <div><Label className="text-xs">City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1 bg-muted border-border" /></div>
              )}
            </div>
            <Button variant="hero" className="w-full" onClick={handleRegister} disabled={submitting}>
              {submitting ? "Registering..." : session.access_type === "paid" ? "Register & Pay" : "Register Now"}
            </Button>
          </div>
        )}

        {/* Registered confirmation */}
        {!isEnded && registered && (
          <div className="glass-card p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
              <Users size={24} className="text-emerald-500" />
            </div>
            <h3 className="font-heading font-semibold">You're Registered!</h3>
            <p className="text-sm text-muted-foreground">
              {isLive ? "The session is live. Join now!" : "Come back when the session starts."}
            </p>
          </div>
        )}

        {/* Join Button */}
        {canJoin && canShowJoinButton && !isEnded && (
          <Button variant="hero" size="lg" className="w-full" onClick={() => window.open(session.meeting_url, "_blank")}>
            <ExternalLink size={16} /> {isLive ? "Join Live Session" : "Open Meeting Link"}
          </Button>
        )}

        {/* Public — no reg needed, show join directly */}
        {!isEnded && isPublicAccess && isLive && !session.meeting_url && (
          <p className="text-sm text-muted-foreground text-center">Meeting link will appear here when the host is ready.</p>
        )}

        {/* Footer */}
        <div className="text-center pt-4">
          <p className="text-[10px] text-muted-foreground">Powered by <span className="text-primary font-semibold">Smart Income Program</span></p>
        </div>
      </div>
    </div>
  );
};

export default PublicLivePage;
