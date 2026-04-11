import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Play, Lock, Check, CheckCircle2, Circle, ExternalLink,
  Calendar, CreditCard, ClipboardList, UserCheck, ChevronRight,
  Loader2, MessageCircle, Phone as PhoneIcon, BadgeCheck, Info, Sparkles,
  Timer
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
  // New per-step fields
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

const UNLOCK_HINTS: Record<string, (value?: string | null) => string> = {
  auto: () => "This step is available now.",
  watch_complete: () => "Watch the previous video fully to unlock this step.",
  watch_seconds: (v) => `Watch at least ${v || "?"} seconds of the previous video to continue.`,
  watch_percent: (v) => `Watch at least ${v || "?"}% of the previous video to continue.`,
  cta_click: () => "Click the button in the previous step to unlock this one.",
  lead_submitted: () => "Submit your details in the previous step to continue.",
  payment_submitted: () => "Complete payment in the previous step to unlock this.",
  manual: () => "The creator will unlock this step for you after review.",
  booking_done: () => "Complete the booking in the previous step to continue.",
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

/* ─── Unlock check with new conditions + time delay ─── */
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

  // Use new unlock_condition if set, otherwise fall back to unlock_rule_type
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
    // Fall back to old unlock_rule_type logic
    const rule = step.unlock_rule_type;
    if (rule === "auto") return { unlocked: true };
    if (rule === "manual") return { unlocked: false, reason: "manual" };
    if (rule === "watch_complete") conditionMet = prevProgress.status === "completed";
    else if (rule === "watch_seconds") conditionMet = prevProgress.max_watched_seconds >= parseInt(step.unlock_rule_value || "0");
    else if (rule === "watch_percent") conditionMet = watchPct >= parseInt(step.unlock_rule_value || "0");
    else conditionMet = prevProgress.status === "completed";
  }

  if (!conditionMet) return { unlocked: false, reason: "condition_not_met" };

  // Check time delay
  if (step.time_delay_enabled && (step.time_delay_minutes || 0) > 0) {
    const conditionMetAt = prevProgress.condition_met_at || prevProgress.completed_at;
    if (!conditionMetAt) return { unlocked: false, reason: "delay_waiting" };

    const delayMs = (step.time_delay_minutes || 0) * 60 * 1000;
    const unlockAt = new Date(conditionMetAt).getTime() + delayMs;
    const now = Date.now();

    if (now < unlockAt) {
      return {
        unlocked: false,
        reason: "delay_countdown",
        unlockAt,
        remainingMs: unlockAt - now,
      };
    }
  }

  return { unlocked: true };
};

/* ─── Countdown Timer Component ─── */
const CountdownTimer = ({ unlockAt, onUnlock, isDark }: { unlockAt: number; onUnlock: () => void; isDark: boolean }) => {
  const [remaining, setRemaining] = useState(Math.max(0, unlockAt - Date.now()));

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

  const totalMs = unlockAt - Date.now() + remaining; // rough for progress
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const progressPct = remaining > 0 ? Math.max(0, 100 - (remaining / Math.max(remaining + 1000, 1)) * 100) : 100;

  const sc = {
    bg: isDark ? "rgba(251,146,60,0.08)" : "rgba(251,146,60,0.06)",
    border: isDark ? "rgba(251,146,60,0.2)" : "rgba(251,146,60,0.15)",
    text: isDark ? "#fbbf24" : "#d97706",
    textMuted: isDark ? "rgba(251,191,36,0.7)" : "rgba(217,119,6,0.7)",
    boxBg: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
  };

  return (
    <div className="rounded-2xl p-6 text-center space-y-4" style={{ background: sc.bg, border: `1px solid ${sc.border}` }}>
      <div className="flex items-center justify-center gap-2 mb-2">
        <Timer size={18} style={{ color: sc.text }} />
        <p className="text-sm font-semibold" style={{ color: sc.text }}>Step unlocks in</p>
      </div>

      <div className="flex items-center justify-center gap-3">
        {hours > 0 && (
          <div className="flex flex-col items-center rounded-xl px-4 py-3 min-w-[60px]" style={{ background: sc.boxBg }}>
            <span className="text-2xl font-bold font-mono" style={{ color: sc.text }}>{hours}</span>
            <span className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: sc.textMuted }}>hr</span>
          </div>
        )}
        <div className="flex flex-col items-center rounded-xl px-4 py-3 min-w-[60px]" style={{ background: sc.boxBg }}>
          <span className="text-2xl font-bold font-mono" style={{ color: sc.text }}>{minutes.toString().padStart(2, "0")}</span>
          <span className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: sc.textMuted }}>min</span>
        </div>
        <div className="flex flex-col items-center rounded-xl px-4 py-3 min-w-[60px]" style={{ background: sc.boxBg }}>
          <span className="text-2xl font-bold font-mono" style={{ color: sc.text }}>{seconds.toString().padStart(2, "0")}</span>
          <span className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: sc.textMuted }}>sec</span>
        </div>
      </div>

      <p className="text-xs" style={{ color: sc.textMuted }}>
        Great job on the previous step! This step will unlock automatically.
      </p>
    </div>
  );
};

/* ─── Per-step Speaker Card ─── */
const StepSpeakerCard = ({ funnel, step, creatorProfile, isDark }: { funnel: any; step: FunnelStep; creatorProfile: any; isDark: boolean }) => {
  const sc = {
    cardBg: isDark ? "#1a1a22" : "#ffffff",
    cardBorder: isDark ? "#3f3f46" : "#e5e7eb",
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
      speaker = {
        name: step.speaker_name_custom || "",
        title: step.speaker_title || "",
        bio: step.speaker_bio || "",
        photo: step.speaker_photo_url_custom || "",
      };
    }
  } else {
    // Global speaker
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
      {speaker.photo && (
        <img src={speaker.photo} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
      )}
      <div className="min-w-0">
        <p className="font-semibold text-sm" style={{ color: sc.text }}>{speaker.name}</p>
        {speaker.title && <p className="text-xs mt-0.5" style={{ color: sc.textMuted }}>{speaker.title}</p>}
        {speaker.bio && <p className="text-xs mt-1" style={{ color: sc.textMuted }}>{speaker.bio}</p>}
      </div>
    </div>
  );
};

/* ─── Per-step Video Topics ─── */
const StepVideoTopics = ({ funnel, step, isDark }: { funnel: any; step: FunnelStep; isDark: boolean }) => {
  const sc = {
    cardBg: isDark ? "#1a1a22" : "#ffffff",
    cardBorder: isDark ? "#3f3f46" : "#e5e7eb",
    text: isDark ? "#ffffff" : "#0f172a",
    textMuted: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
  };

  let topics: Array<{ icon: string; text: string }> = [];

  if (funnel.video_topics_scope === "per_step") {
    if (step.video_topics_step_enabled && step.video_topics_step && step.video_topics_step.length > 0) {
      topics = step.video_topics_step;
    }
  } else {
    // Global topics
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
  const [countdownUnlocks, setCountdownUnlocks] = useState<Record<string, number>>({}); // stepId -> unlockAt timestamp
  const sessionId = useRef(getSessionId(funnel.id));
  const progressSaveTimer = useRef<ReturnType<typeof setInterval>>();

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

      // Initialize missing progress + compute unlock states
      const countdowns: Record<string, number> = {};
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (!map[step.id]) {
          const status = i === 0 ? "unlocked" : "locked";
          map[step.id] = {
            funnel_step_id: step.id,
            status,
            max_watched_seconds: 0,
            watched_percentage: 0,
            last_position_seconds: 0,
            completed_at: null,
            condition_met_at: null,
            time_spent_seconds: 0,
          };
          await supabase.from("funnel_step_progress").insert({
            funnel_id: funnel.id,
            funnel_step_id: step.id,
            session_id: sessionId.current,
            status,
          });
        }

        // Re-evaluate unlock for steps > 0
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
        if (p && (p.status === "unlocked" || p.status === "in_progress" || p.status === "completed")) {
          furthest = i;
        }
      }
      for (let i = 0; i <= furthest; i++) {
        const p = map[steps[i].id];
        if (p && p.status !== "completed") {
          setActiveStepIndex(i);
          break;
        }
        if (i === furthest) setActiveStepIndex(furthest);
      }

      setLoading(false);
    };
    if (steps.length > 0) loadProgress();
    else setLoading(false);
  }, [funnel.id, steps]);

  const getStepStatus = (stepId: string): string => {
    return progressMap[stepId]?.status || "locked";
  };

  const updateStepProgress = useCallback(async (stepId: string, updates: Partial<StepProgress>) => {
    setProgressMap((prev) => ({
      ...prev,
      [stepId]: { ...prev[stepId], ...updates },
    }));

    await supabase
      .from("funnel_step_progress")
      .update(updates as any)
      .eq("funnel_id", funnel.id)
      .eq("funnel_step_id", stepId)
      .eq("session_id", sessionId.current);
  }, [funnel.id]);

  const tryUnlockNext = useCallback(async (completedStepIndex: number) => {
    if (completedStepIndex + 1 >= steps.length) return;
    const nextStep = steps[completedStepIndex + 1];
    const currentProgress = progressMap[steps[completedStepIndex].id];
    const result = checkStepUnlock(nextStep, completedStepIndex + 1, currentProgress);

    if (result.unlocked) {
      const nextStatus = progressMap[nextStep.id]?.status;
      if (nextStatus === "locked") {
        await updateStepProgress(nextStep.id, { status: "unlocked" });
      }
      // Remove any countdown
      setCountdownUnlocks((prev) => {
        const n = { ...prev };
        delete n[nextStep.id];
        return n;
      });
    } else if (result.reason === "delay_countdown" && result.unlockAt) {
      // Set condition_met_at on prev progress if not set
      if (!currentProgress?.condition_met_at) {
        await updateStepProgress(steps[completedStepIndex].id, { condition_met_at: new Date().toISOString() });
      }
      setCountdownUnlocks((prev) => ({ ...prev, [nextStep.id]: result.unlockAt! }));
    }
  }, [steps, progressMap, updateStepProgress]);

  const completeStep = useCallback(async (stepIndex: number) => {
    const step = steps[stepIndex];
    const completedUpdate: Partial<StepProgress> = {
      status: "completed",
      completed_at: new Date().toISOString(),
    };
    // Also set condition_met_at if not set
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

    // Check if condition just became met for the NEXT step
    if (stepIndex + 1 < steps.length && !progress.condition_met_at) {
      const nextStep = steps[stepIndex + 1];
      const cond = nextStep.unlock_condition || "full_watch";
      let justMet = false;
      if (cond === "full_watch" && pct >= 95) justMet = true;
      if (cond === "percentage" && pct >= (nextStep.unlock_percentage || 80)) justMet = true;
      if (justMet) {
        updates.condition_met_at = new Date().toISOString();
      }
    }

    setProgressMap((prev) => ({
      ...prev,
      [step.id]: { ...prev[step.id], ...updates },
    }));

    if (pct >= 95 && progress.status !== "completed") {
      completeStep(stepIndex);
    } else {
      // Try unlock next even before full completion (for percentage-based)
      tryUnlockNext(stepIndex);
    }
  }, [steps, progressMap, completeStep, tryUnlockNext]);

  useEffect(() => {
    progressSaveTimer.current = setInterval(() => {
      const activeStep = steps[activeStepIndex];
      if (!activeStep) return;
      const p = progressMap[activeStep.id];
      if (!p || p.status === "locked") return;

      // Also increment time_spent_seconds
      const newTimeSpent = (p.time_spent_seconds || 0) + 5;
      setProgressMap((prev) => ({
        ...prev,
        [activeStep.id]: { ...prev[activeStep.id], time_spent_seconds: newTimeSpent },
      }));

      supabase
        .from("funnel_step_progress")
        .update({
          max_watched_seconds: p.max_watched_seconds,
          watched_percentage: p.watched_percentage,
          last_position_seconds: p.last_position_seconds,
          status: p.status,
          time_spent_seconds: newTimeSpent,
          ...(p.condition_met_at ? { condition_met_at: p.condition_met_at } : {}),
        })
        .eq("funnel_id", funnel.id)
        .eq("funnel_step_id", activeStep.id)
        .eq("session_id", sessionId.current)
        .then(() => {});

      // Check if time_spent unlock condition just met for next step
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
    // Re-evaluate unlock
    const idx = steps.findIndex((s) => s.id === stepId);
    if (idx > 0) {
      const prevProgress = progressMap[steps[idx - 1].id];
      const result = checkStepUnlock(steps[idx], idx, prevProgress);
      if (result.unlocked) {
        updateStepProgress(stepId, { status: "unlocked" });
        setCountdownUnlocks((prev) => {
          const n = { ...prev };
          delete n[stepId];
          return n;
        });
        toast.success(`Step ${idx + 1} is now unlocked! 🎉`);
      }
    }
  }, [steps, progressMap, updateStepProgress]);

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
      funnel_id: funnel.id,
      name: leadForm.name || null,
      phone: leadForm.phone || null,
      email: leadForm.email || null,
      city: leadForm.city || null,
      custom_value: leadForm.custom_value || null,
      device_type: /Mobi/.test(navigator.userAgent) ? "mobile" : "desktop",
      user_agent: navigator.userAgent,
    });
    setLeadSubmitted(true);
    await completeStep(stepIndex);
    toast.success("Details submitted!");
  };

  const handlePaymentSubmit = async (stepIndex: number) => {
    await supabase.from("funnel_payments").insert({
      funnel_id: funnel.id,
      amount: paymentProof.amount || priceOptions[0]?.amount || 0,
      upi_transaction_id: paymentProof.upi_transaction_id || null,
      payment_type: "upi_manual",
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

  const getUnlockHint = (step: FunnelStep, idx: number): string | null => {
    if (idx === 0) return null;
    const status = getStepStatus(step.id);
    if (status === "completed") return null;
    if (status === "locked" || countdownUnlocks[step.id]) {
      // New condition-based hints
      const cond = step.unlock_condition || "full_watch";
      if (cond === "full_watch") return "Watch the previous video fully to unlock.";
      if (cond === "percentage") return `Watch at least ${step.unlock_percentage || 80}% of the previous video.`;
      if (cond === "time_spent") return `Spend at least ${step.unlock_percentage || 10} minutes on the previous step.`;
      const hintFn = UNLOCK_HINTS[step.unlock_rule_type];
      return hintFn ? hintFn(step.unlock_rule_value) : null;
    }
    return null;
  };

  const nextStepUnlocked = activeStep &&
    activeProgress?.status === "completed" &&
    activeStepIndex + 1 < steps.length &&
    getStepStatus(steps[activeStepIndex + 1].id) !== "locked" &&
    !countdownUnlocks[steps[activeStepIndex + 1]?.id];

  /* ─── Theme colors for sidebar ─── */
  const sc = {
    bg: isDark ? "#0f1117" : "#f8f9fa",
    border: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
    text: isDark ? "#ffffff" : "#0f172a",
    textMuted: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.5)",
    textDim: isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.4)",
    textDimmer: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.3)",
    textLocked: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.25)",
    iconDim: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.4)",
    iconLocked: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.2)",
    progressBg: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
    progressText: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.45)",
    itemBg: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.02)",
    itemIconBg: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
    cardBg: isDark ? "#1a1a22" : "#ffffff",
    cardBorder: isDark ? "#3f3f46" : "#e5e7eb",
    inputBg: isDark ? "#18181b" : "#f1f5f9",
    stepBarBg: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)",
    stepBarBorder: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
    stepBarActive: isDark ? "rgba(212,175,55,0.2)" : "rgba(212,175,55,0.1)",
    stepBarInactive: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.6)",
  };

  /* ─── LEFT SIDEBAR (Desktop) ─── */
  const JourneySidebar = () => {
    const hasContact = funnel.show_contact_buttons && (funnel.contact_whatsapp || funnel.contact_phone);
    return (
      <div
        className="hidden lg:flex flex-col w-[280px] min-w-[280px] shrink-0 h-screen sticky top-0 border-r"
        style={{ background: sc.bg, borderColor: sc.border }}
      >
        <div className="flex-1 overflow-y-auto" style={{ padding: "20px 14px" }}>
          {creatorProfile?.full_name && (
            <div className="flex items-center gap-3 pb-4 mb-4" style={{ borderBottom: `1px solid ${sc.border}` }}>
              <div className="w-[40px] h-[40px] rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ border: "2px solid rgba(212,175,55,0.35)", boxShadow: "0 0 0 3px rgba(212,175,55,0.08)" }}>
                {creatorProfile.avatar_url ? (
                  <img src={creatorProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(212,175,55,0.12)" }}>
                    <span className="text-primary font-bold text-sm">{creatorProfile.full_name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[13px] truncate" style={{ color: sc.text, fontFamily: "'Plus Jakarta Sans', var(--font-heading), sans-serif" }}>
                  {creatorProfile.full_name}
                </p>
                {creatorProfile.kyc_status === "approved" && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-gold">
                    <BadgeCheck size={10} /> Verified
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="pb-4 mb-4" style={{ borderBottom: `1px solid ${sc.border}` }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5" style={{ color: sc.textDim }}>
              Journey Progress
            </p>
            <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: sc.progressBg }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #D4AF37, #B8960C)" }}
              />
            </div>
            <p className="text-[12px] font-semibold" style={{ color: sc.progressText }}>
              {completedCount} / {steps.length} completed
            </p>
          </div>

          <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-3 px-1" style={{ color: sc.textDimmer }}>
            Journey
          </p>
          <div className="space-y-1.5">
            {steps.map((step, idx) => {
              const status = getStepStatus(step.id);
              const Icon = STEP_ICONS[step.step_type] || Circle;
              const isActive = idx === activeStepIndex;
              const isLocked = status === "locked" || !!countdownUnlocks[step.id];
              const isCompleted = status === "completed";
              const isInProgress = status === "in_progress";
              const hasCountdown = !!countdownUnlocks[step.id];

              return (
                <button
                  key={step.id}
                  onClick={() => !isLocked && setActiveStepIndex(idx)}
                  disabled={isLocked}
                  className="w-full flex items-start gap-3 text-left transition-all"
                  style={{
                    padding: "10px 12px",
                    borderRadius: "12px",
                    border: isCompleted
                      ? "1px solid rgba(212,175,55,0.25)"
                      : isActive
                      ? "1px solid rgba(212,175,55,0.3)"
                      : `1px solid transparent`,
                    borderLeft: isCompleted ? "3px solid #D4AF37" : isActive ? "3px solid #D4AF37" : "3px solid transparent",
                    background: isCompleted
                      ? "rgba(212,175,55,0.1)"
                      : isActive
                      ? "rgba(212,175,55,0.08)"
                      : isLocked
                      ? "transparent"
                      : sc.itemBg,
                    cursor: isLocked ? "not-allowed" : "pointer",
                    opacity: isLocked ? 0.55 : 1,
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: isCompleted ? "rgba(212,175,55,0.2)" : isActive ? "rgba(212,175,55,0.15)" : sc.itemIconBg,
                    }}
                  >
                    {isCompleted ? (
                      <Check size={13} className="text-gold" />
                    ) : hasCountdown ? (
                      <Timer size={11} style={{ color: "#fbbf24" }} />
                    ) : isLocked ? (
                      <Lock size={11} style={{ color: sc.iconLocked }} />
                    ) : (
                      <Icon size={13} className={isActive ? "text-gold" : ""} style={!isActive ? { color: sc.iconDim } : {}} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="font-semibold leading-tight truncate"
                      style={{
                        fontSize: "13px",
                        color: isLocked ? sc.textLocked : sc.text,
                        fontFamily: "'Plus Jakarta Sans', var(--font-heading), sans-serif",
                      }}
                    >
                      {step.title || `Step ${idx + 1}`}
                    </p>
                    <p style={{ fontSize: "11px", color: sc.textMuted, marginTop: "2px" }}>
                      {STEP_TYPE_LABELS[step.step_type] || step.step_type}
                      {" · "}
                      {isCompleted ? "Completed" : hasCountdown ? "Countdown" : isInProgress ? "In Progress" : isActive ? "Available" : isLocked ? "Locked" : "Available"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {hasContact && (
          <div className="shrink-0 px-3 py-3" style={{ borderTop: `1px solid ${sc.border}`, background: sc.bg }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5 px-1" style={{ color: sc.textDim }}>
              Contact Creator
            </p>
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
                  style={{ background: sc.itemIconBg, color: sc.text, border: `1px solid ${sc.border}` }}
                >
                  <PhoneIcon size={15} /> Call
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ─── MOBILE STEP BAR ─── */
  const MobileStepBar = () => (
    <div
      className="lg:hidden flex gap-2 overflow-x-auto py-3 px-4"
      style={{
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        background: sc.stepBarBg,
        borderBottom: `1px solid ${sc.border}`,
      }}
    >
      {steps.map((step, idx) => {
        const status = getStepStatus(step.id);
        const isActive = idx === activeStepIndex;
        const isLocked = status === "locked" || !!countdownUnlocks[step.id];
        const isCompleted = status === "completed";
        const hasCountdown = !!countdownUnlocks[step.id];

        return (
          <button
            key={step.id}
            onClick={() => !isLocked && setActiveStepIndex(idx)}
            disabled={isLocked}
            className="flex items-center gap-1.5 shrink-0 transition-all"
            style={{
              padding: "6px 14px",
              borderRadius: "100px",
              fontSize: "12px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              border: isActive
                ? "1px solid rgba(212,175,55,0.4)"
                : isCompleted
                ? "1px solid rgba(212,175,55,0.25)"
                : `1px solid ${sc.stepBarBorder}`,
              background: isActive
                ? sc.stepBarActive
                : isCompleted
                ? "rgba(212,175,55,0.08)"
                : sc.stepBarBg,
              color: isActive
                ? "#D4AF37"
                : isCompleted
                ? "#D4AF37"
                : hasCountdown
                ? "#fbbf24"
                : isLocked
                ? sc.textLocked
                : sc.stepBarInactive,
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

  // Check if active step has a countdown
  const activeCountdown = activeStep ? countdownUnlocks[activeStep.id] : null;

  return (
    <div className="flex min-h-[calc(100vh-52px)]">
      <JourneySidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <div className="lg:hidden text-center py-4 px-4" style={{ borderBottom: `1px solid ${sc.border}` }}>
          <h1 className="font-heading font-extrabold tracking-tight leading-tight" style={{ fontSize: "clamp(18px, 5vw, 28px)", letterSpacing: "-0.02em", color: sc.text }}>
            {funnel.title}
          </h1>
        </div>
        <MobileStepBar />

        {hasContact && (
          <div className="lg:hidden flex gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${sc.border}`, background: sc.bg }}>
            {funnel.contact_whatsapp && (
              <button
                onClick={() => window.open(`https://wa.me/${funnel.contact_whatsapp?.replace(/\D/g, "")}`)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[12px] font-semibold"
                style={{ background: "rgba(37,211,102,0.15)", color: "#25d366", border: "1px solid rgba(37,211,102,0.2)" }}
              >
                <MessageCircle size={14} /> WhatsApp
              </button>
            )}
            {funnel.contact_phone && (
              <button
                onClick={() => window.open(`tel:${funnel.contact_phone}`)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[12px] font-semibold"
                style={{ background: sc.itemIconBg, color: sc.text, border: `1px solid ${sc.border}` }}
              >
                <PhoneIcon size={14} /> Call
              </button>
            )}
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 px-4 lg:px-8 py-6 lg:py-8 max-w-[860px] mx-auto w-full">
          <h1 className="hidden lg:block font-heading font-extrabold tracking-tight leading-tight mb-6" style={{ fontSize: "clamp(22px, 3vw, 34px)", letterSpacing: "-0.02em", color: sc.text }}>
            {funnel.title}
          </h1>
          {activeStep && (
            <div className="space-y-5">
              <div style={{ paddingBottom: "12px", borderBottom: `1px solid ${sc.border}`, marginBottom: "16px" }}>
                <div className="flex items-center gap-3 mb-1">
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: sc.textMuted,
                    }}
                  >
                    Step {activeStepIndex + 1} of {steps.length}
                  </span>
                  {activeProgress?.status === "completed" && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-gold">
                      <Check size={10} /> Completed
                    </span>
                  )}
                  {activeProgress?.status === "in_progress" && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(251,146,60,0.15)", color: "#fb923c" }}>
                      In Progress
                    </span>
                  )}
                </div>
                <h2
                  className="font-heading font-bold"
                  style={{ fontSize: "20px", fontFamily: "'Plus Jakarta Sans', var(--font-heading), sans-serif", color: sc.text }}
                >
                  {activeStep.title || `Step ${activeStepIndex + 1}`}
                </h2>
                {activeStep.description && (
                  <p className="mt-1" style={{ fontSize: "14px", color: sc.textMuted }}>{activeStep.description}</p>
                )}
              </div>

              {/* Countdown timer for delayed steps */}
              {activeCountdown && (
                <CountdownTimer
                  unlockAt={activeCountdown}
                  onUnlock={() => handleCountdownComplete(activeStep.id)}
                  isDark={isDark}
                />
              )}

              {/* Unlock hint for locked steps (no countdown) */}
              {getStepStatus(activeStep.id) === "locked" && !activeCountdown && (
                <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.2)" }}>
                  <Lock size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-300">Step Locked</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(251,191,36,0.7)" }}>{getUnlockHint(activeStep, activeStepIndex)}</p>
                  </div>
                </div>
              )}

              {/* Inline hint about what unlocks next */}
              {activeStepIndex + 1 < steps.length && getStepStatus(activeStep.id) !== "completed" && (getStepStatus(steps[activeStepIndex + 1].id) === "locked" || countdownUnlocks[steps[activeStepIndex + 1]?.id]) && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl" style={{ background: sc.itemBg, border: `1px solid ${sc.border}` }}>
                  <Info size={13} className="shrink-0 mt-0.5" style={{ color: sc.textDimmer }} />
                  <p style={{ fontSize: "12px", color: sc.textMuted, lineHeight: "1.5" }}>
                    <span style={{ color: sc.text, fontWeight: 600 }}>Next:</span> {getUnlockHint(steps[activeStepIndex + 1], activeStepIndex + 1)}
                  </p>
                </div>
              )}

              {/* Step type content - only show when not locked/countdown */}
              {!activeCountdown && getStepStatus(activeStep.id) !== "locked" && (
                <>
                  {activeStep.step_type === "video" && activeStep.video_url && (
                    <div className="space-y-3">
                      <VideoPlayer
                        src={activeStep.video_url}
                        poster={activeStep.video_thumbnail || undefined}
                        allowSeek={funnel.allow_seek !== false}
                        allowSpeed={funnel.allow_speed_change !== false}
                        autoplay={true}
                        initialTime={activeProgress?.last_position_seconds || 0}
                        onTimeUpdate={(ct: number, dur: number) => handleVideoTimeUpdate(activeStepIndex, ct, dur)}
                      />

                      {/* Per-step speaker */}
                      <StepSpeakerCard funnel={funnel} step={activeStep} creatorProfile={creatorProfile} isDark={isDark} />

                      {/* Per-step video topics */}
                      <StepVideoTopics funnel={funnel} step={activeStep} isDark={isDark} />
                    </div>
                  )}

                  {activeStep.step_type === "video" && !activeStep.video_url && (
                    <div className="aspect-video rounded-2xl flex items-center justify-center" style={{ background: sc.cardBg, border: `1px solid ${sc.border}` }}>
                      <div className="text-center">
                        <Play size={40} style={{ color: sc.textDimmer }} className="mx-auto mb-2" />
                        <p style={{ fontSize: "12px", color: sc.textDimmer }}>Video not available</p>
                      </div>
                    </div>
                  )}

                  {activeStep.step_type === "lead_form" && (
                    <div className="rounded-2xl p-6" style={{ background: sc.cardBg, border: `1px solid ${sc.cardBorder}` }}>
                      {leadSubmitted || activeProgress?.status === "completed" ? (
                        <div className="text-center py-6">
                          <CheckCircle2 size={40} className="text-gold mx-auto mb-3" />
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
                          <CheckCircle2 size={40} className="text-gold mx-auto mb-3" />
                          <h3 className="font-heading font-bold" style={{ color: sc.text }}>Step Completed</h3>
                        </>
                      ) : (
                        <>
                          <h3 className="text-lg font-heading font-bold mb-2" style={{ color: sc.text }}>{activeStep.cta_text || (activeStep.step_type === "booking" ? "Book Your Call" : "Continue")}</h3>
                          {activeStep.description && <p style={{ fontSize: "14px", color: sc.textMuted }} className="mb-4">{activeStep.description}</p>}
                          <Button
                            className="h-14 px-8 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg shadow-primary/20"
                            onClick={() => handleCtaClick(activeStepIndex)}
                          >
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
                          <CheckCircle2 size={40} className="text-gold mx-auto mb-3" />
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
                          <CheckCircle2 size={40} className="text-gold mx-auto mb-3" />
                          <h3 className="font-heading font-bold" style={{ color: sc.text }}>Step Unlocked</h3>
                          <p style={{ fontSize: "12px", color: sc.textMuted }} className="mt-1">You've been approved to continue.</p>
                        </>
                      ) : (
                        <>
                          <Lock size={40} style={{ color: sc.textDimmer }} className="mx-auto mb-3" />
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

              {/* Next Step Banner */}
              {nextStepUnlocked && (
                <button
                  onClick={() => setActiveStepIndex(activeStepIndex + 1)}
                  className="w-full flex items-center justify-between transition-all"
                  style={{
                    background: "rgba(212,175,55,0.1)",
                    border: "1px solid rgba(212,175,55,0.25)",
                    borderRadius: "12px",
                    padding: "14px 18px",
                    cursor: "pointer",
                    marginTop: "16px",
                  }}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-gold">
                    <Sparkles size={16} /> Next step unlocked!
                  </span>
                  <span className="flex items-center gap-1 text-sm font-medium text-gold">
                    Continue to Step {activeStepIndex + 2} <ChevronRight size={16} />
                  </span>
                </button>
              )}

              {activeProgress?.status === "completed" && !nextStepUnlocked && activeStepIndex + 1 < steps.length && getStepStatus(steps[activeStepIndex + 1].id) !== "locked" && !countdownUnlocks[steps[activeStepIndex + 1]?.id] && (
                <Button
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold"
                  onClick={() => setActiveStepIndex(activeStepIndex + 1)}
                >
                  Next Step <ChevronRight size={16} />
                </Button>
              )}
            </div>
          )}

          {/* Mobile: Creator + Contact at bottom */}
          <div className="lg:hidden mt-6 space-y-3">
            {creatorProfile?.full_name && (
              <div className="flex items-center gap-3 py-3 px-1">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ border: "2px solid rgba(212,175,55,0.3)" }}>
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
                    <span className="font-semibold text-white text-sm truncate">{creatorProfile.full_name}</span>
                    {creatorProfile.kyc_status === "approved" && <BadgeCheck size={15} className="text-primary flex-shrink-0" />}
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
                  <Button className="flex-1 bg-white/[0.06] hover:bg-white/10 text-white border border-white/[0.06] h-11 rounded-xl text-sm" onClick={() => window.open(`tel:${funnel.contact_phone}`)}>
                    <PhoneIcon size={16} /> Call
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
