import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Video, Lock, Clock, MessageSquare, Music, User, ListChecks, Plus, X } from "lucide-react";
import { getStepTypeMeta } from "./StepTypeSelector";
import { SpeakerPhotoUpload } from "./SpeakerPhotoUpload";

interface FlowStep {
  id?: string;
  step_order: number;
  title: string;
  description: string;
  step_type: string;
  video_asset_id: string | null;
  is_active: boolean;
  unlock_rule_type: string;
  unlock_rule_value: string;
  cta_text: string;
  cta_url: string;
  booking_url: string;
  unlock_timer_minutes?: number;
  between_step_audio_url?: string;
  between_step_audio_enabled?: boolean;
  between_step_message?: string;
  between_step_message_enabled?: boolean;
  unlock_after_percent?: number;
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
}

interface StepConfigPanelProps {
  open: boolean;
  onClose: () => void;
  step: FlowStep | null;
  stepIndex: number;
  onUpdate: (key: keyof FlowStep, value: any) => void;
  onOpenVideoPicker: () => void;
  totalSteps: number;
  speakerScope?: string;
  videoTopicsScope?: string;
  userProfile?: { full_name?: string; avatar_url?: string; bio?: string } | null;
}

const UNLOCK_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "auto", label: "Immediately", description: "Unlocks right away" },
  { value: "watch_complete", label: "After full video watch", description: "Previous video must be watched to 95%+" },
  { value: "watch_seconds", label: "After watching X seconds", description: "Specify how many seconds" },
  { value: "watch_percent", label: "After watching X percent", description: "Specify what percentage" },
  { value: "cta_click", label: "After CTA click", description: "Previous step's CTA must be clicked" },
  { value: "lead_submitted", label: "After form submitted", description: "Lead form must be filled out" },
  { value: "payment_submitted", label: "After payment submitted", description: "Payment proof must be submitted" },
  { value: "manual", label: "Manual unlock by you", description: "You decide when to unlock this step" },
  { value: "booking_done", label: "After booking completed", description: "Booking/call must be marked done" },
];

export const StepConfigPanel = ({ open, onClose, step, stepIndex, onUpdate, onOpenVideoPicker, totalSteps, speakerScope, videoTopicsScope, userProfile }: StepConfigPanelProps) => {
  if (!step) return null;
  const meta = getStepTypeMeta(step.step_type);

  const topics = step.video_topics_step || [];
  const addTopic = () => {
    if (topics.length < 10) onUpdate("video_topics_step" as keyof FlowStep, [...topics, { icon: "✅", text: "" }]);
  };
  const removeTopic = (i: number) => onUpdate("video_topics_step" as keyof FlowStep, topics.filter((_, idx) => idx !== i));
  const updateTopicText = (i: number, text: string) => onUpdate("video_topics_step" as keyof FlowStep, topics.map((t, idx) => idx === i ? { ...t, text: text.slice(0, 100) } : t));
  const waitPreviewMinutes = Math.max(1, step.time_delay_minutes || 30);
  const waitPreviewTotalSeconds = Math.max(59, waitPreviewMinutes * 60 - 1);
  const waitPreviewParts = [
    ...(waitPreviewTotalSeconds >= 3600
      ? [{ label: "hr", value: Math.floor(waitPreviewTotalSeconds / 3600) }]
      : []),
    { label: "min", value: Math.floor((waitPreviewTotalSeconds % 3600) / 60) },
    { label: "sec", value: waitPreviewTotalSeconds % 60 },
  ];
  const waitPreviewTitle = step.title?.trim() || `Step ${stepIndex + 1}`;
  const waitPreviewButtonText = step.timer_cta_text?.trim() || "Contact your mentor on WhatsApp →";

  const getTimerPreviewButtonStyle = (style?: string) => {
    if (style === "white") {
      return {
        background: "hsl(0 0% 100%)",
        color: "hsl(222 47% 11%)",
        border: "none",
      };
    }

    if (style === "outline") {
      return {
        background: "transparent",
        color: "hsl(0 0% 100%)",
        border: "1px solid hsl(0 0% 100% / 0.35)",
      };
    }

    return {
      background: "hsl(44 77% 47%)",
      color: "hsl(222 47% 11%)",
      border: "none",
    };
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-md bg-card border-border overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center`}>
              <meta.icon size={18} className={meta.color} />
            </div>
            <div>
              <SheetTitle className="font-heading text-base">Step {stepIndex + 1} · {meta.label}</SheetTitle>
              <SheetDescription className="text-xs">{meta.description}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5">
          <div>
            <Label className="text-sm font-medium">Step Title</Label>
            <Input
              value={step.title}
              onChange={(e) => onUpdate("title", e.target.value)}
              placeholder={`e.g. ${step.step_type === "video" ? "Watch the Intro" : step.step_type === "lead_form" ? "Enter Your Details" : step.step_type === "cta" ? "Visit Our Page" : step.step_type === "payment" ? "Complete Payment" : step.step_type === "booking" ? "Book Your Call" : "Awaiting Approval"}`}
              className="mt-1.5 bg-muted border-border"
            />
          </div>

          {step.step_type === "video" && (
            <>
              <div>
                <Label className="text-sm font-medium">Video</Label>
                {step.video_asset_id ? (
                  <div className="flex items-center gap-2 mt-1.5 p-3 rounded-lg bg-muted border border-border">
                    <Video size={16} className="text-primary shrink-0" />
                    <span className="text-sm text-foreground flex-1 truncate">Video selected ✓</span>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onOpenVideoPicker}>Change</Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="mt-1.5 w-full" onClick={onOpenVideoPicker}>
                    <Video size={14} /> Select Video
                  </Button>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea value={step.description} onChange={(e) => onUpdate("description", e.target.value)} placeholder="Brief description shown below the video..." className="mt-1.5 bg-muted border-border" rows={2} />
              </div>
            </>
          )}

          {step.step_type === "lead_form" && (
            <div>
              <Label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea value={step.description} onChange={(e) => onUpdate("description", e.target.value)} placeholder="Tell the viewer why to fill the form..." className="mt-1.5 bg-muted border-border" rows={2} />
              <p className="text-xs text-muted-foreground mt-2">Lead form fields are configured in your funnel's Lead Capture settings.</p>
            </div>
          )}
          {step.step_type === "cta" && (
            <>
              <div><Label className="text-sm font-medium">Button Text</Label><Input value={step.cta_text} onChange={(e) => onUpdate("cta_text", e.target.value)} placeholder="e.g. Visit Our Page" className="mt-1.5 bg-muted border-border" /></div>
              <div><Label className="text-sm font-medium">Destination URL</Label><Input value={step.cta_url} onChange={(e) => onUpdate("cta_url", e.target.value)} placeholder="https://..." className="mt-1.5 bg-muted border-border" /><p className="text-xs text-muted-foreground mt-1.5">Paste any URL</p></div>
              <div><Label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></Label><Textarea value={step.description} onChange={(e) => onUpdate("description", e.target.value)} placeholder="Why should they click?" className="mt-1.5 bg-muted border-border" rows={2} /></div>
            </>
          )}
          {step.step_type === "payment" && (
            <div><Label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></Label><Textarea value={step.description} onChange={(e) => onUpdate("description", e.target.value)} placeholder="Payment instructions..." className="mt-1.5 bg-muted border-border" rows={2} /><p className="text-xs text-muted-foreground mt-2">Payment details are in Payment settings.</p></div>
          )}
          {step.step_type === "booking" && (
            <>
              <div><Label className="text-sm font-medium">Booking Link</Label><Input value={step.booking_url} onChange={(e) => onUpdate("booking_url", e.target.value)} placeholder="Calendly, Zoom, etc." className="mt-1.5 bg-muted border-border" /></div>
              <div><Label className="text-sm font-medium">Button Text</Label><Input value={step.cta_text} onChange={(e) => onUpdate("cta_text", e.target.value)} placeholder="Book Your Call" className="mt-1.5 bg-muted border-border" /></div>
              <div><Label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></Label><Textarea value={step.description} onChange={(e) => onUpdate("description", e.target.value)} placeholder="What will this call be about?" className="mt-1.5 bg-muted border-border" rows={2} /></div>
            </>
          )}
          {step.step_type === "manual_approval" && (
            <div><Label className="text-sm font-medium">Internal Note</Label><Textarea value={step.description} onChange={(e) => onUpdate("description", e.target.value)} placeholder="e.g. Unlock after WhatsApp conversation..." className="mt-1.5 bg-muted border-border" rows={2} /><p className="text-xs text-muted-foreground mt-2">Viewer sees "Waiting for approval". Unlock from Lead Progress tab.</p></div>
          )}

          {stepIndex > 0 && (
            <div className="pt-4 border-t border-border space-y-4">
              <div>
                <Label className="text-sm font-medium flex items-center gap-1.5 mb-1">
                  <Lock size={12} className="text-muted-foreground" />
                  When does this step unlock?
                </Label>
                <p className="text-xs text-muted-foreground mb-3">Set how much of the previous step a viewer must complete.</p>
              </div>

              <div className="flex rounded-xl border border-border overflow-hidden">
                {(["full_watch", "percentage", "time_spent"] as const).map((cond) => (
                  <button
                    key={cond}
                    onClick={() => onUpdate("unlock_condition" as keyof FlowStep, cond)}
                    className={`flex-1 py-2 text-xs font-semibold transition-all ${
                      (step.unlock_condition || "full_watch") === cond
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {cond === "full_watch" ? "▶ Full Watch" : cond === "percentage" ? "% Percentage" : "⏱ Time Spent"}
                  </button>
                ))}
              </div>

              {(step.unlock_condition || "full_watch") === "full_watch" && (
                <p className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">Next step unlocks only after the previous video is watched completely (100%).</p>
              )}

              {(step.unlock_condition || "full_watch") === "percentage" && (
                <div className="space-y-2">
                  <Label className="text-xs">Unlock after watching __% of previous video</Label>
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={step.unlock_percentage ?? 80}
                    onChange={(e) => onUpdate("unlock_percentage" as keyof FlowStep, Math.min(99, Math.max(1, parseInt(e.target.value) || 80)))}
                    className="w-24 bg-muted border-border"
                  />
                  <p className="text-xs text-muted-foreground">Step {stepIndex + 1} unlocks when viewer watches {step.unlock_percentage ?? 80}% of Step {stepIndex}</p>
                </div>
              )}

              {(step.unlock_condition || "full_watch") === "time_spent" && (
                <div className="space-y-2">
                  <Label className="text-xs">Unlock after viewer spends __ minutes on previous step</Label>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={step.unlock_percentage ?? 10}
                    onChange={(e) => onUpdate("unlock_percentage" as keyof FlowStep, Math.min(999, Math.max(1, parseInt(e.target.value) || 10)))}
                    className="w-24 bg-muted border-border"
                  />
                  <p className="text-xs text-muted-foreground">Counts time the viewer has the step open, regardless of watch %</p>
                </div>
              )}

              <div className="space-y-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Clock size={12} className="text-muted-foreground" />
                      Add waiting period after unlock condition is met
                    </Label>
                  </div>
                  <Switch
                    checked={step.time_delay_enabled ?? false}
                    onCheckedChange={(v) => {
                      onUpdate("time_delay_enabled" as keyof FlowStep, v);
                      if (v && !(step.time_delay_minutes)) {
                        onUpdate("time_delay_minutes" as keyof FlowStep, 30);
                      }
                    }}
                  />
                </div>
                {step.time_delay_enabled && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Wait</span>
                      <Input
                        type="number"
                        min={1}
                        value={step.time_delay_minutes || 30}
                        onChange={(e) => onUpdate("time_delay_minutes" as keyof FlowStep, parseInt(e.target.value) || 30)}
                        className="w-20 bg-muted border-border"
                      />
                      <span className="text-xs text-muted-foreground">minutes before revealing this step</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Viewer will see a countdown timer. After the countdown ends, the step unlocks automatically.</p>

                    {/* Timer CTA */}
                    <div className="mt-3 pt-3 border-t border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-medium">Call to Action during wait</Label>
                          <p className="text-xs text-muted-foreground">Show a button while the viewer waits</p>
                        </div>
                        <Switch
                          checked={step.timer_cta_enabled ?? false}
                          onCheckedChange={(v) => onUpdate("timer_cta_enabled" as keyof FlowStep, v)}
                        />
                      </div>
                      {step.timer_cta_enabled && (
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs">Button Text</Label>
                            <Input
                              value={step.timer_cta_text || ""}
                              onChange={(e) => onUpdate("timer_cta_text" as keyof FlowStep, e.target.value)}
                              placeholder="e.g. Contact your mentor on WhatsApp →"
                              className="mt-1 bg-muted border-border"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Button URL</Label>
                            <Input
                              value={step.timer_cta_url || ""}
                              onChange={(e) => onUpdate("timer_cta_url" as keyof FlowStep, e.target.value)}
                              placeholder="https://wa.me/91..."
                              className="mt-1 bg-muted border-border"
                            />
                          </div>
                          <div>
                            <Label className="text-xs mb-1.5 block">Button Style</Label>
                            <div className="flex rounded-xl border border-border overflow-hidden">
                              {(["gold", "white", "outline"] as const).map((s) => (
                                <button
                                  key={s}
                                  onClick={() => onUpdate("timer_cta_style" as keyof FlowStep, s)}
                                  className={`flex-1 py-2 text-xs font-semibold transition-all ${
                                    (step.timer_cta_style || "gold") === s
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-4 rounded-2xl border border-border bg-card/60 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <Label className="text-sm font-medium">Viewer wait screen preview</Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              This is the countdown screen shown before this step unlocks.
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                            {waitPreviewMinutes} min wait
                          </span>
                        </div>

                        <div className="relative overflow-hidden rounded-2xl border border-border min-h-[240px] bg-gradient-to-br from-muted via-card to-background">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.18),_transparent_58%)]" />
                          <div className="absolute inset-0 bg-background/65 backdrop-blur-[3px]" />

                          <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4 px-4 py-8 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                              <Lock size={18} className="text-primary" />
                            </div>

                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">Upcoming</p>
                              <p className="mt-1 text-base font-semibold text-foreground">{waitPreviewTitle}</p>
                            </div>

                            <div className="flex items-start gap-2">
                              {waitPreviewParts.map((part, idx) => (
                                <div key={`${part.label}-${idx}`} className="flex items-start gap-2">
                                  <div className="text-center">
                                    <div className="min-w-[64px] rounded-xl border border-primary/20 bg-primary/10 px-3 py-2.5">
                                      <span className="text-2xl font-extrabold tabular-nums text-primary">
                                        {part.value.toString().padStart(2, "0")}
                                      </span>
                                    </div>
                                    <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                      {part.label}
                                    </span>
                                  </div>
                                  {idx < waitPreviewParts.length - 1 && (
                                    <span className="pt-3 text-xl font-bold text-primary/60">:</span>
                                  )}
                                </div>
                              ))}
                            </div>

                            <p className="max-w-[260px] text-[11px] leading-relaxed text-muted-foreground">
                              This step unlocks automatically when the waiting period ends.
                            </p>

                            {step.timer_cta_enabled ? (
                              <div
                                className="w-full max-w-[280px] rounded-xl px-4 py-3 text-sm font-semibold shadow-sm"
                                style={getTimerPreviewButtonStyle(step.timer_cta_style)}
                              >
                                {waitPreviewButtonText}
                              </div>
                            ) : (
                              <p className="text-[11px] text-muted-foreground">
                                Enable “Call to Action during wait” to show a button here.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-border">
                <Label className="text-xs text-muted-foreground mb-2 block">Legacy unlock rule</Label>
                <Select value={step.unlock_rule_type} onValueChange={(v) => onUpdate("unlock_rule_type", v)}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {UNLOCK_OPTIONS.map((r) => (<SelectItem key={r.value} value={r.value}><span>{r.label}</span></SelectItem>))}
                  </SelectContent>
                </Select>
                {(step.unlock_rule_type === "watch_seconds" || step.unlock_rule_type === "watch_percent") && (
                  <Input type="number" value={step.unlock_rule_value} onChange={(e) => onUpdate("unlock_rule_value", e.target.value)} placeholder={step.unlock_rule_type === "watch_seconds" ? "Number of seconds" : "Percentage (0–100)"} className="mt-2 bg-muted border-border" />
                )}
              </div>
            </div>
          )}

          {speakerScope === "per_step" && (
            <div className="pt-4 border-t border-border space-y-4">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <User size={12} className="text-muted-foreground" />
                Speaker for this step
              </Label>
              <div className="flex rounded-xl border border-border overflow-hidden">
                {(["none", "account", "custom"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => onUpdate("speaker_mode_step" as keyof FlowStep, mode)}
                    className={`flex-1 py-2 text-xs font-semibold transition-all ${
                      (step.speaker_mode_step || "none") === mode
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode === "none" ? "None" : mode === "account" ? "Account" : "Custom"}
                  </button>
                ))}
              </div>
              {(step.speaker_mode_step || "none") === "none" && (
                <p className="text-xs text-muted-foreground">No speaker shown for this step.</p>
              )}
              {(step.speaker_mode_step || "none") === "account" && userProfile && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center overflow-hidden shrink-0">
                    {userProfile.avatar_url ? <img src={userProfile.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-primary font-bold text-xs">{userProfile.full_name?.charAt(0)?.toUpperCase() || "?"}</span>}
                  </div>
                  <div><p className="font-bold text-sm">{userProfile.full_name || "Your Name"}</p></div>
                </div>
              )}
              {(step.speaker_mode_step || "none") === "custom" && (
                <div className="space-y-3">
                  <SpeakerPhotoUpload value={step.speaker_photo_url_custom || ""} onChange={(url) => onUpdate("speaker_photo_url_custom" as keyof FlowStep, url)} />
                  <div><Label className="text-xs">Speaker Name</Label><Input value={step.speaker_name_custom || ""} onChange={(e) => onUpdate("speaker_name_custom" as keyof FlowStep, e.target.value.slice(0, 60))} placeholder="e.g. John Doe" className="mt-1 bg-muted border-border" maxLength={60} /></div>
                  <div><Label className="text-xs">Speaker Title</Label><Input value={step.speaker_title || ""} onChange={(e) => onUpdate("speaker_title" as keyof FlowStep, e.target.value.slice(0, 60))} placeholder="e.g. Founder & Coach" className="mt-1 bg-muted border-border" maxLength={60} /></div>
                  <div><Label className="text-xs">Bio</Label><Textarea value={step.speaker_bio || ""} onChange={(e) => onUpdate("speaker_bio" as keyof FlowStep, e.target.value.slice(0, 200))} placeholder="Short bio..." className="mt-1 bg-muted border-border" rows={2} maxLength={200} /></div>
                </div>
              )}
            </div>
          )}
          {speakerScope === "global" && stepIndex > 0 && (
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><User size={12} /> This funnel uses one speaker for all steps. Change in Speaker tab.</p>
            </div>
          )}

          {videoTopicsScope === "per_step" && (
            <div className="pt-4 border-t border-border space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <ListChecks size={12} className="text-muted-foreground" />
                  Key points for this step
                </Label>
                <Switch
                  checked={step.video_topics_step_enabled ?? false}
                  onCheckedChange={(v) => onUpdate("video_topics_step_enabled" as keyof FlowStep, v)}
                />
              </div>
              {step.video_topics_step_enabled && (
                <div className="space-y-2">
                  {topics.map((topic, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={topic.text}
                        onChange={(e) => updateTopicText(idx, e.target.value)}
                        placeholder="Enter a topic..."
                        className="flex-1 bg-muted border-border text-sm"
                        maxLength={100}
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeTopic(idx)}>
                        <X size={12} />
                      </Button>
                    </div>
                  ))}
                  {topics.length < 10 && (
                    <Button variant="outline" size="sm" className="w-full" onClick={addTopic}>
                      <Plus size={12} /> Add Topic
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {stepIndex < totalSteps - 1 && (
            <div className="pt-4 border-t border-border space-y-4">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Clock size={12} className="text-muted-foreground" />
                After Completing This Step
              </Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-1.5"><Music size={12} className="text-muted-foreground" /> Audio Note (between steps)</Label>
                  <Switch checked={step.between_step_audio_enabled || false} onCheckedChange={(v) => onUpdate("between_step_audio_enabled" as keyof FlowStep, v)} />
                </div>
                {step.between_step_audio_enabled && (
                  <Input value={step.between_step_audio_url || ""} onChange={(e) => onUpdate("between_step_audio_url" as keyof FlowStep, e.target.value)} placeholder="Audio file URL (MP3, M4A)" className="bg-muted border-border" />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-1.5"><MessageSquare size={12} className="text-muted-foreground" /> Text Message (between steps)</Label>
                  <Switch checked={step.between_step_message_enabled || false} onCheckedChange={(v) => onUpdate("between_step_message_enabled" as keyof FlowStep, v)} />
                </div>
                {step.between_step_message_enabled && (
                  <Textarea value={step.between_step_message || ""} onChange={(e) => onUpdate("between_step_message" as keyof FlowStep, e.target.value)} placeholder="Message shown while waiting..." className="bg-muted border-border" rows={3} />
                )}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Step Active</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Inactive steps are hidden from viewers</p>
              </div>
              <Switch checked={step.is_active} onCheckedChange={(v) => onUpdate("is_active", v)} />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
