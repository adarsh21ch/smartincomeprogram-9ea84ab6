import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  Play, Pause, MessageCircle, Phone as PhoneIcon, Lock, Check,
  AlertTriangle, BadgeCheck, MapPin, Instagram, Volume2, VolumeX,
  Maximize, Minimize, Share2, Loader2, Gauge, Sun, Moon
} from "lucide-react";
import logoImg from "@/assets/logo.png";
import { MultiStepViewer } from "@/components/funnel/MultiStepViewer";
import { CodeGateScreen } from "@/components/funnel/CodeGateScreen";
import { PrivateLeadForm } from "@/components/funnel/PrivateLeadForm";
import { resolveVideoPlaybackUrl } from "@/lib/videoPlayback";
/* ─── Speed Popover ─── */
const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

const SpeedControl = ({
  currentSpeed,
  onSpeedChange,
}: {
  currentSpeed: number;
  onSpeedChange: (s: number) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="flex items-center gap-1 px-2 py-1 text-[12px] font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors tabular-nums"
      >
        <Gauge size={14} />
        {currentSpeed === 1 ? "1x" : `${currentSpeed}x`}
      </button>
      {open && (
        <div
          className="absolute bottom-full mb-2 right-0 bg-[#1a1a22] border border-white/10 rounded-xl p-1 shadow-2xl shadow-black/50 min-w-[100px] z-50"
          onClick={(e) => e.stopPropagation()}
        >
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { onSpeedChange(s); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-[13px] rounded-lg transition-colors ${
                currentSpeed === s
                  ? "bg-primary/20 text-primary font-semibold"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              {s}x {s === 1 && <span className="text-[11px] text-white/40 ml-1">Normal</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Custom Video Player ─── */
const CustomVideoPlayer = ({
  src,
  poster,
  allowSeek,
  allowSpeed,
  autoplay = false,
  initialTime = 0,
  onTimeUpdate,
  onPlay,
}: {
  src: string;
  poster?: string;
  allowSeek: boolean;
  allowSpeed: boolean;
  autoplay?: boolean;
  initialTime?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPlay?: () => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const maxWatched = useRef(0);
  const isSeeking = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [started, setStarted] = useState(autoplay);
  const [isLoading, setIsLoading] = useState(autoplay);
  const [speed, setSpeed] = useState(1);
  const [autoplayMuted, setAutoplayMuted] = useState(false);
  const [seekToast, setSeekToast] = useState(false);
  const seekToastTimer = useRef<ReturnType<typeof setTimeout>>();
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const autoplayAttempted = useRef(false);
  const playbackSrc = resolveVideoPlaybackUrl(src) ?? src;

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h > 0
      ? `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
      : `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Autoplay logic: try unmuted first, fallback to muted
  useEffect(() => {
    if (!autoplay || autoplayAttempted.current || !videoRef.current) return;
    autoplayAttempted.current = true;
    const v = videoRef.current;
    
    // Try unmuted autoplay first
    v.muted = false;
    setMuted(false);
    const playPromise = v.play();
    if (playPromise) {
      playPromise
        .then(() => {
          setStarted(true);
          setPlaying(true);
          onPlay?.();
        })
        .catch(() => {
          // Fallback: muted autoplay
          v.muted = true;
          setMuted(true);
          setAutoplayMuted(true);
          v.play()
            .then(() => {
              setStarted(true);
              setPlaying(true);
              onPlay?.();
            })
            .catch(() => {
              // Autoplay completely blocked, user must click
              setAutoplayMuted(false);
            });
        });
    }
  }, [autoplay, playbackSrc]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!started) {
      setIsLoading(true);
      setStarted(true);
      v.play().catch(() => {});
      onPlay?.();
    } else if (v.paused) {
      v.play();
    } else {
      v.pause();
    }
  }, [started, onPlay]);

  const handleUnmute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    setMuted(false);
    setAutoplayMuted(false);
  }, []);

  const handleSpeedChange = useCallback((s: number) => {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
  }, []);

  const showSeekDisabledToast = useCallback(() => {
    if (seekToastTimer.current) clearTimeout(seekToastTimer.current);
    setSeekToast(true);
    seekToastTimer.current = setTimeout(() => setSeekToast(false), 2500);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;
      if (e.key === " " || e.key === "k" || e.key === "K") {
        e.preventDefault();
        togglePlay();
      }
      if (!allowSeek) {
        if (["ArrowRight", "l", "L"].includes(e.key)) {
          e.preventDefault();
          showSeekDisabledToast();
        }
        if ("123456789".includes(e.key)) {
          const v = videoRef.current;
          if (v) {
            const target = v.duration * (parseInt(e.key) / 10);
            if (target > maxWatched.current + 1) {
              e.preventDefault();
              showSeekDisabledToast();
            }
          }
        }
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const v = videoRef.current;
        if (v) v.currentTime = Math.max(0, v.currentTime - 5);
      }
      if (e.key === "m" || e.key === "M") {
        setMuted((p) => { if (videoRef.current) videoRef.current.muted = !p; return !p; });
        setAutoplayMuted(false);
      }
      if (e.key === "f" || e.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [allowSeek, togglePlay, showSeekDisabledToast]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen?.();
    }
  };

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || isSeeking.current) return;
    if (v.currentTime > maxWatched.current) {
      maxWatched.current = v.currentTime;
    }
    setCurrent(v.currentTime);
    onTimeUpdate?.(v.currentTime, v.duration);
    if (v.buffered.length > 0) {
      setBuffered(v.buffered.end(v.buffered.length - 1));
    }
  };

  const handleSeeking = () => {
    const v = videoRef.current;
    if (!v || allowSeek) return;
    if (v.currentTime > maxWatched.current + 0.5) {
      isSeeking.current = true;
      v.currentTime = maxWatched.current;
      showSeekDisabledToast();
      requestAnimationFrame(() => { isSeeking.current = false; });
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = pct * duration;
    if (!allowSeek && targetTime > maxWatched.current + 0.5) {
      v.currentTime = maxWatched.current;
      showSeekDisabledToast();
    } else {
      v.currentTime = targetTime;
    }
  };

  const resetHideTimer = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  const watchedPct = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;
  const maxWatchedPct = duration ? (maxWatched.current / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden group select-none"
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      onClick={() => { if (started) togglePlay(); }}
      onContextMenu={(e) => e.preventDefault()}
      tabIndex={0}
    >
      <video
        ref={videoRef}
        src={playbackSrc}
        poster={poster}
        className="w-full h-full object-contain"
        playsInline
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onSeeking={handleSeeking}
        onLoadedMetadata={() => { if (videoRef.current) { setDuration(videoRef.current.duration); if (initialTime > 0) videoRef.current.currentTime = initialTime; } }}
        onPlay={() => { setPlaying(true); setIsLoading(false); }}
        onPause={() => setPlaying(false)}
        onPlaying={() => { setIsBuffering(false); setIsLoading(false); }}
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsLoading(false)}
      />

      {/* Watermark — bottom-right, subtle */}
      {started && (
        <div className="absolute bottom-14 right-4 text-[10px] text-white/[0.12] font-medium pointer-events-none select-none z-10 tracking-wide">
          smartincomeprogram.com
        </div>
      )}

      {/* Unmute banner for autoplay-muted */}
      {autoplayMuted && started && (
        <button
          onClick={(e) => { e.stopPropagation(); handleUnmute(); }}
          className="absolute top-4 left-4 z-30 flex items-center gap-2 px-3 py-2 bg-black/70 backdrop-blur-sm rounded-xl border border-white/10 text-white text-xs font-medium hover:bg-black/80 transition-colors"
        >
          <VolumeX size={14} /> Tap to unmute
        </button>
      )}

      {/* Center play button (only when autoplay failed or not enabled) */}
      {!started && !autoplay && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer z-20"
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
        >
          {poster && <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10">
            <button className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center hover:scale-110 transition-transform shadow-xl shadow-primary/25 backdrop-blur-sm">
              <Play size={36} className="ml-1 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Fallback play button when autoplay was completely blocked */}
      {!started && autoplay && !playing && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer z-20"
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
        >
          {poster && <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10">
            <button className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center hover:scale-110 transition-transform shadow-xl shadow-primary/25 backdrop-blur-sm">
              <Play size={36} className="ml-1 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Seek disabled notification */}
      {seekToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 bg-black/80 backdrop-blur-sm rounded-xl border border-white/10 text-white text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-300 shadow-xl">
          <AlertTriangle size={14} className="text-amber-400 shrink-0" />
          <span>Skipping forward is not allowed for this video</span>
        </div>
      )}

      {/* Loading / Buffering spinner */}
      {(isLoading || isBuffering) && started && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <Loader2 size={40} className="text-white/80 animate-spin" />
        </div>
      )}

      {/* Center pause indicator */}
      {started && !playing && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <Play size={28} className="ml-1 text-white" />
          </div>
        </div>
      )}

      {/* Controls bar */}
      {started && (
        <div
          className={`absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300 ${showControls || !playing ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          onClick={(e) => e.stopPropagation()}
          style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.8))" }}
        >
          {/* Progress bar */}
          <div
            className="h-[5px] mx-4 mt-2 cursor-pointer relative group/bar rounded-full"
            onClick={handleProgressClick}
          >
            <div className="absolute inset-0 rounded-full bg-white/10" />
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/20 transition-[width] duration-200" style={{ width: `${bufferedPct}%` }} />
            {!allowSeek && (
              <div
                className="absolute inset-y-0 rounded-r-full bg-white/[0.03]"
                style={{ left: `${maxWatchedPct}%`, right: 0 }}
              />
            )}
            <div className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-100" style={{ width: `${watchedPct}%` }} />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-primary ring-2 ring-white/90 shadow-lg opacity-0 group-hover/bar:opacity-100 transition-opacity"
              style={{ left: `calc(${watchedPct}% - 7px)` }}
            />
          </div>

          {/* Buttons row */}
          <div className="flex items-center gap-1.5 px-4 py-2.5 text-white">
            <button onClick={togglePlay} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
              {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>

            <span className="tabular-nums text-white/60 text-[12px] font-medium ml-1">
              {fmt(currentTime)}<span className="text-white/30 mx-1">/</span>{fmt(duration)}
            </span>

            <div className="flex-1" />

            <button
              onClick={() => { setMuted((p) => { if (videoRef.current) videoRef.current.muted = !p; return !p; }); setAutoplayMuted(false); }}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              {muted ? <VolumeX size={17} className="text-white/70" /> : <Volume2 size={17} className="text-white/70" />}
            </button>

            {allowSpeed && (
              <SpeedControl currentSpeed={speed} onSpeedChange={handleSpeedChange} />
            )}

            <button onClick={toggleFullscreen} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
              {isFullscreen ? <Minimize size={17} className="text-white/70" /> : <Maximize size={17} className="text-white/70" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Main Page ─── */
const PublicFunnel = () => {
  const { slug } = useParams();
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const [watchSeconds, setWatchSeconds] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: "", phone: "", email: "", city: "", custom_value: "", website: "" });
  const [paymentProof, setPaymentProof] = useState({ upi_transaction_id: "", amount: 0 });
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordUnlocked, setPasswordUnlocked] = useState(false);
  const [codeGateUnlocked, setCodeGateUnlocked] = useState(false);
  const [privateLeadSubmitted, setPrivateLeadSubmitted] = useState(false);
  const [pubTheme, setPubTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("sip-public-theme");
    return saved === "light" ? "light" : "dark";
  });
  const isDark = pubTheme === "dark";
  const togglePubTheme = () => {
    setPubTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem("sip-public-theme", next);
      return next;
    });
  };

  // Theme-aware color helpers
  const tc = {
    bg: isDark ? "#09090b" : "#ffffff",
    bgCard: isDark ? "#141419" : "#f8f9fa",
    border: isDark ? "#27272a" : "#e5e7eb",
    borderSubtle: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    text: isDark ? "#ffffff" : "#0f172a",
    textMuted: isDark ? "#cbd5e1" : "#64748b",
    textDim: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)",
    textDimmer: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.3)",
    inputBg: isDark ? "#09090b" : "#f1f5f9",
    inputBorder: isDark ? "#27272a" : "#d1d5db",
    inputText: isDark ? "#ffffff" : "#0f172a",
    placeholder: isDark ? "#64748b" : "#9ca3af",
    headerBg: isDark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.8)",
    shareText: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.4)",
    shareHover: isDark ? "#ffffff" : "rgba(0,0,0,0.7)",
    contactBg: isDark ? "rgba(9,9,11,0.95)" : "rgba(255,255,255,0.95)",
    footerText: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.25)",
    footerBorder: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)",
  };

  // Single combined fetch
  const { data: bundle, isLoading } = useQuery({
    queryKey: ["public-funnel-bundle", slug],
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-funnel-data?slug=${encodeURIComponent(slug!)}`,
        { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const funnel = bundle?.funnel;
  const videoAsset = bundle?.video;
  const creatorProfile = bundle?.creator;
  const formConfig = bundle?.formConfig;
  const priceOptions: any[] = bundle?.priceOptions || [];
  const funnelSteps: any[] = bundle?.steps || [];
  const isMultiStep = funnel?.funnel_mode === "multi" && funnelSteps.length > 0;

  const isDraft = funnel && !funnel.is_published;
  const canView = funnel && funnel.is_published;
  const isPrivateFunnel = funnel?.visibility === "private";
  const requiredFields = funnel?.required_fields || { email: false, city: false, state: false, whatsapp: false };

  // Check localStorage for existing code verification and lead submission
  useEffect(() => {
    if (!funnel) return;
    const codeVerified = localStorage.getItem(`nf_code_verified_${funnel.id}`);
    if (codeVerified) setCodeGateUnlocked(true);
    const leadStored = localStorage.getItem(`nf_lead_${funnel.id}`);
    if (leadStored) setPrivateLeadSubmitted(true);
  }, [funnel]);

  useEffect(() => {
    if (!funnel || funnel.cta_enabled !== true) return;
    if (!funnel.cta_timing_seconds) {
      setShowCta(true);
      return;
    }
    if (watchSeconds >= funnel.cta_timing_seconds) {
      setShowCta(true);
    }
  }, [funnel, watchSeconds]);

  // OG tags
  useEffect(() => {
    if (!funnel) return;
    document.title = `${funnel.title} | Smart Income Program`;
    const setMeta = (name: string, content: string, prop = false) => {
      const attr = prop ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    setMeta("description", funnel.description || funnel.title);
    setMeta("og:title", funnel.title, true);
    setMeta("og:description", funnel.description || funnel.title, true);
    setMeta("og:type", "website", true);
    setMeta("og:url", window.location.href, true);
    if (funnel.thumbnail_url) setMeta("og:image", funnel.thumbnail_url, true);
    setMeta("og:site_name", "Smart Income Program", true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", funnel.title);
    setMeta("twitter:description", funnel.description || funnel.title);
    if (funnel.thumbnail_url) setMeta("twitter:image", funnel.thumbnail_url);
  }, [funnel]);

  // Resume progress
  const savedProgress = funnel ? localStorage.getItem(`nevora_progress_${funnel.id}`) : null;
  const [resumePrompt, setResumePrompt] = useState(true);
  const parsedProgress = savedProgress ? JSON.parse(savedProgress) : null;

  // Save progress periodically
  useEffect(() => {
    if (!funnel || !videoPlaying) return;
    const interval = setInterval(() => {
      localStorage.setItem(`nevora_progress_${funnel.id}`, JSON.stringify({ lastPosition: watchSeconds, watchedAt: Date.now() }));
    }, 5000);
    return () => clearInterval(interval);
  }, [funnel, videoPlaying, watchSeconds]);

  const submitLead = useMutation({
    mutationFn: async () => {
      if (leadForm.website) return;
      await supabase.from("funnel_leads").insert({
        funnel_id: funnel!.id,
        name: leadForm.name || null, phone: leadForm.phone || null,
        email: leadForm.email || null, city: leadForm.city || null,
        custom_value: leadForm.custom_value || null,
        watch_progress_at_submit: watchSeconds,
        device_type: /Mobi/.test(navigator.userAgent) ? "mobile" : "desktop",
        user_agent: navigator.userAgent,
      });
    },
    onSuccess: () => { setLeadSubmitted(true); toast.success("Thank you! Your details have been submitted."); },
    onError: () => toast.error("Something went wrong. Please try again."),
  });

  const submitPayment = useMutation({
    mutationFn: async () => {
      await supabase.from("funnel_payments").insert({
        funnel_id: funnel!.id,
        amount: paymentProof.amount || priceOptions[0]?.amount || 0,
        upi_transaction_id: paymentProof.upi_transaction_id || null,
        payment_type: "upi_manual",
      });
    },
    onSuccess: () => { setPaymentSubmitted(true); toast.success("Payment proof submitted!"); },
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: tc.bg }}>
      <Loader2 size={32} className="text-primary animate-spin" />
    </div>
  );

  if (!canView) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: tc.bg }}>
      <div className="text-center">
        <h1 className="text-xl font-heading font-bold mb-2" style={{ color: tc.text }}>Funnel Not Found</h1>
        <p className="text-sm" style={{ color: tc.textMuted }}>This funnel doesn't exist or has been unpublished.</p>
      </div>
    </div>
  );

  // Password gate (legacy)
  if (funnel.visibility === "password" && !passwordUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: tc.bg }}>
        <div className="rounded-2xl p-8 w-full max-w-sm text-center" style={{ background: tc.bgCard, border: `1px solid ${tc.border}` }}>
          <Lock size={32} className="text-primary mx-auto mb-4" />
          <h2 className="text-lg font-heading font-semibold mb-2" style={{ color: tc.text }}>{funnel.title}</h2>
          <p className="text-sm mb-4" style={{ color: tc.textMuted }}>This funnel is password protected.</p>
          <Input type="password" placeholder="Enter password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} style={{ background: tc.inputBg, borderColor: tc.inputBorder, color: tc.inputText }} className="mb-3" />
          <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => setPasswordUnlocked(true)}>Unlock</Button>
        </div>
      </div>
    );
  }

  // Private funnel gate: Step 1 - Access Code
  if (isPrivateFunnel && !codeGateUnlocked) {
    return (
      <CodeGateScreen
        funnelId={funnel.id}
        funnelTitle={funnel.title}
        creatorName={creatorProfile?.full_name}
        onSuccess={() => setCodeGateUnlocked(true)}
        onLoginClick={() => {}}
        isDark={isDark}
      />
    );
  }

  // Private funnel gate: Step 2 - Lead Registration
  if (isPrivateFunnel && codeGateUnlocked && !privateLeadSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: tc.bg }}>
        <PrivateLeadForm
          funnelId={funnel.id}
          funnelTitle={funnel.title}
          requiredFields={requiredFields}
          onSuccess={() => setPrivateLeadSubmitted(true)}
          isDark={isDark}
        />
      </div>
    );
  }

  const ctaEnabled = funnel.cta_enabled === true;
  const hasLeadForm = formConfig?.capture_enabled;
  const showLeadFormNow = hasLeadForm && !leadSubmitted && formConfig.capture_timing === "before_video";
  const showLeadFormAfterCta = hasLeadForm && !leadSubmitted && formConfig.capture_timing === "after_cta" && showCta;
  const showLeadFormSidebar = hasLeadForm && !leadSubmitted && formConfig.capture_timing !== "before_video";
  const videoUrl = videoAsset?.public_url;
  const ctaTimingLeft = funnel.cta_timing_seconds ? Math.max(0, funnel.cta_timing_seconds - watchSeconds) : 0;
  const isVerified = creatorProfile?.kyc_status === "approved";

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied! Share it with your friends.");
  };

  const LeadFormCard = ({ className = "" }: { className?: string }) => (
    <div className={`rounded-2xl p-6 ${className}`} style={{ background: tc.bgCard, border: `1px solid ${tc.border}` }}>
      <h3 className="text-lg font-heading font-bold mb-1" style={{ color: tc.text }}>{funnel.cta_text || "Register Now"}</h3>
      <p className="text-xs mb-5" style={{ color: tc.textMuted }}>Fill in your details to continue</p>
      <form onSubmit={(e) => { e.preventDefault(); submitLead.mutate(); }} className="space-y-3">
        <input type="text" name="website" value={leadForm.website} onChange={(e) => setLeadForm({ ...leadForm, website: e.target.value })} style={{ position: "absolute", left: "-9999px" }} tabIndex={-1} autoComplete="off" />
        {formConfig?.show_name && (
          <Input placeholder="Full Name" value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} required={formConfig.name_required || false} style={{ background: tc.inputBg, borderColor: tc.inputBorder, color: tc.inputText }} className="h-12 rounded-xl" />
        )}
        {formConfig?.show_phone && (
          <div className="flex gap-2">
            <div className="flex items-center px-3 rounded-xl text-sm shrink-0 h-12" style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.textDim }}>+91</div>
            <Input placeholder="Phone number" value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} required={formConfig.phone_required || false} style={{ background: tc.inputBg, borderColor: tc.inputBorder, color: tc.inputText }} className="h-12 rounded-xl" />
          </div>
        )}
        {formConfig?.show_email && (
          <Input type="email" placeholder="Email" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} required={formConfig.email_required || false} style={{ background: tc.inputBg, borderColor: tc.inputBorder, color: tc.inputText }} className="h-12 rounded-xl" />
        )}
        {formConfig?.show_city && (
          <Input placeholder="City" value={leadForm.city} onChange={(e) => setLeadForm({ ...leadForm, city: e.target.value })} required={formConfig.city_required || false} style={{ background: tc.inputBg, borderColor: tc.inputBorder, color: tc.inputText }} className="h-12 rounded-xl" />
        )}
        {formConfig?.show_custom && (
          <Input placeholder={formConfig.custom_field_label || "Additional Info"} value={leadForm.custom_value} onChange={(e) => setLeadForm({ ...leadForm, custom_value: e.target.value })} required={formConfig.custom_required || false} style={{ background: tc.inputBg, borderColor: tc.inputBorder, color: tc.inputText }} className="h-12 rounded-xl" />
        )}
        <Button
          type="submit"
          className="w-full h-14 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
          disabled={submitLead.isPending}
        >
          {submitLead.isPending ? "Submitting..." : funnel.cta_text || "Get Started"} →
        </Button>
      </form>
    </div>
  );

  return (
    <div className="flex flex-col" style={{ background: tc.bg, minHeight: "100dvh" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between sticky top-0 z-50"
        style={{
          height: "52px",
          padding: "0 16px",
          borderBottom: `1px solid ${tc.borderSubtle}`,
          background: tc.headerBg,
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="Smart Income Program" className="h-6 w-6" />
          <span className="font-heading font-bold text-[15px]" style={{ color: tc.text, letterSpacing: "-0.02em" }}>Smart Income</span>
          <span className="font-heading font-extrabold text-primary text-[15px]" style={{ letterSpacing: "-0.03em", fontStyle: "italic", transform: "skewX(-4deg)", display: "inline-block", marginLeft: "-2px" }}>Flow</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={togglePubTheme}
            className="p-2 rounded-lg transition-colors"
            style={{ color: tc.shareText }}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={handleShare} className="p-2 rounded-lg transition-colors text-xs font-medium flex items-center gap-1.5" style={{ color: tc.shareText }}>
            <Share2 size={14} /> Share
          </button>
        </div>
      </div>

      {/* Main content */}
      {isMultiStep ? (
        <MultiStepViewer
          funnel={funnel}
          steps={funnelSteps}
          creatorProfile={creatorProfile}
          formConfig={formConfig}
          priceOptions={priceOptions}
          VideoPlayer={CustomVideoPlayer}
          isDark={isDark}
        />
      ) : (
      <div className="flex-1 flex flex-col max-w-6xl mx-auto px-4 py-8 w-full">
        <div className="text-center mb-8">
          <h1
            className="font-heading font-extrabold tracking-tight leading-tight"
            style={{ fontSize: "clamp(20px, 3vw, 36px)", letterSpacing: "-0.02em", color: tc.text }}
          >
            {funnel.title}
          </h1>
          {funnel.description && <p style={{ fontSize: "15px", color: tc.textDim, lineHeight: "1.6" }} className="mt-3 max-w-xl mx-auto">{funnel.description}</p>}
        </div>
          <>
        {/* Lead form before video */}
        {showLeadFormNow && <LeadFormCard className="max-w-md mx-auto mb-8" />}

        {/* Two-column layout */}
        {(!showLeadFormNow || leadSubmitted) && (
          <div className={`${showLeadFormSidebar && !leadSubmitted ? "lg:grid lg:grid-cols-[1fr_380px] lg:gap-8" : "max-w-4xl mx-auto"}`}>
            {/* Left: Video + Creator */}
            <div className="space-y-5">
              {videoUrl && (
                <CustomVideoPlayer
                  src={videoUrl}
                  poster={funnel.thumbnail_url || videoAsset?.thumbnail_url || undefined}
                  allowSeek={funnel.allow_seek !== false}
                  allowSpeed={funnel.allow_speed_change !== false}
                  autoplay={true}
                  onTimeUpdate={(ct, dur) => { setWatchSeconds(Math.floor(ct)); setVideoDuration(dur); }}
                  onPlay={() => setVideoPlaying(true)}
                />
              )}
              {!videoUrl && (
                <div className="aspect-video rounded-2xl flex items-center justify-center" style={{ background: tc.bgCard, border: `1px solid ${tc.borderSubtle}` }}>
                  <Play size={48} style={{ color: tc.textDimmer }} />
                </div>
              )}

              {/* Speaker Card */}
              {(() => {
                const speakerMode = funnel.speaker_mode || "account";
                const showSpeaker = speakerMode !== "none";
                if (!showSpeaker) return null;

                let speakerName = "";
                let speakerPhoto = "";
                let speakerAbout = "";
                if (speakerMode === "account") {
                  speakerName = creatorProfile?.full_name || "";
                  speakerPhoto = creatorProfile?.avatar_url || "";
                  speakerAbout = creatorProfile?.bio || "";
                } else {
                  speakerName = funnel.speaker_name || "";
                  speakerPhoto = funnel.speaker_photo_url || "";
                  speakerAbout = funnel.speaker_about || "";
                }

                if (!speakerName) return null;

                return (
                  <div className="flex items-center gap-3.5 py-4" style={{ borderTop: `1px solid ${tc.border}`, marginTop: "16px" }}>
                    <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center overflow-hidden shrink-0" style={{ border: "2px solid hsl(var(--primary))" }}>
                      {speakerPhoto ? (
                        <img src={speakerPhoto} alt={speakerName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-primary/15 flex items-center justify-center">
                          <span className="text-primary font-heading font-bold text-lg">{speakerName.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="font-heading font-bold text-[15px]" style={{ color: tc.text }}>{speakerName}</p>
                        {speakerMode === "account" && isVerified && <BadgeCheck size={15} className="text-primary flex-shrink-0" />}
                      </div>
                      {speakerAbout && (
                        <p className="text-[13px] mt-0.5 line-clamp-2" style={{ color: tc.textMuted }}>{speakerAbout}</p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Video Topics */}
              {funnel.video_topics_enabled && Array.isArray(funnel.video_topics) && funnel.video_topics.filter((t: string) => t?.trim()).length > 0 && (
                <div className="rounded-2xl p-5" style={{ background: tc.bgCard, border: `1px solid ${tc.border}`, marginTop: "20px" }}>
                  <h3 className="font-heading font-bold text-[16px] mb-3.5" style={{ color: tc.text }}>What you'll learn in this session</h3>
                  <div className="space-y-0">
                    {funnel.video_topics.filter((t: string) => t?.trim()).map((topic: string, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 py-2"
                        style={{ borderBottom: idx < funnel.video_topics.filter((t: string) => t?.trim()).length - 1 ? `1px solid ${tc.border}` : "none" }}
                      >
                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(34,197,94,0.12)" }}>
                          <Check size={11} className="text-emerald-500" />
                        </div>
                        <span className="text-[14px] leading-relaxed" style={{ color: tc.text }}>{topic}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={showLeadFormSidebar && !leadSubmitted ? "lg:hidden" : ""}>
                {ctaEnabled && showCta && (
                  <Button
                    className="w-full h-14 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg shadow-primary/20 cta-pulse"
                    onClick={() => funnel.cta_url ? window.open(funnel.cta_url, "_blank") : null}
                  >
                    {funnel.cta_text || "Get Started"} →
                  </Button>
                )}
                {ctaEnabled && funnel.lock_cta && !showCta && videoPlaying && (
                  <Button disabled className="w-full h-14 text-base rounded-xl cursor-not-allowed" style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", color: tc.textDimmer, border: `1px solid ${tc.borderSubtle}` }}>
                    🔒 {funnel.cta_text || "Get Started"} — unlocks in {Math.floor(ctaTimingLeft / 60)}:{(ctaTimingLeft % 60).toString().padStart(2, "0")}
                  </Button>
                )}
              </div>

              {showLeadFormAfterCta && <div className="lg:hidden"><LeadFormCard /></div>}
            </div>

            {/* Right sidebar */}
            {showLeadFormSidebar && !leadSubmitted && (
              <div className="hidden lg:block sticky top-6 self-start">
                <LeadFormCard />
                {ctaEnabled && showCta && funnel.cta_url && (
                  <Button
                    className="w-full h-14 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg shadow-primary/20 mt-4 cta-pulse"
                    onClick={() => window.open(funnel.cta_url!, "_blank")}
                  >
                    {funnel.cta_text || "Get Started"} →
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {showLeadFormAfterCta && !showLeadFormSidebar && <LeadFormCard className="max-w-md mx-auto mt-6" />}

        {/* Payment Section */}
        {funnel.payment_enabled && leadSubmitted && !paymentSubmitted && (
          <div className="rounded-2xl p-6 max-w-md mx-auto mt-6" style={{ background: tc.bgCard, border: `1px solid ${tc.border}` }}>
            <h3 className="text-lg font-heading font-semibold mb-4" style={{ color: tc.text }}>Complete Payment</h3>
            {priceOptions.length > 0 && (
              <div className="space-y-2 mb-4">
                {priceOptions.map((opt: any) => (
                  <button key={opt.id} onClick={() => setPaymentProof({ ...paymentProof, amount: opt.amount })}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${paymentProof.amount === opt.amount ? "border-primary bg-primary/10" : ""}`}
                    style={paymentProof.amount !== opt.amount ? { borderColor: tc.border, background: tc.inputBg } : {}}>
                    <div className="flex justify-between items-center">
                      <span className="font-medium" style={{ color: tc.text }}>{opt.label}</span>
                      <span className="font-heading font-bold" style={{ color: tc.text }}>₹{opt.amount.toLocaleString("en-IN")}</span>
                    </div>
                    {opt.description && <p className="text-xs mt-1" style={{ color: tc.textMuted }}>{opt.description}</p>}
                  </button>
                ))}
              </div>
            )}
            {funnel.upi_id && (
              <div className="p-3 rounded-xl mb-4" style={{ background: tc.inputBg }}>
                <Label className="text-xs" style={{ color: tc.textMuted }}>Pay via UPI</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm text-primary flex-1">{funnel.upi_id}</code>
                  <Button variant="ghost" size="sm" style={{ color: tc.textMuted }} onClick={() => { navigator.clipboard.writeText(funnel.upi_id!); toast.success("UPI ID copied!"); }}>Copy</Button>
                </div>
              </div>
            )}
            {funnel.qr_code_url && <img src={funnel.qr_code_url} alt="QR Code" className="w-48 h-48 mx-auto mb-4 rounded-xl" />}
            {funnel.payment_instructions && <p className="text-sm mb-4" style={{ color: tc.textMuted }}>{funnel.payment_instructions}</p>}
            <div className="space-y-3">
              <Input placeholder="UPI Transaction ID (optional)" value={paymentProof.upi_transaction_id} onChange={(e) => setPaymentProof({ ...paymentProof, upi_transaction_id: e.target.value })} style={{ background: tc.inputBg, borderColor: tc.inputBorder, color: tc.inputText }} className="h-12 rounded-xl" />
              <Button className="w-full h-14 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl" onClick={() => submitPayment.mutate()} disabled={submitPayment.isPending}>
                {submitPayment.isPending ? "Submitting..." : "I've Made the Payment"}
              </Button>
            </div>
          </div>
        )}

        {paymentSubmitted && (
          <div className="rounded-2xl p-6 text-center max-w-md mx-auto mt-6" style={{ background: tc.bgCard, border: `1px solid ${tc.border}` }}>
            <Check size={32} className="text-green-500 mx-auto mb-3" />
            <h3 className="font-heading font-semibold" style={{ color: tc.text }}>Payment Under Review</h3>
            <p className="text-sm mt-1" style={{ color: tc.textMuted }}>Your payment proof has been submitted. You'll be notified once it's verified.</p>
          </div>
        )}
        </>

        {funnel.show_contact_buttons && (leadSubmitted || !funnel.show_contact_after_cta) && (
          <div className="fixed bottom-0 left-0 right-0 p-4 backdrop-blur-xl flex gap-3 justify-center z-50" style={{ background: tc.contactBg, borderTop: `1px solid ${tc.borderSubtle}` }}>
            {funnel.contact_whatsapp && (
              <Button className="bg-[#25d366] hover:bg-[#20b858] text-white" onClick={() => window.open(`https://wa.me/${funnel.contact_whatsapp?.replace(/\D/g, "")}`)}>
                <MessageCircle size={16} /> WhatsApp
              </Button>
            )}
            {funnel.contact_phone && (
              <Button style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", color: tc.text, border: `1px solid ${tc.borderSubtle}` }} onClick={() => window.open(`tel:${funnel.contact_phone}`)}>
                <PhoneIcon size={16} /> Call
              </Button>
            )}
          </div>
        )}

        {/* Spacer to push footer down */}
        <div className="flex-1" />

        {/* Footer */}
        <div className="mt-16 pt-6 pb-8 text-center" style={{ borderTop: `1px solid ${tc.footerBorder}` }}>
          <p className="text-[11px] tracking-wide" style={{ color: tc.footerText }}>© {new Date().getFullYear()} Smart Income Program · All rights reserved</p>
        </div>
      </div>
      )}

      {/* CTA pulse animation */}
      <style>{`
        .cta-pulse {
          animation: ctaPulse 2s ease-in-out infinite;
        }
        @keyframes ctaPulse {
          0%, 100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.4); }
          50% { box-shadow: 0 0 0 8px hsl(var(--primary) / 0); }
        }
      `}</style>
    </div>
  );
};

export default PublicFunnel;
