import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { StepCodeGate } from "./StepCodeGate";
import {
  Play, Lock, Check, CheckCircle2, Circle, ExternalLink,
  Calendar, CreditCard, ClipboardList, UserCheck, ChevronRight,
  Loader2, MessageCircle, Phone as PhoneIcon, BadgeCheck, Info, Sparkles,
  Timer, Trophy, SkipForward
} from "lucide-react";

interface FunnelStep {
  id: string;
  step_order: number;
  title: string;
  description: string | null;
  step_type: string;
  video_asset_id: string | null;
  is_active: boolean;
  unlock_rule_type: string;
  unlock_rule_value: string | null;
  cta_text: string | null;
  cta_url: string | null;
  booking_url: string | null;
  video_url?: string | null;
  video_thumbnail?: string | null;
  unlock_condition?: string;
  unlock_percentage?: number;
  time_delay_enabled?: boolean;
  time_delay_minutes?: number;
  speaker_mode_step?: string;
  speaker_name_custom?: string;
  speaker_title?: string;
  speaker_bio?: string;
  speaker_photo_url_custom?: string;
  video_topics_step_enabled?: boolean;
  video_topics_step?: Array<{ icon: string; text: string }>;
  timer_cta_enabled?: boolean;
  timer_cta_text?: string;
  timer_cta_url?: string;
  timer_cta_style?: string;
  access_code_enabled?: boolean;
  access_code_message?: string;
}

interface StepProgress {
  funnel_step_id: string;
  status: string;
  max_watched_seconds: number;
  watched_percentage: number;
  last_position_seconds: number;
  completed_at: string | null;
  manually_unlocked?: boolean;
  condition_met_at?: string | null;
  time_spent_seconds?: number;
}

interface MultiStepViewerProps {
  funnel: any;
  steps: FunnelStep[];
  creatorProfile: any;
  formConfig: any;
  priceOptions: any[];
  VideoPlayer: React.ComponentType<any>;
  isDark?: boolean;
}

const STEP_ICONS: Record<string, React.ComponentType<any>> = {
  video: Play,
  lead_form: ClipboardList,
  cta: ExternalLink,
  payment: CreditCard,
  manual_approval: UserCheck,
  booking: Calendar,
};

const STEP_TYPE_LABELS: Record<string, string> = {
  video: "Video",
  lead_form: "Lead Form",
  cta: "CTA / Link",
  payment: "Payment",
  manual_approval: "Manual Approval",
  booking: "Booking",
};

const getSessionId = (funnelId: string): string => {
  const key = `nf_session_${funnelId}`;
  let sid = localStorage.getItem(key);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(key, sid);
  }
  return sid;
};

/* ─── Unlock check ─── */
interface UnlockResult {
  unlocked: boolean;
  reason?: string;
  unlockAt?: number;
  remainingMs?: number;
}

const checkStepUnlock = (
  step: FunnelStep,
  stepIndex: number,
  prevProgress: StepProgress | null
): UnlockResult => {
  if (stepIndex === 0) return { unlocked: true };
  if (!prevProgress) return { unlocked: false, reason: "previous_not_started" };

  const condition = step.unlock_condition || "full_watch";
  const watchPct = prevProgress.watched_percentage || 0;
  const timeSpent = prevProgress.time_spent_seconds || 0;

  let conditionMet = false;
  if (condition === "full_watch") {
    conditionMet = watchPct >= 95 || prevProgress.status === "completed";
  } else if (condition === "percentage") {
    conditionMet = watchPct >= (step.unlock_percentage || 80);
  } else if (condition === "time_spent") {
    const requiredSeconds = (step.unlock_percentage || 10) * 60;
    conditionMet = timeSpent >= requiredSeconds;
  } else {
    const rule = step.unlock_rule_type;
    if (rule === "auto") return { unlocked: true };
    if (rule === "manual") return { unlocked: false, reason: "manual" };
    if (rule === "watch_complete") conditionMet = prevProgress.status === "completed";
    else if (rule === "watch_seconds") conditionMet = prevProgress.max_watched_seconds >= parseInt(step.unlock_rule_value || "0");
    else if (rule === "watch_percent") conditionMet = watchPct >= parseInt(step.unlock_rule_value || "0");
    else conditionMet = prevProgress.status === "completed";
  }

  if (!conditionMet) return { unlocked: false, reason: "condition_not_met" };

  if (step.time_delay_enabled && (step.time_delay_minutes || 0) > 0) {
    const conditionMetAt = prevProgress.condition_met_at || prevProgress.completed_at;
    if (!conditionMetAt) return { unlocked: false, reason: "delay_waiting" };

    const delayMs = (step.time_delay_minutes || 0) * 60 * 1000;
    const unlockAt = new Date(conditionMetAt).getTime() + delayMs;
    const now = Date.now();

    if (now < unlockAt) {
      return { unlocked: false, reason: "delay_countdown", unlockAt, remainingMs: unlockAt - now };
    }
  }

  return { unlocked: true };
};

/* ─── Per-step Speaker Card ─── */
const StepSpeakerCard = ({ funnel, step, creatorProfile, isDark }: { funnel: any; step: FunnelStep; creatorProfile: any; isDark: boolean }) => {
  const sc = {
    cardBg: isDark ? "#1a1a1a" : "#ffffff",
    cardBorder: isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb",
    text: isDark ? "#ffffff" : "#0f172a",
    textMuted: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
  };

  let speaker: { name: string; title?: string; bio?: string; photo?: string } | null = null;

  if (funnel.speaker_scope === "per_step") {
    const mode = step.speaker_mode_step || "none";
    if (mode === "none") return null;
    if (mode === "account" && creatorProfile) {
      speaker = { name: creatorProfile.full_name, photo: creatorProfile.avatar_url, bio: creatorProfile.bio };
    } else if (mode === "custom") {
      speaker = { name: step.speaker_name_custom || "", title: step.speaker_title || "", bio: step.speaker_bio || "", photo: step.speaker_photo_url_custom || "" };
    }
  } else {
    if (funnel.speaker_mode === "none") return null;
    if (funnel.speaker_mode === "account" && creatorProfile) {
      speaker = { name: creatorProfile.full_name, photo: creatorProfile.avatar_url, bio: creatorProfile.bio };
    } else if (funnel.speaker_mode === "custom") {
      speaker = { name: funnel.speaker_name, bio: funnel.speaker_about, photo: funnel.speaker_photo_url };
    }
  }

  if (!speaker || !speaker.name) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: sc.cardBg, border: `1px solid ${sc.cardBorder}` }}>
      {speaker.photo && <img src={speaker.photo} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />}
      <div className="min-w-0">
        <p className="font-semibold text-sm" style={{ color: sc.text }}>{speaker.name}</p>
        {speaker.title && <p className="text-xs mt-0.5" style={{ color: "#D4AF37" }}>{speaker.title}</p>}
        {speaker.bio && <p className="text-xs mt-1" style={{ color: sc.textMuted }}>{speaker.bio}</p>}
      </div>
    </div>
  );
};

/* ─── Per-step Video Topics ─── */
const StepVideoTopics = ({ funnel, step, isDark }: { funnel: any; step: FunnelStep; isDark: boolean }) => {
  const sc = {
    cardBg: isDark ? "#1a1a1a" : "#ffffff",
    cardBorder: isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb",
    text: isDark ? "#ffffff" : "#0f172a",
    textMuted: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
  };

  let topics: Array<{ icon: string; text: string }> = [];

  if (funnel.video_topics_scope === "per_step") {
    if (step.video_topics_step_enabled && step.video_topics_step && step.video_topics_step.length > 0) {
      topics = step.video_topics_step;
    }
  } else {
    if (funnel.video_topics_enabled && funnel.video_topics && funnel.video_topics.length > 0) {
      topics = funnel.video_topics;
    }
  }

  if (topics.length === 0) return null;

  return (
    <div className="rounded-xl p-4 space-y-2" style={{ background: sc.cardBg, border: `1px solid ${sc.cardBorder}` }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: sc.textMuted }}>Key Points</p>
      <ul className="space-y-1.5">
        {topics.map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: sc.text }}>
            <span className="shrink-0">{t.icon || "✅"}</span>
            <span>{t.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* ─── Up Next Section ─── */
const UpNextSection = ({
  nextStep,
  nextStepIndex,
  totalSteps,
  unlockResult,
  countdownUnlockAt,
  currentWatchPct,
  onPlayNext,
  onCountdownComplete,
  isDark,
}: {
  nextStep: FunnelStep | null;
  nextStepIndex: number;
  totalSteps: number;
  unlockResult: UnlockResult | null;
  countdownUnlockAt: number | null;
  currentWatchPct: number;
  onPlayNext: () => void;
  onCountdownComplete: () => void;
  isDark: boolean;
}) => {
  const sc = {
    cardBg: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
    cardBorder: isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb",
    text: isDark ? "#ffffff" : "#0f172a",
    textMuted: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
    textDim: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)",
  };

  // State D: Last step
  if (!nextStep) {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: sc.cardBg, border: `1px solid ${sc.cardBorder}` }}>
        <Trophy size={32} className="mx-auto mb-3" style={{ color: "#D4AF37" }} />
        <p className="font-semibold text-sm" style={{ color: sc.text }}>You're on the final step!</p>
        <p className="text-xs mt-1" style={{ color: sc.textMuted }}>Complete this video to finish the program.</p>
      </div>
    );
  }

  // State B: Countdown active
  if (countdownUnlockAt) {
    return (
      <UpNextCountdown
        nextStep={nextStep}
        nextStepIndex={nextStepIndex}
        unlockAt={countdownUnlockAt}
        onUnlock={onCountdownComplete}
        isDark={isDark}
      />
    );
  }

  // State A: Unlocked and ready
  if (unlockResult?.unlocked) {
    return (
      <div
        className="rounded-2xl p-5 flex items-center justify-between gap-4 cursor-pointer hover:opacity-90 transition-opacity"
        style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.2)" }}
        onClick={onPlayNext}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(212,175,55,0.15)" }}>
            <SkipForward size={18} style={{ color: "#D4AF37" }} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#D4AF37" }}>Up Next</p>
            <p className="font-semibold text-sm truncate" style={{ color: sc.text }}>
              Step {nextStepIndex + 1}: {nextStep.title || `Step ${nextStepIndex + 1}`}
            </p>
            <p className="text-xs" style={{ color: sc.textMuted }}>
              {STEP_TYPE_LABELS[nextStep.step_type] || nextStep.step_type}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shrink-0"
          onClick={(e) => { e.stopPropagation(); onPlayNext(); }}
        >
          Play Now →
        </Button>
      </div>
    );
  }

  // State C: Locked by condition
  const cond = nextStep.unlock_condition || "full_watch";
  const requiredPct = cond === "percentage" ? (nextStep.unlock_percentage || 80) : cond === "full_watch" ? 95 : 0;
  const progressToward = requiredPct > 0 ? Math.min(100, (currentWatchPct / requiredPct) * 100) : 0;

  let conditionText = "Watch the previous video fully to unlock.";
  if (cond === "percentage") conditionText = `Watch at least ${nextStep.unlock_percentage || 80}% of the current video to unlock.`;
  if (cond === "time_spent") conditionText = `Spend at least ${nextStep.unlock_percentage || 10} minutes on the current step.`;

  return (
    <div className="rounded-2xl p-5" style={{ background: sc.cardBg, border: `1px solid ${sc.cardBorder}` }}>
      <div className="flex items-center gap-2 mb-3">
        <Lock size={14} style={{ color: sc.textDim }} />
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: sc.textDim }}>Up Next — Locked</p>
      </div>
      <p className="font-semibold text-sm mb-1" style={{ color: sc.text }}>
        Step {nextStepIndex + 1}: {nextStep.title || `Step ${nextStepIndex + 1}`}
      </p>
      <p className="text-xs mb-3" style={{ color: sc.textMuted }}>{conditionText}</p>
      {requiredPct > 0 && (
        <div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressToward}%`, background: "linear-gradient(90deg, #D4AF37, #B8960C)" }}
            />
          </div>
          <p className="text-[11px] mt-1.5" style={{ color: sc.textMuted }}>
            {Math.floor(currentWatchPct)}% / {requiredPct}% needed
          </p>
        </div>
      )}
    </div>
  );
};

/* ─── Up Next Countdown (State B) ─── */
const UpNextCountdown = ({
  nextStep,
  nextStepIndex,
  unlockAt,
  onUnlock,
  isDark,
}: {
  nextStep: FunnelStep;
  nextStepIndex: number;
  unlockAt: number;
  onUnlock: () => void;
  isDark: boolean;
}) => {
  const [remaining, setRemaining] = useState(Math.max(0, unlockAt - Date.now()));
  const totalDuration = useRef(Math.max(1, unlockAt - Date.now()));

  useEffect(() => {
    totalDuration.current = Math.max(1, unlockAt - Date.now() + remaining);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const r = unlockAt - Date.now();
      if (r <= 0) {
        clearInterval(interval);
        setRemaining(0);
        onUnlock();
      } else {
        setRemaining(r);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [unlockAt, onUnlock]);

  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const progressPct = Math.min(100, Math.max(0, ((totalDuration.current - remaining) / totalDuration.current) * 100));

  const boxStyle = {
    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    borderRadius: "12px",
    padding: "12px 16px",
    minWidth: "70px",
    textAlign: "center" as const,
  };

  return (
    <div className="rounded-2xl p-6 text-center space-y-4" style={{ background: isDark ? "rgba(212,175,55,0.04)" : "rgba(212,175,55,0.03)", border: "1px solid rgba(212,175,55,0.15)" }}>
      <div className="flex items-center justify-center gap-2">
        <Lock size={16} style={{ color: "#D4AF37" }} />
        <p className="text-sm font-semibold" style={{ color: "#D4AF37" }}>Next step unlocks in</p>
      </div>

      <p className="font-semibold text-sm" style={{ color: isDark ? "#fff" : "#0f172a" }}>
        Step {nextStepIndex + 1}: {nextStep.title}
      </p>

      <div className="flex items-center justify-center gap-3">
        {hours > 0 && (
          <div style={boxStyle}>
            <span className="text-3xl font-bold font-mono" style={{ color: "#D4AF37" }}>{hours}</span>
            <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }}>hr</p>
          </div>
        )}
        <div style={boxStyle}>
          <span className="text-3xl font-bold font-mono" style={{ color: "#D4AF37" }}>{minutes.toString().padStart(2, "0")}</span>
          <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }}>min</p>
        </div>
        <span className="text-2xl font-bold" style={{ color: "rgba(212,175,55,0.4)" }}>:</span>
        <div style={boxStyle}>
          <span className="text-3xl font-bold font-mono" style={{ color: "#D4AF37" }}>{seconds.toString().padStart(2, "0")}</span>
          <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }}>sec</p>
        </div>
      </div>

      {/* Countdown progress bar */}
      <div className="max-w-[240px] mx-auto">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #D4AF37, #B8960C)" }} />
        </div>
      </div>

      <p className="text-xs" style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }}>
        Great job! This step will unlock automatically.
      </p>
    </div>
  );
};

/* ─── Video End Overlay ─── */
const VideoEndOverlay = ({
  nextStep,
  nextStepIndex,
  onPlayNow,
  onStayHere,
  isDark,
}: {
  nextStep: FunnelStep;
  nextStepIndex: number;
  onPlayNow: () => void;
  onStayHere: () => void;
  isDark: boolean;
}) => {
  const [countdown, setCountdown] = useState(5);
  const svgSize = 64;
  const strokeWidth = 3;
  const radius = (svgSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          onPlayNow();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onPlayNow]);

  const dashOffset = circumference * (countdown / 5);

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center animate-in fade-in duration-300"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(4px)" }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: "#D4AF37" }}>Up Next</p>
      <p className="font-bold text-lg text-white mb-1">{nextStep.title || `Step ${nextStepIndex + 1}`}</p>
      <p className="text-xs text-white/50 mb-6">Step {nextStepIndex + 1}</p>

      <div className="relative mb-6">
        <svg width={svgSize} height={svgSize} className="-rotate-90">
          <circle cx={svgSize / 2} cy={svgSize / 2} r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} fill="none" />
          <circle
            cx={svgSize / 2} cy={svgSize / 2} r={radius}
            stroke="#D4AF37" strokeWidth={strokeWidth} fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white">{countdown}</span>
      </div>

      <p className="text-xs text-white/50 mb-6">Playing in {countdown}s</p>

      <div className="flex gap-3">
        <Button
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6"
          onClick={(e) => { e.stopPropagation(); onPlayNow(); }}
        >
          Play Now
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10 font-medium px-6"
          onClick={(e) => { e.stopPropagation(); onStayHere(); }}
        >
          Stay Here
        </Button>
      </div>
    </div>
  );
};

/* ═══════════ MAIN COMPONENT ═══════════ */
export const MultiStepViewer = ({
  funnel,
  steps,
  creatorProfile,
  formConfig,
  priceOptions,
  VideoPlayer,
  isDark = true,
}: MultiStepViewerProps) => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [progressMap, setProgressMap] = useState<Record<string, StepProgress>>({});
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: "", phone: "", email: "", city: "", custom_value: "", website: "" });
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [paymentProof, setPaymentProof] = useState({ upi_transaction_id: "", amount: 0 });
  const [loading, setLoading] = useState(true);
  const [countdownUnlocks, setCountdownUnlocks] = useState<Record<string, number>>({});
  const [showEndOverlay, setShowEndOverlay] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [stepCodeUnlocked, setStepCodeUnlocked] = useState<Record<string, boolean>>({});

  // Check localStorage for previously unlocked step codes
  useEffect(() => {
    const unlocked: Record<string, boolean> = {};
    for (const step of steps) {
      if (step.access_code_enabled) {
        const key = `nf_step_code_${step.id}_${sessionId.current}`;
        if (localStorage.getItem(key) === "true") {
          unlocked[step.id] = true;
        }
      }
    }
    setStepCodeUnlocked(unlocked);
  }, [steps]);
  const [countdownNow, setCountdownNow] = useState(Date.now());
  const sessionId = useRef(getSessionId(funnel.id));
  const progressSaveTimer = useRef<ReturnType<typeof setInterval>>();
  const contentRef = useRef<HTMLDivElement>(null);

  // Tick every second for countdown display
  useEffect(() => {
    const hasActive = Object.keys(countdownUnlocks).length > 0;
    if (!hasActive) return;
    const t = setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [countdownUnlocks]);

  useEffect(() => {
    const loadProgress = async () => {
      const { data } = await supabase
        .from("funnel_step_progress")
        .select("funnel_step_id, status, max_watched_seconds, watched_percentage, last_position_seconds, completed_at, condition_met_at, time_spent_seconds")
        .eq("funnel_id", funnel.id)
        .eq("session_id", sessionId.current);

      const map: Record<string, StepProgress> = {};
      if (data) {
        for (const p of data) {
          map[p.funnel_step_id] = p as any;
        }
      }

      const countdowns: Record<string, number> = {};
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (!map[step.id]) {
          const status = i === 0 ? "unlocked" : "locked";
          map[step.id] = {
            funnel_step_id: step.id, status, max_watched_seconds: 0,
            watched_percentage: 0, last_position_seconds: 0, completed_at: null,
            condition_met_at: null, time_spent_seconds: 0,
          };
          await supabase.from("funnel_step_progress").insert({
            funnel_id: funnel.id, funnel_step_id: step.id, session_id: sessionId.current, status,
          });
        }

        if (i > 0) {
          const prevProgress = map[steps[i - 1].id];
          const result = checkStepUnlock(step, i, prevProgress);
          if (result.unlocked && map[step.id].status === "locked") {
            map[step.id].status = "unlocked";
            supabase.from("funnel_step_progress").update({ status: "unlocked" })
              .eq("funnel_id", funnel.id).eq("funnel_step_id", step.id).eq("session_id", sessionId.current).then(() => {});
          }
          if (!result.unlocked && result.reason === "delay_countdown" && result.unlockAt) {
            countdowns[step.id] = result.unlockAt;
          }
        }
      }

      setProgressMap(map);
      setCountdownUnlocks(countdowns);

      let furthest = 0;
      for (let i = 0; i < steps.length; i++) {
        const p = map[steps[i].id];
        if (p && (p.status === "unlocked" || p.status === "in_progress" || p.status === "completed")) furthest = i;
        // If this step has a countdown, it's the furthest the user should see
        if (countdowns[steps[i].id]) { furthest = i; break; }
      }
      // Navigate to the furthest non-completed step, or the countdown step
      if (countdowns[steps[furthest]?.id]) {
        setActiveStepIndex(furthest);
      } else {
        for (let i = 0; i <= furthest; i++) {
          const p = map[steps[i].id];
          if (p && p.status !== "completed") { setActiveStepIndex(i); break; }
          if (i === furthest) setActiveStepIndex(furthest);
        }
      }

      setLoading(false);
    };
    if (steps.length > 0) loadProgress();
    else setLoading(false);
  }, [funnel.id, steps]);

  const getStepStatus = (stepId: string): string => progressMap[stepId]?.status || "locked";

  const updateStepProgress = useCallback(async (stepId: string, updates: Partial<StepProgress>) => {
    setProgressMap((prev) => ({ ...prev, [stepId]: { ...prev[stepId], ...updates } }));
    await supabase.from("funnel_step_progress").update(updates as any)
      .eq("funnel_id", funnel.id).eq("funnel_step_id", stepId).eq("session_id", sessionId.current);
  }, [funnel.id]);

  const tryUnlockNext = useCallback(async (completedStepIndex: number) => {
    if (completedStepIndex + 1 >= steps.length) return;
    const nextStep = steps[completedStepIndex + 1];
    const currentProgress = progressMap[steps[completedStepIndex].id];
    const result = checkStepUnlock(nextStep, completedStepIndex + 1, currentProgress);

    if (result.unlocked) {
      const nextStatus = progressMap[nextStep.id]?.status;
      if (nextStatus === "locked") await updateStepProgress(nextStep.id, { status: "unlocked" });
      setCountdownUnlocks((prev) => { const n = { ...prev }; delete n[nextStep.id]; return n; });
    } else if (result.reason === "delay_countdown" && result.unlockAt) {
      if (!currentProgress?.condition_met_at) {
        await updateStepProgress(steps[completedStepIndex].id, { condition_met_at: new Date().toISOString() });
      }
      setCountdownUnlocks((prev) => ({ ...prev, [nextStep.id]: result.unlockAt! }));
      // Auto-navigate to the timer-locked step so the countdown shows there
      setActiveStepIndex(completedStepIndex + 1);
    }
  }, [steps, progressMap, updateStepProgress]);

  const completeStep = useCallback(async (stepIndex: number) => {
    const step = steps[stepIndex];
    const completedUpdate: Partial<StepProgress> = {
      status: "completed", completed_at: new Date().toISOString(),
    };
    if (!progressMap[step.id]?.condition_met_at) {
      completedUpdate.condition_met_at = new Date().toISOString();
    }
    await updateStepProgress(step.id, completedUpdate);
    await tryUnlockNext(stepIndex);
  }, [steps, progressMap, updateStepProgress, tryUnlockNext]);

  const handleVideoTimeUpdate = useCallback((stepIndex: number, currentTime: number, duration: number) => {
    const step = steps[stepIndex];
    const progress = progressMap[step.id];
    if (!progress) return;

    const maxWatched = Math.max(progress.max_watched_seconds, Math.floor(currentTime));
    const pct = duration > 0 ? Math.floor((maxWatched / duration) * 100) : 0;

    const updates: Partial<StepProgress> = {
      status: progress.status === "unlocked" ? "in_progress" : progress.status,
      max_watched_seconds: maxWatched,
      watched_percentage: pct,
      last_position_seconds: Math.floor(currentTime),
    };

    if (stepIndex + 1 < steps.length && !progress.condition_met_at) {
      const nextStep = steps[stepIndex + 1];
      const cond = nextStep.unlock_condition || "full_watch";
      let justMet = false;
      if (cond === "full_watch" && pct >= 95) justMet = true;
      if (cond === "percentage" && pct >= (nextStep.unlock_percentage || 80)) justMet = true;
      if (justMet) updates.condition_met_at = new Date().toISOString();
    }

    setProgressMap((prev) => ({ ...prev, [step.id]: { ...prev[step.id], ...updates } }));

    if (pct >= 95 && progress.status !== "completed") {
      completeStep(stepIndex);
      // Show end overlay if next step is available
      if (stepIndex + 1 < steps.length) {
        const nextStep = steps[stepIndex + 1];
        const nextResult = checkStepUnlock(nextStep, stepIndex + 1, { ...progress, ...updates, status: "completed" });
        if (nextResult.unlocked) {
          setShowEndOverlay(true);
        }
      }
    } else {
      tryUnlockNext(stepIndex);
    }
  }, [steps, progressMap, completeStep, tryUnlockNext]);

  useEffect(() => {
    progressSaveTimer.current = setInterval(() => {
      const activeStep = steps[activeStepIndex];
      if (!activeStep) return;
      const p = progressMap[activeStep.id];
      if (!p || p.status === "locked") return;

      const newTimeSpent = (p.time_spent_seconds || 0) + 5;
      setProgressMap((prev) => ({
        ...prev,
        [activeStep.id]: { ...prev[activeStep.id], time_spent_seconds: newTimeSpent },
      }));

      supabase.from("funnel_step_progress").update({
        max_watched_seconds: p.max_watched_seconds, watched_percentage: p.watched_percentage,
        last_position_seconds: p.last_position_seconds, status: p.status,
        time_spent_seconds: newTimeSpent,
        ...(p.condition_met_at ? { condition_met_at: p.condition_met_at } : {}),
      }).eq("funnel_id", funnel.id).eq("funnel_step_id", activeStep.id).eq("session_id", sessionId.current).then(() => {});

      if (activeStepIndex + 1 < steps.length) {
        const nextStep = steps[activeStepIndex + 1];
        if (nextStep.unlock_condition === "time_spent") {
          const requiredSec = (nextStep.unlock_percentage || 10) * 60;
          if (newTimeSpent >= requiredSec && getStepStatus(nextStep.id) === "locked") {
            tryUnlockNext(activeStepIndex);
          }
        }
      }
    }, 5000);
    return () => { if (progressSaveTimer.current) clearInterval(progressSaveTimer.current); };
  }, [activeStepIndex, progressMap, steps, funnel.id, tryUnlockNext]);

  const handleCountdownComplete = useCallback((stepId: string) => {
    const idx = steps.findIndex((s) => s.id === stepId);
    if (idx > 0) {
      const prevProgress = progressMap[steps[idx - 1].id];
      const result = checkStepUnlock(steps[idx], idx, prevProgress);
      if (result.unlocked) {
        updateStepProgress(stepId, { status: "unlocked" });
        setCountdownUnlocks((prev) => { const n = { ...prev }; delete n[stepId]; return n; });
        toast.success(`Step ${idx + 1} is now unlocked! 🎉`);
      }
    }
  }, [steps, progressMap, updateStepProgress]);

  const switchToStep = useCallback(async (newIndex: number) => {
    if (newIndex === activeStepIndex) return;
    setShowEndOverlay(false);
    setTransitioning(true);
    await new Promise((r) => setTimeout(r, 150));
    setActiveStepIndex(newIndex);
    setTransitioning(false);
  }, [activeStepIndex]);

  const handleCtaClick = async (stepIndex: number) => {
    const step = steps[stepIndex];
    if (step.cta_url) window.open(step.cta_url, "_blank");
    if (step.booking_url) window.open(step.booking_url, "_blank");
    await completeStep(stepIndex);
    toast.success("Step completed!");
  };

  const handleLeadSubmit = async (stepIndex: number) => {
    if (leadForm.website) return;
    await supabase.from("funnel_leads").insert({
      funnel_id: funnel.id, name: leadForm.name || null, phone: leadForm.phone || null,
      email: leadForm.email || null, city: leadForm.city || null, custom_value: leadForm.custom_value || null,
      device_type: /Mobi/.test(navigator.userAgent) ? "mobile" : "desktop", user_agent: navigator.userAgent,
    });
    setLeadSubmitted(true);
    await completeStep(stepIndex);
    toast.success("Details submitted!");
  };

  const handlePaymentSubmit = async (stepIndex: number) => {
    await supabase.from("funnel_payments").insert({
      funnel_id: funnel.id, amount: paymentProof.amount || priceOptions[0]?.amount || 0,
      upi_transaction_id: paymentProof.upi_transaction_id || null, payment_type: "upi_manual",
    });
    setPaymentSubmitted(true);
    await completeStep(stepIndex);
    toast.success("Payment submitted!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="text-primary animate-spin" />
      </div>
    );
  }

  const activeStep = steps[activeStepIndex];
  const activeProgress = activeStep ? progressMap[activeStep.id] : null;
  const completedCount = steps.filter((s) => getStepStatus(s.id) === "completed").length;
  const progressPct = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;
  const currentWatchPct = activeProgress?.watched_percentage || 0;

  // Next step info for Up Next section
  const nextStep = activeStepIndex + 1 < steps.length ? steps[activeStepIndex + 1] : null;
  const nextStepUnlockResult = nextStep
    ? checkStepUnlock(nextStep, activeStepIndex + 1, progressMap[activeStep?.id])
    : null;
  const nextCountdownAt = nextStep ? countdownUnlocks[nextStep.id] || null : null;

  const getUnlockHint = (step: FunnelStep, idx: number): string | null => {
    if (idx === 0) return null;
    const status = getStepStatus(step.id);
    if (status === "completed") return null;
    if (status === "locked" || countdownUnlocks[step.id]) {
      const cond = step.unlock_condition || "full_watch";
      if (cond === "full_watch") return "Watch the previous video fully to unlock.";
      if (cond === "percentage") return `Watch at least ${step.unlock_percentage || 80}% of the previous video.`;
      if (cond === "time_spent") return `Spend at least ${step.unlock_percentage || 10} minutes on the previous step.`;
      return null;
    }
    return null;
  };

  /* ─── Theme colors ─── */
  const sc = {
    bg: isDark ? "#111111" : "#f8f9fa",
    border: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
    text: isDark ? "#ffffff" : "#0f172a",
    textMuted: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
    textDim: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)",
    textLocked: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.25)",
    progressBg: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    itemBg: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
    cardBg: isDark ? "#1a1a1a" : "#ffffff",
    cardBorder: isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb",
    inputBg: isDark ? "#18181b" : "#f1f5f9",
  };

  /* ─── SIDEBAR (Desktop) ─── */
  const JourneySidebar = () => {
    const hasContact = funnel.show_contact_buttons && (funnel.contact_whatsapp || funnel.contact_phone);
    return (
      <div
        className="hidden lg:flex flex-col w-[320px] min-w-[320px] shrink-0 h-screen sticky top-0 border-r"
        style={{ background: sc.bg, borderColor: sc.border }}
      >
        <div className="flex-1 overflow-y-auto" style={{ padding: "24px 16px", scrollbarWidth: "thin", scrollbarColor: "rgba(212,175,55,0.3) transparent" }}>
          {/* Creator profile */}
          {creatorProfile?.full_name && (
            <div className="flex items-center gap-3 pb-5 mb-5" style={{ borderBottom: `1px solid ${sc.border}` }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ border: "2px solid rgba(212,175,55,0.35)", boxShadow: "0 0 0 3px rgba(212,175,55,0.08)" }}>
                {creatorProfile.avatar_url ? (
                  <img src={creatorProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(212,175,55,0.12)" }}>
                    <span className="text-primary font-bold text-sm">{creatorProfile.full_name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[13px] truncate" style={{ color: sc.text, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {creatorProfile.full_name}
                </p>
                {creatorProfile.kyc_status === "approved" && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: "#D4AF37" }}>
                    <BadgeCheck size={10} /> Verified
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Journey Progress */}
          <div className="pb-5 mb-5" style={{ borderBottom: `1px solid ${sc.border}` }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: sc.textDim }}>
              Journey Progress
            </p>
            <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: sc.progressBg }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #D4AF37, #B8960C)" }} />
            </div>
            <p className="text-[12px]" style={{ color: sc.textMuted }}>
              <span style={{ color: "#D4AF37", fontWeight: 600 }}>{completedCount}</span> of {steps.length} steps completed
            </p>
          </div>

          {/* Step list */}
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: sc.textDim }}>
            Journey
          </p>
          <div className="space-y-2">
            {steps.map((step, idx) => {
              const status = getStepStatus(step.id);
              const Icon = STEP_ICONS[step.step_type] || Circle;
              const isActive = idx === activeStepIndex;
              const isLocked = status === "locked" && !countdownUnlocks[step.id];
              const isCompleted = status === "completed";
              const isInProgress = status === "in_progress";
              const hasCountdown = !!countdownUnlocks[step.id];
              const stepProgress = progressMap[step.id];
              const watchPct = stepProgress?.watched_percentage || 0;

              return (
                <button
                  key={step.id}
                  onClick={() => !isLocked && switchToStep(idx)}
                  disabled={isLocked}
                  className="w-full flex items-start gap-3 text-left transition-all group"
                  title={isLocked ? "Complete the previous step to unlock" : ""}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "14px",
                    border: isActive ? "1px solid rgba(212,175,55,0.3)" : isCompleted ? "1px solid rgba(212,175,55,0.15)" : "1px solid transparent",
                    background: isActive ? "rgba(212,175,55,0.08)" : isCompleted ? "rgba(212,175,55,0.04)" : isLocked ? "transparent" : sc.itemBg,
                    cursor: isLocked ? "not-allowed" : "pointer",
                    opacity: isLocked ? 0.5 : 1,
                  }}
                >
                  {/* Status icon - 36px */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 relative"
                    style={{
                      background: isCompleted ? "#D4AF37" : isActive ? "rgba(212,175,55,0.15)" : hasCountdown ? "rgba(251,191,36,0.12)" : isLocked ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)",
                      border: isActive ? "2px solid #D4AF37" : isCompleted ? "none" : hasCountdown ? "1.5px solid #fbbf24" : isLocked ? `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}` : `1px solid ${sc.border}`,
                    }}
                  >
                    {isCompleted ? (
                      <Check size={16} style={{ color: "#0a0a0a" }} strokeWidth={3} />
                    ) : hasCountdown ? (
                      <Timer size={14} style={{ color: "#fbbf24" }} />
                    ) : isLocked ? (
                      <Lock size={12} style={{ color: sc.textLocked }} />
                    ) : (
                      <Icon size={14} style={{ color: isActive ? "#D4AF37" : sc.textMuted }} />
                    )}
                    {/* Pulse ring for active */}
                    {isActive && !isCompleted && (
                      <div className="absolute inset-0 rounded-full animate-ping" style={{ border: "2px solid rgba(212,175,55,0.3)", animationDuration: "2s" }} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium uppercase tracking-widest mb-0.5" style={{ color: sc.textDim }}>
                      Step {idx + 1}
                    </p>
                    <p className="font-semibold text-[14px] leading-tight truncate" style={{ color: isLocked ? sc.textLocked : sc.text, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {step.title || `Step ${idx + 1}`}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: sc.textMuted }}>
                      {STEP_TYPE_LABELS[step.step_type] || step.step_type}
                      {" · "}
                      {isCompleted ? "Completed" : hasCountdown ? "Countdown" : isInProgress ? "In Progress" : isActive ? "Now Playing" : isLocked ? "Locked" : "Available"}
                    </p>

                    {/* Watch progress bar for in-progress */}
                    {(isInProgress || isActive) && !isCompleted && watchPct > 0 && (
                      <div className="mt-2">
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: sc.progressBg }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${watchPct}%`, background: "#D4AF37" }} />
                        </div>
                        <p className="text-[10px] mt-0.5" style={{ color: sc.textDim }}>{watchPct}% watched</p>
                      </div>
                    )}

                    {/* Countdown hint — live updating */}
                    {hasCountdown && countdownUnlocks[step.id] && (() => {
                      const rem = Math.max(0, countdownUnlocks[step.id] - countdownNow);
                      const mm = Math.floor(rem / 60000);
                      const ss = Math.floor((rem % 60000) / 1000);
                      return (
                        <p className="text-[10px] mt-1 font-medium" style={{ color: "#fbbf24" }}>
                          ⏱ Unlocks in {mm}:{ss.toString().padStart(2, "0")}
                        </p>
                      );
                    })()}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Contact buttons */}
        {hasContact && (
          <div className="shrink-0 px-4 py-3" style={{ borderTop: `1px solid ${sc.border}`, background: sc.bg }}>
            <div className="space-y-2">
              {funnel.contact_whatsapp && (
                <button
                  onClick={() => window.open(`https://wa.me/${funnel.contact_whatsapp?.replace(/\D/g, "")}`)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:opacity-90"
                  style={{ background: "rgba(37,211,102,0.15)", color: "#25d366", border: "1px solid rgba(37,211,102,0.2)" }}
                >
                  <MessageCircle size={15} /> WhatsApp
                </button>
              )}
              {funnel.contact_phone && (
                <button
                  onClick={() => window.open(`tel:${funnel.contact_phone}`)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:opacity-90"
                  style={{ background: sc.itemBg, color: sc.text, border: `1px solid ${sc.border}` }}
                >
                  <PhoneIcon size={15} /> Call
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-1 text-center" style={{ borderTop: `1px solid ${sc.border}` }}>
          <div style={{ padding: "12px 0", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
            ©️ 2025 Smart Income Program · Powered by{" "}
            <a href="https://nevorai.com" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.25)", textDecoration: "none" }}>Nevorai</a>
          </div>
        </div>
      </div>
    );
  };
  /* ─── MOBILE STEP PILLS ─── */
  const MobileStepBar = () => (
    <div
      className="lg:hidden flex gap-2 overflow-x-auto py-3 px-4"
      style={{ scrollbarWidth: "none", background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", borderBottom: `1px solid ${sc.border}` }}
    >
      {steps.map((step, idx) => {
        const status = getStepStatus(step.id);
        const isActive = idx === activeStepIndex;
        const isLocked = status === "locked" && !countdownUnlocks[step.id];
        const isCompleted = status === "completed";
        const hasCountdown = !!countdownUnlocks[step.id];

        return (
          <button
            key={step.id}
            onClick={() => !isLocked && switchToStep(idx)}
            disabled={isLocked}
            className="flex items-center gap-1.5 shrink-0 transition-all"
            style={{
              padding: "8px 16px",
              borderRadius: "100px",
              fontSize: "12px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              border: isActive ? "1.5px solid rgba(212,175,55,0.5)" : isCompleted ? "1px solid rgba(212,175,55,0.25)" : `1px solid ${sc.border}`,
              background: isActive ? "rgba(212,175,55,0.12)" : isCompleted ? "rgba(212,175,55,0.06)" : "transparent",
              color: isActive || isCompleted ? "#D4AF37" : hasCountdown ? "#fbbf24" : isLocked ? sc.textLocked : sc.textMuted,
              cursor: isLocked ? "not-allowed" : "pointer",
              opacity: isLocked ? 0.5 : 1,
            }}
          >
            {isCompleted ? <Check size={12} /> : hasCountdown ? <Timer size={10} /> : isLocked ? <Lock size={10} /> : <Circle size={10} />}
            {step.title || `Step ${idx + 1}`}
          </button>
        );
      })}
      <style>{`.lg\\:hidden::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );

  const hasContact = funnel.show_contact_buttons && (funnel.contact_whatsapp || funnel.contact_phone);
  const activeCountdown = activeStep ? countdownUnlocks[activeStep.id] : null;

  // Timer blur is active when the ACTIVE step itself has a countdown
  const isTimerBlurActive = !!(activeCountdown && activeStep?.step_type === "video");

  return (
    <div className="flex min-h-[calc(100vh-52px)]">
      <JourneySidebar />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile title */}
        <div className="lg:hidden text-center py-4 px-4" style={{ borderBottom: `1px solid ${sc.border}` }}>
          <h1 className="font-heading font-extrabold tracking-tight leading-tight" style={{ fontSize: "clamp(18px, 5vw, 28px)", letterSpacing: "-0.02em", color: sc.text }}>
            {funnel.title}
          </h1>
        </div>
        <MobileStepBar />

        {/* Mobile contact */}
        {hasContact && (
          <div className="lg:hidden flex gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${sc.border}`, background: sc.bg }}>
            {funnel.contact_whatsapp && (
              <button onClick={() => window.open(`https://wa.me/${funnel.contact_whatsapp?.replace(/\D/g, "")}`)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[12px] font-semibold"
                style={{ background: "rgba(37,211,102,0.15)", color: "#25d366", border: "1px solid rgba(37,211,102,0.2)" }}>
                <MessageCircle size={14} /> WhatsApp
              </button>
            )}
            {funnel.contact_phone && (
              <button onClick={() => window.open(`tel:${funnel.contact_phone}`)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[12px] font-semibold"
                style={{ background: sc.itemBg, color: sc.text, border: `1px solid ${sc.border}` }}>
                <PhoneIcon size={14} /> Call
              </button>
            )}
          </div>
        )}

        {/* Main content */}
        <div ref={contentRef} className="flex-1 px-4 lg:px-8 py-6 lg:py-8 max-w-[860px] mx-auto w-full">
          {/* Desktop title */}
          <h1 className="hidden lg:block font-heading font-extrabold tracking-tight leading-tight mb-6" style={{ fontSize: "clamp(22px, 3vw, 34px)", letterSpacing: "-0.02em", color: sc.text }}>
            {funnel.title}
          </h1>

          {activeStep && (
            <div
              className="space-y-5 transition-opacity duration-150"
              style={{ opacity: transitioning ? 0 : 1 }}
            >
              {/* Step header */}
              <div style={{ paddingBottom: "12px", borderBottom: `1px solid ${sc.border}`, marginBottom: "16px" }}>
                <div className="flex items-center gap-3 mb-1">
                  <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: sc.textMuted }}>
                    Step {activeStepIndex + 1} of {steps.length}
                  </span>
                  {activeProgress?.status === "completed" && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: "#D4AF37" }}>
                      <Check size={10} /> Completed
                    </span>
                  )}
                  {activeProgress?.status === "in_progress" && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(212,175,55,0.12)", color: "#D4AF37" }}>
                      In Progress · {currentWatchPct}%
                    </span>
                  )}
                </div>
                <h2 className="font-heading font-bold" style={{ fontSize: "20px", fontFamily: "'Plus Jakarta Sans', sans-serif", color: sc.text }}>
                  {activeStep.title || `Step ${activeStepIndex + 1}`}
                </h2>
                {activeStep.description && (
                  <p className="mt-1" style={{ fontSize: "14px", color: sc.textMuted }}>{activeStep.description}</p>
                )}
              </div>

              {/* Countdown with blurred video preview — shows on the ACTIVE step when it has a countdown */}
              {(() => {
                if (!activeCountdown || activeStep.step_type !== "video") return null;

                const timerStep = activeStep;
                const timerUnlockAt = activeCountdown;

                const rem = Math.max(0, timerUnlockAt - countdownNow);
                const h = Math.floor(rem / 3600000);
                const m = Math.floor((rem % 3600000) / 60000);
                const s = Math.floor((rem % 60000) / 1000);

                // Auto-unlock when timer reaches 0
                if (rem <= 0) {
                  setTimeout(() => {
                    handleCountdownComplete(timerStep.id);
                  }, 0);
                }

                return (
                  <div className="space-y-4">
                    <div className="relative aspect-video rounded-2xl overflow-hidden" style={{ background: sc.cardBg, border: `1px solid ${sc.border}` }}>
                      {/* Blurred thumbnail/video preview */}
                      {timerStep.video_thumbnail ? (
                        <img src={timerStep.video_thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ filter: "blur(20px) brightness(0.4)", transform: "scale(1.1)" }} />
                      ) : timerStep.video_url ? (
                        <video src={timerStep.video_url} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" style={{ filter: "blur(12px) brightness(0.4)", transform: "scale(1.1)" }} />
                      ) : (
                        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0a0a0a, #1a1a1a)" }} />
                      )}

                      {/* Dark overlay */}
                      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.55)" }} />

                      {/* Countdown overlay */}
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6">
                        {/* Lock icon */}
                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(212,160,23,0.15)", border: "1.5px solid rgba(212,160,23,0.4)" }}>
                          <Lock size={20} style={{ color: "#D4AF37" }} />
                        </div>

                        {/* Step label */}
                        <div className="text-center">
                          <p className="text-[10px] font-bold tracking-[0.12em] uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>Upcoming</p>
                          <p className="text-base font-bold text-white mt-0.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            {timerStep.title || `Step ${activeStepIndex + 1}`}
                          </p>
                        </div>

                        {/* Timer boxes */}
                        <div className="flex items-center gap-2">
                          {h > 0 && (
                            <>
                              <div className="text-center">
                                <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(212,160,23,0.15)", border: "1.5px solid rgba(212,160,23,0.3)" }}>
                                  <span className="text-3xl font-extrabold font-mono" style={{ color: "#D4A017", fontVariantNumeric: "tabular-nums" }}>{h.toString().padStart(2, "0")}</span>
                                </div>
                                <span className="text-[9px] font-semibold tracking-wider uppercase mt-1 block" style={{ color: "rgba(255,255,255,0.35)" }}>hrs</span>
                              </div>
                              <span className="text-xl font-bold mb-4" style={{ color: "rgba(212,175,55,0.5)" }}>:</span>
                            </>
                          )}
                          <div className="text-center">
                            <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(212,160,23,0.15)", border: "1.5px solid rgba(212,160,23,0.3)" }}>
                              <span className="text-3xl font-extrabold font-mono" style={{ color: "#D4A017", fontVariantNumeric: "tabular-nums" }}>{m.toString().padStart(2, "0")}</span>
                            </div>
                            <span className="text-[9px] font-semibold tracking-wider uppercase mt-1 block" style={{ color: "rgba(255,255,255,0.35)" }}>min</span>
                          </div>
                          <span className="text-xl font-bold mb-4" style={{ color: "rgba(212,175,55,0.5)" }}>:</span>
                          <div className="text-center">
                            <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(212,160,23,0.15)", border: "1.5px solid rgba(212,160,23,0.3)" }}>
                              <span className="text-3xl font-extrabold font-mono" style={{ color: "#D4A017", fontVariantNumeric: "tabular-nums" }}>{s.toString().padStart(2, "0")}</span>
                            </div>
                            <span className="text-[9px] font-semibold tracking-wider uppercase mt-1 block" style={{ color: "rgba(255,255,255,0.35)" }}>sec</span>
                          </div>
                        </div>

                        <p className="text-[11px] text-center" style={{ color: "rgba(255,255,255,0.4)" }}>
                          This step will unlock automatically when the timer ends
                        </p>

                        {/* CTA Button during timer */}
                        {timerStep.timer_cta_enabled && timerStep.timer_cta_text && timerStep.timer_cta_url && (
                          <button
                            onClick={() => window.open(timerStep.timer_cta_url!, "_blank")}
                            className="mt-2 transition-all hover:opacity-90 hover:-translate-y-0.5"
                            style={{
                              padding: "14px 28px",
                              borderRadius: "12px",
                              fontSize: "15px",
                              fontWeight: 700,
                              fontFamily: "'Plus Jakarta Sans', sans-serif",
                              cursor: "pointer",
                              width: "100%",
                              maxWidth: "360px",
                              ...(timerStep.timer_cta_style === "white"
                                ? { background: "#fff", color: "#000", border: "none" }
                                : timerStep.timer_cta_style === "outline"
                                ? { background: "transparent", color: "#fff", border: "1.5px solid rgba(255,255,255,0.4)" }
                                : { background: "#D4A017", color: "#000", border: "none" }),
                            }}
                          >
                            {timerStep.timer_cta_text}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Non-video countdown fallback */}
              {activeCountdown && activeStep.step_type !== "video" && (
                <UpNextCountdown
                  nextStep={activeStep}
                  nextStepIndex={activeStepIndex}
                  unlockAt={activeCountdown}
                  onUnlock={() => handleCountdownComplete(activeStep.id)}
                  isDark={isDark}
                />
              )}

              {/* Unlock hint for locked steps */}
              {getStepStatus(activeStep.id) === "locked" && !activeCountdown && (
                <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.15)" }}>
                  <Lock size={16} style={{ color: "#D4AF37" }} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "#D4AF37" }}>Step Locked</p>
                    <p className="text-xs mt-0.5" style={{ color: sc.textMuted }}>{getUnlockHint(activeStep, activeStepIndex)}</p>
                  </div>
                </div>
              )}

              {/* Step content */}
              {!activeCountdown && !isTimerBlurActive && getStepStatus(activeStep.id) !== "locked" && (
                <>
                  {/* Access Code Gate — shown when step is unlocked but code not yet entered */}
                  {activeStep.access_code_enabled && !stepCodeUnlocked[activeStep.id] && activeStep.step_type === "video" && (
                    <StepCodeGate
                      funnelId={funnel.id}
                      stepId={activeStep.id}
                      stepTitle={activeStep.title}
                      message={activeStep.access_code_message || "To unlock this step, contact your mentor and request the access code for this session."}
                      sessionId={sessionId.current}
                      onSuccess={() => setStepCodeUnlocked((prev) => ({ ...prev, [activeStep.id]: true }))}
                      isDark={isDark}
                    />
                  )}

                  {activeStep.step_type === "video" && activeStep.video_url && (!activeStep.access_code_enabled || stepCodeUnlocked[activeStep.id]) && (
                    <div className="space-y-4">
                      <div className="relative">
                        <VideoPlayer
                          src={activeStep.video_url}
                          poster={activeStep.video_thumbnail || undefined}
                          allowSeek={funnel.allow_seek !== false}
                          allowSpeed={funnel.allow_speed_change !== false}
                          autoplay={true}
                          initialTime={activeProgress?.last_position_seconds || 0}
                          onTimeUpdate={(ct: number, dur: number) => handleVideoTimeUpdate(activeStepIndex, ct, dur)}
                        />

                        {/* Video End Overlay */}
                        {showEndOverlay && nextStep && nextStepUnlockResult?.unlocked && (
                          <VideoEndOverlay
                            nextStep={nextStep}
                            nextStepIndex={activeStepIndex + 1}
                            onPlayNow={() => { setShowEndOverlay(false); switchToStep(activeStepIndex + 1); }}
                            onStayHere={() => setShowEndOverlay(false)}
                            isDark={isDark}
                          />
                        )}
                      </div>

                      {/* Per-step speaker */}
                      <StepSpeakerCard funnel={funnel} step={activeStep} creatorProfile={creatorProfile} isDark={isDark} />
                      {/* Per-step video topics */}
                      <StepVideoTopics funnel={funnel} step={activeStep} isDark={isDark} />
                    </div>
                  )}

                  {activeStep.step_type === "video" && !activeStep.video_url && (
                    <div className="aspect-video rounded-2xl flex items-center justify-center" style={{ background: sc.cardBg, border: `1px solid ${sc.border}` }}>
                      <div className="text-center">
                        <Play size={40} style={{ color: sc.textDim }} className="mx-auto mb-2" />
                        <p style={{ fontSize: "12px", color: sc.textDim }}>Video coming soon</p>
                      </div>
                    </div>
                  )}

                  {activeStep.step_type === "lead_form" && (
                    <div className="rounded-2xl p-6" style={{ background: sc.cardBg, border: `1px solid ${sc.cardBorder}` }}>
                      {leadSubmitted || activeProgress?.status === "completed" ? (
                        <div className="text-center py-6">
                          <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: "#D4AF37" }} />
                          <h3 className="font-heading font-bold" style={{ color: sc.text }}>Details Submitted</h3>
                          <p style={{ fontSize: "12px", color: sc.textMuted }} className="mt-1">Thank you for your information.</p>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-lg font-heading font-bold mb-4" style={{ color: sc.text }}>Fill in your details</h3>
                          <form onSubmit={(e) => { e.preventDefault(); handleLeadSubmit(activeStepIndex); }} className="space-y-3">
                            <input type="text" name="website" value={leadForm.website} onChange={(e) => setLeadForm({ ...leadForm, website: e.target.value })} style={{ position: "absolute", left: "-9999px" }} tabIndex={-1} autoComplete="off" />
                            {formConfig?.show_name && <Input placeholder="Full Name" value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} required={formConfig.name_required} style={{ background: sc.inputBg, borderColor: sc.cardBorder, color: sc.text }} className="h-12 rounded-xl" />}
                            {formConfig?.show_phone && (
                              <div className="flex gap-2">
                                <div className="flex items-center px-3 rounded-xl text-sm shrink-0 h-12" style={{ background: sc.inputBg, border: `1px solid ${sc.cardBorder}`, color: sc.textMuted }}>+91</div>
                                <Input placeholder="Phone number" value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} required={formConfig.phone_required} style={{ background: sc.inputBg, borderColor: sc.cardBorder, color: sc.text }} className="h-12 rounded-xl" />
                              </div>
                            )}
                            {formConfig?.show_email && <Input type="email" placeholder="Email" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} required={formConfig.email_required} style={{ background: sc.inputBg, borderColor: sc.cardBorder, color: sc.text }} className="h-12 rounded-xl" />}
                            {formConfig?.show_city && <Input placeholder="City" value={leadForm.city} onChange={(e) => setLeadForm({ ...leadForm, city: e.target.value })} required={formConfig.city_required} style={{ background: sc.inputBg, borderColor: sc.cardBorder, color: sc.text }} className="h-12 rounded-xl" />}
                            <Button type="submit" className="w-full h-14 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">Submit →</Button>
                          </form>
                        </>
                      )}
                    </div>
                  )}

                  {(activeStep.step_type === "cta" || activeStep.step_type === "booking") && (
                    <div className="rounded-2xl p-6 text-center" style={{ background: sc.cardBg, border: `1px solid ${sc.cardBorder}` }}>
                      {activeProgress?.status === "completed" ? (
                        <>
                          <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: "#D4AF37" }} />
                          <h3 className="font-heading font-bold" style={{ color: sc.text }}>Step Completed</h3>
                        </>
                      ) : (
                        <>
                          <h3 className="text-lg font-heading font-bold mb-2" style={{ color: sc.text }}>{activeStep.cta_text || (activeStep.step_type === "booking" ? "Book Your Call" : "Continue")}</h3>
                          {activeStep.description && <p style={{ fontSize: "14px", color: sc.textMuted }} className="mb-4">{activeStep.description}</p>}
                          <Button className="h-14 px-8 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl" onClick={() => handleCtaClick(activeStepIndex)}>
                            {activeStep.cta_text || (activeStep.step_type === "booking" ? "Book Now" : "Continue")} →
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {activeStep.step_type === "payment" && (
                    <div className="rounded-2xl p-6" style={{ background: sc.cardBg, border: `1px solid ${sc.cardBorder}` }}>
                      {paymentSubmitted || activeProgress?.status === "completed" ? (
                        <div className="text-center py-6">
                          <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: "#D4AF37" }} />
                          <h3 className="font-heading font-bold" style={{ color: sc.text }}>Payment Submitted</h3>
                          <p style={{ fontSize: "12px", color: sc.textMuted }} className="mt-1">Your payment is being reviewed.</p>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-lg font-heading font-semibold mb-4" style={{ color: sc.text }}>Complete Payment</h3>
                          {priceOptions.length > 0 && (
                            <div className="space-y-2 mb-4">
                              {priceOptions.map((opt: any) => (
                                <button key={opt.id} onClick={() => setPaymentProof({ ...paymentProof, amount: opt.amount })}
                                  className={`w-full p-3 rounded-xl border text-left transition-all ${paymentProof.amount === opt.amount ? "border-primary bg-primary/10" : ""}`}
                                  style={paymentProof.amount !== opt.amount ? { borderColor: sc.cardBorder, background: sc.inputBg } : {}}>
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium" style={{ color: sc.text }}>{opt.label}</span>
                                    <span className="font-heading font-bold" style={{ color: sc.text }}>₹{opt.amount.toLocaleString("en-IN")}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                          {funnel.upi_id && (
                            <div className="p-3 rounded-xl mb-4" style={{ background: sc.inputBg }}>
                              <span className="text-xs" style={{ color: sc.textMuted }}>Pay via UPI</span>
                              <div className="flex items-center gap-2 mt-1">
                                <code className="text-sm text-primary flex-1">{funnel.upi_id}</code>
                                <Button variant="ghost" size="sm" style={{ color: sc.textMuted }} onClick={() => { navigator.clipboard.writeText(funnel.upi_id!); toast.success("UPI ID copied!"); }}>Copy</Button>
                              </div>
                            </div>
                          )}
                          <div className="space-y-3">
                            <Input placeholder="UPI Transaction ID" value={paymentProof.upi_transaction_id} onChange={(e) => setPaymentProof({ ...paymentProof, upi_transaction_id: e.target.value })} style={{ background: sc.inputBg, borderColor: sc.cardBorder, color: sc.text }} className="h-12 rounded-xl" />
                            <Button className="w-full h-14 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl" onClick={() => handlePaymentSubmit(activeStepIndex)}>
                              I've Made the Payment
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {activeStep.step_type === "manual_approval" && (
                    <div className="rounded-2xl p-8 text-center" style={{ background: sc.cardBg, border: `1px solid ${sc.cardBorder}` }}>
                      {activeProgress?.status === "completed" || activeProgress?.manually_unlocked ? (
                        <>
                          <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: "#D4AF37" }} />
                          <h3 className="font-heading font-bold" style={{ color: sc.text }}>Step Unlocked</h3>
                          <p style={{ fontSize: "12px", color: sc.textMuted }} className="mt-1">You've been approved to continue.</p>
                        </>
                      ) : (
                        <>
                          <Lock size={40} style={{ color: sc.textDim }} className="mx-auto mb-3" />
                          <h3 className="font-heading font-bold" style={{ color: sc.text }}>Awaiting Approval</h3>
                          <p style={{ fontSize: "14px", color: sc.textMuted }} className="mt-2">{activeStep.description || "The creator will unlock this step for you after review."}</p>
                          {funnel.contact_whatsapp && (
                            <Button className="mt-4 bg-[#25d366] hover:bg-[#20b858] text-white" onClick={() => window.open(`https://wa.me/${funnel.contact_whatsapp?.replace(/\D/g, "")}`)}>
                              <MessageCircle size={16} /> Contact on WhatsApp
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ═══ UP NEXT SECTION (hidden when blurred timer overlay is active) ═══ */}
              {!isTimerBlurActive && (
                <UpNextSection
                  nextStep={nextStep}
                  nextStepIndex={activeStepIndex + 1}
                  totalSteps={steps.length}
                  unlockResult={nextStepUnlockResult}
                  countdownUnlockAt={nextCountdownAt}
                  currentWatchPct={currentWatchPct}
                  onPlayNext={() => switchToStep(activeStepIndex + 1)}
                  onCountdownComplete={() => nextStep && handleCountdownComplete(nextStep.id)}
                  isDark={isDark}
                />
              )}
            </div>
          )}

          {/* Mobile creator + contact */}
          <div className="lg:hidden mt-6 space-y-3">
            {creatorProfile?.full_name && (
              <div className="flex items-center gap-3 py-3 px-1">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ border: "2px solid rgba(212,175,55,0.3)" }}>
                  {creatorProfile.avatar_url ? (
                    <img src={creatorProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-primary/15 flex items-center justify-center">
                      <span className="text-primary font-bold text-sm">{creatorProfile.full_name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm truncate" style={{ color: sc.text }}>{creatorProfile.full_name}</span>
                    {creatorProfile.kyc_status === "approved" && <BadgeCheck size={15} className="text-primary shrink-0" />}
                  </div>
                </div>
              </div>
            )}
            {funnel.show_contact_buttons && (funnel.contact_whatsapp || funnel.contact_phone) && (
              <div className="flex gap-2">
                {funnel.contact_whatsapp && (
                  <Button className="flex-1 bg-[#25d366] hover:bg-[#20b858] text-white h-11 rounded-xl text-sm" onClick={() => window.open(`https://wa.me/${funnel.contact_whatsapp?.replace(/\D/g, "")}`)}>
                    <MessageCircle size={16} /> WhatsApp
                  </Button>
                )}
                {funnel.contact_phone && (
                  <Button className="flex-1 h-11 rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.06)", color: sc.text, border: `1px solid ${sc.border}` }} onClick={() => window.open(`tel:${funnel.contact_phone}`)}>
                    <PhoneIcon size={16} /> Call
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-12 pt-4 pb-2 text-center" style={{ borderTop: `1px solid ${sc.border}` }}>
            <div style={{ padding: "12px 0", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
              ©️ 2025 Smart Income Program · Powered by{" "}
              <a href="https://nevorai.com" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.25)", textDecoration: "none" }}>Nevorai</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
