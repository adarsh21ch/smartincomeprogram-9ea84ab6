import { useState, useEffect, useRef, useCallback } from "react";
import {
  CheckCircle2, Lock, Play, Timer, Trophy, SkipForward, ExternalLink,
  ChevronRight, Check, Circle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "./VideoPlayer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Types ─── */
export interface RichStepData {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  step_type: string;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  is_locked: boolean;
  cta_text?: string | null;
  cta_url?: string | null;
  booking_url?: string | null;
  unlock_condition?: string | null;
  unlock_percentage?: number | null;
  time_delay_enabled?: boolean;
  time_delay_minutes?: number;
  speaker_mode_step?: string | null;
  speaker_name_custom?: string | null;
  speaker_title?: string | null;
  speaker_bio?: string | null;
  speaker_photo_url_custom?: string | null;
  video_topics_step_enabled?: boolean;
  video_topics_step?: Array<{ icon: string; text: string }> | null;
  timer_cta_enabled?: boolean;
  timer_cta_text?: string | null;
  timer_cta_url?: string | null;
  timer_cta_style?: string | null;
  progress: {
    watch_percent: number;
    is_completed: boolean;
    last_position_seconds: number;
    condition_met_at?: string | null;
    max_watched_seconds?: number;
    time_spent_seconds?: number;
  };
}

interface FunnelData {
  id: string;
  name: string;
  description?: string;
  speaker_name?: string;
  speaker_photo_url?: string;
  speaker_about?: string;
  speaker_mode?: string;
  speaker_scope?: string;
  video_topics_enabled?: boolean;
  video_topics?: Array<{ icon: string; text: string }>;
  video_topics_scope?: string;
}

interface CreatorData {
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  kyc_status?: string;
}

interface ProgramTabProps {
  funnel: FunnelData;
  steps: RichStepData[];
  completionPct: number;
  creatorProfile?: CreatorData | null;
  onStepComplete: () => void;
}

/* ─── Unlock check — SAME logic as MultiStepViewer ─── */
interface UnlockResult {
  unlocked: boolean;
  reason?: string;
  unlockAt?: number;
  remainingMs?: number;
}

const checkStepUnlock = (
  step: RichStepData,
  stepIndex: number,
  prevProgress: { watch_percent: number; is_completed: boolean; condition_met_at?: string | null; time_spent_seconds?: number } | null
): UnlockResult => {
  if (stepIndex === 0) return { unlocked: true };
  if (!prevProgress) return { unlocked: false, reason: "previous_not_started" };

  const condition = step.unlock_condition || "full_watch";
  const watchPct = prevProgress.watch_percent || 0;
  const timeSpent = prevProgress.time_spent_seconds || 0;

  let conditionMet = false;
  if (condition === "full_watch") {
    conditionMet = watchPct >= 95 || prevProgress.is_completed;
  } else if (condition === "percentage") {
    conditionMet = watchPct >= (step.unlock_percentage || 80);
  } else if (condition === "time_spent") {
    const requiredSeconds = (step.unlock_percentage || 10) * 60;
    conditionMet = timeSpent >= requiredSeconds;
  } else {
    conditionMet = prevProgress.is_completed;
  }

  if (!conditionMet) return { unlocked: false, reason: "condition_not_met" };

  // Time delay check
  if (step.time_delay_enabled && (step.time_delay_minutes || 0) > 0) {
    const conditionMetAt = prevProgress.condition_met_at;
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

/* ─── Speaker Card ─── */
const SpeakerCard = ({ funnel, step, creatorProfile }: { funnel: FunnelData; step: RichStepData; creatorProfile?: CreatorData | null }) => {
  let speaker: { name: string; title?: string; bio?: string; photo?: string } | null = null;

  if (funnel.speaker_scope === "per_step") {
    const mode = step.speaker_mode_step || "none";
    if (mode === "none") return null;
    if (mode === "account" && creatorProfile) {
      speaker = { name: creatorProfile.full_name || "", photo: creatorProfile.avatar_url, bio: creatorProfile.bio };
    } else if (mode === "custom") {
      speaker = { name: step.speaker_name_custom || "", title: step.speaker_title || "", bio: step.speaker_bio || "", photo: step.speaker_photo_url_custom || "" };
    }
  } else {
    if (funnel.speaker_mode === "none") return null;
    if (funnel.speaker_mode === "account" && creatorProfile) {
      speaker = { name: creatorProfile.full_name || "", photo: creatorProfile.avatar_url, bio: creatorProfile.bio };
    } else if (funnel.speaker_mode === "custom") {
      speaker = { name: funnel.speaker_name || "", bio: funnel.speaker_about, photo: funnel.speaker_photo_url };
    }
  }

  if (!speaker || !speaker.name) return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl p-4 border border-border/50 bg-card/50 backdrop-blur-sm">
      {speaker.photo && (
        <img src={speaker.photo} alt="" className="w-11 h-11 rounded-full object-cover shrink-0 ring-2 ring-primary/20" />
      )}
      <div className="min-w-0">
        <p className="font-semibold text-sm text-foreground">{speaker.name}</p>
        {speaker.title && <p className="text-xs text-primary mt-0.5">{speaker.title}</p>}
        {speaker.bio && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{speaker.bio}</p>}
      </div>
    </div>
  );
};

/* ─── Video Topics ─── */
const VideoTopics = ({ funnel, step }: { funnel: FunnelData; step: RichStepData }) => {
  let topics: Array<{ icon: string; text: string }> = [];

  if (funnel.video_topics_scope === "per_step") {
    if (step.video_topics_step_enabled && step.video_topics_step?.length) {
      topics = step.video_topics_step;
    }
  } else {
    if (funnel.video_topics_enabled && funnel.video_topics?.length) {
      topics = funnel.video_topics;
    }
  }

  if (topics.length === 0) return null;

  return (
    <div className="rounded-2xl p-4 border border-border/50 bg-card/50 backdrop-blur-sm space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Key Points</p>
      <ul className="space-y-1.5">
        {topics.map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
            <span className="shrink-0">{t.icon || "✅"}</span>
            <span>{t.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* ─── Full-Width Step Bar ─── */
const StepBar = ({ steps, activeIndex, countdownUnlocks, onStepClick }: {
  steps: RichStepData[];
  activeIndex: number;
  countdownUnlocks: Record<string, number>;
  onStepClick: (index: number) => void;
}) => {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
      {steps.map((step, i) => {
        const isCompleted = step.progress.is_completed;
        const isActive = i === activeIndex;
        const isLocked = step.is_locked && !isCompleted;
        const hasCountdown = !!countdownUnlocks[step.id];

        return (
          <button
            key={step.id}
            onClick={() => onStepClick(i)}
            className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all text-center min-w-0"
            style={{
              background: isActive ? "rgba(212,175,55,0.1)" : isCompleted ? "rgba(212,175,55,0.04)" : "transparent",
              border: isActive ? "1.5px solid rgba(212,175,55,0.35)" : isCompleted ? "1px solid rgba(212,175,55,0.15)" : "1px solid hsl(var(--border) / 0.3)",
              cursor: isLocked && !hasCountdown ? "not-allowed" : "pointer",
              opacity: isLocked && !hasCountdown ? 0.4 : 1,
            }}
          >
            {/* Icon */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: isCompleted ? "hsl(var(--primary))" : isActive ? "rgba(212,175,55,0.15)" : hasCountdown ? "rgba(251,191,36,0.12)" : "hsl(var(--muted) / 0.5)",
                border: isActive && !isCompleted ? "2px solid hsl(var(--primary))" : "none",
              }}
            >
              {isCompleted ? (
                <Check size={13} className="text-primary-foreground" strokeWidth={3} />
              ) : hasCountdown ? (
                <Timer size={11} style={{ color: "#fbbf24" }} />
              ) : isLocked ? (
                <Lock size={10} className="text-muted-foreground/50" />
              ) : (
                <span className={`text-[10px] font-bold ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  {i + 1}
                </span>
              )}
            </div>

            {/* Label */}
            <span className={`text-[10px] font-medium leading-tight truncate w-full ${
              isActive ? "text-primary" : isCompleted ? "text-primary/80" : hasCountdown ? "text-yellow-400/80" : "text-muted-foreground/60"
            }`}>
              {step.title || `Step ${i + 1}`}
            </span>
          </button>
        );
      })}
    </div>
  );
};

/* ─── Blurred Countdown Overlay (matches MultiStepViewer exactly) ─── */
const BlurredCountdown = ({ step, unlockAt, onUnlock }: {
  step: RichStepData;
  unlockAt: number;
  onUnlock: () => void;
}) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= unlockAt) {
        clearInterval(interval);
        onUnlock();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [unlockAt, onUnlock]);

  const remaining = Math.max(0, unlockAt - now);
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);

  const timerBoxStyle = "px-3 py-2.5 rounded-xl text-center";

  return (
    <div className="space-y-4">
      <div className="relative aspect-video rounded-2xl overflow-hidden border border-border/50">
        {/* Blurred background */}
        {step.thumbnail_url ? (
          <img src={step.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ filter: "blur(20px) brightness(0.4)", transform: "scale(1.1)" }} />
        ) : step.video_url ? (
          <video src={step.video_url} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" style={{ filter: "blur(12px) brightness(0.4)", transform: "scale(1.1)" }} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-background to-muted" />
        )}

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/55" />

        {/* Countdown content */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6">
          {/* Lock icon */}
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(212,160,23,0.15)", border: "1.5px solid rgba(212,160,23,0.4)" }}>
            <Lock size={20} className="text-primary" />
          </div>

          {/* Label */}
          <div className="text-center">
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/50">Upcoming</p>
            <p className="text-base font-bold text-white mt-0.5">{step.title}</p>
          </div>

          {/* Timer boxes */}
          <div className="flex items-center gap-2">
            {h > 0 && (
              <>
                <div className={timerBoxStyle} style={{ background: "rgba(212,160,23,0.15)", border: "1.5px solid rgba(212,160,23,0.3)" }}>
                  <span className="text-2xl font-extrabold font-mono" style={{ color: "#D4A017", fontVariantNumeric: "tabular-nums" }}>{h.toString().padStart(2, "0")}</span>
                  <p className="text-[9px] font-semibold tracking-wider uppercase mt-0.5 text-white/35">hrs</p>
                </div>
                <span className="text-lg font-bold mb-3" style={{ color: "rgba(212,175,55,0.5)" }}>:</span>
              </>
            )}
            <div className={timerBoxStyle} style={{ background: "rgba(212,160,23,0.15)", border: "1.5px solid rgba(212,160,23,0.3)" }}>
              <span className="text-2xl font-extrabold font-mono" style={{ color: "#D4A017", fontVariantNumeric: "tabular-nums" }}>{m.toString().padStart(2, "0")}</span>
              <p className="text-[9px] font-semibold tracking-wider uppercase mt-0.5 text-white/35">min</p>
            </div>
            <span className="text-lg font-bold mb-3" style={{ color: "rgba(212,175,55,0.5)" }}>:</span>
            <div className={timerBoxStyle} style={{ background: "rgba(212,160,23,0.15)", border: "1.5px solid rgba(212,160,23,0.3)" }}>
              <span className="text-2xl font-extrabold font-mono" style={{ color: "#D4A017", fontVariantNumeric: "tabular-nums" }}>{s.toString().padStart(2, "0")}</span>
              <p className="text-[9px] font-semibold tracking-wider uppercase mt-0.5 text-white/35">sec</p>
            </div>
          </div>

          <p className="text-[11px] text-white/40">This step will unlock automatically when the timer ends</p>

          {/* CTA during wait */}
          {step.timer_cta_enabled && step.timer_cta_text && step.timer_cta_url && (
            <button
              onClick={() => window.open(step.timer_cta_url!, "_blank")}
              className="mt-1 transition-all hover:opacity-90 hover:-translate-y-0.5 w-full max-w-[320px]"
              style={{
                padding: "12px 24px",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
                ...(step.timer_cta_style === "white"
                  ? { background: "#fff", color: "#000", border: "none" }
                  : step.timer_cta_style === "outline"
                  ? { background: "transparent", color: "#fff", border: "1.5px solid rgba(255,255,255,0.4)" }
                  : { background: "#D4A017", color: "#000", border: "none" }),
              }}
            >
              {step.timer_cta_text}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Up Next Section (matches MultiStepViewer) ─── */
const UpNextSection = ({
  nextStep,
  nextIndex,
  unlockResult,
  countdownAt,
  currentWatchPct,
  onPlayNext,
  onCountdownComplete,
}: {
  nextStep: RichStepData | null;
  nextIndex: number;
  unlockResult: UnlockResult | null;
  countdownAt: number | null;
  currentWatchPct: number;
  onPlayNext: () => void;
  onCountdownComplete: () => void;
}) => {
  // Last step
  if (!nextStep) {
    return (
      <div className="rounded-2xl p-5 text-center border border-primary/15 bg-gradient-to-b from-primary/5 to-transparent">
        <Trophy size={28} className="mx-auto mb-2 text-primary" />
        <p className="font-semibold text-sm text-foreground">You're on the final step!</p>
        <p className="text-xs text-muted-foreground mt-1">Complete this to finish the program.</p>
      </div>
    );
  }

  // Countdown
  if (countdownAt) {
    return (
      <BlurredCountdown
        step={nextStep}
        unlockAt={countdownAt}
        onUnlock={onCountdownComplete}
      />
    );
  }

  // Unlocked
  if (unlockResult?.unlocked) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-4 flex items-center justify-between gap-3 border border-primary/20 cursor-pointer hover:bg-primary/5 transition-all"
        style={{ background: "rgba(212,175,55,0.04)" }}
        onClick={onPlayNext}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-primary/15">
            <SkipForward size={18} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">Up Next</p>
            <p className="font-semibold text-sm text-foreground truncate">
              Step {nextIndex + 1}: {nextStep.title}
            </p>
          </div>
        </div>
        <Button size="sm" className="shrink-0 gap-1">
          Play <ChevronRight size={14} />
        </Button>
      </motion.div>
    );
  }

  // Locked by condition
  const cond = nextStep.unlock_condition || "full_watch";
  const requiredPct = cond === "percentage" ? (nextStep.unlock_percentage || 80) : cond === "full_watch" ? 95 : 0;
  const progressToward = requiredPct > 0 ? Math.min(100, (currentWatchPct / requiredPct) * 100) : 0;

  let conditionText = "Watch the previous video fully to unlock.";
  if (cond === "percentage") conditionText = `Watch at least ${nextStep.unlock_percentage || 80}% of the current video to unlock.`;
  if (cond === "time_spent") conditionText = `Spend at least ${nextStep.unlock_percentage || 10} minutes on the current step.`;

  return (
    <div className="rounded-2xl p-4 border border-border/50 bg-muted/10">
      <div className="flex items-center gap-2 mb-2">
        <Lock size={12} className="text-muted-foreground/50" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Up Next — Locked</p>
      </div>
      <p className="font-medium text-sm text-foreground/80">
        Step {nextIndex + 1}: {nextStep.title}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{conditionText}</p>
      {requiredPct > 0 && (
        <div className="mt-2">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary/60 transition-all duration-500"
              style={{ width: `${progressToward}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {Math.floor(currentWatchPct)}% / {requiredPct}% needed
          </p>
        </div>
      )}
    </div>
  );
};

/* ═══════════ MAIN COMPONENT ═══════════ */
export const ProgramTab = ({ funnel, steps, completionPct, creatorProfile, onStepComplete }: ProgramTabProps) => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [countdownUnlocks, setCountdownUnlocks] = useState<Record<string, number>>({});
  const [localProgress, setLocalProgress] = useState<Record<string, { watch_percent: number; condition_met_at?: string | null }>>({});
  const completedSteps = steps.filter((s) => s.progress.is_completed).length;
  const allComplete = steps.length > 0 && completedSteps === steps.length;

  // Initialize local progress from server data
  useEffect(() => {
    const lp: Record<string, { watch_percent: number; condition_met_at?: string | null }> = {};
    for (const s of steps) {
      lp[s.id] = { watch_percent: s.progress.watch_percent, condition_met_at: s.progress.condition_met_at };
    }
    setLocalProgress(lp);
  }, [steps]);

  // Find the best starting step
  useEffect(() => {
    // Check for countdown steps first
    for (let i = 0; i < steps.length; i++) {
      if (countdownUnlocks[steps[i].id]) {
        setActiveStepIndex(i);
        return;
      }
    }
    // Find first non-completed, non-locked step
    for (let i = 0; i < steps.length; i++) {
      if (!steps[i].progress.is_completed && !steps[i].is_locked) {
        setActiveStepIndex(i);
        return;
      }
    }
    if (steps.length > 0) setActiveStepIndex(steps.length - 1);
  }, [steps, countdownUnlocks]);

  // Build countdowns using REAL unlock logic
  useEffect(() => {
    const countdowns: Record<string, number> = {};
    for (let i = 1; i < steps.length; i++) {
      const step = steps[i];
      const prevStep = steps[i - 1];
      const prevProg = {
        watch_percent: localProgress[prevStep.id]?.watch_percent ?? prevStep.progress.watch_percent,
        is_completed: prevStep.progress.is_completed,
        condition_met_at: localProgress[prevStep.id]?.condition_met_at ?? prevStep.progress.condition_met_at,
        time_spent_seconds: prevStep.progress.time_spent_seconds,
      };

      const result = checkStepUnlock(step, i, prevProg);
      if (result.reason === "delay_countdown" && result.unlockAt) {
        countdowns[step.id] = result.unlockAt;
      }
    }
    setCountdownUnlocks(countdowns);
  }, [steps, localProgress]);

  // Compute real-time step statuses
  const getStepUnlockStatus = useCallback((stepIndex: number): UnlockResult => {
    if (stepIndex === 0) return { unlocked: true };
    const step = steps[stepIndex];
    const prevStep = steps[stepIndex - 1];
    const prevProg = {
      watch_percent: localProgress[prevStep.id]?.watch_percent ?? prevStep.progress.watch_percent,
      is_completed: prevStep.progress.is_completed,
      condition_met_at: localProgress[prevStep.id]?.condition_met_at ?? prevStep.progress.condition_met_at,
      time_spent_seconds: prevStep.progress.time_spent_seconds,
    };
    return checkStepUnlock(step, stepIndex, prevProg);
  }, [steps, localProgress]);

  const isStepAccessible = useCallback((stepIndex: number): boolean => {
    const step = steps[stepIndex];
    if (step.progress.is_completed) return true;
    if (stepIndex === 0) return true;
    const result = getStepUnlockStatus(stepIndex);
    return result.unlocked;
  }, [steps, getStepUnlockStatus]);

  const handleStepClick = (index: number) => {
    const step = steps[index];
    if (step.progress.is_completed) {
      setActiveStepIndex(index);
      return;
    }
    if (countdownUnlocks[step.id]) {
      setActiveStepIndex(index); // Let user see countdown
      return;
    }
    if (!isStepAccessible(index)) {
      toast.error("Complete the previous step first", { duration: 2000 });
      return;
    }
    setActiveStepIndex(index);
  };

  const handleCountdownComplete = useCallback((stepId: string) => {
    setCountdownUnlocks((prev) => {
      const n = { ...prev };
      delete n[stepId];
      return n;
    });
    onStepComplete();
    toast.success("Step unlocked! 🎉");
  }, [onStepComplete]);

  const activeStep = steps[activeStepIndex];
  const nextStep = activeStepIndex + 1 < steps.length ? steps[activeStepIndex + 1] : null;
  const activeCountdown = activeStep ? countdownUnlocks[activeStep.id] : null;
  const isTimerBlurActive = !!(activeCountdown && activeStep?.step_type === "video");

  // Next step unlock status (real-time)
  const nextStepUnlock = nextStep ? getStepUnlockStatus(activeStepIndex + 1) : null;
  const nextCountdownAt = nextStep ? countdownUnlocks[nextStep.id] || null : null;
  const currentWatchPct = localProgress[activeStep?.id]?.watch_percent ?? activeStep?.progress.watch_percent ?? 0;

  if (steps.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">No content yet. Check back soon.</p>
      </div>
    );
  }

  if (allComplete) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{completedSteps} of {steps.length} steps completed</span>
            <span className="font-medium" style={{ color: "#22c55e" }}>100% ✨</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: "100%", background: "#22c55e" }} />
          </div>
        </div>
        <StepBar steps={steps} activeIndex={activeStepIndex} countdownUnlocks={countdownUnlocks} onStepClick={handleStepClick} />
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-8 text-center space-y-3">
          <Trophy size={40} className="mx-auto text-primary" />
          <h2 className="text-xl font-bold text-foreground">Program Complete! 🎉</h2>
          <p className="text-sm text-muted-foreground">Congratulations! You've completed all steps.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {completedSteps} of {steps.length} steps completed
          </span>
          <span className="font-medium">{completionPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Full-width step bar */}
      <StepBar steps={steps} activeIndex={activeStepIndex} countdownUnlocks={countdownUnlocks} onStepClick={handleStepClick} />

      {/* Active step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStep.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          {/* Step header */}
          <div className="pb-2 border-b border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Step {activeStepIndex + 1} of {steps.length}
              </span>
              {activeStep.progress.is_completed && (
                <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1" style={{ color: "#D4AF37" }}>
                  <Check size={10} /> Completed
                </span>
              )}
              {!activeStep.progress.is_completed && currentWatchPct > 0 && !isTimerBlurActive && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  In Progress · {Math.floor(currentWatchPct)}%
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-foreground">{activeStep.title}</h2>
            {activeStep.description && (
              <p className="text-sm text-muted-foreground mt-1">{activeStep.description}</p>
            )}
          </div>

          {/* Countdown with blurred video preview */}
          {isTimerBlurActive ? (
            <BlurredCountdown
              step={activeStep}
              unlockAt={activeCountdown!}
              onUnlock={() => handleCountdownComplete(activeStep.id)}
            />
          ) : !isStepAccessible(activeStepIndex) && !activeStep.progress.is_completed ? (
            /* Locked step */
            <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.15)" }}>
              <Lock size={16} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-primary">Step Locked</p>
                <p className="text-xs mt-0.5 text-muted-foreground">
                  {activeStep.unlock_condition === "percentage"
                    ? `Watch at least ${activeStep.unlock_percentage || 80}% of the previous video.`
                    : activeStep.unlock_condition === "time_spent"
                    ? `Spend at least ${activeStep.unlock_percentage || 10} minutes on the previous step.`
                    : "Watch the previous video fully to unlock."}
                </p>
              </div>
            </div>
          ) : (
            /* Unlocked step content */
            <>
              {activeStep.step_type === "video" && activeStep.video_url ? (
                <VideoPlayer
                  videoUrl={activeStep.video_url}
                  stepTitle={activeStep.title}
                  stepId={activeStep.id}
                  funnelId={funnel.id}
                  initialPosition={activeStep.progress.last_position_seconds}
                  durationSeconds={activeStep.duration_seconds}
                  onComplete={() => {
                    onStepComplete();
                    if (nextStep) {
                      const result = getStepUnlockStatus(activeStepIndex + 1);
                      if (result.unlocked) {
                        setTimeout(() => setActiveStepIndex(activeStepIndex + 1), 1500);
                      } else if (result.reason === "delay_countdown" && result.unlockAt) {
                        setCountdownUnlocks((prev) => ({ ...prev, [nextStep.id]: result.unlockAt! }));
                        setTimeout(() => setActiveStepIndex(activeStepIndex + 1), 1500);
                      }
                    }
                  }}
                  onClose={() => {}}
                  hideHeader
                />
              ) : activeStep.step_type === "video" && !activeStep.video_url ? (
                <div className="aspect-video rounded-2xl flex items-center justify-center bg-card border border-border">
                  <div className="text-center">
                    <Play size={40} className="mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground/50">Video coming soon</p>
                  </div>
                </div>
              ) : (activeStep.step_type === "cta" || activeStep.step_type === "booking") ? (
                <div className="rounded-2xl p-6 text-center bg-card border border-border">
                  {activeStep.progress.is_completed ? (
                    <>
                      <CheckCircle2 size={40} className="mx-auto mb-3 text-primary" />
                      <h3 className="font-bold text-foreground">Step Completed</h3>
                    </>
                  ) : (
                    <>
                      <h3 className="text-lg font-bold mb-2 text-foreground">{activeStep.cta_text || "Continue"}</h3>
                      {activeStep.description && <p className="text-sm text-muted-foreground mb-4">{activeStep.description}</p>}
                      <Button
                        className="h-12 px-8 font-bold"
                        onClick={() => {
                          if (activeStep.cta_url) window.open(activeStep.cta_url, "_blank");
                          if (activeStep.booking_url) window.open(activeStep.booking_url, "_blank");
                        }}
                      >
                        {activeStep.cta_text || "Continue"} →
                      </Button>
                    </>
                  )}
                </div>
              ) : null}

              {/* Speaker card */}
              <SpeakerCard funnel={funnel} step={activeStep} creatorProfile={creatorProfile} />

              {/* Video topics */}
              <VideoTopics funnel={funnel} step={activeStep} />

              {/* Step CTA button */}
              {activeStep.cta_text && activeStep.cta_url && activeStep.step_type === "video" && (
                <Button
                  className="w-full font-bold"
                  onClick={() => window.open(activeStep.cta_url!, "_blank")}
                >
                  {activeStep.cta_text} <ExternalLink size={14} className="ml-1" />
                </Button>
              )}
            </>
          )}

          {/* Up Next section — hidden when timer overlay is active */}
          {!isTimerBlurActive && (
            <UpNextSection
              nextStep={nextStep}
              nextIndex={activeStepIndex + 1}
              unlockResult={nextStepUnlock}
              countdownAt={nextCountdownAt}
              currentWatchPct={currentWatchPct}
              onPlayNext={() => setActiveStepIndex(activeStepIndex + 1)}
              onCountdownComplete={() => nextStep && handleCountdownComplete(nextStep.id)}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
