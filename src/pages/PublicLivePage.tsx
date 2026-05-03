import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Logo } from "@/components/landing/Logo";
import {
  Calendar, Play, Pause, ExternalLink, Copy, Share2, RotateCcw,
  Volume2, VolumeX, Maximize, Users, Radio, AlertCircle, RefreshCw,
} from "lucide-react";
import { format } from "date-fns";

type SessionState =
  | "waiting" | "live" | "ended" | "replay"
  | "between_slots" | "full" | "cancelled";

interface StateResponse {
  state: SessionState;
  seek_seconds: number;
  next_slot: string | null;
  current_slot_start: string | null;
  current_slot_end: string | null;
  seconds_until_next: number;
  replay_available: boolean;
  replay_enabled: boolean;
  video_url: string | null;
  session_data: any;
}

const fmtSeconds = (total: number) => {
  total = Math.max(0, Math.floor(total));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${String(s).padStart(2, "0")}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
};

const fmtTime = (total: number) => {
  total = Math.max(0, Math.floor(total));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const PublicLivePage = () => {
  const { slug } = useParams();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<StateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Registration
  const [needsReg, setNeedsReg] = useState(false);
  const [regForm, setRegForm] = useState({ name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchState = useCallback(async (id?: string) => {
    const idToUse = id ?? sessionId;
    if (!idToUse) return;
    try {
      const { data, error } = await supabase.functions.invoke("get-live-session-state", {
        body: { session_id: idToUse, current_timestamp: new Date().toISOString() },
      });
      if (error) throw error;
      setState(data as StateResponse);
      setErrored(false);
    } catch (e) {
      console.error(e);
      setErrored(true);
    }
  }, [sessionId]);

  // Initial load: resolve slug → id
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("live_sessions")
        .select("id, registration_required, is_published")
        .eq("slug", slug!)
        .maybeSingle();
      if (!data) { setLoading(false); setErrored(true); return; }
      setSessionId(data.id);
      // Has the viewer already registered (localStorage)?
      const regKey = `lsr-registered-${data.id}`;
      const alreadyRegistered = !!localStorage.getItem(regKey);
      setNeedsReg(!!data.registration_required && !alreadyRegistered);
      await fetchState(data.id);
      // Increment view (fire-and-forget)
      supabase.from("live_sessions" as any)
        .update({ total_views: undefined } as any)
        .eq("id", data.id)
        .then(() => {});
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Tick clock for countdowns
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Polling with jitter
  useEffect(() => {
    if (!sessionId || !state) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      let base = 30;
      if (state.state === "waiting" && state.seconds_until_next > 0 && state.seconds_until_next < 300) base = 10;
      if (state.state === "between_slots" && state.seconds_until_next < 300) base = 10;
      if (state.state === "live") base = 30;
      if (state.state === "ended" || state.state === "cancelled") base = 60;
      const jitter = Math.random() * 10 - 5;
      timer = setTimeout(async () => { await fetchState(); schedule(); }, (base + jitter) * 1000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [sessionId, state?.state, state?.seconds_until_next, fetchState]);

  // Auto-refetch the moment the countdown hits zero (avoid waiting up to 10s for poll)
  useEffect(() => {
    if (!state) return;
    if (state.state !== "waiting" && state.state !== "between_slots") return;
    if (!state.next_slot) return;
    const target = new Date(state.next_slot).getTime();
    const msLeft = target - Date.now();
    if (msLeft <= 0) {
      fetchState();
      return;
    }
    // refetch right when slot starts, plus 500ms buffer
    const t = setTimeout(() => fetchState(), msLeft + 500);
    return () => clearTimeout(t);
  }, [state?.state, state?.next_slot, fetchState]);

  // Realtime: instant transitions
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase
      .channel(`session-${sessionId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "live_sessions",
        filter: `id=eq.${sessionId}`,
      }, () => fetchState())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, fetchState]);

  // ---------- LOADING / ERROR ----------
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (errored && !state) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center gap-4">
        <Link to="/"><Logo size="lg" /></Link>
        <AlertCircle className="text-muted-foreground" size={40} />
        <h1 className="text-xl font-heading font-bold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          We couldn't load this session. Please check your connection and try again.
        </p>
        <Button variant="hero" onClick={() => window.location.reload()}>
          <RefreshCw size={14} /> Retry
        </Button>
        <p className="text-xs text-muted-foreground max-w-sm">
          If this keeps happening, the session may have ended or the link may be invalid.
        </p>
      </div>
    );
  }

  if (!state) return null;

  // ---------- REGISTRATION GATE ----------
  if (needsReg && state.state !== "cancelled" && state.state !== "ended") {
    const fields = state.session_data?.registration_fields ?? { name: true, email: true, phone: false };
    const handleRegister = async () => {
      if (fields.name && !regForm.name.trim()) return toast.error("Name is required");
      if (fields.email && !regForm.email.trim()) return toast.error("Email is required");
      if (fields.phone && !regForm.phone.trim()) return toast.error("Phone is required");
      setSubmitting(true);
      const { data: insRow, error } = await supabase.from("live_session_registrations").insert({
        session_id: sessionId!,
        name: regForm.name || null,
        email: regForm.email || null,
        phone: regForm.phone || null,
      }).select("id").single();
      setSubmitting(false);
      if (error) { toast.error("Registration failed"); return; }
      localStorage.setItem(`lsr-registered-${sessionId}`, "1");
      // fire-and-forget confirmation email
      if (insRow?.id && regForm.email) {
        supabase.functions.invoke("send-live-session-email", {
          body: { registration_id: insRow.id, type: "confirmation" },
        }).catch(() => {});
      }
      toast.success("You're registered! Check your inbox.");
      setNeedsReg(false);
      fetchState();
    };

    return (
      <PageShell title={state.session_data?.title}>
        <Card className="p-6 space-y-4 max-w-md mx-auto">
          <div className="text-center">
            <h2 className="text-xl font-heading font-bold">{state.session_data?.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">Register to join this session</p>
          </div>
          <div className="space-y-3">
            {fields.name && (
              <div><Label className="text-xs">Full Name</Label>
                <Input value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })} className="mt-1" /></div>
            )}
            {fields.email && (
              <div><Label className="text-xs">Email</Label>
                <Input type="email" value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} className="mt-1" /></div>
            )}
            {fields.phone && (
              <div><Label className="text-xs">Phone</Label>
                <Input value={regForm.phone} onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })} className="mt-1" placeholder="+91" /></div>
            )}
          </div>
          <Button variant="hero" className="w-full" onClick={handleRegister} disabled={submitting}>
            {submitting ? "Registering…" : "Register Now"}
          </Button>
        </Card>
      </PageShell>
    );
  }

  // ---------- BY STATE ----------
  switch (state.state) {
    case "cancelled":
      return <NotAvailableState />;
    case "full":
      return <FullState state={state} now={now} />;
    case "ended":
      return <EndedState state={state} sessionId={sessionId!} />;
    case "replay":
      return <ReplayState state={state} />;
    case "live":
      return <LiveState state={state} fetchState={fetchState} />;
    case "between_slots":
      return <BetweenSlotsState state={state} now={now} />;
    case "waiting":
    default:
      return <WaitingState state={state} now={now} />;
  }
};

// ====================== SUB-COMPONENTS ======================

const PageShell = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <div className="min-h-screen bg-background flex flex-col">
    <div className="border-b border-border px-4 py-3">
      <Link to="/"><Logo size="sm" /></Link>
    </div>
    <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 sm:py-10">
      {children}
    </div>
    <div className="text-center pb-4 text-[10px] text-muted-foreground">Smart Income Program</div>
  </div>
);

const SlotChips = ({ slots, now }: { slots: string[]; now: number }) => {
  if (!slots || slots.length === 0) return null;
  const today = new Date(now);
  today.setHours(0,0,0,0);
  const tomorrow = today.getTime() + 86400000;
  const todays = slots
    .map((s) => new Date(s))
    .filter((d) => d.getTime() >= today.getTime() && d.getTime() < tomorrow)
    .sort((a,b) => a.getTime()-b.getTime());
  if (todays.length === 0) return null;
  const next = todays.find((d) => d.getTime() > now);
  return (
    <div className="flex flex-wrap gap-2 justify-center mt-3">
      {todays.map((d) => {
        const isPast = d.getTime() < now;
        const isNext = next && d.getTime() === next.getTime();
        return (
          <span key={d.toISOString()}
            className={`text-xs px-2.5 py-1 rounded-full border ${
              isPast ? "border-border text-muted-foreground line-through" :
              isNext ? "border-primary bg-primary/10 text-primary font-semibold" :
              "border-border text-foreground"
            }`}>
            {format(d, "h:mm a")}{isPast ? " ✓" : ""}{isNext ? " → next" : ""}
          </span>
        );
      })}
    </div>
  );
};

const ShareRow = ({ url, title, time }: { url: string; title: string; time?: string }) => {
  const msg = encodeURIComponent(`Join ${title}${time ? ` — live at ${time}` : ""}. Click here: ${url}`);
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}>
        <Copy size={14} /> Copy link
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.open(`https://wa.me/?text=${msg}`, "_blank")}>
        <Share2 size={14} /> WhatsApp
      </Button>
    </div>
  );
};

const AddToCalendar = ({ start, durationMin, title, description, url }: {
  start: string; durationMin: number; title: string; description?: string; url: string;
}) => {
  const startD = new Date(start);
  const endD = new Date(startD.getTime() + durationMin * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${fmt(startD)}/${fmt(endD)}&details=${encodeURIComponent((description ?? "") + "\n\nJoin: " + url)}&location=${encodeURIComponent(url)}`;
  return (
    <Button variant="outline" size="sm" onClick={() => window.open(gcal, "_blank")}>
      <Calendar size={14} /> Add to Calendar
    </Button>
  );
};

// --- WAITING ---
const WaitingState = ({ state, now }: { state: StateResponse; now: number }) => {
  const url = window.location.href;
  const next = state.next_slot ? new Date(state.next_slot) : null;
  const secsLeft = next ? Math.max(0, Math.floor((next.getTime() - now) / 1000)) : 0;
  return (
    <PageShell>
      <div className="text-center space-y-6">
        {state.session_data?.thumbnail_url && (
          <img src={state.session_data.thumbnail_url} alt="" className="rounded-2xl w-full max-h-64 object-cover" />
        )}
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold">{state.session_data?.title}</h1>
          {state.session_data?.description && (
            <p className="text-sm text-muted-foreground mt-2">{state.session_data.description}</p>
          )}
        </div>

        <Card className="p-6 sm:p-8">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Starts in</p>
          <p className="text-4xl sm:text-5xl font-heading font-bold text-primary tabular-nums animate-pulse">
            {fmtSeconds(secsLeft)}
          </p>
          {next && (
            <p className="text-xs text-muted-foreground mt-3">
              📅 {format(next, "EEEE, MMM d • h:mm a")} IST
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Session starts automatically. Keep this page open.
          </p>
        </Card>

        <SlotChips slots={state.session_data?.scheduled_times ?? []} now={now} />

        {next && (
          <div className="flex flex-wrap gap-2 justify-center">
            <AddToCalendar
              start={next.toISOString()}
              durationMin={Math.max(1, Math.round(((state.session_data?.video_duration_seconds ?? 3600) / 60)))}
              title={state.session_data?.title}
              description={state.session_data?.description}
              url={url}
            />
          </div>
        )}
        <ShareRow url={url} title={state.session_data?.title} time={next ? format(next, "MMM d, h:mm a") : undefined} />
      </div>
    </PageShell>
  );
};

// --- BETWEEN SLOTS ---
const BetweenSlotsState = ({ state, now }: { state: StateResponse; now: number }) => {
  const next = state.next_slot ? new Date(state.next_slot) : null;
  const secsLeft = next ? Math.max(0, Math.floor((next.getTime() - now) / 1000)) : 0;
  const url = window.location.href;
  const showReplayOption = state.replay_available;
  return (
    <PageShell>
      <div className="text-center space-y-6">
        <h1 className="text-2xl font-heading font-bold">{state.session_data?.title}</h1>
        <p className="text-sm text-muted-foreground">✅ This session has ended.</p>

        {showReplayOption && (
          <Card className="p-5 space-y-3">
            <p className="text-sm font-semibold">▶ Watch the replay of the session that just ended</p>
            <Button variant="hero" size="lg" onClick={() => window.location.reload()}>
              <Play size={16} /> Watch Replay
            </Button>
            <p className="text-xs text-muted-foreground">— OR —</p>
          </Card>
        )}

        <Card className="p-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Next live session in</p>
          <p className="text-4xl sm:text-5xl font-heading font-bold text-primary tabular-nums animate-pulse">
            {fmtSeconds(secsLeft)}
          </p>
          {next && <p className="text-xs text-muted-foreground mt-3">📅 {format(next, "EEEE, MMM d • h:mm a")} IST</p>}
          <p className="text-xs text-muted-foreground mt-2">
            Keep this page open — it will switch to the live player automatically.
          </p>
        </Card>

        <SlotChips slots={state.session_data?.scheduled_times ?? []} now={now} />

        {next && (
          <div className="flex flex-wrap gap-2 justify-center">
            <AddToCalendar
              start={next.toISOString()}
              durationMin={60}
              title={state.session_data?.title}
              description={state.session_data?.description}
              url={url}
            />
          </div>
        )}
        <ShareRow url={url} title={state.session_data?.title} time={next ? format(next, "MMM d, h:mm a") : undefined} />
      </div>
    </PageShell>
  );
};

// --- ENDED ---
const EndedState = ({ state, sessionId }: { state: StateResponse; sessionId: string }) => {
  const [form, setForm] = useState({ name: "", email: "" });
  const [done, setDone] = useState(false);
  const submit = async () => {
    if (!form.name || !form.email) return toast.error("Name & email required");
    const { error } = await supabase.from("live_session_registrations").insert({
      session_id: sessionId, name: form.name, email: form.email,
    });
    if (error) return toast.error("Could not save");
    setDone(true);
    toast.success("We'll notify you about future sessions!");
  };
  return (
    <PageShell>
      <div className="text-center space-y-5 max-w-md mx-auto">
        <h1 className="text-2xl font-heading font-bold">✅ All sessions have ended</h1>
        <p className="text-sm text-muted-foreground">
          Thank you for watching <span className="font-semibold">{state.session_data?.title}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          There are no more scheduled sessions at this time.
        </p>
        {!done ? (
          <Card className="p-5 space-y-3 text-left">
            <p className="text-sm font-semibold text-center">Get notified about future sessions</p>
            <Input placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Button variant="hero" className="w-full" onClick={submit}>Notify me</Button>
          </Card>
        ) : (
          <p className="text-sm text-primary">✓ You're on the list.</p>
        )}
        <ShareRow url={window.location.href} title={state.session_data?.title} />
      </div>
    </PageShell>
  );
};

// --- FULL ---
const FullState = ({ state, now }: { state: StateResponse; now: number }) => {
  const next = state.next_slot ? new Date(state.next_slot) : null;
  const secsLeft = next ? Math.max(0, Math.floor((next.getTime() - now) / 1000)) : 0;
  return (
    <PageShell>
      <div className="text-center space-y-5 max-w-md mx-auto">
        <Users size={48} className="mx-auto text-muted-foreground" />
        <h1 className="text-2xl font-heading font-bold">This session is at capacity</h1>
        <p className="text-sm text-muted-foreground">
          This session has reached its maximum number of viewers.
        </p>
        {next ? (
          <Card className="p-5">
            <p className="text-xs text-muted-foreground mb-2">Next session starts in</p>
            <p className="text-3xl font-heading font-bold text-primary tabular-nums">{fmtSeconds(secsLeft)}</p>
            <p className="text-xs text-muted-foreground mt-2">{format(next, "EEEE, MMM d • h:mm a")} IST</p>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">Follow us to get notified of future sessions.</p>
        )}
      </div>
    </PageShell>
  );
};

// --- NOT AVAILABLE ---
const NotAvailableState = () => (
  <PageShell>
    <div className="text-center space-y-4 max-w-md mx-auto">
      <AlertCircle size={48} className="mx-auto text-muted-foreground" />
      <h1 className="text-2xl font-heading font-bold">This session is not available</h1>
      <p className="text-sm text-muted-foreground">
        This session has been cancelled or is no longer active.
      </p>
      <Link to="/"><Button variant="hero">Go to homepage</Button></Link>
    </div>
  </PageShell>
);

// --- LIVE ---
const LiveState = ({ state, fetchState }: { state: StateResponse; fetchState: () => Promise<void> }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [maxWatched, setMaxWatched] = useState(state.seek_seconds);
  const [progress, setProgress] = useState(state.seek_seconds);
  const [duration, setDuration] = useState(0);
  const [showFeedback, setShowFeedback] = useState<"play" | "pause" | "back" | null>(null);
  const userPausedRef = useRef(false);

  const isExternalLink = !!state.video_url && /^https?:\/\//.test(state.video_url) && !state.video_url.match(/\.(mp4|webm|mov|m3u8)/i);

  // Try unmuted autoplay first (live session); fall back to muted if browser blocks it
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !state.video_url || isExternalLink) return;
    const startPlayback = async () => {
      try { v.currentTime = state.seek_seconds; } catch {}
      setMaxWatched(state.seek_seconds);
      // Attempt unmuted autoplay
      v.muted = false;
      try {
        await v.play();
        setMuted(false);
      } catch {
        // Blocked → fall back to muted autoplay so video at least starts
        v.muted = true;
        setMuted(true);
        try { await v.play(); } catch {}
      }
    };
    if (v.readyState >= 1) {
      setDuration(v.duration);
      startPlayback();
    }
    const onLoaded = () => {
      setDuration(v.duration);
      startPlayback();
    };
    v.addEventListener("loadedmetadata", onLoaded);
    return () => v.removeEventListener("loadedmetadata", onLoaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.video_url]);

  // Periodically resync max watched (live edge moves)
  useEffect(() => {
    const t = setInterval(() => {
      setMaxWatched((prev) => {
        const elapsed = Math.floor(((Date.now() - new Date(state.current_slot_start!).getTime()) / 1000));
        return Math.max(prev, elapsed);
      });
    }, 1000);
    return () => clearInterval(t);
  }, [state.current_slot_start]);

  // Block forward seek
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onSeeking = () => {
      if (v.currentTime > maxWatched + 1) {
        v.currentTime = maxWatched;
        toast.info("Cannot skip ahead in a live session");
      }
    };
    const onTime = () => setProgress(v.currentTime);
    v.addEventListener("seeking", onSeeking);
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("seeking", onSeeking);
      v.removeEventListener("timeupdate", onTime);
    };
  }, [maxWatched]);

  const togglePlay = () => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) {
      // resume → force resync to live position
      const liveSeek = Math.floor((Date.now() - new Date(state.current_slot_start!).getTime()) / 1000);
      try { v.currentTime = Math.min(liveSeek, duration); } catch {}
      userPausedRef.current = false;
      v.play().catch(()=>{});
      setPaused(false);
      setShowFeedback("play");
    } else {
      v.pause();
      userPausedRef.current = true;
      setPaused(true);
      setShowFeedback("pause");
    }
    setTimeout(() => setShowFeedback(null), 600);
  };

  const handleVideoTap = (e: React.MouseEvent) => {
    const v = videoRef.current; if (!v) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isLeft = x < rect.width / 2;
    // Detect double tap via time
    const lastTap = (handleVideoTap as any)._t ?? 0;
    const t = Date.now();
    if (t - lastTap < 280) {
      // double tap
      if (isLeft) {
        v.currentTime = Math.max(0, v.currentTime - 10);
        setShowFeedback("back");
        setTimeout(() => setShowFeedback(null), 600);
      } else {
        toast.info("Cannot skip ahead in a live session");
      }
      (handleVideoTap as any)._t = 0;
    } else {
      (handleVideoTap as any)._t = t;
      setTimeout(() => {
        if ((handleVideoTap as any)._t === t) {
          togglePlay();
          (handleVideoTap as any)._t = 0;
        }
      }, 280);
    }
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: state.session_data?.title, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied");
      }
    } catch {}
  };

  if (isExternalLink) {
    return (
      <div className="min-h-screen bg-[#0b0e14] text-white flex flex-col items-center justify-center px-4 text-center gap-6">
        <div className="inline-flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span className="text-xs sm:text-sm font-bold text-red-500 uppercase tracking-[0.2em]">Live Now</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-heading font-bold uppercase tracking-tight">{state.session_data?.title}</h1>
        <Button variant="hero" size="lg" onClick={() => window.open(state.video_url!, "_blank")}>
          <ExternalLink size={16} /> Join Live Session
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#0b0e14] text-white flex flex-col">
      {/* Top: LIVE NOW + Title */}
      <div className="pt-6 sm:pt-10 px-4 text-center">
        <div className="inline-flex items-center gap-2 mb-3 sm:mb-5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span className="text-[11px] sm:text-sm font-bold text-red-500 uppercase tracking-[0.25em]">Live Now</span>
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-heading font-bold uppercase tracking-tight px-2 break-words">
          {state.session_data?.title}
        </h1>
      </div>

      {/* Video stage */}
      <div className="flex-1 flex items-center justify-center px-3 sm:px-6 py-4 sm:py-8">
        <div className="w-full max-w-5xl">
          <div className="relative bg-black rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/5">
            <video
              ref={videoRef}
              src={state.video_url ?? undefined}
              className="w-full aspect-video"
              playsInline
              autoPlay
              preload="auto"
              onClick={handleVideoTap}
              onPause={() => setPaused(true)}
              onPlay={() => setPaused(false)}
            />

            {/* LIVE pill top-left */}
            <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold uppercase tracking-wider shadow-lg">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
              </span>
              Live
            </div>

            {/* Tap-to-unmute */}
            {muted && !paused && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const v = videoRef.current; if (!v) return;
                  v.muted = false; setMuted(false); v.play().catch(() => {});
                }}
                className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 hover:bg-black/85 backdrop-blur text-white text-xs font-semibold shadow-lg animate-fade-in"
              >
                <VolumeX size={14} /> Tap to unmute
              </button>
            )}

            {/* Tap feedback */}
            {showFeedback && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/60 text-white rounded-full p-4 animate-fade-in">
                  {showFeedback === "play" && <Play size={32} />}
                  {showFeedback === "pause" && <Pause size={32} />}
                  {showFeedback === "back" && <RotateCcw size={32} />}
                </div>
              </div>
            )}

            {/* Custom controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent px-3 py-2 space-y-1.5">
              <div
                className="relative h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer"
                onClick={(e) => {
                  const v = videoRef.current; if (!v) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  const target = pct * Math.max(1, maxWatched);
                  if (target <= maxWatched + 1) v.currentTime = target;
                }}
              >
                <div
                  className="absolute h-full bg-red-500 transition-[width] duration-300"
                  style={{ width: `${Math.min(100, (progress / Math.max(1, maxWatched)) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-white text-xs">
                <div className="flex items-center gap-2">
                  <button onClick={togglePlay} aria-label="Play/Pause">
                    {paused ? <Play size={16} /> : <Pause size={16} />}
                  </button>
                  <button onClick={() => { const v = videoRef.current; if (v) { v.muted = !v.muted; setMuted(v.muted); } }} aria-label="Mute">
                    {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <span className="tabular-nums">{fmtTime(progress)}</span>
                  {progress < maxWatched - 5 && (
                    <button
                      onClick={() => { const v = videoRef.current; if (v) v.currentTime = maxWatched; }}
                      className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider"
                    >
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                      </span>
                      Back to Live
                    </button>
                  )}
                </div>
                <button onClick={() => videoRef.current?.requestFullscreen?.()} aria-label="Fullscreen">
                  <Maximize size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Info row below video */}
          <div className="mt-3 sm:mt-4 flex items-center justify-between gap-3 text-xs sm:text-sm text-white/60">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-red-400 font-medium shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                Live
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="truncate">forward seek &amp; speed disabled</span>
            </div>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 hover:text-white transition-colors shrink-0"
            >
              <Share2 size={14} /> Share
            </button>
          </div>

          {state.session_data?.description && (
            <p className="mt-4 text-sm text-white/70 text-center max-w-3xl mx-auto">
              {state.session_data.description}
            </p>
          )}
        </div>
      </div>

      {/* Footer brand */}
      <div className="text-center pb-4 sm:pb-6 text-[11px] text-white/40">
        <span className="font-semibold text-white/60">Smart Income Program</span> powered by Nevorai
      </div>
    </div>
  );
};

// --- REPLAY ---
const ReplayState = ({ state }: { state: StateResponse }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showFeedback, setShowFeedback] = useState<"play" | "pause" | "back" | "fwd" | null>(null);

  const noVideo = !state.video_url;

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onLoaded = () => setDuration(v.duration);
    const onTime = () => setProgress(v.currentTime);
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTime);
    };
  }, []);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current; if (!v) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * duration;
  };

  const togglePlay = () => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) { v.play(); setShowFeedback("play"); }
    else { v.pause(); setShowFeedback("pause"); }
    setTimeout(() => setShowFeedback(null), 600);
  };

  const handleVideoTap = (e: React.MouseEvent) => {
    const v = videoRef.current; if (!v) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isLeft = x < rect.width / 2;
    const lastTap = (handleVideoTap as any)._t ?? 0;
    const t = Date.now();
    if (t - lastTap < 280) {
      if (isLeft) { v.currentTime = Math.max(0, v.currentTime - 10); setShowFeedback("back"); }
      else { v.currentTime = Math.min(duration, v.currentTime + 10); setShowFeedback("fwd"); }
      setTimeout(() => setShowFeedback(null), 600);
      (handleVideoTap as any)._t = 0;
    } else {
      (handleVideoTap as any)._t = t;
      setTimeout(() => {
        if ((handleVideoTap as any)._t === t) { togglePlay(); (handleVideoTap as any)._t = 0; }
      }, 280);
    }
  };

  const slot = state.current_slot_start ? new Date(state.current_slot_start) : null;

  if (noVideo) {
    return <PageShell><p className="text-sm text-center text-muted-foreground">Replay is not available.</p></PageShell>;
  }

  return (
    <PageShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg sm:text-xl font-heading font-bold flex-1 truncate">{state.session_data?.title}</h1>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">Replay</span>
        </div>
        {slot && <p className="text-xs text-muted-foreground">Originally aired: {format(slot, "MMM d, yyyy • h:mm a")}</p>}

        <div className="relative bg-black rounded-2xl overflow-hidden">
          <video ref={videoRef} src={state.video_url} className="w-full aspect-video" playsInline
            onClick={handleVideoTap}
            onPause={() => setPaused(true)} onPlay={() => setPaused(false)} />
          {showFeedback && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/60 text-white rounded-full p-4 animate-fade-in">
                {showFeedback === "play" && <Play size={32} />}
                {showFeedback === "pause" && <Pause size={32} />}
                {showFeedback === "back" && <RotateCcw size={32} />}
                {showFeedback === "fwd" && <RotateCcw size={32} className="rotate-180" />}
              </div>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 space-y-1.5">
            <div className="relative h-1.5 bg-white/20 rounded-full cursor-pointer" onClick={handleSeek}>
              <div className="absolute h-full bg-primary rounded-full" style={{ width: `${(progress / Math.max(1, duration)) * 100}%` }} />
            </div>
            <div className="flex items-center justify-between text-white text-xs">
              <div className="flex items-center gap-2">
                <button onClick={togglePlay}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
                <button onClick={() => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, v.currentTime - 10); }}>←10</button>
                <button onClick={() => { const v = videoRef.current; if (v) v.currentTime = Math.min(duration, v.currentTime + 10); }}>10→</button>
                <span className="tabular-nums">{fmtTime(progress)} / {fmtTime(duration)}</span>
              </div>
              <div className="flex items-center gap-2">
                <select value={speed} onChange={(e) => { const s = parseFloat(e.target.value); setSpeed(s); if (videoRef.current) videoRef.current.playbackRate = s; }}
                  className="bg-black/40 rounded px-1 py-0.5 text-xs">
                  {[0.75,1,1.25,1.5,2].map((s) => <option key={s} value={s}>{s}x</option>)}
                </select>
                <button onClick={() => videoRef.current?.requestFullscreen?.()}><Maximize size={16} /></button>
              </div>
            </div>
          </div>
        </div>

        {state.session_data?.description && (
          <Card className="p-4"><p className="text-sm">{state.session_data.description}</p></Card>
        )}
      </div>
    </PageShell>
  );
};

export default PublicLivePage;
