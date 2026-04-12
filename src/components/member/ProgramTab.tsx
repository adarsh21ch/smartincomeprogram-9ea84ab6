import { useState, useEffect, useRef, useCallback } from "react";
import {
  CheckCircle2, Lock, Play, Timer, Trophy, SkipForward, ExternalLink,
  ChevronRight, Check, Circle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VideoPlayer, type VideoPlayerProgress } from "./VideoPlayer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  lock_reason?: string | null;
  unlock_at?: string | null;
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
    permanently_unlocked?: boolean;
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

interface LocalStepProgress {
  watch_percent: number;
  is_completed: boolean;
  condition_met_at?: string | null;
  time_spent_seconds: number;
  last_position_seconds: number;
}

const getInitialProgressState = (step: RichStepData): LocalStepProgress => ({
  watch_percent: step.progress.watch_percent ?? 0,
  is_completed: step.progress.is_completed ?? false,
  condition_met_at: step.progress.condition_met_at ?? null,
  time_spent_seconds: step.progress.time_spent_seconds ?? 0,
  last_position_seconds: step.progress.last_position_seconds ?? 0,
});

const meetsUnlockCondition = (
  step: RichStepData | null | undefined,
  progress: { watchedPercent: number; timeSpentSeconds: number; isCompleted?: boolean }
) => {
  if (!step) return false;

  const condition = step.unlock_condition || "full_watch";

  if (condition === "percentage") {
    return progress.watchedPercent >= (step.unlock_percentage || 80);
  }

  if (condition === "time_spent") {
    return progress.timeSpentSeconds >= ((step.unlock_percentage || 10) * 60);
  }

  return progress.watchedPercent >= 95 || Boolean(progress.isCompleted);
};

const getCountdownUnlockAt = (step: RichStepData | null | undefined, conditionMetAt?: string | null) => {
  if (!step?.time_delay_enabled || !conditionMetAt) return null;

  const delayMinutes = step.time_delay_minutes || 0;
  if (delayMinutes <= 0) return null;

  return new Date(conditionMetAt).getTime() + delayMinutes * 60 * 1000;
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

/* ─── localStorage resume helpers ─── */
const getResumeKey = (userId: string | undefined, funnelId: string) =>
  `nf_member_resume_${userId ?? "anon"}_${funnelId}`;

const readResumeState = (key: string): { activeStepId: string | null; progress: Record<string, LocalStepProgress> } => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { activeStepId: null, progress: {} };
    const parsed = JSON.parse(raw);
    return {
      activeStepId: typeof parsed?.activeStepId === "string" ? parsed.activeStepId : null,
      progress: parsed?.progress && typeof parsed.progress === "object" ? parsed.progress : {},
    };
  } catch {
    return { activeStepId: null, progress: {} };
  }
};

const writeResumeState = (key: string, activeStepId: string | null, progress: Record<string, LocalStepProgress>) => {
  try {
    localStorage.setItem(key, JSON.stringify({ activeStepId, progress }));
  } catch { /* quota exceeded — ignore */ }
};

/* ─── Compact Scrollable Step Strip ─── */
const StepBar = ({
  steps,
  activeIndex,
  countdownUnlocks,
  stepStates,
  onStepClick,
}: {
  steps: RichStepData[];
  activeIndex: number;
  countdownUnlocks: Record<string, number>;
  stepStates: Array<{
    completed: boolean;
    accessible: boolean;
    hasCountdown: boolean;
    watchPercent: number;
  }>;
  onStepClick: (index: number) => void;
}) => {
  return (
    <div className="overflow-x-auto scrollbar-hide" style={{ height: 80 }}>
      <div className="flex gap-2 pb-1 h-full items-center" style={{ minWidth: "max-content" }}>
        {steps.map((step, i) => {
          const state = stepStates[i];
          const isCompleted = state.completed;
          const isActive = i === activeIndex;
          const isLocked = !state.accessible && !isCompleted;
          const hasCountdown = state.hasCountdown || !!countdownUnlocks[step.id];

          return (
            <button
              key={step.id}
              onClick={() => onStepClick(i)}
              className={cn(
                "rounded-xl border transition-all flex flex-col items-center justify-center gap-1 flex-shrink-0",
                isActive ? "border-primary/40 bg-primary/10 items-start px-3 py-2" : "border-border/40 bg-card/50 px-2 py-2",
                isLocked && !hasCountdown && "opacity-50 cursor-not-allowed",
              )}
              style={{
                height: 64,
                minWidth: isActive ? 140 : 72,
              }}
              disabled={isLocked && !hasCountdown}
            >
              {isActive ? (
                <>
                  <div className="flex items-center gap-2 w-full">
                    <div className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      isCompleted ? "bg-primary text-primary-foreground" : "border-2 border-primary bg-primary/10 text-primary",
                    )}>
                      {isCompleted ? <Check size={12} strokeWidth={3} /> : i + 1}
                    </div>
                    <p className="text-xs font-semibold text-foreground truncate flex-1 text-left">
                      {step.title || `Step ${i + 1}`}
                    </p>
                  </div>
                  <p className={cn(
                    "text-[10px] pl-9",
                    isCompleted ? "text-primary" : hasCountdown ? "text-warning" : "text-muted-foreground",
                  )}>
                    {isCompleted ? "Completed" : hasCountdown ? "Timer" : state.watchPercent > 0 ? `${Math.floor(state.watchPercent)}%` : "Playing"}
                  </p>
                </>
              ) : (
                <>
                  <div className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold",
                    isCompleted ? "bg-primary text-primary-foreground" : hasCountdown ? "border border-warning/40 bg-warning/10 text-warning" : isLocked ? "border border-border/50 bg-muted/30 text-muted-foreground" : "border border-border bg-muted/40 text-foreground",
                  )}>
                    {isCompleted ? <Check size={12} strokeWidth={3} /> : hasCountdown ? <Timer size={11} /> : isLocked ? <Lock size={10} /> : i + 1}
                  </div>
                  <p className="text-[9px] text-muted-foreground truncate max-w-[56px] text-center">
                    {(step.title || `S${i + 1}`).slice(0, 8)}
                  </p>
                </>
              )}
            </button>
          );
        })}
      </div>
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
    <div
      className="rounded-2xl p-4 border mt-4"
      style={{
        background: "rgba(212,175,55,0.05)",
        borderColor: "rgba(212,175,55,0.15)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Lock size={12} className="text-muted-foreground/50" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Up Next — Locked</p>
      </div>
      <p className="font-medium text-sm text-foreground/80">
        Step {nextIndex + 1}: {nextStep.title}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{conditionText}</p>
    </div>
  );
};

/* ═══════════ MAIN COMPONENT ═══════════ */
export const ProgramTab = ({ funnel, steps, completionPct, creatorProfile, onStepComplete }: ProgramTabProps) => {
  const { user } = useAuth();
  const resumeKey = getResumeKey(user?.id, funnel.id);
  const cachedResume = useRef(readResumeState(resumeKey));

  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [countdownUnlocks, setCountdownUnlocks] = useState<Record<string, number>>({});
  const [localProgress, setLocalProgress] = useState<Record<string, LocalStepProgress>>(cachedResume.current.progress);
  const hasInitializedStepRef = useRef(false);
  const pendingConditionPersistRef = useRef<Record<string, boolean>>({});

  const getServerCountdownAt = useCallback((step: RichStepData | null | undefined) => {
    if (!step?.is_locked || !step.unlock_at) return null;

    const unlockAt = new Date(step.unlock_at).getTime();
    return Number.isFinite(unlockAt) && unlockAt > Date.now() ? unlockAt : null;
  }, []);

  useEffect(() => {
    setLocalProgress((previous) => {
      const nextEntries = steps.map((step) => {
        const incoming = getInitialProgressState(step);
        const current = previous[step.id];

        return [
          step.id,
          current
            ? {
                ...incoming,
                watch_percent: Math.max(current.watch_percent, incoming.watch_percent),
                is_completed: current.is_completed || incoming.is_completed,
                condition_met_at: current.condition_met_at || incoming.condition_met_at,
                time_spent_seconds: Math.max(current.time_spent_seconds, incoming.time_spent_seconds),
                last_position_seconds: Math.max(current.last_position_seconds, incoming.last_position_seconds),
              }
            : incoming,
        ] as const;
      });

      return Object.fromEntries(nextEntries);
    });
  }, [steps]);

  const getProgressSnapshot = useCallback(
    (step: RichStepData): LocalStepProgress => localProgress[step.id] ?? getInitialProgressState(step),
    [localProgress]
  );

  // Persist resume state whenever activeStepIndex or localProgress changes
  useEffect(() => {
    if (!hasInitializedStepRef.current || steps.length === 0) return;
    const activeId = steps[activeStepIndex]?.id ?? null;
    writeResumeState(resumeKey, activeId, localProgress);
  }, [activeStepIndex, localProgress, resumeKey, steps]);

  const stepStates = steps.map((step, index) => {
    const progress = getProgressSnapshot(step);
    const countdownAt = countdownUnlocks[step.id] ?? getServerCountdownAt(step);
    const hasCountdown = Boolean(step.is_locked && countdownAt);

    // Check if PREVIOUS step is completed locally — allows optimistic unlock
    const prevCompleted = index > 0
      ? (getProgressSnapshot(steps[index - 1]).is_completed)
      : false;
    const locallyUnlocked = index === 0 || !step.is_locked || prevCompleted;

    const unlockResult: UnlockResult = {
      unlocked: locallyUnlocked,
      reason: hasCountdown ? "delay_countdown" : (step.lock_reason ?? undefined),
      unlockAt: countdownAt ?? undefined,
    };

    return {
      completed: progress.is_completed,
      accessible: locallyUnlocked || progress.is_completed || hasCountdown,
      hasCountdown,
      watchPercent: progress.watch_percent,
      unlockResult,
    };
  });

  useEffect(() => {
    if (hasInitializedStepRef.current || steps.length === 0) return;

    // 1. Priority: a step with an active countdown timer
    const timerIdx = stepStates.findIndex((state) => state.hasCountdown);
    if (timerIdx >= 0) {
      setActiveStepIndex(timerIdx);
      hasInitializedStepRef.current = true;
      return;
    }

    // 2. Restore from localStorage
    const savedId = cachedResume.current.activeStepId;
    if (savedId) {
      const savedIdx = steps.findIndex((s) => s.id === savedId);
      if (savedIdx >= 0) {
        const savedProgress = getProgressSnapshot(steps[savedIdx]);
        if (savedProgress.is_completed || stepStates[savedIdx]?.accessible) {
          setActiveStepIndex(savedIdx);
          hasInitializedStepRef.current = true;
          return;
        }
      }
    }

    // 3. Fallback: first incomplete unlocked step
    const firstAvailableIndex = stepStates.findIndex((state) => !state.completed && state.accessible);

    setActiveStepIndex(firstAvailableIndex >= 0 ? firstAvailableIndex : 0);
    hasInitializedStepRef.current = true;
  }, [steps, getProgressSnapshot, stepStates]);

  useEffect(() => {
    if (steps.length === 0) return;
    setActiveStepIndex((current) => Math.min(current, steps.length - 1));
  }, [steps.length]);

  useEffect(() => {
    const now = Date.now();
    const serverCountdowns = Object.fromEntries(
      steps
        .map((step) => {
          const unlockAt = getServerCountdownAt(step);
          return unlockAt && unlockAt > now ? [step.id, unlockAt] as const : null;
        })
        .filter((entry): entry is readonly [string, number] => Boolean(entry))
    );

    setCountdownUnlocks((previous) => {
      const next = { ...previous };

      Object.entries(next).forEach(([stepId, unlockAt]) => {
        if (unlockAt <= now || !steps.some((step) => step.id === stepId)) {
          delete next[stepId];
        }
      });

      return { ...next, ...serverCountdowns };
    });
  }, [getServerCountdownAt, steps]);

  const isStepAccessible = useCallback((stepIndex: number): boolean => {
    const state = stepStates[stepIndex];
    return Boolean(state?.accessible);
  }, [stepStates]);

  const persistConditionMetAt = useCallback(async (
    step: RichStepData,
    nextStep: RichStepData | null,
    progress: VideoPlayerProgress,
    conditionMetAt: string,
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const now = new Date().toISOString();
    const isCompleted = progress.watchedPercent >= 95;
    const unlocksImmediately = Boolean(nextStep) && !getCountdownUnlockAt(nextStep, conditionMetAt);

    const operations: PromiseLike<unknown>[] = [
      supabase.from("funnel_step_progress").upsert(
        {
          funnel_id: funnel.id,
          funnel_step_id: step.id,
          session_id: user.id,
          watched_percentage: progress.watchedPercent,
          last_position_seconds: Math.floor(progress.currentTime),
          max_watched_seconds: progress.maxWatchedSeconds,
          time_spent_seconds: progress.timeSpentSeconds,
          condition_met_at: conditionMetAt,
          status: isCompleted ? "completed" : progress.watchedPercent > 0 ? "in_progress" : "unlocked",
          completed_at: isCompleted ? now : null,
          updated_at: now,
        },
        { onConflict: "funnel_id,funnel_step_id,session_id", ignoreDuplicates: false }
      ),
    ];

    if (nextStep && unlocksImmediately) {
      operations.push(
        supabase.from("funnel_step_progress").upsert(
          {
            funnel_id: funnel.id,
            funnel_step_id: nextStep.id,
            session_id: user.id,
            status: "unlocked",
            permanently_unlocked: true,
            condition_met_at: conditionMetAt,
            unlocked_at: now,
            updated_at: now,
          },
          { onConflict: "funnel_id,funnel_step_id,session_id", ignoreDuplicates: false }
        )
      );
    }

    await Promise.all(operations);

    return unlocksImmediately;
  }, [funnel.id]);

  const handleVideoProgress = useCallback((stepIndex: number, progress: VideoPlayerProgress) => {
    const step = steps[stepIndex];
    if (!step) return;

    const nextStep = steps[stepIndex + 1] ?? null;
    const currentProgress = getProgressSnapshot(step);
    let conditionMetAt = currentProgress.condition_met_at ?? null;
    let shouldPersistCondition = false;

    if (!conditionMetAt && nextStep && !pendingConditionPersistRef.current[step.id]) {
      if (meetsUnlockCondition(nextStep, {
        watchedPercent: progress.watchedPercent,
        timeSpentSeconds: progress.timeSpentSeconds,
        isCompleted: progress.watchedPercent >= 95,
      })) {
        conditionMetAt = new Date().toISOString();
        shouldPersistCondition = true;
      }
    }

    setLocalProgress((previous) => {
      const snapshot = previous[step.id] ?? getInitialProgressState(step);

      return {
        ...previous,
        [step.id]: {
          ...snapshot,
          watch_percent: Math.max(snapshot.watch_percent, progress.watchedPercent),
          is_completed: snapshot.is_completed || progress.watchedPercent >= 95,
          condition_met_at: snapshot.condition_met_at || conditionMetAt,
          time_spent_seconds: Math.max(snapshot.time_spent_seconds, progress.timeSpentSeconds),
          last_position_seconds: Math.max(snapshot.last_position_seconds, Math.floor(progress.currentTime)),
        },
      };
    });

    if (shouldPersistCondition && conditionMetAt) {
      const unlockAt = getCountdownUnlockAt(nextStep, conditionMetAt);
      if (nextStep && unlockAt) {
        setCountdownUnlocks((previous) => ({ ...previous, [nextStep.id]: unlockAt }));
      }

      pendingConditionPersistRef.current[step.id] = true;
      void persistConditionMetAt(step, nextStep, progress, conditionMetAt)
        .then((unlockedImmediately) => {
          if (unlockedImmediately) {
            onStepComplete();
          }
        })
        .finally(() => {
          pendingConditionPersistRef.current[step.id] = false;
        });
    }
  }, [steps, getProgressSnapshot, onStepComplete, persistConditionMetAt]);

  const handleStepCompleted = useCallback(async (stepIndex: number) => {
    const step = steps[stepIndex];
    if (!step) return;

    const completedAt = new Date().toISOString();
    const currentProgress = getProgressSnapshot(step);
    const completedProgress: LocalStepProgress = {
      ...currentProgress,
      watch_percent: Math.max(currentProgress.watch_percent, 95),
      is_completed: true,
      condition_met_at: currentProgress.condition_met_at ?? completedAt,
    };

    setLocalProgress((previous) => ({
      ...previous,
      [step.id]: completedProgress,
    }));

    // Write completion to DB BEFORE invalidating queries so Home tab gets fresh data
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const nextStep = steps[stepIndex + 1] ?? null;
        const conditionMet = nextStep ? meetsUnlockCondition(nextStep, {
          watchedPercent: completedProgress.watch_percent,
          timeSpentSeconds: completedProgress.time_spent_seconds,
          isCompleted: true,
        }) : false;
        const unlocksImmediately = conditionMet && !getCountdownUnlockAt(nextStep, completedProgress.condition_met_at ?? completedAt);

        const ops: PromiseLike<unknown>[] = [
          supabase.from("funnel_step_progress").upsert(
            {
              funnel_id: funnel.id,
              funnel_step_id: step.id,
              session_id: authUser.id,
              watched_percentage: completedProgress.watch_percent,
              last_position_seconds: Math.floor(completedProgress.last_position_seconds),
              time_spent_seconds: completedProgress.time_spent_seconds,
              condition_met_at: completedProgress.condition_met_at,
              status: "completed",
              completed_at: completedAt,
              updated_at: completedAt,
            },
            { onConflict: "funnel_id,funnel_step_id,session_id", ignoreDuplicates: false }
          ),
        ];

        // Permanently unlock next step if condition met immediately
        if (nextStep && unlocksImmediately) {
          ops.push(
            supabase.from("funnel_step_progress").upsert(
              {
                funnel_id: funnel.id,
                funnel_step_id: nextStep.id,
                session_id: authUser.id,
                status: "unlocked",
                permanently_unlocked: true,
                condition_met_at: completedProgress.condition_met_at ?? completedAt,
                unlocked_at: completedAt,
                updated_at: completedAt,
              },
              { onConflict: "funnel_id,funnel_step_id,session_id", ignoreDuplicates: false }
            )
          );
        }

        await Promise.all(ops);
      }
    } catch {
      // Silently fail — local state is already updated, server will catch up
    }

    // Now invalidate queries so Home tab and Program tab get fresh server data
    onStepComplete();

    const nextStep = steps[stepIndex + 1];
    if (!nextStep) {
      // This was the last step — program complete!
      toast.success("🎉 Program Complete! You can rewatch any video anytime.", { duration: 5000 });
      return;
    }

    if (!meetsUnlockCondition(nextStep, {
      watchedPercent: completedProgress.watch_percent,
      timeSpentSeconds: completedProgress.time_spent_seconds,
      isCompleted: true,
    })) {
      return;
    }

    const nextUnlockAt = getCountdownUnlockAt(nextStep, completedProgress.condition_met_at ?? completedAt);
    if (nextUnlockAt) {
      setCountdownUnlocks((previous) => ({ ...previous, [nextStep.id]: nextUnlockAt }));
      setTimeout(() => setActiveStepIndex(stepIndex + 1), 900);
      return;
    }

    // Auto-advance to next step — use LOCAL knowledge that condition is met,
    // don't rely on server's is_locked which hasn't refreshed yet
    setTimeout(() => setActiveStepIndex(stepIndex + 1), 900);
  }, [steps, getProgressSnapshot, onStepComplete, funnel.id]);

  const completedSteps = stepStates.filter((state) => state.completed).length;
  const allComplete = steps.length > 0 && completedSteps === steps.length;

  const handleStepClick = (index: number) => {
    const step = steps[index];
    const state = stepStates[index];

    if (state?.completed) {
      setActiveStepIndex(index);
      return;
    }

    if (countdownUnlocks[step.id]) {
      setActiveStepIndex(index);
      return;
    }

    if (!isStepAccessible(index)) {
      toast.error("Complete the previous step first", { duration: 2000 });
      return;
    }

    setActiveStepIndex(index);
  };

  const handleCountdownComplete = useCallback(async (stepId: string) => {
    setCountdownUnlocks((prev) => {
      const n = { ...prev };
      delete n[stepId];
      return n;
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date().toISOString();

      await supabase.from("funnel_step_progress").upsert(
        {
          funnel_id: funnel.id,
          funnel_step_id: stepId,
          session_id: user.id,
          status: "unlocked",
          permanently_unlocked: true,
          unlocked_at: now,
          updated_at: now,
        },
        { onConflict: "funnel_id,funnel_step_id,session_id", ignoreDuplicates: false }
      );

      onStepComplete();
      toast.success("Step unlocked! 🎉");
    } catch {
      toast.error("Couldn't unlock the next step. Please refresh and try again.");
    }
  }, [funnel.id, onStepComplete]);

  const activeStep = steps[activeStepIndex];
  const activeProgress = activeStep ? getProgressSnapshot(activeStep) : null;
  const nextStep = activeStepIndex + 1 < steps.length ? steps[activeStepIndex + 1] : null;
  const activeState = stepStates[activeStepIndex];
  const activeCountdown = (activeStep?.is_locked && !activeState?.accessible) ? (countdownUnlocks[activeStep.id] ?? getServerCountdownAt(activeStep) ?? null) : null;
  const isTimerBlurActive = !!(activeCountdown && activeStep?.step_type === "video");

  const nextStepState = nextStep ? stepStates[activeStepIndex + 1] : null;
  const nextCountdownAt = nextStepState?.hasCountdown ? (countdownUnlocks[nextStep!.id] ?? getServerCountdownAt(nextStep) ?? null) : null;
  const nextStepUnlock = nextStep
    ? {
        unlocked: nextStepState?.accessible && !nextStepState?.hasCountdown,
        reason: nextCountdownAt ? "delay_countdown" : (nextStep.lock_reason ?? undefined),
        unlockAt: nextCountdownAt ?? undefined,
      }
    : null;
  const currentWatchPct = activeProgress?.watch_percent ?? 0;

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
        {/* Completion banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-5 text-center space-y-1"
        >
          <Trophy size={28} className="mx-auto text-primary" />
          <h2 className="text-lg font-bold text-foreground">Program Complete! 🎉</h2>
          <p className="text-xs text-muted-foreground">You can rewatch any video anytime.</p>
        </motion.div>

        {/* Progress bar */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{completedSteps} of {steps.length} steps completed</span>
            <span className="font-medium" style={{ color: "#22c55e" }}>100% ✨</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: "100%", background: "#22c55e" }} />
          </div>
        </div>

        {/* Step bar — all steps accessible */}
        <StepBar
          steps={steps}
          activeIndex={activeStepIndex}
          countdownUnlocks={countdownUnlocks}
          stepStates={stepStates}
          onStepClick={handleStepClick}
        />

        {/* Active step content — reuse normal rendering */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <div className="pb-2 border-b border-border/50">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Step {activeStepIndex + 1} of {steps.length}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1" style={{ color: "#D4AF37" }}>
                  <Check size={10} /> Completed
                </span>
              </div>
              <h2 className="text-lg font-bold text-foreground">{activeStep.title}</h2>
              {activeStep.description && (
                <p className="text-sm text-muted-foreground mt-1">{activeStep.description}</p>
              )}
            </div>

            {activeStep.step_type === "video" && activeStep.video_url ? (
              <VideoPlayer
                videoUrl={activeStep.video_url}
                stepTitle={activeStep.title}
                stepId={activeStep.id}
                funnelId={funnel.id}
                initialPosition={0}
                durationSeconds={activeStep.duration_seconds}
                initialTimeSpentSeconds={activeProgress?.time_spent_seconds ?? 0}
                completionThreshold={95}
                onProgress={(progress) => handleVideoProgress(activeStepIndex, progress)}
                onComplete={() => {}}
                onClose={() => {}}
                hideHeader
                autoPlayMuted
              />
            ) : null}

            <SpeakerCard funnel={funnel} step={activeStep} creatorProfile={creatorProfile} />
            <VideoTopics funnel={funnel} step={activeStep} />
          </motion.div>
        </AnimatePresence>
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
            <span className="font-medium">{Math.max(completionPct, steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.max(completionPct, steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0)}%` }}
          />
        </div>
      </div>

      {/* Full-width step bar */}
      <StepBar
        steps={steps}
        activeIndex={activeStepIndex}
        countdownUnlocks={countdownUnlocks}
        stepStates={stepStates}
        onStepClick={handleStepClick}
      />

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
              {activeProgress?.is_completed && (
                <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1" style={{ color: "#D4AF37" }}>
                  <Check size={10} /> Completed
                </span>
              )}
              {!activeProgress?.is_completed && currentWatchPct > 0 && !isTimerBlurActive && (
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
          ) : !isStepAccessible(activeStepIndex) && !activeProgress?.is_completed ? (
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
                  initialPosition={activeProgress?.is_completed ? 0 : (activeProgress?.last_position_seconds ?? 0)}
                  durationSeconds={activeStep.duration_seconds}
                  initialTimeSpentSeconds={activeProgress?.time_spent_seconds ?? 0}
                  completionThreshold={95}
                  onProgress={(progress) => handleVideoProgress(activeStepIndex, progress)}
                  onComplete={() => handleStepCompleted(activeStepIndex)}
                  onClose={() => {}}
                  hideHeader
                  autoPlayMuted
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
                  {activeProgress?.is_completed ? (
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
